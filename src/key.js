// Copyright 2011-2013 Mozilla Foundation.
//
// Licensed under the Apache License, Version 2.0
// <LICENSE.txt or http://www.apache.org/licenses/LICENSE-2.0>
// This file may not be copied, modified, or distributed
// except according to those terms.

/* We're trying to do a key agreement between multiple parties.
 *
 * G = the base point on the curve, generating the group
 * n = order of the group
 *
 * A private key is a random integer d in [1,n-1], though to avoid
 * a variety of attacks it's clamped to a slightly smaller range.
 *
 * A public key is Q = dG, a group element.
 *
 * The private key is private because it's the discrete log of the public
 * key.
 *
 * Normal DH key exchange is done by Alice publishing dG, Bob publishing
 * eG, and then deG == edG being used by both as the shared secret on both
 * sides, thus fed into a KDF (say) for use in a symmetric cipher.
 *
 * Multiparty DH key exchange is a generalization of this:
 *
 * - Establish a size k of the party doing the exchange.
 *
 * - Each person picks a random keypair.
 *
 * - Each person publishes their pubkey. "Pubkey" is a bit of a misnomer
 *   here, for purposes of this algorithm it's more useful to think of it
 *   as the "1-secret exchange-key including priv_i"
 *
 * - Each person takes every J-secret exchange-key and, so long as J < k-2,
 *   and the key doesn't contain their priv_i yet, multiplies it by their
 *   private key and re-publishes _that_ as the J+1-secret exchange key
 *   including whatever it had before, as well as priv_i.
 *
 * - This flooding-keys-into-the-mix behavior continues until every subset
 *   of keys of size < k-1 has been published.
 *
 * - Every person then looks for the exchange key that contains
 *   all-but-their-own private key.
 *
 * - They multiply that, in private, with their private key. That's the
 *   final secret.
 */

