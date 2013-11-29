// Copyright 2011-2013 Mozilla Foundation.
//
// Licensed under the Apache License, Version 2.0
// <LICENSE.txt or http://www.apache.org/licenses/LICENSE-2.0>
// This file may not be copied, modified, or distributed
// except according to those terms.

// Messages and groups are "tagged" in stxt with a particular
// identity. This is not in any way integral to data structures; the groups
// all run off keys. A tag is a _claim_ to authorship or identity, that you
// may or may not trust the contents of by comparing and verifying with
// other parties.

(function() {
"use strict";

var Fmt = require('./fmt.js');
var Trace = require('./trace.js');
var Assert = require('./assert.js');
var Uletter = require('./uletter.js');
var Config = require('./config.js');

var sjcl = require('sjcl');

// A tag is composed of a kind, a nick and guid. The kind is either 'u' or
// 'g' (for 'user' or 'group'; or some other entity, if we ever support
// more).  Nick is for human consumption, the guid is for _accidental_
// collision avoidance; it does nothing to prevent intentional collision
// (indeed, you can just use someone else's nick if you want; it'll be
// noticed, but only when there's a higher-level trust mismatch).
//
// There are restrictions on these components:
//
//   - The nick can only be drawn from the unicode "letter" class and must
//     be <= 20 characters (or, in js busted-unicode-land here, <= 20 UCS2
//     code units).
//
//   - The GUID is 10 base32 digits (~50 bits), where 40 of the bits are
//     chosen at random and then the remaining 10 are spread through the
//     GUID by securely hashing the nick-and-first-40 and then taking
//     successive nybbles out of that 40 bits, shifting the next hash bit
//     into the low bit of a 5-bit code unit, and right-rotating N%5.
//
// This weird construction is to keep people from picking vanity GUIDs, as
// well as to give you a quick check whether someone just made up a GUID or
// (at least) related a properly-generated one. In theory you can still do
// a brute force search for interesting vanity GUIDs (goodness knows if
// there are any valid ones that count as such) but it seems less likely
// that most people would bother; most semantically pleasing
// 10-letter-strings in base32 are going to be invalid.

var b32 = "a-z2-7";
var all_hex = "0123456789abcdef";
var all_b32 = "abcdefghijklmnopqrstuvwxyz234567";
var anti_b32 = {"a":0, "b":1, "c":2, "d":3, "e":4, "f":5, "g":6, "h":7,
                "i":8, "j":9, "k":10, "l":11, "m":12, "n":13, "o":14,
                "p":15, "q":16, "r":17, "s":18, "t":19, "u":20, "v":21,
                "w":22, "x":23, "y":24, "z":25, "2":26, "3":27, "4":28,
                "5":29, "6":30, "7":31 };

var nick_re_str = "[" + Uletter + "]{1,20}";
var nick_re = new RegExp("^" + nick_re_str + "$");

var guid_re_str = "[" + b32 + "]{5}-[" + b32 + "]{5}";
var guid_re = new RegExp("^" + guid_re_str + "$");

var tag_re_str = "([ug])-(" + nick_re_str + ")-(" + guid_re_str + ")";
var tag_re = new RegExp("^" + tag_re_str + "$");

var log = Trace.mkLog("tag");

function expand_to_guid(kind, nick, bits40) {
    Assert.ok(kind === 'u' || kind === 'g', "unknown tag kind");
    Assert.ok(nick_re.exec(nick));
    Assert.equal(sjcl.bitArray.bitLength(bits40), 40);
    var s = kind + "-" + nick;
    var spre = s + "-" + sjcl.codec.hex.fromBits(bits40);
    var hashbits = sjcl.hash[Config.hash_type].hash(spre);
    var lowten = sjcl.bitArray.bitSlice(hashbits, 0, 10);
    var guid = "";
    for (var i = 0; i < 10; ++i) {
        var nybble = sjcl.bitArray.extract(bits40, i*4, 4);
        Assert.ok(0 <= nybble &&
                  nybble <= 0xf);
        log("form nybble {}: 0b{:bin} = 0x{:hex}",
            i, nybble, nybble);
        nybble <<= 1;
        nybble |= (lowten & 1);
        var n = i%5;
        var rotated = (((nybble << (5-n)) & 0x1f) |
                       (nybble >> n));
        Assert.ok(0 <= rotated &&
                    rotated <= 0x1f);
        Assert.ok(rotated <= all_b32.length);
        guid += all_b32[rotated];
    }
    return guid;
}

function check_tag_kind(k) {
    Assert.ok(k === 'u' || k === 'g', "unknown tag kind");
}

function make_guid(kind, nick) {
    check_tag_kind(kind);
    Assert.match(nick, nick_re);
    // An sjcl word is 32 bits. We want
    // 40 bits, so we ask for two words.
    var pre = sjcl.random.randomWords(2);
    var bits40 = sjcl.bitArray.bitSlice(pre, 0, 40);
    var guid = expand_to_guid(kind, nick, bits40);
    Assert.equal(guid.length, 10);
    guid = guid.substr(0,5) + "-" + guid.substr(5, 10);
    Assert.match(guid, guid_re);
    return guid;
}

function check_guid(kind, nick, guid) {
    Assert.match(guid, guid_re);
    guid = guid.replace("-","");
    Assert.equal(guid.length, 10);
    var hex = "";
    for (var i = 0; i < 10; ++i) {
        var b = guid[i];
        Assert.ok(b in anti_b32);
        b = anti_b32[b];
        var n = i%5;
        var unrotated = (((b << n) & 0x1f) |
                         (b >> (5-n)));
        var nybble = unrotated >> 1;
        Assert.ok(0 <= nybble &&
                  nybble <= 0xf);
        log("check nybble {}: 0b{:bin} = 0x{:hex}",
            i, nybble, nybble);
        hex += all_hex[nybble];
    }

    log("hex nybbles: {} ", hex);
    Assert.equal(hex.length, 10);
    var bits40 = sjcl.codec.hex.toBits(hex);
    Assert.equal(sjcl.bitArray.bitLength(bits40), 40);
    var guid2 = expand_to_guid(kind, nick, bits40);
    Assert.equal(guid, guid2,
                 Fmt.fmt("check_guid: mismatch {} vs {}",
                         guid, guid2));
}

var Tag = function(kind, nick, guid) {
    Assert.typeOf(kind, "string");
    Assert.typeOf(nick, "string");
    Assert.ok(kind === "u" || kind === "g", "unknown tag kind");
    if (guid) {
        check_guid(kind, nick, guid);
    } else {
        guid = make_guid(kind, nick);
    }
    Assert.typeOf(guid, "string");
    this.kind = kind;
    this.nick = nick;
    this.guid = guid;
    Object.freeze(this);
};

Tag.prototype = {
    toString: function() {
        return this.kind + "-" + this.nick + "-" + this.guid;
    },
};

Tag.parse = function(s) {
    Assert.match(s, tag_re);
    var matches = tag_re.exec(s);
    return new Tag(matches[1], matches[2], matches[3]);
};

Tag.new_user = function(nick) {
    return new Tag('u', nick, make_guid('u', nick));
};

Tag.new_group = function(nick) {
    return new Tag('g', nick, make_guid('g', nick));
};

module.exports = Tag;

})();
