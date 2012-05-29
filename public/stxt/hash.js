"use strict";
if (typeof define !== 'function') { var define = require('amdefine')(module) }
define(["stxt/stxt", "stxt/enc", "sjcl"],
function(Stxt, Enc, sjcl) {

    var Hash = {};
    Hash.hash = function(obj) {
        Stxt.assert(Stxt.hashtype in sjcl.hash,
                    "unknown hash: " + Stxt.hashtype);
        var str = JSON.stringify(obj);
        var h = sjcl.hash[Stxt.hashtype].hash(str);
        return Enc.bin2str(h);
    };

    Hash.random = function() {
        return Hash.hash(sjcl.random.randomWords(8));
    };

    Hash.hmac = function(key, obj) {
        Stxt.assert(Stxt.hashtype in sjcl.hash,
                    "unknown hash: " + Stxt.hashtype);
        var str = JSON.stringify(obj);
        var hmac = new sjcl.misc.hmac(key, sjcl.hash[Stxt.hashtype]);
        var h = hmac.mac(str);
        return Enc.bin2str(h);
    };

    Stxt.Hash = Hash;
    return Hash;
});
