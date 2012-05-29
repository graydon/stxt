// Sneakertext testsuite.
"use strict";
if (typeof define !== 'function') { var define = require('amdefine')(module) }
define(["sjcl", "stxt/stxt", "stxt/hash", "stxt/msg",
    "stxt/key", "stxt/group", "stxt/agent",
    "stxt/store", "stxt/peer", "stxt/sync"],
function(sjcl, Stxt, Hash, Msg,
         Key, Group, Agent,
         Store, Peer, Sync) {

var log = Stxt.mkLog("test");
var Test = {};

Test.suite = {};
Test.sub = {};

Test.sub.new_named_mem_peer = function(name, cb) {
    var store = new Store("mem", "Memory",
                          Store.Memory.driver);
    Peer.attach(store, name, "testpass", cb);
};

Test.sub.new_mem_peer = function(cb) {
    Test.sub.new_named_mem_peer("testuser", cb);
};

Test.sub.add_messages_and_sort = function(agent) {
    log("making messages");
    var x = new Msg(agent.group.id, []);
    var y = new Msg(agent.group.id, [x.id]);
    var z = new Msg(agent.group.id, [x.id, y.id]);
    var msgs = [z, y, x];
    log("adding messages");
    agent.add_msg_raw(x);
    agent.add_msg_raw(y);
    agent.add_msg_raw(z);
    log("sorting messages");
    agent.get_graph().sort_msgs(msgs);
    log("resulting order");
    for (var i in msgs) {
        log("    {:id}", msgs[i].id);
    }
    Stxt.log("checking order");
    Stxt.assert(msgs[0] === x);
    Stxt.assert(msgs[1] === y);
    Stxt.assert(msgs[2] === z);
};

Test.sub.setup_alice_and_bob_conversation = function(cb) {
    Test.sub.new_named_mem_peer("alice", function(peer_a) {
        peer_a.get_root_agent(function(root_agent_a) {
            Test.sub.new_named_mem_peer("bob", function(peer_b) {
                peer_b.get_root_agent(function(root_agent_b) {
                    log("root agent A: from={}, group.id={:id}",
                        root_agent_a.from(), root_agent_a.group.id);
                    log("root agent B: from={}, group.id={:id}",
                        root_agent_b.from(), root_agent_b.group.id);
                    Stxt.assert(root_agent_a.from().toString() !=
                                root_agent_b.from().toString());
                    var sub_agent_a = peer_a.new_agent_with_new_group();

                    var sub_agent_b =
                        peer_b.new_agent_with_new_group(sub_agent_a.group.id,
                                                        sub_agent_a.key);

                    log("sub agent A: from={}, group.id={:id}",
                        sub_agent_a.from(), sub_agent_b.group.id);
                    log("sub agent B: from={}, group.id={:id}",
                        sub_agent_b.from(), sub_agent_b.group.id);
                    Stxt.assert(sub_agent_a.from().toString() !=
                                sub_agent_b.from().toString());

                    root_agent_a.add_link_ref(sub_agent_a.group.id);
                    root_agent_b.add_link_ref(sub_agent_b.group.id);
                    cb(peer_a, peer_b,
                       root_agent_a, root_agent_b,
                       sub_agent_a, sub_agent_b);
                });
            });
        });
    });
};

Test.suite.attach = function(done) {
    Test.sub.new_mem_peer(function(peer) {
        Stxt.assert(peer instanceof Peer);
    Stxt.then(done);
    });
};

Test.suite.sort_msgs = function(done) {
    Test.sub.new_mem_peer(function(peer) {
        peer.get_root_agent(function(agent) {
            Stxt.assert(agent instanceof Agent);
            Test.sub.add_messages_and_sort(agent);
        Stxt.then(done);
        });
    });
};

Test.suite.add_refs = function(done) {
    Test.sub.new_mem_peer(function(peer) {
        peer.get_root_agent(function(root_agent) {
            log("creating rererenced groups");
            var agent_a = peer.new_agent_with_new_group();
            var agent_b = peer.new_agent_with_new_group();
            var agent_c = peer.new_agent_with_new_group();
            Test.sub.add_messages_and_sort(agent_a);
            Test.sub.add_messages_and_sort(agent_b);
            root_agent.add_link_ref(agent_a.group.id);
            root_agent.add_link_ref(agent_b.group.id);
            root_agent.chg_link_ref(agent_b.group.id,
                                    agent_c.group.id);
            log("got link-refs:");
            var refs = root_agent.get_link_refs();
            refs.forEach(function(r) {
                log("    {:id}", r);
            });
            Stxt.assert(Stxt.len(refs) == 2);
            Stxt.assert(refs[0] == agent_a.group.id);
            Stxt.assert(refs[1] == agent_c.group.id);
        Stxt.then(done);
        });
    });
}

Test.suite.two_peer_exchange = function(done) {
    Test.sub.setup_alice_and_bob_conversation(function(peer_a, peer_b,
                               root_agent_a, root_agent_b,
                               sub_agent_a, sub_agent_b) {
        var a_sync = new Sync(sub_agent_a);
        var b_remote = new Sync.Loopback(peer_b);
        sub_agent_a.add_epoch_if_missing();
        sub_agent_a.add_member(sub_agent_b.from());
        sub_agent_a.add_ping();
        a_sync.do_sync(b_remote, function() {
            sub_agent_b.decrypt_all();
            Stxt.assert(Stxt.len(sub_agent_b.msgs) == 3);
            sub_agent_b.add_ping();
            a_sync.do_sync(b_remote, function() {
                Stxt.assert(Stxt.len(sub_agent_a.msgs) == 4);
                sub_agent_a.add_ping();
                a_sync.do_sync(b_remote, function() {
                    Stxt.assert(Stxt.len(sub_agent_b.msgs) == 5);
                    sub_agent_a.maybe_derive_next_agent(function(sub_agent2_a) {
                        sub_agent_b.maybe_derive_next_agent(function(sub_agent2_b) {
                            Stxt.assert(sub_agent2_a);
                            Stxt.assert(sub_agent2_b);
                            log("derived next-agent A: from={}, group.id={:id}",
                                sub_agent2_a.from(), sub_agent2_a.group.id);
                            log("derived next-agent B: from={}, group.id={:id}",
                                sub_agent2_b.from(), sub_agent2_b.group.id);
                            Stxt.assert(sub_agent2_a.group.id ==
                                        sub_agent2_b.group.id);
                            a_sync.do_sync(b_remote, function() {
                                peer_a.gc(function() {
                                    peer_a.has_group(sub_agent_a.group.id, function(has) {
                                        // Check that the old group got gc'ed
                                        Stxt.assert(!has);
                                        Stxt.then(done);
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

Test.all_tests = function() {
    var passes = [];
    var fails = [];
    var all_tests = Object.keys(Test.suite);
    var run_test = function(i, done) {
    if (i >= all_tests.length) {
        Stxt.then(done);
    } else {
        var n = all_tests[i];
            var t = Test.suite[n];
            log("*** TEST: {} ***", n);
            var passed = false;
            try {
        t(function() {
            log("*** PASS: {} ***", n);
            passes.push(n);
            Stxt.then(run_test, [i+1, done]);
        });
            } catch (e) {
        log("*** FAIL: {} ***", n);
        fails.push(n);
        log(e.stack);
        Stxt.then(run_test, [i+1, done]);
            }
    }
    };
    run_test(0, function() {
    log("*** TOTAL: {} PASS, {} FAIL ***",
            passes.length, fails.length);
    if (fails.length > 0) {
            log("*** FAILS: {:join(', ')} ***", fails);
    }
    });
};
Stxt.Test = Test;
return Test;
});
