// A 'web' represents a JSON-RPC interface to a 'smart' webserver,
// that is, one usable as a 'remote' in the sense of stxt.sync. Note
// that it is not necessarily the web server that this file was
// _loaded_ from.
//
// A web server may be one of two sorts:
//
//   - 'dumb': it's serving the public/ directory here and nothing
//     else, you can just copy it on to a normal website, which is
//     enough to serve a client that can be directed to other servers.
//     You're on your own for finding interesting servers to talk to.
//
//   - 'smart': it's running node-server.js. This means it's serving
//     public/ to clients that GET the site, just like a 'dumb'
//     server, but also processing POST requests (possibly CORS)
//     carrying JSON-RPC against the sneakertext data structure it's
//     holding in-memory / on-disk.
//
// We were definitely loaded off a web server of some sort; we default
// to setting up a 'web' that points back to the origin we were loaded
// from, but it's entirely possible to point it at some other 'smart'
// server.
//
// Every request sent through JSON-RPC must:
//
//    - Carry a nonce.
//    - Be associated with a 'primary' group.
//    - Be signed by the symmetric key in the primary group.
//
// The server will reject a request if any of these occur:
//
//    - It's against a 'primary' group the server doesn't have agency
//      within.
//    - It's carrying a bad signature.
//    - It carries a nonce of some successful recent operation
//      (window-size chosen by server)
//
// See commentary in stxt.sync for more discussion of this.

"use strict";
if (typeof define !== 'function') { var define = require('amdefine')(module) }

