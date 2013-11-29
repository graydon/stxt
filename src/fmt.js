// Copyright 2011-2013 Mozilla Foundation.
//
// Licensed under the Apache License, Version 2.0
// <LICENSE.txt or http://www.apache.org/licenses/LICENSE-2.0>
// This file may not be copied, modified, or distributed
// except according to those terms.

(function() {
"use strict";

var Assert = require('./assert.js');
var fomatto = require('./fomatto.js');

function abbrev(x) {
    Assert.typeOf(x, 'string');
    if (x.length > 8) {
        return x.substr(0, 8);
    }
    return x;
}

function len(x) {
    if (x.hasOwnProperty("length")) {
        return x.length;
    } else {
        return Object.keys(x).length;
    }
}

var fmt = fomatto.Formatter({ id: abbrev,
                              short: abbrev,
                              len: len
                            });

function pad(s,len) {
    Assert.typeOf(s, 'string');
    while (s.length < len) {
        s += '\0';
    }
    return s;
}

function unpad(s) {
    Assert.typeOf(s, 'string');
    return s.replace(/\0*$/);
}

module.exports = {
    abbrev: abbrev,
    len: len,
    fmt: fmt,
    pad: pad,
    unpad: unpad
};

})();
