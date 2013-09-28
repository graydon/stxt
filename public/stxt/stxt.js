// Copyright 2011-2013 Mozilla Foundation.
//
// Licensed under the Apache License, Version 2.0
// <LICENSE.txt or http://www.apache.org/licenses/LICENSE-2.0>
// This file may not be copied, modified, or distributed
// except according to those terms.

if (typeof define !== 'function') { var define = require('amdefine')(module) }
define(['fomatto'],
function(fomatto) {

function abbrev(x) {
    if (x.length > 8) {
        return x.substr(0, 8);
    }
    return x;
}

function len(x) {
    if (x.hasOwnProperty("length")) {
        return x.length;
    } else {
        return Object.keys(x).length
    }
}

var format =
    fomatto.Formatter({ id: abbrev,
                        short: abbrev,
                        len: len
                      });

var logBits = {
    agent: true,
    gc: false,
    graph: false,
    http: true,
    jsonrpc: true,
    key: false,
    keyrot: false,
    msg: false,
    peer: true,
    server: true,
    sync: false,
    tag: false,
    test: true,
    visit: false,
    web: true
};

var mkLog = function(bit) {
    return (function() {
        if (bit in logBits &&
            logBits[bit]) {
            Stxt.log(bit + ": " +
                     format.apply(format, arguments));
        }
    });
};

var Stxt = {

    // Cross-project utilities.

    format: format,

    abbrev: abbrev,

    len: len,

    mkLog: mkLog,

    log: function() {
        console.log(format.apply(format, arguments));
    },

    then: function(cb, args) {
        if (cb) {
            setTimeout(function() { cb.apply(cb, args) }, 0);
        }
    },

    assert: function(x, msg) {
        if (!msg) {
            msg = "<unknown>";
        }
        if (!x) {
            console.log("Assertion failed: %s", msg);
            console.trace();
            throw new Error("Assertion failed: " + msg);
        }
    },

    keytype: "c25519", // or "c192", "c224", "c256", "c384"
    enctype: "base32", // or "base64", "hex"
    hashtype: "sha256", // or "sha1"
};
return Stxt;
});

