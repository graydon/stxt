// Copyright 2011-2013 Mozilla Foundation.
//
// Licensed under the Apache License, Version 2.0
// <LICENSE.txt or http://www.apache.org/licenses/LICENSE-2.0>
// This file may not be copied, modified, or distributed
// except according to those terms.

(function() {
'use strict';

var sjcl = require('sjcl');
var when = require('when');

var Agent = require('./agent.js');
var Assert = require('./assert.js');
var Fmt = require('./fmt.js');
var Group = require('./group.js');
var Hash = require('./hash.js');
var Key = require('./key.js');
var Msg = require('./msg.js');
var Tag = require('./tag.js');
var Trace = require('./trace.js');

var log = Trace.mkLog("peer");
var vlog = Trace.mkLog("visit");
var gclog = Trace.mkLog("gc");

var Peer = function(store, user, pw, salt, root_group_id) {
    this.root_group_id = root_group_id;
    this.store = store;
    this.tag = new Tag("u", user);
    this.agent_key = sjcl.misc.pbkdf2(pw, salt);
    this.groups = {};
    this.agents = {};
};

// Agent and Group objects should not be stored by JSON.stringify'ing them
// directly.  They are more subtle than that.

Peer.attach = function(store, user, pw) {
    Assert.ok(store);
    Assert.isString(user);
    var peer_d = when.defer();

    store.has_p("cfg", "root-group")
        .then(function(has_root) {
            if (has_root) {
                log("reloading root group id");
                var gid_p = store.get_p("cfg", "root-group");
                var salt_p = store.get_p("cfg", "agent-salt");
                when.join(gid_p, salt_p).spread(function(gid, salt) {
                    var peer = new Peer(store, user, pw, salt, gid);
                    peer_d.resolve(peer.get_agent(gid));
                }).otherwise(function(err) {
                    peer_d.reject(err);
                });
            } else {
                log("initializing root group");
                var salt = Hash.random();
                var key = Hash.random();
                var gid = Hash.hash(key);
                var peer = new Peer(store, user, pw, salt, gid);
                var group = new Group(gid, peer);
                var pair = Key.genpair();
                var agent = new Agent(group, key, pair, peer);

                agent.add_epoch_if_missing();

                log("storing root group {:id}", group.id);
                peer.put_group(group)
                .then(function() {
                    log("storing root agent");
                    return peer.put_agent(agent);
                })
                .then(function() {
                    log("storing agent salt");
                    return store.put_p("cfg", "agent-salt", salt);
                })
                .then(function() {
                    log("storing root group id");
                    return store.put_p("cfg", "root-group", group.id);
                })
                .then(function() {
                    log("made peer");
                    peer_d.resolve(peer);
                }).otherwise(function(err) {
                    peer_d.reject(err);
                });
            }
        }).otherwise(function(err) {
            peer_d.reject(err);
        });
    return peer_d.promise;
};

Peer.prototype = {
    list_groups: function() {
        return this.store.keys_p("group");
    },
    list_agents: function() {
        return this.store.keys_p("agent");
    },
    has_group: function(groupid) {
        return this.store.has_p("group", groupid);
    },
    new_agent_for_group: function(group, key) {
        var pair = Key.genpair();
        var agent = new Agent(group, key, pair, this);
        this.agents[group.id] = agent;
        return agent;
    },
    new_agent_with_new_group: function(gid, key) {
        if (key) {
            Assert.equal(gid, Hash.hash(key));
        } else {
            Assert.notOk(gid);
            key = Hash.random();
            gid = Hash.hash(key);
        }
        var group = new Group(gid, this);
        this.groups[gid] = group;
        return this.new_agent_for_group(group, key);
    },
    get_group: function(groupid) {
        Assert.instanceOf(this, Peer);
        var group_d = when.defer();
        if (groupid in this.groups) {
            group_d.resolve(this.groups[groupid]);
        } else {
            var group = new Group(groupid, this);
            this.groups[groupid] = group;
            this.store.get("group", groupid).then(function(value) {
                var g = JSON.parse(value);
                for (var i in g) {
                    var e = g[i];
                    Assert.equal(e.group, groupid);
                    var ee = new Msg.Envelope(e.group, e.ct);
                    Assert.equal(ee.id, i);
                    group.add_envelope(ee);
                }
                Assert.equal(group.id, groupid);
                group_d.resolve(group);
            }).otherwise(function(err) {
                group_d.reject(err);
            });
        }
        return group_d.promise;
    },
    put_group: function(group) {
        if (group.id in this.groups) {
            Assert.equal(this.groups[group.id], group);
        } else {
            this.groups[group.id] = group;
        }
        var envs = group.envelopes;
        return this.store.put_p("group", group.id, JSON.stringify(envs));
    },

    del_group_and_agent: function(gid) {
        var peer = this;
        delete peer.groups[gid];
        delete peer.agents[gid];
        return peer.store.del_p("agent", gid)
            .then(function() {
                return peer.store.del_p("group", gid);
            });
    },

    // The agent interface implicitly loads the group that
    // the agent is attached to.
    put_agent: function(agent) {
        if (agent.group.id in this.agents) {
            Assert.equal(this.agents[agent.group.id], agent);
        } else {
            this.agents[agent.group.id] = agent;
        }
        var a = JSON.stringify({tag: agent.tag,
                                key: agent.key,
                                pair: agent.pair});
        this.store.put_p("agent", agent.group.id, a);
    },
    has_agent: function(groupid) {
        return this.store.has_p("agent", groupid);
    },
    get_agent: function(groupid) {
        // Records in the 'agent" table are
        //
        // groupid => { tag: tag, key: groupkey, pair: keypair }
        //
        var peer = this;
        var agent_d = when.defer();
        if (groupid in this.agents) {
            agent_d.resolve(this.agents[groupid]);
        } else {
            peer.get_group(groupid, function(group) {
                peer.store.get_p("agent", groupid).then(function(value) {
                    var a = JSON.parse(value);
                    var agent = new Agent(group, a.key, a.pair,
                                          peer, a.tag);
                    peer.agents[groupid] = agent;
                    agent_d.resolve(agent);
                })
                .otherwise(function(err) {
                    agent_d.reject(err);
                });
            });
        }
        return agent_d.promise;
    },

    get_root_agent: function() {
        return this.get_agent(this.root_group_id);
    },

    visit_gid_p: function(gid, each) {
        var gg = Fmt.abbrev(gid);
        var peer = this;
        var done_d = when.defer();
        function ok() {
            done_d.resolve();
        }
        function bad(err) {
            done_d.reject(err);
        }
        vlog("gid: " + gg);
        peer.has_agent(gid).then(function(has) {
            if (has) {
                vlog("have agent for " + gg);
                peer.get_agent(gid)
                    .then(function(agent) {
                        peer.visit_agent_p(agent, each)
                            .then(ok)
                            .otherwise(bad);
                    }).otherwise(bad);
            } else {
                peer.has_group(gid).then(function(has) {
                    if (has) {
                        vlog("have no agent, but group for " + gg);
                        peer.get_group(gid)
                            .then(function(group) {
                                when.resolve(each(gid, group, null))
                                    .then(ok)
                                    .otherwise(bad);
                            })
                            .then(ok)
                            .otherwise(bad);
                    } else {
                        vlog("have no agent or group for " + gg);
                        when.resolve(each(gid, null, null))
                            .then(ok)
                            .otherwise(bad);
                    }
                }).otherwise(bad);
            }
        }).otherwise(bad);
        return done_d.promise;
    },

    visit_agent_links_p: function(agent, each) {
        var links = agent.get_link_refs();
        var gg = Fmt.abbrev(agent.group.id);
        var peer = this;
        vlog("" + gg + " has " + links.length + " links");
        return when.map(links, function(link) {
            return peer.visit_gid_p(link, each);
        });
    },

    visit_agent_next_p: function(agent, each) {
        var peer = this;
        if (agent.next) {
            vlog("agent {:id} next: {:id}", agent.group.id, agent.next);
            return peer.visit_gid_p(agent.next, each);
        } else {
            vlog("agent {:id} has no next, looking at links",
                 agent.group.id);
            return peer.visit_agent_links_p(agent, each);
        }
    },

    visit_agent_p: function(agent, each) {
        var peer = this;
        return when.resolve(each(agent.group.id, agent.group, agent))
            .then(function() {
                return peer.visit_agent_next_p(agent, each);
            });
    },

    // NB: 'each' is a callback which will be called as
    //
    //   each(gid, group, agent)
    //
    // where either agent, or group-and-agent, may be null,
    // indicating a gid-link that doesn't point to anything we
    // have.

    visit_all_linked_groups_p: function(each) {
        return this.visit_gid_p(this.root_group_id, each);
    },

    gc_p: function() {
        // Garbage collection operates several stages:
        //
        //   - For each primary group we have agency in (one found
        //     only by following ref=links, off the root), check any
        //     of its agent next-linked groups that we have agency
        //     within, to see if the next-link has been committed
        //     to by all the group's members. If so, queue a
        //     "relink(A,B)" event, where A is the next-group's
        //     primary (parent) group ID and B is the next group ID.
        //
        //   - Process all these queued relink events. Each causes all
        //     groups with ref:link=A to issue a chg(ref,link,A,B)
        //     message, updating the group's N link-reference to point
        //     to B rather than A.
        //
        //   - Start marking from our root personal group, marking
        //     groups as live if ref'ed (in any way) by the state of
        //     another live group.
        //
        //   - Sweep all unreferenced groups and their agents.

        var done_d = when.defer();

        var relinks = {};
        var all_agents = {};
        var all_groups = {};
        var peer = this;

        peer.visit_all_linked_groups_p(function(gid, group, agent) {
            if (agent) {
                Assert.equal(agent.group.id, gid);
                gclog("phase 1: found agent {:id}", gid);
                all_agents[gid] = agent;
            }
            if (group) {
                all_groups[gid] = true;
            }

        }).then(function() {
            for (var gid in all_agents) {
                var agent = all_agents[gid];
                gclog("phase 2: inspecting agent {:id}", gid);
                if (agent.next) {
                    gclog("phase 2: agent {:id} has next {:id}",
                          gid, agent.next);
                    if (agent.next in all_agents) {
                        gclog("phase 2: we have an agent for {:id}",
                              agent.next);
                        var next = all_agents[agent.next];
                        if (next.members_have_committed()) {
                            gclog("phase 2: members have committted in {:id}",
                                  agent.next);
                            gclog("phase 2: scheduling relink({:id}, {:id})",
                                  gid, agent.next);
                            Assert.notProperty(relinks, gid);
                            relinks[gid] = agent.next;
                        }
                    }
                }
            }

        }).then(function() {
            var groups_to_relink = Object.keys(all_groups);
            return when.map(groups_to_relink, function(gid) {
                gclog("phase 3: inspecting agent {:id}", gid);
                var agent = all_agents[gid];
                var links = agent.get_link_refs();
                var dirty = false;
                for (var j in links) {
                    var link = links[j];
                    gclog("phase 3: {:id} links to {:id}", gid, link);
                    if (link in relinks) {
                        gclog("phase 3: changing link in " +
                              "{:id}: {:id} -> {:id}",
                              gid, link, relinks[link]);
                        agent.chg_link_ref(link, relinks[link]);
                    }
                }
                if (dirty) {
                    return agent.save_p();
                } else {
                    return when.resolve(null);
                }
            });

        }).then(function() {
            return peer.visit_all_linked_groups_p(function(gid) {
                gclog("phase 4: {:id} still reachable", gid);
                delete all_groups[gid];
            });

        }).then(function() {
            var groups_to_delete = Object.keys(all_groups);
            gclog("phase 5: {} groups to delete",
                  groups_to_delete.length);
            return when.map(groups_to_delete, function(gid) {
                gclog("phase 5: deleting group and " +
                      "agent for {:id}", gid);
                return peer.del_group_and_agent(gid);
            });

        }).then(function() {
            gclog("finished GC");
            done_d.resolve(relinks);

        }).otherwise(function(err) {
            gclog("GC failed");
            done_d.reject(err);
        });

        return done_d.promise;
    },
};

module.exports = Peer;
})();
