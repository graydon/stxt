// Copyright 2011-2013 Mozilla Foundation.
//
// Licensed under the Apache License, Version 2.0
// <LICENSE.txt or http://www.apache.org/licenses/LICENSE-2.0>
// This file may not be copied, modified, or distributed
// except according to those terms.

(function() {
"use strict";

var Config = require('./config.js');
var Assert = require('./assert.js');

var sjcl = require('sjcl');

var Hash = {};

Hash.hash = function(obj) {
    Assert.ok(Config.hash_type in sjcl.hash,
              "unknown hash: " + Config.hash_type);
    var str = JSON.stringify(obj);
    var h = sjcl.hash[Config.hash_type].hash(str);
    return sjcl.codec.hex.fromBits(h);
};

Hash.random = function() {
    return Hash.hash(sjcl.random.randomWords(8));
};

Hash.hmac = function(key, obj) {
    Assert.typeOf(key, 'string');
    Assert.ok(Config.hash_type in sjcl.hash,
              "unknown hash: " + Config.hash_type);
    var str = JSON.stringify(obj);
    key = sjcl.codec.utf8String.toBits(key);
    var hmac = new sjcl.misc.hmac(key, sjcl.hash[Config.hash_type]);
    var h = hmac.mac(str);
    return sjcl.codec.hex.fromBits(h);
};

module.exports = Hash;

})();
