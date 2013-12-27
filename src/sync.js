// Copyright 2011-2013 Mozilla Foundation.
//
// Licensed under the Apache License, Version 2.0
// <LICENSE.txt or http://www.apache.org/licenses/LICENSE-2.0>
// This file may not be copied, modified, or distributed
// except according to those terms.

// A sync operation is focused on reconciling some portion of a peer's
// state with a remote peer. The remote peer is presented behind an
// RPC interface. At this point there's only one, which is JSON-RPC,
// defined over in stxt.web.
//
// Sync operations are driven from the client's do_sync method; a
// server is called by whatever framework is hosting the service
// (usually node / JSON-RPC) and simply steps through whatever part of
// the sync it can manage.
//
// Every sync operation is associated with an agent. The agent's group
// serves both as the focus of the conversation and the source of
// authenticators used during the exchange. Both peers must therefore
// have agency within the primary group of a sync; the requests sent
// to the RPC are all hmac'ed with the agent's (shared) group key.
//
// Sync proceeds in two steps:
//
//   1. Synchronize all the envelopes in the agent's group.
//
//   2. After decrypting the agent's group and reading its current
//      state: for every group referenced in that state, synchronize
//      the referenced-group's envelopes. This _might_ cause
//      recurrence to step #1 if one of the referenced groups is one
//      the peer has agency in. But if not, at least the carried
//      envelopes have been transferred.

