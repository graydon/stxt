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

    /**
     * Generate a random 256-bit hex nonce.
     *
     * @return {String}     The nonce.
     */
    nonce: function() {
        var secbits = sjcl.random.randomWords(8);
        return sjcl.codec.hex.fromBits(secbits);
    },

    /**
     * Add HMAC (using this.agent.key), nonce and agent/group identities to
     * a sync request or response, to make it a safe "payload" ready to
     * send over an unauthenticated RPC mechanism.
     *
     * @this {Sync}
     * @param {Object} obj        The req/res object to calculate an HMAC of.
     * @param {String} sync_gid   The current group ID being synchronized.
     * @return {Object}           A "payload object" to be serialized.
     */
    form_payload: function(obj, sync_gid) {
        Assert.instanceOf(this, Sync);
        Assert.isString(sync_gid);
        var payload = {
            agent_group: this.agent.group.id,
            sync_group: sync_gid,
            mac: Hash.hmac(this.agent.key, obj),
            body: obj,
            nonce: this.nonce()
        };
        Object.freeze(payload);
        return payload;
    },

    /**
     * Verify a "payload object" has a valid HMAC and isn't a replay of
     * a nonce we've seen before.
     *
     * @this {Sync}
     * @param {Object} payload    The payload to verify.
     * @return {bool}             True if the payload is ok, else false.
     */
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
    send_request_to_remote: function(remote, method, sync_gid, obj) {
        Assert.instanceOf(this, Sync);
        Assert.isObject(remote);
        Assert.isString(method);
        Assert.isString(sync_gid);
        Assert.isObject(obj);

        var sync = this;
        var response_d = when.defer();
        var payload = this.form_payload(obj, sync_gid);

        remote.send_request(method, payload)
            .then(function(response) {
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
     * @return Promise<>         Resolved when synchronization is complete.
     *
     */
    sync_one_group: function(remote, gid) {
        Assert.instanceOf(this, Sync);
        Assert.isObject(remote);
        Assert.isString(gid);

        var sync = this;
        var done_d = when.defer();
        function ok() { done_d.resolve(); }
        function bad(err) { done_d.reject(err); }

        sync.step(gid, {})
            .then(function(req) {
                log("sending 1st request for {:id}", gid);
                return sync.send_request_to_remote(remote, "sync_group",
                                                   gid, req);
            })
            .then(function(res) {
                log("got 1st response for {:id}", gid);
                return sync.step(gid, res);
            })
            .then(function(req) {
                if (req.envelopes.length !== 0) {
                    log("sending 2nd request for {:id}", gid);
                    return sync.send_request_to_remote(remote, "sync_group",
                                                       gid, req);
                } else {
                    ok();
                }
            })
            .then(function() {
                log("got 2nd response for {:id}", gid);
                log("synchronized {:id} after 2 RTs", gid);
                ok();
            }).otherwise(bad);
        return done_d.promise;
    },

    /**
     * Recursively sync all groups reachable from this.agent (in which
     * this.agent.peer has agency) with remote.
     *
     * @this {Sync}
     * @param {Object} remote    The remote to talk to.
     * @return Promise<>         Resolved when synchronization is complete.
     */
    do_sync: function(remote) {

        Assert.instanceOf(this, Sync);
        Assert.isObject(remote);

        log("starting top-level sync on {:id}", this.agent.group.id);
        var sync = this;

        function each(gid, group) {
            log("do_sync attempt on {:id}, group is {}null",
                gid, group ? "non-" : "");
            if (group) {
                return sync.sync_one_group(remote, gid);
            } else {
                return when.resolve(null);
            }
        }

        return this.agent.save_p()
            .then(function() {
                return sync.agent.peer.visit_agent_p(sync.agent, each);
            });
    },

    /**
     * Receive an object carrying (possibly empty, partial) arrays of
     * envelopes and envelope_ids carried on the remote peer for a given
     * group; respond with a list of the envelopes this peer has that the
     * remote peer is missing.
     *
     * @this {Sync}
     * @param {String} sync_gid    The group to synchronize.
     * @param {Object} body        Object with .envelopes and .envelope_ids.
     * @return Promise<res>        Promise for a similarly-structured object.
     */

    step: function(sync_gid, body) {
        var sync = this;
        Assert.instanceOf(sync, Sync);
        Assert.isString(sync_gid);
        Assert.isObject(body);

        var res_d = when.defer();

        sync.agent.peer.get_group(sync_gid).then(function(group) {
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
                    var e = new Msg.Envelope(sync_gid, ct);
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
                group.save().then(function() {
                    res_d.resolve(res);
                });
            } else {
                res_d.resolve(res);
            }
        }).otherwise(function(err) {
            res_d.reject(err);
        });
        return res_d.promise;
    },

    // Server methods: callbacks from an RPC host environment.
    sync_group: function(req) {
        Assert.instanceOf(this, Sync);
        var sync = this;
        var payload_d = when.defer();
        sync.step(req.sync_group, req.body)
            .then(function(res) {
                payload_d.resolve(sync.form_payload(res, req.sync_group));
            }).otherwise(function(err) {
                payload_d.reject(err);
            });
        return payload_d.promise;
    },
};

// A fake remote to talk between local peers, for testing and
// such.
Sync.Loopback = function(peer) {
    this.peer = peer;
    this.syncs = {};
};
Sync.Loopback.prototype = {
    step_sync: function(sync, payload) {
        var payload_d = when.defer();
        log("in loopback.step_sync(...)");
        Assert.ok(sync.verify_payload(payload));
        log("payload verified");
        sync.step(payload.sync_group, payload.body)
            .then(function(res) {
                payload_d.resolve(sync.form_payload(res, payload.sync_group));
            }).otherwise(function(err) {
                payload_d.reject(err);
            });
        return payload_d.promise;
    },
    send_request: function(method, payload) {
        log("in loopback.send_request({}, ..)", method);
        Assert.equal(method, "sync_group");
        Assert.isObject(payload);
        var gid = payload.agent_group;
        if (gid in this.syncs) {
            return this.step_sync(this.syncs[gid], payload);
        } else {
            var loopback = this;
            return this.peer.get_agent(gid).then(function(agent) {
                var sync = new Sync(agent);
                loopback.syncs[gid] = sync;
                return loopback.step_sync(sync, payload);
            });
        }
    }
};

module.exports = Sync;
})();
