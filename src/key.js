// Copyright 2011-2013 Mozilla Foundation.
//
// Licensed under the Apache License, Version 2.0
// <LICENSE.txt or http://www.apache.org/licenses/LICENSE-2.0>
// This file may not be copied, modified, or distributed
// except according to those terms.

/* We're trying to do a key agreement between multiple parties.
 *
 * Domain parameters:
 *
 * p = prime
 * a, b = constants defining the curve
 * G = the base point on the curve, generating the group
 * n = order of the group
 * h = cofactor
 *
 * A private key is a random integer d in [1,n-1].
 * A public key is Q = dG, a group element.
 *
 * The private key is private because it's the discrete log of the public
 * key.
 *
 * When dealing with the sjcl.ecc library, public-key parts (anything
 * that's been multiplied by G) are of type 'point' and private keys are of
 * type 'bn' (bignum). So it's pretty easy to tell what you're working
 * with.
 *
 * Multiparty DH key agreement is pretty simple:
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
        // an sjcl 'word' is 32-bits = 4 bytes.
        // a c25519 key is 32 bytes = 8 words.

        var secbits = sjcl.random.randomWords(8);

        // Clamp the random bytes into a secret key, as per djb rule.
        var secbytes = sjcl.codec.bytes.fromBits(secbits);
        secbytes[0] &= 248;
        secbytes[31] &= 127;
        secbytes[31] |= 64;
        secbits = sjcl.codec.bytes.toBits(secbytes);
        var sec = sjcl.codec.hex.fromBits(secbits);

        Assert.equal(Fmt.len(sec), 64);

        // basepoint for curve25519: 9
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

// An exch-key is one that represents work-in-progress in a multi-party
// DH key-exchange. As such, it has a public value (which is something
// we can .mult(sec) with some secret value) as well as a list of users
// whose secret-parts have been included (multiplied) into the key and
// a party_size indicating how many users are involved in the exchange,
// in total. When the user list gets to party_size - 1 and the current
// user is the one missing from the list, the exchange is done.
//
// FIXME: the use of a 'party size' here is wrong; the exch needs to be
// pinned to a target tag set when it is constructed and check
// completeness based on the presence/absence of each tag in the target
// tag set.

Key.Exch = function(party_size, users, pub) {
    this.party_size = party_size;
    users.forEach(function(u) {
        // We should be called with a list of strings
        // from tag.toString() calls, not tags themselves.
        // At least for now; possibly this should change.
        Assert.isString(u);
    });
    this.users = users;
    this.pub = pub;
    this.users.sort();
};

Key.Exch.prototype = {
    has_user: function(user) {
        return this.users.indexOf(user) !== -1;
    },
    is_finished: function() {
        return (this.users.length >= this.party_size - 1);
    },
    needs_user: function(user) {
        return !(this.is_finished() || this.has_user(user));
    },
    extend_with_user: function(user, sec) {
        return new Key.Exch(this.party_size,
                            this.users.concat(user).sort(),
                            Key.mult(sec, this.pub));
    },
    derive_final: function(sec) {
        Assert.ok(this.is_finished());
        return Hash.hash(Key.mult(sec, this.pub));
    },
    extended_name: function(user) {
        return this.users.concat(user).sort().join(",");
    },
    name: function() {
        return this.users.sort().join(",");
    }
};

module.exports = Key;
})();
