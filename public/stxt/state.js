"use strict";
if (typeof define !== 'function') { var define = require('amdefine')(module) }
define(["stxt/stxt"],
function(Stxt) {

var State = function() {
    this.types = {};
};

State.prototype = {

    snap: function() {
        return JSON.parse(JSON.stringify(this.types));
    },

    get_keys: function(t) {
        if (t in this.types) {
            return this.types[t]
        } else {
            return {};
        }
    },

    get_vals: function(t, k) {
        if (t in this.types) {
            if (k in this.types[t]) {
                return this.types[t][k];
            }
        }
        return [];
    },

    get_t: function(t) {
        if (! (t in this.types)) {
            this.types[t] = {};
        }
        return this.types[t];
    },

    get_tk: function(t,k) {
        var ty = this.get_t(t);
        if (! (k in ty)) {
            ty[k] = [];
        }
        return ty[k];
    },

    add_tkv: function(t,k,v) {
        Stxt.assert(typeof t == "string");
        Stxt.assert(typeof k == "string");
        Stxt.assert(typeof v == "string");
        this.get_tk(t,k).push(v);
    },

    del_tkv: function(t,k,v) {
        Stxt.assert(typeof t == "string");
        Stxt.assert(typeof k == "string");
        Stxt.assert(typeof v == "string");
        // del deletes a single k=v pair. If no such pair
        // exists, it does nothing.
        var ty = this.get_t(t);
        if (k in ty) {
            var e = ty[k];
            var ix = e.indexOf(v);
            if (ix != -1) {
                e.splice(ix,1)
                if (e.length == 0) {
                    delete ty[k];
                }
                return true;
            }
        }
        return false;
    },

    chg_tkv: function(t,k,v1,v2) {
        Stxt.assert(typeof t == "string");
        Stxt.assert(typeof k == "string");
        Stxt.assert(typeof v1 == "string");
        Stxt.assert(typeof v2 == "string");
        // chg is exactly the same as add+del, it changes
        // only _one_ occurrence of t:k=v1 => t:k=v2, not all.
        //
        // If there are no occurrences, it does nothing.
        if (this.del_tkv(t,k,v1)) {
            this.add_tkv(t,k,v2);
        }
    }
};

Stxt.State = State;
return State;
});