(function() {
"use strict";

var sjcl = require('sjcl');
var curve25519 = require('./curve25519.js');

var Assert = require('./assert.js');
var Config = require('./config.js');
var Fmt = require('./fmt.js');
var Hash = require('./hash.js');
var Trace = require('./trace.js');

var Key = {};

var log = Trace.mkLog("key");

if (Config.mpdh_key_type === "c25519") {

    Key.to_str = function(bits255) {
        // bits255 is the curve25519 representation of bits
        // (16bit number arrays).
        Assert.isArray(bits255);
        return curve25519.to_hex(bits255);
    };

    Key.from_bits = function(bits) {
        // bits is the sjcl representation of bits
        // (32bit number arrays).
        Assert.isArray(bits);
        var hex = sjcl.codec.hex.fromBits(bits);
        return curve25519.from_hex(hex);
    };

    Key.from_str = function(str) {
        Assert.isString(str);
        return curve25519.from_hex(str);
    };

    Key.mult = function(sec, pub) {
        var sec255 = Key.from_str(sec);
        var pub255 = Key.from_str(pub);
        return Key.to_str(curve25519.crypto_scalarmult(sec255, pub255));
    };

    Key.genpair = function() {
        // We use sjcl's fortuna for random number generation
        // but change it to c25519's representation via hex interchange.
        //
        // An sjcl 'word' is 32 bits = 4 bytes.
        // A c25519 key is 32 bytes = 8 words.

        var secbits = sjcl.random.randomWords(8);

        // Clamp the random bytes into a secret key, as per djb rule.
        var secbytes = sjcl.codec.bytes.fromBits(secbits);
        secbytes[0] &= 248;
        secbytes[31] &= 127;
        secbytes[31] |= 64;
        secbits = sjcl.codec.bytes.toBits(secbytes);
        var sec = sjcl.codec.hex.fromBits(secbits);

        Assert.equal(Fmt.len(sec), 64);

        // Basepoint for curve25519: 9.
        var basepoint = ("09000000000000000000000000000000" +
                         "00000000000000000000000000000000");
        var pub = Key.mult(sec, basepoint);

        log("generated {} keypair, pub={:id}", Config.mpdh_key_type, pub);
        return {sec: sec, pub: pub};
    };

} else {

    Assert.ok(Config.mpdh_key_type in sjcl.ecc.curves,
              "unknown keytype: " + Config.mpdh_key_type);

    Key.mult = function(sec,pub) {
        var secbits = sjcl.codec.hex.toBits(sec);
        var pubbits = sjcl.codec.hex.toBits(pub);
        var curve = sjcl.ecc.curves[Config.mpdh_key_type];
        var point = new sjcl.ecc.elGamal.publicKey(curve, pubbits);
        var exp = new sjcl.ecc.elGamal.privateKey(curve, secbits);
        var n = point.mult(exp);
        return sjcl.codec.hex.fromBits(n.L.toBits());
    };

    Key.genpair = function() {
        var curve = sjcl.ecc.curves[Config.mpdh_key_type];
        var pair = sjcl.ecc.elGamal.generateKeys(curve);
        var sec = sjcl.codec.hex.fromBits(pair.sec.J.toBits());
        var pub = sjcl.codec.hex.fromBits(pair.pub.L.toBits());
        log("generated {} keypair, pub={:id}", Config.mpdh_key_type, pub);
        return {sec: sec, pub: pub};
    };
}

/**
 * Construct an exchange-Key, which is a (public) group element from the
 * group we're doing multiparty DH negotiation in, and represents the
 * cumulative scalar multiplication of some number of private-key-parts
 * by some subset of the users in the group.
 *
 * An exchange-key is either unfinished or finished. It's finished when it
 * lacks private key material from exactly one of its users: the "final"
 * user who will contribute a final secret scalar and derive (by hashing
 * the resulting group element) a shared-secret key. An exchange key is
 * unfinished when it has any smaller subset of users. An exchange key must
 * never have the full set of users; it should stop at one-user-missing, in
 * order to indicate _which_ user should perform the final derivation using
 * it.
 *
 * A 1-user group has a degenerate definition of "finished": it is finished
 * when it's started, and final derivation just hashes the provided secret.
 *
 * @param {Array} live_users  List of user tags of users who are live
 *                            in this group. Calculated from State.
 *
 * @param {String} name       Name of the key, which should be a hash of the
 *                            sorted live user list, followed by a colon
 *                            and a number, which is a bitset indicating
 *                            which users have contributed to this exchange
 *                            key, 1 for contributed, 0 for not. User bit
 *                            number corresponds to position in sorted
 *                            order of live_users.
 *
 * @param {String} pub        A public key (group element) of the DH
 *                            group we're negotiating in.
 *
 * @return an instance of Key.Exch, or null if the name of the key does not
 *         represent the hash of the provided live_users list (that is, if
 *         the exchange must be restarted because the user list changed mid
 *         way through rotation).
 */
Key.Exch = function(live_users, name, pub) {

    Assert.isArray(live_users);
    Assert.ok(live_users.length > 0);
    Assert.ok(live_users.length <= Config.group_sz);
    live_users.forEach(function(u) {
        // We should be called with a list of strings
        // from tag.toString() calls, not tags themselves.
        // At least for now.
        Assert.isString(u);
    });
    live_users.sort();

    Assert.isString(name);
    Assert.match(name, /^[a-fA-F0-9]+:[a-fA-F0-9]+$/);

    Assert.isString(pub);
    Assert.match(pub, /^[a-fA-F0-9]+$/);

    var parts = name.split(":");
    Assert.equal(parts.length, 2);

    var hash = parts[0];
    Assert.equal(Hash.hash(live_users), hash);

    var bits = parseInt(parts[1], 16);
    Assert.ok(Number.isFinite(bits));
    Assert.isNumber(bits);
    Assert.ok(bits >= 0);
    var full_mask = ((1 << live_users.length) - 1);
    Assert.ok(bits <= full_mask);
    if (bits === full_mask) {
        // Degenerate case: an exch-key that is built
        // for a 1-user group is finished when it's
        // started.
        Assert.equal(bits, 1);
    }

    this.live_users = live_users;
    this.hash = hash;
    this.bits = bits;
    this.pub = pub;
    Object.freeze(this);
    return this;
};

Key.Exch.name_valid_for_live_users = function(name, live_users) {
    Assert.isString(name);
    var parts = name.split(":");
    Assert.equal(parts.length, 2);

    Assert.isArray(live_users);
    live_users.sort();
    var hash = Hash.hash(live_users);

    if (hash !== parts[0]) {
        log("exchange key {} doesn't describe " +
            "live-user set {}, should start with {:id}, " +
            "discarding",
            name, live_users, hash);
        return false;
    } else {
        return true;
    }
};

Key.Exch.initial_name = function(live_users, user) {
    Assert.isArray(live_users);
    Assert.isString(user);
    Assert.ok(live_users.length <= Config.group_sz);
    live_users.sort();
    log("calculating initial exchange-key name for {} in {}",
        user, live_users);
    var i = live_users.indexOf(user);
    Assert.ok(i !== -1);
    Assert.ok(i < live_users.length);
    return Hash.hash(live_users) + ":" + (1 << i).toString(16);
};

Key.Exch.prototype = {

    /**
     * Check to see if `this` exchange key contains a private
     * scalar (private key) contribution from a given user.
     *
     * @param {String} user   The user to check for.
     * @return {boolean}      True if the user is present
     *                        in `this`, else false.
     */
    has_user: function(user) {
        Assert.instanceOf(this, Key.Exch);
        Assert.isString(user);
        var i = this.live_users.indexOf(user);
        if (i === -1) {
            return false;
        }
        return ((1 << i) & this.bits) !== 0;
    },

    has_only_user: function(user) {
        Assert.instanceOf(this, Key.Exch);
        Assert.isString(user);
        var i = this.live_users.indexOf(user);
        if (i === -1) {
            return false;
        }
        return ((1 << i) === this.bits);
    },

    /**
     * Check if the exchange key contains scalar (private) keys from
     * all-but-one of the live users.
     *
     * @return {boolean}   True if the key is either from a single-user
     *                     group, or is from a multi-user group and lacks
     *                     exactly one user's private scalar; false
     *                     otherwise.
     */
    is_finished: function() {
        Assert.instanceOf(this, Key.Exch);
        if (this.live_users.length === 1) {
            Assert.ok(this.bits === 1);
            return true;
        }
        var n_zeroes = 0;
        for (var i = 0; i < this.live_users.length; ++i) {
            if (((1 << i) & this.bits) === 0) {
                n_zeroes++;
            }
        }
        Assert.ok(n_zeroes > 0);
        return n_zeroes === 1;
    },
    needs_user: function(user) {
        return !(this.is_finished() || this.has_user(user));
    },
    extend_with_user: function(user, sec) {
        Assert.notOk(this.is_finished());
        return new Key.Exch(this.live_users,
                            this.extended_name(user),
                            Key.mult(sec, this.pub));
    },
    derive_final: function(sec) {
        Assert.ok(this.is_finished());
        if (this.live_users.length === 1) {
            return Hash.hash(sec);
        } else {
            return Hash.hash(Key.mult(sec, this.pub));
        }
    },
    extended_name: function(user) {
        Assert.instanceOf(this, Key.Exch);
        Assert.isString(user);
        Assert.notOk(this.is_finished());
        var i = this.live_users.indexOf(user);
        Assert.ok(i !== -1);
        Assert.ok(i < this.live_users);
        Assert.ok(((1 << i) & this.bits) === 0);
        return this.hash + ":" + (this.bits | (1 << 1)).toString(16);
    },
    name: function() {
        Assert.instanceOf(this, Key.Exch);
        return this.hash + ":" + this.bits.toString(16);
    }
};

module.exports = Key;
})();
