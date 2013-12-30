(function() {
"use strict";

/* global describe */
/* global it */
/* jshint maxlen: 100 */

var when = require('when');

require('when/monitor/console');

var Stxt = require('../src/stxt.js');

var log = Stxt.Trace.mkLog('test');

var Assert = Stxt.Assert;
describe('Basic', function(){
    it('testsuite functions', function(){
        Assert.ok(Stxt.return_true());
    });
});

var Fmt = Stxt.Fmt;
describe('Fmt', function() {
    it('abbreviates long lines', function() {
        Assert.equal(Fmt.abbrev('hello chicken delicious'),
                     'hello ch');
    });
    it('leaves short lines alone', function() {
        Assert.equal(Fmt.abbrev('hello'), 'hello');
    });
    it('measures length of arrays', function() {
        Assert.equal(Fmt.len([1,2,3]), 3);
    });
    it('measures length of objects', function() {
        Assert.equal(Fmt.len({a:10, b:11, c:12}), 3);
    });
    it('0-pads strings', function() {
        Assert.equal(Fmt.pad('noodle', 10), 'noodle\0\0\0\0');
    });
    it('avoids padding when unneeded', function() {
        Assert.equal(Fmt.pad('noodle',6), 'noodle');
        Assert.equal(Fmt.pad('noodle',4), 'noodle');
    });
    it('strips padding when present', function() {
        Assert.equal(Fmt.unpad(Fmt.pad('noodle', 10)), 'noodle');
    });
    it('strips padding when not present', function() {
        Assert.equal(Fmt.unpad(Fmt.pad('noodle', 4)), 'noodle');
    });
});

describe('Hash (sha256)', function(){
    var Hash = Stxt.Hash;
    it('passes 3 sha256 test vectors', function(){
        var sha256_tvecs = [
            // Nb: the test input is JSON.stringify(input), so 'a' is actually '"a"'.
            ['a', 'ac8d8342bbb2362d13f0a559a3621bb407011368895164b628a54f7fc33fc43c'],
            ['dog', 'a52e833634f22ad98e3ff8814fa79b59d3e5645dcf7cca077c606402c0d2d4f3'],
            ['cat', 'e852be0aa593e30e99f250e7b39a3741d00bb1b86796303bded2c9aa5d7fcc08']
        ];
        sha256_tvecs.forEach(function(pair) {
            Assert.equal(Hash.hash(pair[0]), pair[1]);
        });
    });

    it('passes 3 sha256-hmac test vectors', function(){
        var sha256_hmac_tvecs = [
            // Nb: the test input is JSON.stringify(input), so 'a' is actually '"a"'.
            ['a', 'ff35f5eb3de1ed78d45a5cbd64c3907017846831f34c4a5c760786a730a4ece4'],
            ['dog', '883be5dd16f36bb8f42859c2bc74825723ec9e3612405361589541773bcc1922'],
            ['cat', 'eda926345c0cfd718c43a645403cd918f55b5b39c4d9687ecf91ed75bc38ef66']
        ];
        sha256_hmac_tvecs.forEach(function(pair) {
            Assert.equal(Hash.hmac("key", pair[0]), pair[1]);
        });
    });
});

describe('Tag', function(){
    var Tag = Stxt.Tag;
    var bob = Tag.new_user('bob');
    var conv = Tag.new_group('conv');
    it('generates tags with correct nick and kind', function(){
        Assert.equal(bob.kind, 'u');
        Assert.equal(bob.nick, 'bob');
        Assert.equal(conv.kind, 'g');
        Assert.equal(conv.nick, 'conv');
    });
    it('can re-parse its own stringification', function(){
        Assert.deepEqual(bob, Tag.parse(bob.toString()));
        Assert.deepEqual(conv, Tag.parse(conv.toString()));
    });
});

describe('Curve25519', function() {

    this.timeout(500);

    var c255 = Stxt.curve25519;
    it('passes the first 10 donna test vectors', function() {
        var donna_tvecs = [
            ["0300000000000000000000000000000000000000000000000000000000000000",
             "0900000000000000000000000000000000000000000000000000000000000000",
             "2fe57da347cd62431528daac5fbb290730fff684afc4cfc2ed90995f58cb3b74"],
            ["0500000000000000000000000000000000000000000000000000000000000000",
             "2fe57da347cd62431528daac5fbb290730fff684afc4cfc2ed90995f58cb3b74",
             "93fea2a7c1aeb62cfd6452ff5badae8bdffcbd7196dc910c89944006d85dbb68"],
            ["0500000000000000000000000000000000000000000000000000000000000000",
             "0900000000000000000000000000000000000000000000000000000000000000",
             "2fe57da347cd62431528daac5fbb290730fff684afc4cfc2ed90995f58cb3b74"],
            ["0300000000000000000000000000000000000000000000000000000000000000",
             "2fe57da347cd62431528daac5fbb290730fff684afc4cfc2ed90995f58cb3b74",
             "93fea2a7c1aeb62cfd6452ff5badae8bdffcbd7196dc910c89944006d85dbb68"],
            ["2ce57da347cd62431528daac5fbb290730fff684afc4cfc2ed90995f58cb3b74",
             "9afea2a7c1aeb62cfd6452ff5badae8bdffcbd7196dc910c89944006d85dbb68",
             "2f166b2aa2bb677827572fa3606e9d143523d9c135cdf2403af28a1bf246a10a"],
            ["2ae57da347cd62431528daac5fbb290730fff684afc4cfc2ed90995f58cb3b74",
             "2f166b2aa2bb677827572fa3606e9d143523d9c135cdf2403af28a1bf246a10a",
             "fd2fbba00d997278a75827810b4efc5c1259c731cb6a7185deed26fe6413f005"],
            ["2ae57da347cd62431528daac5fbb290730fff684afc4cfc2ed90995f58cb3b74",
             "9afea2a7c1aeb62cfd6452ff5badae8bdffcbd7196dc910c89944006d85dbb68",
             "2f166b2aa2bb677827572fa3606e9d143523d9c135cdf2403af28a1bf246a10a"],
            ["2ce57da347cd62431528daac5fbb290730fff684afc4cfc2ed90995f58cb3b74",
             "2f166b2aa2bb677827572fa3606e9d143523d9c135cdf2403af28a1bf246a10a",
             "fd2fbba00d997278a75827810b4efc5c1259c731cb6a7185deed26fe6413f005"],
            ["03f31689e576053b327ff50f3fd5b41305dc2f459a093d82d7621344aa8d9a7e",
             "67d11907cc37c4545a3c757e50e352d7cda57a405db6e089577966f8bc4e4b6d",
             "593251e741a7a6b24be916b624d43f3b20a3a2244c8003722e9765cff71ca857"],
            ["05f31689e576053b327ff50f3fd5b41305dc2f459a093d82d7621344aa8d9a7e",
             "593251e741a7a6b24be916b624d43f3b20a3a2244c8003722e9765cff71ca857",
             "fd52d04fe48fe65107680ee175cbfab3fb526e7412bc95806a44c6f88676f877"],
        ];
        donna_tvecs.forEach(function(triple) {
            var r = c255.crypto_scalarmult(c255.from_hex(triple[0]),
                                           c255.from_hex(triple[1]));
            Assert.equal(c255.to_hex(r), triple[2]);
        });
    });
});

var Store = Stxt.Store;
describe('Store', function() {

    function new_db_with_two_rows() {
        var store = new Store("mem", "Memory", Store.Memory.driver);
        var store_d = when.defer();
        store.put_p('group', 'foo', 'bar')
            .then(function() {
                return store.put_p('group', 'baz', 'quux');
            })
            .then(function() {
                store_d.resolve(store);
            });
        return store_d.promise;
    }

    describe('Memory driver', function() {

        it("supports put", function(done) {
            new_db_with_two_rows()
                .then(function() {
                    done();
                })
                .done(null, done);
        });

        it("supports put => has/!has", function(done) {
            new_db_with_two_rows()
                .then(function(store) {
                    return store.has_p('group', 'foo')
                        .then(function(v) {
                            Assert.ok(v);
                            return store.has_p('group', 'baz');
                        })
                        .then(function(v) {
                            Assert.ok(v);
                            return store.has_p('group', 'nope');
                        })
                        .then(function(v) {
                            Assert.notOk(v);
                            done();
                        });
                })
                .done(null, done);
        });

        it("supports put => get", function(done) {
            new_db_with_two_rows()
                .then(function(store) {
                    return store.get_p('group', 'foo')
                        .then(function(v) {
                            Assert.equal(v, 'bar');
                            return store.get_p('group', 'baz');
                        })
                        .then(function(v) {
                            Assert.equal(v, 'quux');
                            done();
                        });
                })
                .done(null, done);
        });

        it("supports put => keys", function(done) {
            new_db_with_two_rows()
                .then(function(store) {
                    return store.keys_p('group')
                        .then(function(ks) {
                            Assert.isArray(ks);
                            ks.sort();
                            Assert.deepEqual(ks, ['baz', 'foo']);
                            done();
                        });
                })
                .done(null, done);
        });

        it("supports put => del => !has", function(done) {
            new_db_with_two_rows()
                .then(function(store) {
                    return store.has_p('group', 'foo')
                        .then(function(v) {
                            Assert.ok(v);
                            return store.del_p('group', 'foo');
                        })
                        .then(function() {
                            return store.has_p('group', 'foo');
                        })
                        .then(function(v) {
                            Assert.notOk(v);
                            done();
                        });
                })
                .done(null, done);
        });
    });
});

var Peer = Stxt.Peer;
var Agent = Stxt.Agent;

function new_named_mem_peer(name) {
    var store = new Store("mem", "Memory",
                          Store.Memory.driver);
    return Peer.attach(store, name, "testpass");
}

function new_mem_peer() {
    return new_named_mem_peer("testuser");
}

function new_mem_peer_root_agent() {
    var agent_d = when.defer();
    new_named_mem_peer("testuser")
        .then(function(peer) {
            agent_d.resolve(peer.get_root_agent());
        }).otherwise(function(err) {
            agent_d.reject(err);
        });
    return agent_d.promise;
}

describe('Peer', function() {
    it("can attach", function(done) {
        new_mem_peer().then(function(peer) {
            Assert.instanceOf(peer, Peer);
            done();
        })
        .done(null, done);
    });
});


var Msg = Stxt.Msg;
function add_messages_and_sort(agent) {
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
    var graph = agent.get_graph();
    graph.sort_msgs(msgs);
    log("resulting order");
    for (var i in msgs) {
        log("    {:id}", msgs[i].id);
    }
    log("checking order");
    Assert.deepEqual(msgs, [x,y,z]);
    Assert.notOk(msgs[0].has_parent_id(msgs[0].id));
    Assert.ok(msgs[1].has_parent_id(msgs[0].id));
    Assert.ok(msgs[2].has_parent_id(msgs[0].id));
    Assert.ok(msgs[2].has_parent_id(msgs[1].id));
    Assert.ok(graph.dominates(msgs[0].id, msgs[1].id));
    Assert.ok(graph.dominates(msgs[0].id, msgs[2].id));
}

describe('Agent', function() {

    it("can instantiate for peer's root group", function(done) {
        new_mem_peer_root_agent().then(function(agent) {
            Assert.instanceOf(agent, Agent);
            done();
        })
        .done(null, done);
    });

    it("can inject messages", function(done) {
        new_mem_peer_root_agent().then(function(agent) {
            add_messages_and_sort(agent);
            done();
        })
        .done(null, done);
    });

    it("can link groups together", function(done) {
        new_mem_peer_root_agent().then(function(root_agent) {
            var peer = root_agent.peer;
            log("creating rererenced groups");
            var agent_a = peer.new_agent_with_new_group();
            var agent_b = peer.new_agent_with_new_group();
            var agent_c = peer.new_agent_with_new_group();
            add_messages_and_sort(agent_a);
            add_messages_and_sort(agent_b);
            root_agent.add_link_ref(agent_a.group.id);
            root_agent.add_link_ref(agent_b.group.id);
            root_agent.chg_link_ref(agent_b.group.id,
                                    agent_c.group.id);
            log("got link-refs:");
            var refs = root_agent.get_link_refs();
            refs.forEach(function(r) {
                log("    {:id}", r);
            });
            Assert.deepEqual(refs,
                             [agent_a.group.id,
                              agent_c.group.id]);
            done();
        }).done(null, done);
    });
});

function setup_alice_and_bob_conversation() {

    var conv_d = when.defer();

    var peer_a_p = new_named_mem_peer("alice");
    var peer_b_p = new_named_mem_peer("bob");

    when.join(peer_a_p, peer_b_p).spread(function(peer_a,
                                                  peer_b) {

        var root_agent_a_p = peer_a.get_root_agent();
        var root_agent_b_p = peer_b.get_root_agent();

        when.join(root_agent_a_p, root_agent_b_p).spread(function(root_agent_a,
                                                                  root_agent_b) {

            log("root agent A: from={}, group.id={:id}",
                root_agent_a.from(), root_agent_a.group.id);

            log("root agent B: from={}, group.id={:id}",
                root_agent_b.from(), root_agent_b.group.id);

            Assert.notEqual(root_agent_a.from().toString(),
                            root_agent_b.from().toString());

            var conv_agent_a = peer_a.new_agent_with_new_group();

            var conv_agent_b = peer_b.new_agent_with_new_group(conv_agent_a.group.id,
                                                               conv_agent_a.key);

            log("conv agent A: from={}, group.id={:id}",
                conv_agent_a.from(), conv_agent_b.group.id);

            log("conv agent B: from={}, group.id={:id}",
                conv_agent_b.from(), conv_agent_b.group.id);

            Assert.notEqual(conv_agent_a.from().toString(),
                            conv_agent_b.from().toString());

            root_agent_a.add_link_ref(conv_agent_a.group.id);
            root_agent_b.add_link_ref(conv_agent_b.group.id);

            conv_d.resolve([peer_a, peer_b,
                            root_agent_a, root_agent_b,
                            conv_agent_a, conv_agent_b]);
        }).otherwise(function(err) {
            conv_d.reject(err);
        });
    }).otherwise(function(err) {
        conv_d.reject(err);
    });
    return conv_d.promise;
}

var Sync = Stxt.Sync;
describe('Sync', function() {

    this.timeout(10000);

    it("can have a private conversation", function(done) {
        setup_alice_and_bob_conversation().spread(function(peer_a, peer_b,
                                                           root_agent_a, root_agent_b,
                                                           sub_agent_a, sub_agent_b) {

            log("instantiating pair of syncs");
            var a_sync = new Sync(sub_agent_a);
            var b_remote = new Sync.Loopback(peer_b);
            log("adding epoch if missing");
            sub_agent_a.add_epoch_if_missing();
            log("adding B as a member from A's agent");
            sub_agent_a.add_member(sub_agent_b.from());
            log("adding a ping from A's agent");
            sub_agent_a.add_ping();
            log("doing initial sync");
            a_sync.do_sync(b_remote).then(function() {
                log("decrypting all messages");
                sub_agent_b.decrypt_all();
                log("checking 3 messages arrived in agent B");
                Assert.equal(Fmt.len(sub_agent_b.msgs), 3);
                log("adding a ping from agent B");
                sub_agent_b.add_ping();
                log("doing second sync");
                return a_sync.do_sync(b_remote);
            }).then(function() {
                Assert.equal(Fmt.len(sub_agent_a.msgs), 4);
                log("adding another ping from agent A");
                sub_agent_a.add_ping();
                log("doing third sync");
                return a_sync.do_sync(b_remote);
            }).then(function() {
                Assert.equal(Fmt.len(sub_agent_b.msgs), 5);
                log("attempting to rotate from agent A");
                return when.join(sub_agent_a.maybe_derive_next_agent(),
                                 sub_agent_b.maybe_derive_next_agent());
            }).spread(function(sub_agent2_a, sub_agent2_b) {
                log("attempting to rotate from agent B");
                Assert.ok(sub_agent2_a);
                Assert.ok(sub_agent2_b);
                log("derived next-agent A: from={}, group.id={:id}",
                    sub_agent2_a.from(), sub_agent2_a.group.id);
                log("derived next-agent B: from={}, group.id={:id}",
                    sub_agent2_b.from(), sub_agent2_b.group.id);
                Assert.equal(sub_agent2_a.group.id,
                             sub_agent2_b.group.id);
                log("doing fourth  sync");
                a_sync.do_sync(b_remote)
                    .then(function() {
                        log("beginning GC");
                        return peer_a.gc_p();
                    }).then(function() {
                        log("GC complete, checking if A has group {:id}",
                            sub_agent_a.group.id);
                        peer_a.has_group(sub_agent_a.group.id)
                            .then(function(has) {
                                // Check that the old group got gc'ed
                                Assert.notOk(has);
                                done();
                            });
                    });
            });
        }).done(null, done);
    });
});


})();