(function() {
"use strict";

var sjcl = require('sjcl');
var when = require('when');

var Assert = require('./assert.js');
var Hash = require('./hash.js');
var Msg = require('./msg.js');
var Trace = require('./trace.js');

var log = Trace.mkLog("sync");

var Sync = function(agent) {
    log("new: agent group={:id}", agent.group.id);
    this.agent = agent;
    this.nonces = {};
};

Sync.prototype = {
    nonce: function() {
        var secbits = sjcl.random.randomWords(8);
        return sjcl.codec.hex.fromBits(secbits);
    },
    form_payload: function(obj, sync_gid) {
        Assert.instanceOf(this, Sync);
        return {
            agent_group: this.agent.group.id,
            sync_group: sync_gid,
            mac: Hash.hmac(this.agent.key, obj),
            body: obj,
            nonce: this.nonce()
        };
    },
    verify_payload: function(payload) {
        Assert.instanceOf(this, Sync);
        if (payload.nonce in this.nonces) {
            log("nonce reuse, rejecting");
            return false;
        }
        if (payload.mac !== Hash.hmac(this.agent.key,
                                      payload.body)) {
            log("bad hmac, rejecting");
            return false;
        }
        this.nonces[payload.nonce] = true;
        return true;
    },

    /**
     * Encode request payload, send to a remote, verify response.
     *
     * @this {Sync}
     * @param {Object} remote     The remote to talk to.
     * @param {String} method     The method-name to RPC on the remote.
     * @param {String} sync_gid   The group ID to synchronize.
     * @return {Promise<Object>}  The response's .body field.
     */
    send_request: function(remote, method, sync_gid, obj) {
        Assert.instanceOf(this, Sync);
        Assert.isObject(remote);
        Assert.isString(method);
        Assert.isString(sync_gid);
        Assert.isObject(obj);
        var sync = this;
        var response_d = when.defer();
        var payload = this.form_payload(obj, sync_gid);
        remote.send_request(method, payload, function(response) {
            if (sync.verify_payload(response)) {
                response_d.resolve(response.body);
            } else {
                response_d.reject("payload verification failed");
            }
        });
        return response_d.promise;
    },

    /**
     * Send messages in group to remote, and receive any missing messages.
     *
     * @this {Sync}
     * @param {Object} remote    The remote to talk to.
     * @param {String} gid       The group to synchronize.
     * @return Promise<>         Fires when synchronization is complete.
     *
     */
    sync_one_group: function(remote, gid) {
        Assert.instanceOf(this, Sync);
        Assert.isObject(remote);
        Assert.isString(gid);
        var sync = this;
        var done_d = when.defer();
        sync.step(gid, {}, function(req) {
            log("sending first request for {:id}", gid);
            sync.send_request(remote, "sync_group", gid, req)
                .then(function(res) {
                    log("got first response for {:id}", gid);
                    sync.step(gid, res, function(req) {
                        if (req.envelopes.length !== 0) {
                            log("sending second request for {:id}", gid);
                            sync.send_request(remote, "sync_group", gid, req)
                                .then(function() {
                                    log("got second response for {:id}", gid);
                                    log("synchronized {:id} " +
                                        "after 2 round trips",
                                        gid);
                                    done_d.resolve();
                                })
                                .otherwise(function(err) {
                                    done_d.reject(err);
                                });
                        } else {
                            log("synchronized {:id} after 1 round trip", gid);
                            done_d.resolve();
                        }
                    });
                })
            .otherwise(function(err) {
                done_d.reject(err);
            });
        });
        return done_d.promise;
    },

    // Client method: sync that will make RPCs.
    do_sync: function(remote, cb) {
        Assert.instanceOf(this, Sync);
        log("starting top-level sync on {:id}", this.agent.group.id);
        var sync = this;
        this.agent.save(function() {
            sync.agent.peer.visit_agent(
                sync.agent,
                function(gid, group, agent, more) {
                    log("do_sync attempt on {:id}, group is {}null",
                        gid, group ? "non-" : "");
                    if (group) {
                        sync.sync_one_group(remote, gid, more).then(more);
                    } else {
                        more();
                    }
                }, function() { if (cb) { cb(); } });
        });
    },

    // Symmetric operation done on client and server: takes a sync
    // gid and partial list of envelope_ids in the other peer and
    // possibly a bunch of actual envelopes we're missing. Adds
    // the ones we don't have to our db, loads and sends the ones
    // we have that the other peer doesn't.
    step: function(sync_group, body, cb) {
        var sync = this;
        Assert.instanceOf(sync, Sync);
        sync.agent.peer.get_group(sync_group).done(function(group) {
            var res = {envelope_ids: group.list_envelopes()};
            var send_candidates = {};

            var dirty = false;
            var n_candidate = 0;
            var n_inhibited_envs = 0;
            var n_inhibited_ids = 0;
            var n_to_send = 0;

            res.envelope_ids.forEach(function(e) {
                n_candidate++;
                send_candidates[e] = true;
            });

            if ('envelopes' in body) {
                body.envelopes.forEach(function(ct) {
                    var e = new Msg.Envelope(sync_group, ct);
                    var id = e.id;
                    if (group.has_envelope(id)) {
                        log("redundant envelope: {:id}", id);
                    } else {
                        log("new envelope: {:id}", id);
                        dirty = true;
                        group.add_envelope(e);
                    }
                    n_inhibited_envs++;
                    delete send_candidates[id];
                });
            }

            if ('envelope_ids' in body) {
                body.envelope_ids.forEach(function(e) {
                    if (e in send_candidates) {
                        n_inhibited_ids++;
                        delete send_candidates[e];
                    }
                });
                var cts = Object.keys(send_candidates).map(function(id) {
                    var e = group.get_envelope(id);
                    n_to_send++;
                    return e.ct;
                });
                res.envelopes = cts;
            }

            log("inhibiting {} of {} candidates ({} id/{} env)",
                (n_inhibited_ids + n_inhibited_envs),
                n_candidate,
                n_inhibited_ids,
                n_inhibited_envs);
            log("sending {} fulltexts", n_to_send);

            if (dirty) {
                log("writing modified group {:id}", group.id);
                group.save(function() { cb(res); });
            } else {
                cb(res);
            }
        });
    },

    // Server methods: callbacks from an RPC host environment.
    sync_group: function(req, cb) {
        Assert.instanceOf(this, Sync);
        var sync = this;
        sync.step(req.sync_group, req.body, function(res) {
            cb(sync.form_payload(res, req.sync_group));
        });
    },
};

// A fake remote to talk between local peers, for testing and
// such.
Sync.Loopback = function(peer) {
    this.peer = peer;
    this.syncs = {};
};
Sync.Loopback.prototype = {
    step_sync: function(sync, payload, cb) {
        log("in loopback.step_sync(...)");
        Assert.ok(sync.verify_payload(payload));
        log("payload verified");
        sync.step(payload.sync_group, payload.body, function(res) {
            cb(sync.form_payload(res, payload.sync_group));
        });
    },
    send_request: function(method, payload, success) {
        log("in loopback.send_request({}, ..)", method);
        Assert.equal(method, "sync_group");
        var gid = payload.agent_group;
        if (gid in this.syncs) {
            this.step_sync(this.syncs[gid], payload, success);
        } else {
            var loopback = this;
            this.peer.get_agent(gid).done(function(agent) {
                var sync = new Sync(agent);
                loopback.syncs[gid] = sync;
                loopback.step_sync(sync, payload, success);
            });
        }
    }
};

module.exports = Sync;
})();