define(["zepto", "qr", "vizhash", "sjcl", "stxt/stxt",
        "stxt/group", "stxt/peer", "stxt/key", "stxt/tag",
        "stxt/agent", "stxt/store", "stxt/sync", "stxt/test"],
function($, qrcode, vizhash, sjcl, Stxt,
         Group, Peer, Key, Tag,
         Agent, Store, Sync, Test) {

var log = Stxt.mkLog("web");

var Web = function(origin) {
    if (typeof origin == "undefined") {
        origin = "/";
    }
    this.origin = origin;
    this.seq = 0;
};

Web.prototype = {
    // Called back by stxt.sync
    send_request: function(method, payload, success) {
        var id = this.seq++;
        var data = JSON.stringify({method: method,
                                   params: [payload],
                                   id: id});
        log("JSON-RPC: req #{}", id);
        $.ajax({type: 'POST',
                url: this.origin,
                data: data,
                dataType: 'json',
                success: function(data) {
                    log("JSON-RPC OK: res #{}", data.id);
                    if (typeof success == "function") {
                        success(data.result);
                    }
                },
                error: function(xhr, type, error) {
                    var json = JSON.parse(xhr.responseText);
                    log("JSON-RPC ERR: res #{} {}",
                        json.id, json.error);
                    window.xhr = xhr;
                }});
    }
};

// We also put our web-UI code in here, since it's only
// ever relevant in the web-client context.

Web.go = function() {

    // Until we have reasonable versioning worked out
    // we'll just kill localstore when we arrive.
    localStorage.clear()

    var draw_group_vizhash = function(text) {
        var vhash = vizhash.canvasHash(text, 74, 74);
    $("#group-viz").html("");
        $("#group-viz").append(vhash.canvas);
    }

    var create_qrcode = function(text, version, level) {
        var qr = qrcode(version, level);
        qr.addData(text);
        qr.make();
        return qr.createImgTag();
    };

    var draw_group_qrcode = function(text) {
        $("#group-qr").html("");
        $("#group-qr").html(create_qrcode(text, 3, 'L'));
    };

    var draw_member_list = function() {
        if (window.agent) {
            $("#members").html("");
            var members = window.agent.get_members();
            for (var i in members) {
                var tag = members[i];
                var vhash = vizhash.canvasHash(tag.toString(), 50, 12);
                var cell = function(inner) { return $("<td></td>").append(inner) };
                $("#members").append($("<tr></tr>")
                                     .append(cell(vhash.canvas))
                                     .append(cell(tag.toString()))
                                    );
            };
        }
    };

    var show_invite = function() {
        if (window.agent) {
            var url = location.origin + location.pathname +
                "#!g=" + agent.group.id +
                "&k=" + agent.key;
            $("#invite-qr").html(create_qrcode(url, 10, 'M'));
            $("#invite-link").attr("href", url);
            $("#invite").css("display", "block");
        }
    };

    var dismiss_invite = function() {
        $("#invite-qr").html("");
        $("#invite-link").attr("href", "");
        $("#invite").css("display", "none");
    };

    window.$ = $;

    $("#dismiss").on("click", dismiss_invite);

    var out = $("#output")[0];
    out.lines = [];
    var max_lines = 100;

    var putline = function(txt, s) {
        txt.lines.push(s);
        if (txt.lines.length > max_lines) {
            txt.lines.shift();
        }
        txt.value = txt.lines.join("\n");
        txt.scrollTop = txt.scrollHeight;
    }

    Stxt.log = (function() {
        var log = $("#log")[0];
        log.lines = [];
        return function(s) {
            putline(log, "<log> " + s);
        };
    })();

    var repaint_output = function() {
    function repaint_agent(agent) {
        log("showing messages from {:id}", agent.group.id);
        if (agent.group.id != window.agent.group.id) {
        set_agent(agent);
        }
        var msgs = agent.get_msgs_by("kind", "chat");
        msgs.forEach(function(m) {
                putline(out, "<" + m.from.toString() + "> " + m.body.text);
        });
        if (agent.next) {
        var peer = agent.peer;
        peer.has_agent(agent.next, function(has) {
            if (has) {
            peer.get_agent(agent.next, repaint_agent);
            } else {
            draw_member_list();
            }
        });
        } else {
        draw_member_list();
        }
    }
        if (window.agent) {
            out.value = "";
            out.lines = [];
        repaint_agent(window.agent);
        }
    };

    var set_agent = function(agent) {
    add_self_if_not_member(agent);
        window.agent = agent;
        // FIXME: use group tag
        $("#group-name")[0].innerHTML = Stxt.abbrev(agent.group.id);
        draw_group_qrcode(agent.group.id);
        draw_group_vizhash(agent.group.id);
    };

    var add_self_if_not_member = function(agent) {
    var members = agent.get_members();
    var self = agent.from().toString();
    if (! (self in members)) {
        agent.add_member(agent.from());
    }
    }

    var find_members = function(agent, name, guid) {
        var members = agent.get_members();
        var prefix = "u-" + name;
        if (guid) {
            prefix += "-" + guid;
        }
        var matches = [];
        for (var nick in members) {
            if (nick.indexOf(prefix) == 0) {
                matches.push(members[nick]);
            }
        }
        return matches;
    };

    var sync_agent = function() {
        if (window.agent) {
            var agent = window.agent;
            agent.maybe_derive_next_agent(function(agent2) {
        log("maybe_derive_new_agent returned: " + agent2);
        if (agent2 && agent2.members_have_committed()) {
                    agent = agent2;
                    set_agent(agent2);
        }

        var peer = agent.peer;
        var sync = new Sync(agent);
        var web = new Web();
        Stxt.then(function() {
            log("starting sync on {:id}", agent.group.id);
                    sync.do_sync(web, function() {
            agent.peer.gc(function(relinks) {
                            if (agent.group.id in relinks) {
                peer.get_agent(relinks[agent.group.id],
                                               function(agent) {
                           set_agent(agent);
                           repaint_output();
                                               });
                            } else {
                repaint_output();
                            }
            });
                    });
        });
        });
        }
    };

    var commands = {
        help: { args: [],
                desc: "this listing",
                exec: function() {
                    putline(out, "<help>");
                    putline(out, "<help> command list:");
                    putline(out, "<help>");
                    for (var i in commands) {
                        var c = commands[i];
                        putline(out, "<help> /" + i
                                + " " + c.args.join(" ")
                                + " -- " + c.desc);
                    }
                    putline(out, "<help>");
                } },
        invite: { args: [],
                  desc: "display invite to this group",
                  exec: show_invite },
        kick: { args: ['NAME', '[GUID]'],
                desc: "remove nickname from group",
                exec: function(name, guid) {
                    if (window.agent && typeof name == "string") {
                        var matches = find_members(window.agent, name, guid);
                        switch (matches.length) {
                            case 0:
                            putline(out, "<info> no such member found");
                            break;

                            case 1:
                            putline(out, "<info> removing member " + matches[0].toString());
                            window.agent.del_member(matches[0]);
                            break;

                            default:
                            putline(out, "<info> ambiguous /kick command");
                        }
                        draw_member_list();
                    }
                } },

        nick: { args: ['NAME', '[GUID]'],
                desc: "add or change nicknames",
                exec: function(name, guid) {
                    if (window.agent && typeof name == "string") {
                        var old = window.agent.from();
                        var matches = find_members(window.agent, name, guid);
                        switch (matches.length) {
                            case 0:
                            window.agent.tag = new Tag("u", name);
                            break;

                            case 1:
                            window.agent.tag = matches[0];
                            putline(out, "<info> found existing member " +
                                    matches[0].toString());
                            break;

                            default:
                            putline(out, "<info> ambiguous /nick command");
                        }
                        var n = window.agent.from();
                        if (n != old) {
                            putline(out, "<info> " + old.toString() + " now speaks as " + n.toString());
                            if (!window.agent.has_member(n)) {
                                if (window.agent.has_member(old)) {
                                    window.agent.chg_member(old, n);
                                } else {
                                    window.agent.add_member(n);
                                }
                                draw_member_list();
                            }
                        }
                    }
                }
              },
        sync: { args: [],
                desc: "run sync",
                exec: function() {
                    sync_agent();
                } },
        info: { args: ['[kind key]'],
                desc: "show database keys",
                exec: function(kind, key) {
                    if (window.store) {
                        if (kind) {
                            putline(out, "<info> " + kind + " " + key + ":");
                            window.store.get(kind, key, function(v) {
                                putline(out, "<info> " + JSON.stringify(JSON.parse(v),
                                                                        undefined, 4));
                            });
                        } else {
                            var kinds = ['agent', 'group', 'cfg'];
                            kinds.forEach(function(k) {
                                var ks = window.store.keys(k, function(i) {
                                    putline(out, "<info> " + k + " " + i);
                                });
                            });
                        }
                    }
                } },

        test: { args: [],
                desc: "run testsuite",
                exec: function() {
                    Test.all_tests();
                } },

        clear: { args: [],
                 desc: "clear webStorage state",
                 exec: function() {
                     localStorage.clear();
                 } }
    };

    $("#input").on('keypress',
                   function(e) {
                       if (e.keyCode == 0x0D || e.keyCode == 0x0a) {
                           var cmd = input.value.match(/^\/(\w+)\s*(.*)/);
                           if (cmd) {
                               if (cmd[1] in commands) {
                                   var c = commands[cmd[1]].exec;
                                   var args = cmd[2].split(/\s+/);
                                   c.apply(c, args);
                               } else {
                                   putline(out, "<help> unknown command: /" + cmd[1]);
                                   putline(out, "<help> try /help for list");
                               }
                           } else {
                               if (window.agent) {
                                   var s = input.value;
                                   input.value = "";
                                   window.agent.add_msg("chat", {text:s});
                                   window.agent.save(function() {
                                       repaint_output();
                                       sync_agent();
                                   });
                               } else {
                                   putline(out, "<info> no active group");
                               }
                           }
                           input.value = "";
                       }
                   });

    var seeded = function() {
        var store = new Store("web", "WebStorage", localStorage);
        Peer.attach(store, "visitor", "pw", function(peer) {
            window.store = store;
            window.peer = peer;

            // Peer now has a root group. We _might_ have arrived
            // here via a location request. If so, it's an invite,
            // we'll activate it. Otherwise we'll make a new
            // one.
            var gg = location.hash.match(/g=(\w+)/);
            var kk = location.hash.match(/k=(\w+)/);
            if (gg && kk) {
                // location.hash = "";
                var gid = gg[1];
                var key = kk[1];
                log("location group is {:id}", gid);
                peer.has_agent(gid, function(has) {
                    if (has) {
                        log("existing group {:id}", gid);
                        peer.get_agent(gid, function(agent) {
                            set_agent(agent);
                            sync_agent();
                        })
                    } else {
                        log("new group {:id}", gid);
                        var agent = peer.new_agent_with_new_group(gid, key);
                        agent.save(function() {
                            set_agent(agent);
                            sync_agent();
                        });
                    }
                });
            } else {
                log("no location group, founding new one");
                var agent = peer.new_agent_with_new_group();
                agent.add_epoch_if_missing();
                peer.get_root_agent(function(root_agent) {
                    root_agent.add_link_ref(agent.group.id);
                    agent.save(function() {
                        set_agent(agent);
                        sync_agent();
                    });
                });
            }
        });
    }

    sjcl.random.startCollectors();

    if (sjcl.random.isReady()) {
        // On chrome the PRNG seeds instantly from system.
        seeded();
    } else {
        // Elsewhere we listen for user randomness.
        sjcl.random.addEventListener("progress", function(n) {
            log("seeding progres... {}", n);
        });
        sjcl.random.addEventListener("seeded", seeded);
    }
};

Stxt.Web = Web;
return Web;
});
