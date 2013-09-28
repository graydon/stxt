// Copyright 2011-2013 Mozilla Foundation.
//
// Licensed under the Apache License, Version 2.0
// <LICENSE.txt or http://www.apache.org/licenses/LICENSE-2.0>
// This file may not be copied, modified, or distributed
// except according to those terms.

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
