// Copyright 2011-2013 Mozilla Foundation.
//
// Licensed under the Apache License, Version 2.0
// <LICENSE.txt or http://www.apache.org/licenses/LICENSE-2.0>
// This file may not be copied, modified, or distributed
// except according to those terms.

(function() {
"use strict";

var Assert = require('./assert.js');

var Group = function(id, peer) {
    Assert.isString(id);
    Assert.isObject(peer);
    this.id = id;
    this.peer = peer;
    this.envelopes = {};
    this.agents = [];
    Object.freeze(this);
};


// A group has an ID, which is the strong hash of its current private key.
//
// Every group also has a tag but the tag is stored in the encrypted
// content of the group, as part of the epoch message; it only becomes
// visible when a peer has agency in the group, so it is surfaced as a
// field in Agent.
//
// A group's tag is thus its private, long-lived "identity" and copied from
// each group to its next epoch, as keys rotate; the ID is ephemeral and
// associated with only a single epoch.

Group.prototype = {

    get_id: function() {
        return this.id;
    },

    add_agent: function(ls) {
        this.agents.push(ls);
    },

    save: function() {
        return this.peer.put_group(this);
    },

    has_envelope: function(env_id) {
        return this.envelopes.hasOwnProperty(env_id);
    },

    all_envelopes: function(f) {
        var g = this;
        this.list_envelopes().forEach(function(i) {
            f(g.envelopes[i]);
        });
    },

    get_envelope: function(env_id) {
        var e = this.envelopes[env_id];
        Assert.equal(e.group, this.id);
        return e;
    },

    add_envelope: function(env) {
        Assert.equal(env.group, this.id);
        this.envelopes[env.id] = env;
        this.agents.forEach(function(agent) {
            agent.decrypt_envelope(env);
        });
    },

    list_envelopes: function() {
        var ls = Object.keys(this.envelopes);
        ls.sort();
        return ls;
    }
};

module.exports = Group;
})();
