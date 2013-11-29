// Copyright 2011-2013 Mozilla Foundation.
//
// Licensed under the Apache License, Version 2.0
// <LICENSE.txt or http://www.apache.org/licenses/LICENSE-2.0>
// This file may not be copied, modified, or distributed
// except according to those terms.

(function() {
"use strict";

var Config = require('./config.js');
var Fmt = require('./fmt.js');

// Global trace buffer
var cbuf = require('CBuffer');
var TRACE_BUF = cbuf(Config.tracebuf_len);


// Logging trace-event type
var TRACE_LOG = 0;
function push_log(display, str) {
    if (display) {
        console.log(str);
    }
    TRACE_BUF.push([TRACE_LOG, str]);
}

function log() {
    push_log(true, Fmt.fmt.apply(Fmt.fmt, arguments));
}


// Higher level formatters and log-control flags
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

(process.env.LOG || '')
  .split(/[\s,]+/)
  .forEach(function(name){
      if (name in logBits) {
          logBits[name] = true;
      }
  });

var mkLog = function(bit) {
    return (function() {
        var display = false;
        if (bit in logBits &&
            logBits[bit]) {
            display = true;
        }
        push_log(display, bit + ": " +
                 Fmt.fmt.apply(Fmt.fmt, arguments));
    });
};

module.exports = {
    log: log,
    mkLog: mkLog,
    logBits: logBits,
    trace_tags: {
        TRACE_LOG: TRACE_LOG
    }
};

})();
