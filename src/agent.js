// Copyright 2011-2013 Mozilla Foundation.
//
// Licensed under the Apache License, Version 2.0
// <LICENSE.txt or http://www.apache.org/licenses/LICENSE-2.0>
// This file may not be copied, modified, or distributed
// except according to those terms.

(function() {
'use strict';

var when = require('when');

var Assert = require('./assert.js');
var Fmt = require('./fmt.js');
var Graph = require('./graph.js');
var Group = require('./group.js');
var Hash = require('./hash.js');
var Key = require('./key.js');
var Msg = require('./msg.js');
var State = require('./state.js');
var Tag = require('./tag.js');
var Trace = require('./trace.js');

var log = Trace.mkLog('agent');
var klog = Trace.mkLog('keyrot');

var Agent = function(group, key, pair, peer, tag) {

    Assert.instanceOf(group, Group);
    Assert.isString(key);
    Assert.isObject(pair);
    Assert.ok(peer);

    if (tag) {
        Assert.instancecOf(tag, Tag);
    }

    this.group = group;
    this.key = key;
    this.tag = tag;  // null => use peer tag
    this.pair = pair;
    this.next_pair = Key.genpair();
    this.peer = peer;

    this.next = null; // to be set

    // caches
    this.msgs = {};
    this.decrypted = {};
    this.graph = null;
    this.state = null;

    this.group.add_agent(this);
};


Agent.prototype = {

    save: function() {
        var agent = this;
        return agent.peer.put_group(agent.group)
            .then(function() {
                return agent.peer.put_agent(agent);
            });
    },

    get_group: function() {
        return this.group;
    },

    from: function() {
        // An agent will compose messages either from an assumed tag,
        // specific to its participation in this group, or the default tag
        // of its peer, if no assumed one exists.
        if (this.tag) {
            return this.tag;
        } else {
            return this.peer.tag;
        }
    },

    decrypt_envelope: function(env) {
        var eid = env.id;
        if (eid in this.decrypted) {
            return;
        }
        var m = env.decrypt(this.key);
        this.decrypted[eid] = true;
        var mid = m.id;
        Assert.notProperty(this.msgs, mid);
        this.msgs[mid] = m;

        // FIXME: incrementalize graph and state-building.
        this.graph = null;
        this.state = null;
        return m;
    },

    decrypt_all: function() {
        var agent = this;
        agent.group.list_envelopes().forEach(function(env_id) {
            if (!(env_id in agent.decrypted)) {
                var e = agent.group.get_envelope(env_id);
                agent.decrypt_envelope(e);
            }
        });
    },

    get_msg: function(mid) {
        this.decrypt_all();
        Assert.property(this.msgs, mid);
        return this.msgs[mid];
    },

    get_graph: function() {
        this.decrypt_all();
        if (! this.graph) {
            this.graph = new Graph(this.msgs);
            this.graph.get_analysis();
            Object.freeze(this.graph);
        }
        return this.graph;
    },

    get_current_exch_keys: function() {
        var exchs = {};
        if (this.get_graph().get_root() == null) {
            // We're in group-founding position.
            return exchs;
        }
        var party_size = Fmt.len(this.get_users());
        var msgs = this.get_graph().get_all_msgs_sorted();
        msgs.forEach( function(m) {
            Assert.instanceOf(m, Msg);
            for (var i in m.keys) {
                var k = m.keys[i];
                var e = new Key.Exch(party_size,
                                     i.split(","),
                                     k);
                exchs[e.name()] = e;
            }
        });
        return exchs;
    },

    get_next_key_rotation: function() {

        var from = this.from().toString();
        var exchs = this.get_current_exch_keys();
        var new_exchs = {};

        var seeded_us = false;
        var n_finished = 0;
        var n_includes_us = 0;
        var n_other = 0;

        for (var i in exchs) {
            if (i === from) {
                seeded_us = true;
            }
            var e = exchs[i];
            var nn = e.extended_name(from);
            if (e.needs_user(from) &&
                ! (nn in exchs)) {
                var x = e.extend_with_user(from,
                                           this.next_pair.pub);
                exchs[x.name()] = x;
                new_exchs[x.name()] = x;
            } else {
                if (e.is_finished()) {
                    n_finished++;
                } else if (e.has_user(from)) {
                    n_includes_us++;
                } else {
                    n_other++;
                }

            }
        }
        var nk = {};
        for (i in new_exchs) {
            nk[i] = new_exchs[i].pub;
        }

        klog("{} in {:id} found {:len} live exchs",
             this.from(), this.group.id, exchs);

        klog("{:len} needed us, {} had us, {} finished, {} other",
             new_exchs, n_includes_us, n_finished, n_other);

        if (!seeded_us) {
            klog("seeding for {}", this.from());
            nk[from] = this.next_pair.pub;
        }

        return nk;
    },

    maybe_derive_next_key: function() {
        //
        // An agent is allowed to rotate to a new key (possibly
        // publishing a root for its new group, if there isn't one yet)
        // when the following is true:
        //
        //  - Every exchange key it is obliged to publish in order
        //    to complete a rotation, it has published.
        //
        //  - It has the exchange key that is complete except-for
        //    its own secret.
        //
        // FIXME: we're only checking the second rule here,
        // not the first.
        //
        var from = this.from().toString();
        var exchs = this.get_current_exch_keys();
        for (var i in exchs) {
            var e = exchs[i];
            if (e.is_finished() &&
                ! e.has_user(from)) {
                klog("{} in {:id} found finished exch w/o us, " +
                     "deriving new key",
                     this.from(), this.group.id);
                return e.derive_final(this.next_pair.sec);
            }
        }
        klog("{} in {:id} not ready to derive new key",
            this.from(), this.group.id);
        return null;
    },

    /**
     * Sets this.next to given group ID. If already set, requires that
     * next_id === this.next.
     *
     * @param {String} next_id  Group ID to set this.next to.
     */
    set_next: function(next_id) {
        if (this.next) {
            Assert.equal(this.next, next_id);
        } else {
            this.next = next_id;
        }
    },

    /**
     * Attempt to derive "next" key in multiparty key rotation sequence,
     * and if successful, construct group and agent for that key, emit a
     * new epoch message for the group, and return the new agent.
     *
     * @this Agent
     * @return {Agent}   Promise for the next agent, or promise for null if
     *                   key rotation is not yet complete.
     * @see Agent#maybe_derive_next_key
     */
    maybe_derive_next_agent: function() {

        var agent = this;
        var peer = agent.peer;

        var done_d = when.defer();

        var next_key = this.maybe_derive_next_key();

        if (!agent.next) {
            if (next_key) {
                var gid = Hash.hash(next_key);
                this.set_next(gid);
            }
        }

        if (agent.next) {
            log("{} already done group {}, (curr {:id}, next {:id})",
                agent.from(), agent.group.tag,
                agent.group.id, agent.next);
            agent.peer.has_agent(agent.next).then(function(has) {
                if (has) {
                    agent.peer.get_agent(agent.next)
                        .then(function(next_agent) {
                            done_d.resolve(next_agent);
                        });
                } else {
                    var next_agent =
                        peer.new_agent_with_new_group(agent.group.tag,
                                                      next_key);
                    log("{} done group {} (curr {:id}, derived next {:id})",
                        agent.from(), agent.group.tag,
                        agent.group.id, next_agent.group.id);
                    agent.set_next(next_agent.group.id);
                    next_agent.add_epoch(agent.get_graph().leaf_ids(),
                                         agent.get_state().snap());
                    agent.save().then(function() {
                        next_agent.save().then(function() {
                            done_d.resolve(next_agent);
                        });
                    });
                }
            });
        } else {
            done_d.resolve(null);
        }
        return done_d.promise;
    },

    members_have_committed: function() {
        var members = this.get_users();
        var committed_members = {};
        var n = Fmt.len(members);
        var i;

        for (i in members) {
            klog("group {:id} member {}", this.group.id, i);
        }

        if (n < 1) {
            return true;
        }

        this.decrypt_all();

        for (i in this.msgs) {
            if (n < 1) {
                break;
            }
            var m = this.msgs[i];
            var f = m.from.toString();
            klog("group {:id} msg from {}",
                 this.group.id, m.from);
            if (f in members &&
                !(f in committed_members)) {
                --n;
                committed_members[f] = true;
            }
        }

        klog("group {:id} {:len}/{:len} " +
             "have committed => group is {}committed",
             this.group.id, committed_members, members,
             (n === 0 ? "" : "not "));
        return n === 0;
    },

    get_state: function() {
        if (!this.state) {
            this.state = this.get_graph().calculate_final_state();
            Object.freeze(this.state);
        }
        return this.state;
    },

    encrypt_msg_and_add_to_group: function(m) {
        this.group.add_envelope(m.encrypt(this.key));
    },

    add_msg: function(kind, body, parents) {
        if (!parents) {
            parents = this.get_graph().leaf_ids();
        }
        var nk = this.get_next_key_rotation();
        var m = new Msg(this.group.id,
                        parents,
                        this.from(),
                        kind, body, nk);
        this.encrypt_msg_and_add_to_group(m);
        return m;
    },



    add_epoch: function(parents, state) {
        Assert.instanceOf(this, Agent);
        var agent = this;
        Assert.equal(Fmt.len(agent.group.envelopes), 0);
        log("new epoch for group {:id}, from {}",
            agent.group.id, agent.from());
        this.add_msg(Msg.KIND_EPOCH, {}, parents);
        // Propagate the state forward in a sequence of new
        // SET messages.
        State.for_each_tkv(state, function(t,k,v) {
            agent.set_state(t,k,v);
        });
    },

    add_epoch_if_missing: function() {
        if (Fmt.len(this.group.envelopes) === 0) {
            this.add_epoch([], {});
        }
    },



    set_state: function(t,k,v) {
        var ty = {};
        ty[k] = v;
        var body = {};
        body[t] = ty;
        this.add_msg(Msg.KIND_SET, body);
    },

    chg_state: function(t,k1,k2) {
        var ty = {};
        ty[k1] = k2;
        var body = {};
        body[t] = ty;
        this.add_msg(Msg.KIND_CHG, body);
    },

    del_state: function(t,k) {
        var body = {};
        body[t] = k;
        this.add_msg(Msg.KIND_DEL, body);
    },



    add_live_user: function(tag) {
        this.set_state(State.TYPE_USER, tag.toString(), State.USER_LIVE);
    },

    add_idle_user: function(tag) {
        this.set_state(State.TYPE_USER, tag.toString(), State.USER_IDLE);
    },

    del_user: function(tag) {
        this.del_state(State.TYPE_USER, tag.toString());
    },

    get_users: function() {
        Assert.instanceOf(this, Agent);
        var tags = this.get_state().get_keys(State.TYPE_USER);
        var users = {};
        for (var tag in tags) {
            users[tag] = Tag.parse(tag);
        }
        return users;
    },

    has_user: function(tag) {
        Assert.instanceOf(this, Agent);
        Assert.instanceOf(tag, Tag);
        var tags = this.get_state().get_keys(State.TYPE_USER);
        return tag.toString() in tags;
    },



    get_linked_groups: function() {
        Assert.instanceOf(this, Agent);
        return Object.keys(this.get_state().get_keys(State.TYPE_GROUP));
    },

    add_local_link: function(id) {
        Assert.instanceOf(this, Agent);
        Assert.isString(id);
        this.set_state(State.TYPE_GROUP, id, State.GROUP_LOCAL);
    },

    add_share_link: function(id) {
        Assert.instanceOf(this, Agent);
        Assert.isString(id);
        this.set_state(State.TYPE_GROUP, id, State.GROUP_SHARE);
    },

    chg_link: function(a,b) {
        Assert.instanceOf(this, Agent);
        Assert.isString(a);
        Assert.isString(b);
        this.chg_state(State.TYPE_GROUP, a, b);
    },



    add_ping: function() {
        this.add_msg(Msg.KIND_PING, {});
    }
};

module.exports = Agent;
})();
