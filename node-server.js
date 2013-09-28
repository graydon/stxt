// Copyright 2011-2013 Mozilla Foundation.
//
// Licensed under the Apache License, Version 2.0
// <LICENSE.txt or http://www.apache.org/licenses/LICENSE-2.0>
// This file may not be copied, modified, or distributed
// except according to those terms.

// Sneakertext server for node.js

"use strict";
var PORT = 8080;

var requirejs = require("requirejs");
requirejs.config({ baseUrl: "./public",
                   paths: {fomatto: "/hide-me1",
                           sjcl: "/hide-me2"},
                   // NB: what's going on here is we're telling
                   // require.js to not-know how to find 'sjcl' xso
                   // that it asks node.  This in turn gets node to go
                   // dig into node_modules/sjcl/index.js so you
                   // should make sure that file is an up-to-date copy
                   // of the sjcl.js file the browser is using,
                   // assuming you want them to be the same code.
                   //
                   // Same deal with fomatto.
                   nodeRequire: require
                 });
requirejs([
    // These come from public/ and are for the stxt logic
    // itself: code shared with web clients.
    "sjcl", "stxt/stxt", "stxt/store", "stxt/peer", "stxt/sync",

    // These come from node_modules and are for the node
    // server process, don't need to be public.
    "crypto", "http", "node-static", "deimos", "os", "ministore"
],
function(sjcl, Stxt, Store, Peer, Sync,
         crypto, http, www, rpc, os, ministore) {

var log = Stxt.mkLog("server");
var hlog = Stxt.mkLog("http");
var jlog = Stxt.mkLog("jsonrpc");

log("startup...");

sjcl.random.addEventListener("progress", function(n) {
    log("seeding progres... " + n);
});

sjcl.random.addEventListener("seeded", function() {
    log("seeded!");

    var store = new Store("node", "MiniStore", ministore);
    Peer.attach(store, "server", "pw", function(peer) {
        function dispatch_rpc(method, cb) {
            return function(rpc, args) {
                if (! (args instanceof Array) ||
                    args.length != 1) {
                    rpc.invalidParams();
                    jlog('invalid params');
                    return;
                }
                var payload = args[0];
                var maybe_rotate = function(agent, cb) {
                    agent.maybe_derive_next_agent(function(agent2) {
                        if (agent2) {
                            if (!agent2.member_has_committed(agent2.from())) {
                                agent2.add_ping();
                            }
                        }
                        peer.gc(cb);
                    });
                };

                var gid = payload.agent_group;
                if (typeof gid != "string") {
                    jlog("non-string group id");
                    rpc.invalidParams();
                    return;
                }
                gid = gid.replace(/[^a-zA-Z0-9]/g, "");
                peer.has_agent(gid, function(has_agent) {
                    if (!has_agent) {
                        rpc.invalidParams();
                        jlog('unknown group: {:id}', gid);
                        return;
                    }

                    peer.get_agent(gid, function(agent) {
                        var sync = new Sync(agent);
                        if (!sync.verify_payload(payload)) {
                            rpc.invalidParams();
                            jlog("verify failed");
                            return;
                        }

                        maybe_rotate(agent, function() {
                            sync[method](payload, function(res) {
                                maybe_rotate(agent, function() {
                                    jlog("OK, sending response payload");
                                    rpc.response(res);
                                })
                            });
                        });
                    });
                });
            };
        }
        var methods = ["sync_group"];
        var rpc_methods = { };
        for (var i in methods) {
            jlog("registered RPC method for '{}'", methods[i]);
            rpc_methods[methods[i]] = dispatch_rpc(methods[i]);
        }

        // start server
        var file = new www.Server('./public', {cache: 0});
        http.createServer(function (request, response) {
            if(request.method == 'POST') {
                // if POST request, handle RPC
                hlog('POST request');
                new rpc.RpcHandler(request, response, rpc_methods, true);
            } else if (request.method == 'OPTIONS') {
                // We allow CORS so that clients from other domains
                // running dumb servers can talk to us.
                hlog('OPTIONS preflight-request');
                var headers = {};
                headers["Access-Control-Allow-Origin"] = "*";
                headers["Access-Control-Allow-Methods"] =
                    "POST, GET, PUT, DELETE, OPTIONS";
                headers["Access-Control-Allow-Credentials"] = false;
                headers["Access-Control-Max-Age"] = '86400'; // 24 hours
                headers["Access-Control-Allow-Headers"] =
                    "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept";
                response.writeHead(200, headers);
                response.end();
            } else {
                // if GET request, serve static
                hlog('GET: {}', request.url);
                file.serve(request, response);
            }
        }).listen(PORT);

        var ifaces = os.networkInterfaces();
        var ip = null;
        for (var i in ifaces["eth0"]) {
            var iface = ifaces["eth0"][i];
            if (iface.family == "IPv4" && iface.internal == false) {
                ip = iface.address;
            }
        }
        if (!ip) {
            ip = "localhost";
        }
        hlog("stxt HTTP service listening on {}:{}", ip, PORT);

        peer.get_root_agent(function(root_agent) {
            var invite_group_agent = peer.new_agent_with_new_group();
            invite_group_agent.add_epoch_if_missing();
            root_agent.add_link_ref(invite_group_agent.id);
            invite_group_agent.save(function() {
                log("invite group is: http://{}:{}/index.html#!g={}&k={}",
                    ip, PORT,
                    invite_group_agent.group.id,
                    invite_group_agent.key);
                log("ready");
            });
        });
    });
});

sjcl.random.addEntropy(crypto.randomBytes(1024));

});

