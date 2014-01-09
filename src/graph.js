// Copyright 2011-2013 Mozilla Foundation.
//
// Licensed under the Apache License, Version 2.0
// <LICENSE.txt or http://www.apache.org/licenses/LICENSE-2.0>
// This file may not be copied, modified, or distributed
// except according to those terms.

// Models a fully-decrypted group (message-set) as a graph based
// on the ancestry links. Graph-analytic algorithms go here.

(function() {
"use strict";

var Fmt = require('./fmt.js');
var Trace = require('./trace.js');
var Assert = require('./assert.js');
var Msg = require('./msg.js');
var State = require('./state.js');

var log = Trace.mkLog('graph');

var Graph = function(msgs) {
    this.msgs = msgs;
    this.analysis = null;
};

Graph.prototype = {

    all_msgs: function(f) {
        Assert.isFunction(f);
        for (var i in this.msgs) {
            var m = this.msgs[i];
            f(i,m);
        }
    },

    get_all_msgs: function() {
        var msgs = [];
        for (var i in this.msgs) {
            msgs.push(this.msgs[i]);
        }
        return msgs;
    },

    get_all_msgs_sorted: function() {
        var msgs = [];
        for (var i in this.msgs) {
            msgs.push(this.msgs[i]);
        }
        this.sort_msgs(msgs);
        return msgs;
    },

    get_msg: function(mid) {
        Assert.isString(mid);
        Assert.ok(mid in this.msgs);
        return this.msgs[mid];
    },

    get_doms: function(mid, doms) {
        function intersect(a,b) {
            var s = {};
            for (var i in a) {
                if (i in b) {
                    s[i] = true;
                }
            }
            return s;
        }

        if (mid in doms) {
            return doms[mid];
        }

        var d = null;
        var graph = this;
        if (mid in this.msgs) {
            var m = graph.msgs[mid];
            m.parents.forEach(function(pid) {
                var pdom = graph.get_doms(pid, doms);
                if (d) {
                    d = intersect(d, pdom);
                } else {
                    d = pdom;
                }
            });
        }
        if (!d) {
            d = {};
        }
        d[mid] = true;
        doms[mid] = d;
        return d;
    },

    get_analysis: function() {
        if (!this.analysis) {
            log("analyzing graph...");
            var ancs = {};
            var doms = {};
            var roots = {};
            var graph = this;
            var leaves = {};
            this.all_msgs(function(mid, m) {
                leaves[mid] = m;
            });
            this.all_msgs(function(mid, m) {
                graph.index_ancestry(mid, m, ancs, roots, leaves);
            });
            this.all_msgs(function(mid) {
                graph.get_doms(mid, doms);
            });
            this.analysis = {ancs: ancs,
                             doms: doms,
                             roots: roots,
                             leaves: leaves};
            log("{:len} roots, {:len} leaves, {:len} nodes",
                roots, leaves, ancs);
        }
        return this.analysis;
    },

    get_ancs: function() { return this.get_analysis().ancs; },
    get_roots: function() { return this.get_analysis().roots; },
    get_leaves: function() { return this.get_analysis().leaves; },
    dominates: function(a,b) {
        return (a in this.get_analysis().doms[b]);
    },

    index_ancestry: function(mid, m, ancs, roots, leaves) {
        Assert.isString(mid);
        Assert.instanceOf(m, Msg);
        Assert.isObject(ancs);
        Assert.isObject(roots);
        Assert.isObject(leaves);
        log("indexing ancestry of {:id}", mid);
        if (mid in ancs) {
            log("already seen {:id}", mid);
            return;
        }
        ancs[mid] = {};
        log("with {:len} parents", m.parents);
        var is_root = true;
        var graph = this;
        m.parents.forEach(function(pid) {
            if (pid in graph.msgs) {
                is_root = false;
            }
        });

        if (is_root) {
            if (mid in roots) {
                Assert.equal(roots[mid], m,
                            "index_ancestry bad root");
            } else {
                log("adding root {:id}", mid);
                roots[mid] = m;
            }
            return;
        }

        m.parents.forEach(function(pid) {
            delete leaves[pid];
            if (pid in graph.msgs) {
                // Recur on parent, then copy
                // its ancestors forward to ours.
                var p = graph.get_msg(pid);
                ancs[mid][pid] = p;
                graph.index_ancestry(pid, p, ancs, roots, leaves);
                for (var j in ancs[pid]) {
                    if (j in ancs[mid]) {
                        Assert.equal(ancs[mid][j], ancs[pid][j],
                                    "index_ancestry bad anc");
                    } else {
                        ancs[mid][j] = ancs[pid][j];
                    }
                }
            }
        });
    },

    get_ancs_of: function(mid) {
        var msgs = [];
        Assert.isString(mid);
        var ancs = this.get_analysis().ancs;
        Assert.isObject(ancs);
        if (mid in ancs) {
            for (var i in ancs[mid]) {
                msgs.push(ancs[mid][i]);
            }
        }
        return msgs;
    },

    get_root: function() {
        var roots = this.get_roots();
        var rs = [];
        for (var i in roots) {
            rs.push(roots[i]);
        }
        this.sort_msgs(rs);
        // If there are multiple roots it's not a big deal; we pick the
        // first (which degrades to "trusting their timestamps") and assume
        // that anyone else in the group is co-operating, since they could
        // always manufacture a group that was earlier or redundant by any
        // other measure we chose as well.
        var n = Fmt.len(rs);
        if (n === 0) {
            return null;
        }
        return rs[0];
    },

    leaf_ids: function() {
        return Object.keys(this.get_leaves());
    },

    sort_msgs: function(msgs) {
        var ancs = this.get_ancs();
        function cmp(a,b) {

            // negative if a < b
            // 0 if a == b
            // positive if a > b
            //
            // a < b  <=>  a is ancestor-of b
            //        <=>  a is in b.ancestors
            //
            // When neither is an ancestor of another,
            // we drop down to lexical compare on the
            // the timestamps embedded on the messages,
            // which might also be equal; if so we go
            // with lexical compare on the message ids!
            // This should get us a full order.

            if (a.id in ancs[b.id]) {
                return -1;
            } else if (b.id in ancs[a.id]) {
                return 1;
            } else {
                if (a.time < b.time) {
                    return -1;
                } else if (b.time < a.time) {
                    return 1;
                } else {
                    if (a.id < b.id) {
                        return -1;
                    } else if (b.id < a.id) {
                        return 1;
                    } else {
                        return 0;
                    }
                }
            }
        }
        msgs.sort(cmp);
        return msgs;
    },

    calculate_state_of: function(mid) {
        return State.from_msgs(this.get_ancs_of(mid));
    },

    calculate_final_state: function() {
        return State.from_msgs(this.get_all_msgs());
    }

};

module.exports = Graph;
})();
