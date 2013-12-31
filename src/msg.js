// Copyright 2011-2013 Mozilla Foundation.
//
// Licensed under the Apache License, Version 2.0
// <LICENSE.txt or http://www.apache.org/licenses/LICENSE-2.0>
// This file may not be copied, modified, or distributed
// except according to those terms.
(function() {
"use strict";

var Tag = require('./tag.js');
var Hash = require('./hash.js');
var Trace = require('./trace.js');
var Assert = require('./assert.js');
var Config = require('./config.js');

var sjcl = require("sjcl");

var log = Trace.mkLog("msg");

var Msg = function(group, parents, from, kind, body, keys, time) {
    Assert.ok(group);
    Assert.typeOf(group, 'string');
    this.group = group;
    this.parents = parents || [];
    this.from = from || new Tag("u", "anon");
    this.kind = kind || "ping";
    this.body = body || {};
    this.keys = keys || {};
    this.time = time || (new Date()).toISOString();
    this.parents.sort();
    this.id = Hash.hash({group:this.group,
                         parents:this.parents,
                         from:this.from,
                         kind:this.kind,
                         body:this.body,
                         keys:this.keys});
    Object.freeze(this);
    Assert.isArray(this.parents);
    Assert.instanceOf(this.from, Tag);
    Assert.isString(this.kind);
    Assert.isObject(this.body);
    log("new: kind={}, from={}, group={:id}, id={:id}",
        this.kind, this.from, this.group, this.id);
};

Msg.prototype = {
    // symkey should be a previously-established sjcl bitarray
    encrypt: function(symkey) {
        Assert.isString(symkey);
        Assert.property(Config, 'ae_cipher_type');
        Assert.property(Config, 'ae_cipher_len');
        Assert.property(Config, 'ae_cipher_mode');
        Assert.property(Config, 'ae_tag_len');
        var params = {
            cipher: Config.ae_cipher_type,
            ks: Config.ae_cipher_len,
            mode: Config.ae_cipher_mode,
            ts: Config.ae_tag_len
        };
        log("encrypting: kind={}, from={}, group={:id}, id={:id}",
            this.kind, this.from, this.group, this.id);

        // NB: sjcl json-encodes the ciphertext _container_, which is
        // overkill for us; we JSON-encode everything before transfer
        // or storage anyways; so we undo its JSON-encoding here.
        var e = JSON.parse(sjcl.encrypt(symkey,
                                        JSON.stringify(this),
                                        params));

        return new Msg.Envelope(this.group, e);
    },
    has_parent_id: function(parent_id) {
        return this.parents.indexOf(parent_id) !== -1;
    }
};

Msg.Envelope = function(group, ct) {
    Assert.isString(group);
    Assert.isObject(ct);
    this.group = group;
    this.ct = ct;
    this.id = Hash.hash({group:this.group,
                         ct:this.ct});
};

Msg.Envelope.prototype = {
    decrypt: function(symkey) {
        log("decrypting envelope: id={:id}", this.id);
        var v = JSON.parse(sjcl.decrypt(symkey,JSON.stringify(this.ct)));
        Assert.equal(v.group, this.group);
        var from = new Tag(v.from.kind,
                           v.from.nick,
                           v.from.guid);
        return new Msg(v.group, v.parents,
                       from, v.kind, v.body,
                       v.keys, v.time);
    },
};

Msg.KIND_PING = 'ping';

Msg.KIND_EPOCH = 'epoch';

Msg.KIND_SET = 'set';
Msg.KIND_DEL = 'del';
Msg.KIND_CHG = 'chg';

module.exports = Msg;

})();
