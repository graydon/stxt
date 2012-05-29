"use strict";
if (typeof define !== 'function') { var define = require('amdefine')(module) }
define(["sjcl",
    "stxt/stxt", "stxt/hash", "stxt/key", "stxt/msg",
    "stxt/tag", "stxt/agent", "stxt/group", "stxt/store"],
function(sjcl, Stxt, Hash, Key, Msg, Tag, Agent, Group, Store) {

var log = Stxt.mkLog("peer");
var vlog = Stxt.mkLog("visit");
var gclog = Stxt.mkLog("gc");

var Peer = function(store, user, pw, salt, root_group_id) {
    this.root_group_id = root_group_id;
    this.store = store;
    this.tag = new Tag("u", user);
    this.agent_key = sjcl.misc.pbkdf2(pw, salt);
    this.groups = {};
    this.agents = {};
};

// Agent and Group objects should not be stored by JSON.stringify'ing them directly.
// They are more subtle than that.

Peer.attach = function(store, user, pw, cb) {
    Stxt.assert(store)
    Stxt.assert(typeof user == "string");
    store.has("cfg", "root-group", function(has_root) {
        if (has_root) {
            log("reloading root group id");
            store.get("cfg", "root-group", function(gid) {
                store.get("cfg", "agent-salt", function(salt) {
                    var peer = new Peer(store, user, pw, salt, gid);
                    peer.get_agent(gid, function(agent) {
                        cb(peer);
                    });
                });
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
            peer.put_group(group, function() {
                log("storing root agent");
                peer.put_agent(agent, function() {
                    log("storing root group id");
                    store.put("cfg", "agent-salt", salt, function() {
                        store.put("cfg", "root-group", group.id, function() {
                            cb(peer);
                        });
                    });
                });
            });
        }
    })
};

Peer.prototype = {
    list_groups: function(groupid, cb) {
        var groups = [];
        this.store.keys("group", function(key) {
            groups.push(key);
        }, function() { cb(groups) });
    },
    list_agents: function(groupid, cb) {
        var agents = [];
        this.store.keys("agent", function(key) {
            agents.push(key);
        }, function() { cb(agents) });
    },
    has_group: function(groupid, cb) {
        this.store.has("group", groupid, cb);
    },
    new_agent_for_group: function(group, key) {
        var pair = Key.genpair();
        var agent = new Agent(group, key, pair, this);
        this.agents[group.id] = agent;
        return agent;
    },
    new_agent_with_new_group: function(gid, key) {
        if (key) {
            Stxt.assert(gid == Hash.hash(key));
        } else {
            Stxt.assert(!gid);
            key = Hash.random();
            gid = Hash.hash(key);
        }
        var group = new Group(gid, this);
        this.groups[gid] = group;
        return this.new_agent_for_group(group, key);
    },
    get_group: function(groupid, cb) {
        Stxt.assert(this instanceof Peer);
        if (groupid in this.groups) {
            cb(this.groups[groupid]);
        } else {
            var group = new Group(groupid, this);
            this.groups[groupid] = group;
            this.store.get("group", groupid, function(value) {
                var g = JSON.parse(value);
                for (var i in g) {
                    var e = g[i];
                    Stxt.assert(e.group == groupid);
                    var ee = new Msg.Envelope(e.group, e.ct);
                    Stxt.assert(ee.id == i);
                    group.add_envelope(ee);
                }
                Stxt.assert(group.id == groupid);
                cb(group);
            });
        }
    },
    put_group: function(group, cb) {
        if (group.id in this.groups) {
            Stxt.assert(this.groups[group.id] === group);
        } else {
            this.groups[group.id] = group;
        }
        var envs = group.envelopes;
        this.store.put("group", group.id, JSON.stringify(envs), cb);
    },

    del_group_and_agent: function(gid, cb) {
        var peer = this;
        delete peer.groups[gid];
        delete peer.agents[gid];
        peer.store.del("agent", gid, function() {
            peer.store.del("group", gid, cb);
        });
    },

    // The agent interface implicitly loads the group that
    // the agent is attached to.
    put_agent: function(agent, cb) {
        if (agent.group.id in this.agents) {
            Stxt.assert(this.agents[agent.group.id] === agent);
        } else {
            this.agents[agent.group.id] = agent;
        }
        var a = JSON.stringify({tag: agent.tag,
                                key: agent.key,
                                pair: agent.pair});
        this.store.put("agent", agent.group.id, a, cb);
    },
    has_agent: function(groupid, cb) {
        this.store.has("agent", groupid, cb);
    },
    get_agent: function(groupid, cb) {
        // Records in the 'agent" table are
        //
        // groupid => { tag: tag, key: groupkey, pair: keypair }
        //
        var peer = this;
        if (groupid in this.agents) {
            cb(this.agents[groupid]);
        } else {
            peer.get_group(groupid, function(group) {
                peer.store.get("agent", groupid, function(value) {
                    var a = JSON.parse(value);
                    var agent = new Agent(group, a.key, a.pair,
                                          peer, a.tag);
                    peer.agents[groupid] = agent;
                    cb(agent);
                });
            });
        }
    },

    get_root_agent: function(cb) {
        this.get_agent(this.root_group_id, cb);
    },

    // NB: 'each' is a callback which will be called as
    //
    //   each(gid, group, agent, cb)
    //
    // where either agent, or group-and-agent, may be null,
    // indicating a gid-link that doesn't point to anything we
    // have. In all cases, the 'each' callback should itself
    // complete by a call to cb() in each control-leaf, which
    // will continue the iteration.
    //
    // Let's all manually CPS-convert our code! Thanks JS!
    //
    visit_all_linked_groups: function(each, done) {
        this.visit_gid(this.root_group_id, each, done);
    },

    visit_gid: function(gid, each, done) {
        var gg = Stxt.abbrev(gid);
        var peer = this;
        vlog("gid: " + gg);
        peer.has_agent(gid, function(has) {
            if (has) {
                vlog("have agent for " + gg);
                peer.get_agent(gid, function(agent) {
                    peer.visit_agent(agent, each, done);
                });
            } else {
                peer.has_group(gid, function(has) {
                    if (has) {
                        vlog("have no agent, but group for " + gg);
                        peer.get_group(gid, function(group) {
                            each(gid, group, null, done);
                        });
                    } else {
                        vlog("have no agent or group for " + gg);
                        each(gid, null, null, done);
                    }
                });
            }
        });
    },

    visit_agent_links: function(agent, each, done) {
        var links = agent.get_link_refs();
        var gg = Stxt.abbrev(agent.group.id);
        var peer = this;
        vlog("" + gg + " has " + links.length + " links");
        function visit_link(n) {
            if (n == links.length) {
                done();
            } else {
                vlog("" + gg + " link #" + n
                     + ": " + Stxt.abbrev(links[n]));
                peer.visit_gid(links[n], each, function() {
                    visit_link(n+1);
                });
            }
        }
        visit_link(0);
    },

    visit_agent_next: function(agent, each, done) {
        var peer = this;
        if (agent.next) {
            vlog("agent {:id} next: {:id}", agent.group.id, agent.next);
            peer.visit_gid(agent.next, each, done);
        } else {
            vlog("agent {:id} has no next, looking at links",
         agent.group.id);
            peer.visit_agent_links(agent, each, done);
        }
    },

    visit_agent: function(agent, each, done) {
        var peer = this;
        each(agent.group.id, agent.group, agent, function() {
            peer.visit_agent_next(agent, each, done);
        });
    },

    gc: function(done_gc) {
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

        var relinks = {};
        var all_agents = {};
        var all_groups = {};
        var live_groups = {};
        var peer = this;

        peer.visit_all_linked_groups(function(gid, group, agent, cb) {
            if (agent) {
        Stxt.assert(agent.group.id == gid);
                gclog("phase 1: found agent {:id}", gid);
                all_agents[gid] = agent;
            }
            if (group) {
                all_groups[gid] = true;
            }
            cb();
        }, function() {
            for (var gid in all_agents) {
                var agent = all_agents[gid];
                gclog("phase 2: inspecting agent {:id}", gid);
                if (agent.next) {
                    gclog("phase 2: agent {:id} has next {:id}", gid, agent.next);
                    if (agent.next in all_agents) {
                        gclog("phase 2: we have an agent for {:id}", agent.next);
                        var next = all_agents[agent.next];
                        if (next.members_have_committed()) {
                            gclog("phase 2: members have committted in {:id}", agent.next);
                            gclog("phase 2: scheduling relink({:id}, {:id})", gid, agent.next);
                            Stxt.assert(!(gid in relinks));
                            relinks[gid] = agent.next;
                        }
                    }
                }
            }

        var groups_to_relink = Object.keys(all_groups);
        var adjust_links = function(i, cb) {
        if (i == groups_to_relink.length) {
            cb();
        } else {
            var gid = groups_to_relink[i];
                    gclog("phase 3: inspecting agent {:id}", gid);
                    var agent = all_agents[gid];
                    var links = agent.get_link_refs();
            var dirty = false;
                    for (var j in links) {
            var link = links[j];
            gclog("phase 3: {:id} links to {:id}", gid, link);
            if (link in relinks) {
                            gclog("phase 3: changing link in {:id}: {:id} -> {:id}",
                  gid, link, relinks[link]);
                            agent.chg_link_ref(link, relinks[link]);
            }
                    }
            if (dirty) {
            agent.save(function() {adjust_links(i+1, cb)});
            } else {
            adjust_links(i+1, cb)
            }
        }
        };
        adjust_links(0, function() {
        peer.visit_all_linked_groups(function(gid, group, agent, cb) {
                    gclog("phase 4: {:id} still reachable", gid);
                    delete all_groups[gid];
                    cb();
        }, function() {
                    var groups_to_delete = Object.keys(all_groups);
                    gclog("phase 5: {} groups to delete", groups_to_delete.length);
                    function del_group(i) {
            if (i == groups_to_delete.length) {
                            if (done_gc) { done_gc(relinks); }
            } else {
                            var did = groups_to_delete[i];
                            gclog("phase 5: deleting group and agent for {:id}", did);
                            peer.del_group_and_agent(did, function() {
                del_group(i+1);
                            })
            }
                    }
                    del_group(0);
        });
            });
    });
    }

};


Stxt.Peer = Peer;
return Peer;
});
