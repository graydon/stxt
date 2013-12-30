// Copyright 2011-2013 Mozilla Foundation.
//
// Licensed under the Apache License, Version 2.0
// <LICENSE.txt or http://www.apache.org/licenses/LICENSE-2.0>
// This file may not be copied, modified, or distributed
// except according to those terms.

(function() {
'use strict';

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

    save: function(cb) {
        var agent = this;
        agent.peer.put_group(agent.group)
            .then(function() {
                agent.peer.put_agent(agent);
            })
            .then(cb);
    },

    save_p: function() {
        var agent = this;
        return agent.peer.put_group(agent.group)
            .then(function() {
                return agent.peer.put_agent(agent);
            });
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
        var a = this;
        this.group.all_envelopes(function(e) {
            a.decrypt_envelope(e);
        });
    },

    all_msgs: function(f) {
        this.decrypt_all();
        for (var i in this.msgs) {
            var m = this.msgs[i];
            f(i,m);
        }
    },

    get_msg: function(mid) {
        this.decrypt_all();
        Assert.property(this.msgs, mid);
        return this.msgs[mid];
    },

    all_msgs_in_sorted_order: function(f) {
        var msgs = [];
        this.all_msgs(function(mid, m) {
            msgs.push(m);
        });
        this.get_graph().sort_msgs(msgs);
        for (var i in msgs) {
            var m = msgs[i];
            f(m.id, m);
        }
    },

    get_msgs_by: function(field, val) {
        Assert.isString(field);
        Assert.isString(val);
        var s = [];
        this.all_msgs_in_sorted_order(function(mid, m) {
            Assert.ok(mid);
            Assert.ok(m);
            if (m[field] === val) {
                s.push(m);
            }
        });
        return s;
    },

    get_graph: function() {
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
        var party_size = Fmt.len(this.get_members());
        this.all_msgs_in_sorted_order(function(mid, m) {
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

    set_next: function(next_id) {
        if (this.next) {
            Assert.equal(this.next, next_id);
        } else {
            this.next = next_id;
        }
    },

    maybe_derive_next_agent: function(cb) {

        var agent = this;
        var peer = agent.peer;

        // This will figure out if it's time to rotate, and if so
        // derive a new key, make a new group, emit a root
        // message, new agent, etc. It returns the new agent, or
        // null if it's not time to rotate.
        var next_key = this.maybe_derive_next_key();

        if (!agent.next) {
            if (next_key) {
                var gid = Hash.hash(next_key);
                this.set_next(gid);
            }
        }

        if (agent.next) {
            log("already done group {:id}, next group {:id}",
                agent.group.id, agent.next);
            agent.peer.has_agent(agent.next).done(function(has) {
                if (has) {
                    agent.peer.get_agent(agent.next).then(cb);
                } else {
                    var next_agent =
                        peer.new_agent_with_new_group(gid, next_key);
                    log("done group {:id}, derived next group {:id}",
                        agent.group.id, next_agent.group.id);
                    agent.set_next(next_agent.group.id);
                    next_agent.add_epoch(agent.get_graph().leaf_ids(),
                                         agent.get_state().snap());
                    agent.save(function() {
                        next_agent.save(function() {
                            if (cb) {
                                cb(next_agent);
                            }
                        });
                    });
                }
            });
        } else {
            if (cb) {
                cb(null);
            }
        }
    },

    member_has_committed: function(member) {
        Assert.instanceOf(member, Tag);
        var mem = member.toString();
        this.decrypt_all();
        for (var i in this.msgs) {
            var m = this.msgs[i];
            if (m.from.toString() === mem) {
                return true;
            }
        }
        return false;
    },

    members_have_committed: function() {
        var members = this.get_members();
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

        function for_each_tkv(ob, f) {
            for (var t in ob) {
                for (var k in ob[t]) {
                    f(t,k,ob[t][k]);
                }
            }
        }

        if (!this.state) {

            // The "state" of the group is established in the
            // following fashion:
            //
            //   - Start with the root's body as state
            //
            //   - Add all the 'add' msg k/v pairs
            //   - Change all the 'chg' msg k/v1=v2 pairs
            //   - Delete all the 'del' k/v pairs

            var adds = this.get_msgs_by("kind", "add");
            var chgs = this.get_msgs_by("kind", "chg");
            var dels = this.get_msgs_by("kind", "del");
            var root = this.get_graph().get_root();

            var state = new State();

            if (!root) {
                return state;
            }

            // NB: the state values in root are arrays from
            // the snapshot of previous state multimap vals.
            if ('body' in root && 'state' in root.body) {
                for_each_tkv(root.body.state, function(t,k,vs) {
                    Assert.instanceOf(vs, Array);
                    vs.forEach(function(v) {
                        state.add_tkv(t,k,v);
                    });
                });
            }

            adds.forEach(function(m) {
                for_each_tkv(m.body, function(t,k,v) {
                    state.add_tkv(t,k,v);
                });
            });

            chgs.forEach(function(m) {
                for_each_tkv(m.body, function(t,k,v) {
                    state.chg_tkv(t,k,v[0],v[1]);
                });
            });

            dels.forEach(function(m) {
                for_each_tkv(m.body, function(t,k,v) {
                    state.del_tkv(t,k,v);
                });
            });

            this.state = state;
            Object.freeze(this.state);
        }
        return this.state;
    },

    add_msg_raw: function(m) {
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
        this.add_msg_raw(m);
        return m;
    },

    add_epoch: function(parents, state) {
        Assert.equal(Fmt.len(this.group.envelopes), 0);
        log("new epoch for group {:id}, from {}",
            this.group.id, this.from());
        this.add_msg("epoch", {state: state}, parents);
    },

    add_epoch_if_missing: function() {
        if (Fmt.len(this.group.envelopes) === 0) {
            var members = {};
            members[this.from().nick] = [this.from().guid];
            this.add_epoch([], {member: members});
        }
    },

    add_state: function(t,k,v) {
        var ty = {};
        ty[k] = v;
        var body = {};
        body[t] = ty;
        this.add_msg("add", body);
    },

    chg_state: function(t,k,v1,v2) {
        Assert.isString(t);
        Assert.isString(k);
        Assert.isString(v1);
        Assert.isString(v2);
        var ty = {};
        ty[k] = [v1,v2];
        var body = {};
        body[t] = ty;
        this.add_msg("chg", body);
    },

    del_state: function(t,k,v) {
        var ty = {};
        ty[k] = v;
        var body = {};
        body[t] = ty;
        this.add_msg("del", body);
    },

    add_ref: function(name, id) { this.add_state("ref", name, id); },
    del_ref: function(name, id) { this.del_state("ref", name, id); },
    chg_ref: function(name, a, b) { this.chg_state("ref", name, a, b); },

    add_member: function(tag) {
        this.add_state("member", tag.nick, tag.guid);
    },
    del_member: function(tag) {
        this.del_state("member", tag.nick, tag.guid);
    },
    chg_member: function(a,b) {
        if (a.nick === b.nick) {
            this.chg_state("member", a.nick, a.guid, b.guid);
        } else {
            this.del_state("member", a.nick, a.guid);
            this.add_state("member", b.nick, b.guid);
        }
    },

    get_refs: function() {
        return this.get_state().get_keys("ref");
    },

    add_link_ref: function(id) { this.add_ref("link", id); },
    chg_link_ref: function(a,b) { this.chg_ref("link", a, b); },

    get_link_refs: function() {
        return this.get_state().get_vals("ref", "link");
    },

    get_all_refs: function() {
        var all_refs = {};
        var refs = this.get_refs();
        for (var i in refs) {
            for (var j in refs[i]) {
                all_refs[j] = true;
            }
        }
        return Object.keys(all_refs);
    },

    get_members: function() {
        var nicks = this.get_state().get_keys("member");
        var members = {};
        for (var nick in nicks) {
            for (var i in nicks[nick]) {
                var guid = nicks[nick][i];
                var tag = new Tag("u", nick, guid);
                members[tag.toString()] = tag;
            }
        }
        return members;
    },

    has_member: function(tag) {
        Assert.instanceOf(tag, Tag);
        var nicks = this.get_state().get_keys("member");
        return tag.nick in nicks &&
            nicks[tag.nick].indexOf(tag.guid) !== -1;
    },

    add_ping: function() {
        this.add_msg("ping", {});
    }
};

module.exports = Agent;
})();
