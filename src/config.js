// Copyright 2011-2013 Mozilla Foundation.
//
// Licensed under the Apache License, Version 2.0
// <LICENSE.txt or http://www.apache.org/licenses/LICENSE-2.0>
// This file may not be copied, modified, or distributed
// except according to those terms.

(function() {
"use strict";

// Since this is the bottom of the dependency tree and sjcl
// incorrectly initializes its PRNG on node.js, we do it
// again here.
var sjcl = require('sjcl');
if (typeof module !== 'undefined' && module.exports) {
    // get entropy for node.js
    var crypt = require('crypto');
    var buf = crypt.randomBytes(1024/8).toString('utf8');
    sjcl.random.addEntropy(buf, 1024, "crypto.randomBytes");
}

// Actual purpose of this module: to set config parameters
// used across the stxt library.

module.exports = {

    mpdh_key_type: "c25519",

    hash_type: "sha256",

    msg_len: 256,
    group_sz: 16,

    ae_cipher_type: "aes",
    ae_cipher_len: 128,
    ae_cipher_mode: "gcm",
    ae_tag_len: 64,

    kdf: "pbkdf2",
    kdf_iter: 1000,

    tracebuf_len: 1024
    
};

})();
