"use strict";
if (typeof define !== 'function') { var define = require('amdefine')(module) }
define(["stxt/stxt", "sjcl", "curve25519"],
function(Stxt, sjcl, curve25519) {

    var Enc = {};

    Enc.b32_bin2str = function(bits) {
        var hex = sjcl.codec.hex.fromBits(bits);
        var bits255 = curve25519.c255lhexdecode(hex);
        return curve25519.c255lbase32encode(bits255);
    }

    Enc.b32_str2bin = function(str) {
        var bits255 = curve25519.c255lbase32decode(str)
        var hex = curve25519.c255lhexencode(bits255);
        return sjcl.codec.hex.toBits(hex);
    }

    if (Stxt.enctype == "base32") {

        Enc.bin2str = Enc.b32_bin2str;
        Enc.str2bin = Enc.b32_str2bin;


    } else {

        Stxt.assert(Stxt.enctype in sjcl.codec,
                    "unknown enctype: " + Stxt.enctype);

        Enc.bin2str = function(bits) {
            return sjcl.codec[Stxt.enctype].fromBits(bits);
        }

        Enc.str2bin = function(str) {
            return sjcl.codec[Stxt.enctype].toBits(str);
        }
    }
    Stxt.Enc = Enc;
    return Enc;
});
