// Copyright 2011-2013 Mozilla Foundation.
//
// Licensed under the Apache License, Version 2.0
// <LICENSE.txt or http://www.apache.org/licenses/LICENSE-2.0>
// This file may not be copied, modified, or distributed
// except according to those terms.

"use strict";
if (typeof define !== 'function') { var define = require('amdefine')(module) }
define(["sjcl", "stxt/stxt", "stxt/tag", "stxt/hash"],
function(sjcl, Stxt, Tag, Hash) {

var log = Stxt.mkLog("msg");

var Msg = function(group, parents, from, kind, body, keys, time) {
    Stxt.assert(group && typeof group == "string");
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
    Stxt.assert(this.parents instanceof Array);
    Stxt.assert(this.from instanceof Tag);
    Stxt.assert(typeof this.kind == "string");
    Stxt.assert(typeof this.body == "object");
    log("new: kind={}, from={}, group={:id}, id={:id}",
        this.kind, this.from, this.group, this.id);
};

Msg.prototype = {
    encrypt: function(symkey) {
        Stxt.assert(symkey, "missing symkey in Msg.encrypt");
        log("encrypting: kind={}, from={}, group={:id}, id={:id}",
            this.kind, this.from, this.group, this.id);
        // NB: sjcl json-encodes the ciphertext _container_, which is
        // overkill for us; we JSON-encode everything before transfer
        // or storage anyways; so we undo its JSON-encoding here.
        var e = JSON.parse(sjcl.encrypt(symkey, JSON.stringify(this)));
        return new Msg.Envelope(this.group, e);
    },
    has_parent_id: function(parent_id) {
        return this.parents.indexOf(parent_id) != -1;
    }
};

Msg.Envelope = function(group, ct) {
    Stxt.assert(typeof group == "string");
    Stxt.assert(typeof ct == "object");
    this.group = group;
    this.ct = ct;
    this.id = Hash.hash({group:this.group,
                         ct:this.ct});
}
Msg.Envelope.prototype = {
    decrypt: function(symkey) {
        log("decrypting envelope: id={:id}", this.id);
        var v = JSON.parse(sjcl.decrypt(symkey,JSON.stringify(this.ct)));
        Stxt.assert(v.group == this.group);
        var from = new Tag(v.from.kind,
                           v.from.nick,
                           v.from.guid);
        return new Msg(v.group, v.parents,
                       from, v.kind, v.body,
                       v.keys, v.time);
    },
};

Stxt.Msg = Msg;
return Msg;

});
