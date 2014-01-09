// Copyright 2011-2013 Mozilla Foundation.
//
// Licensed under the Apache License, Version 2.0
// <LICENSE.txt or http://www.apache.org/licenses/LICENSE-2.0>
// This file may not be copied, modified, or distributed
// except according to those terms.

(function() {
"use strict";

var Assert = require('./assert.js');
var Msg = require('./msg.js');

var State = function() {
    this.types = {};
};

State.is_state_msg = function(m) {
    Assert.instanceOf(m, Msg);
    return (m.kind === Msg.KIND_EPOCH ||
            m.kind === Msg.KIND_SET ||
            m.kind === Msg.KIND_DEL ||
            m.kind === Msg.KIND_CHG);
};

State.for_each_tkv = function(ob, f) {
    Assert.isObject(ob);
    Assert.isFunction(f);
    for (var t in ob) {
        Assert.isObject(ob[t]);
        for (var k in ob[t]) {
            f(t,k,ob[t][k]);
        }
    }
};

State.from_msgs = function(msgs) {
    Assert.isArray(msgs);
    var state = new State();
    msgs.forEach(function(m) {
        if (State.is_state_msg(m)) {
            state.apply_state_msg(m);
        }
    });
    return state;
};

// State is a map of key-value maps. The first level
// map is of "types", of which the values are second-level maps.
// The second level map is indexed by "keys", of which the values
// are strings.
//
// Here are some examples of the sorts of things stored in state:
//
//
//   type     key      values
// -------------------------------------------
//
//  'group'  '<gid1>'   'share'
//           '<gid2>'   'local'
//
//  'user'   '<utag1>'  'live'
//           '<utag2>'  'idle'
//
//
// The state is considered "persistent" in the sense that on key
// rotation, the state of a group is copied forward to its next
// epoch in a sequence of initial messages.

State.prototype = {

    /**
     * Produces a deep clone (snapshot) of the first level map.
     *
     * @return {Object}  A deep clone of `this.types`.
     */
    snap: function() {
        return JSON.parse(JSON.stringify(this.types));
    },

    /**
     * Gets the second-level map for t.
     *
     * @return {Object}  If there is an entry for t, else {}.
     */
    get_keys: function(t) {
        Assert.isString(t);
        if (t in this.types) {
            return this.types[t];
        } else {
            return {};
        }
    },

    /**
     * Gets the value associated with t[k], or null.
     *
     * @return {String}  If there is an entry for t[k], else null.
     */
    get_val: function(t, k) {
        Assert.isString(t);
        Assert.isString(k);
        if (t in this.types) {
            if (k in this.types[t]) {
                return this.types[t][k];
            }
        }
        return null;
    },

    /**
     * Sets (possibly overwriting) the state value t[k] = v.
     */
    set_val: function(t,k,v) {
        Assert.isString(t);
        Assert.isString(k);
        Assert.isString(v);
        this._get_t(t)[k] = v;
    },

    /**
     * Changes a value from one _key_ to another: atomically
     * copy v = t[k1]; delete t[k1]; t[k2] = v;
     *
     * @param {String} t   The type of key to change.
     * @param {String} k1  The key to change from.
     * @param {String} k2  The key to change to.
     * @return {bool}  If the change occurred.
     */
    chg_key: function(t,k1,k2) {
        Assert.isString(t);
        Assert.isString(k1);
        Assert.isString(k2);
        var ty = this._get_t(t);
        if (k1 in ty) {
            var v = ty[k1];
            delete ty[k1];
            ty[k2] = v;
            return true;
        } else {
            return false;
        }
    },

    /**
     * Deletes whatever value is associated with t[k].
     */
    del_key: function(t,k) {
        Assert.isString(t);
        Assert.isString(k);
        var ty = this._get_t(t);
        if (k in ty) {
            delete ty[k];
            return true;
        } else {
            return false;
        }
    },

    _get_t: function(t) {
        Assert.isString(t);
        if (! (t in this.types)) {
            this.types[t] = {};
        }
        return this.types[t];
    },

    apply_state_msg: function(m) {
        Assert.instanceOf(m, Msg);
        Assert.instanceOf(this, State);

        var state = this;

        if (m.kind === Msg.KIND_SET) {
            State.for_each_tkv(m.body, function(t,k,v) {
                state.set_val(t,k,v);
            });
        } else if (m.kind === Msg.KIND_CHG) {
            State.for_each_tkv(m.body, function(t,k1,k2) {
                state.chg_key(t,k1,k2);
            });
        } else if (m.kind === Msg.KIND_DEL) {
            for (var t in m.body) {
                state.del_key(t, m.body[t]);
            }
        } else {
            // Currently epochs are just sentinels; may grow
            // more capabilities later.
            Assert.equal(m.kind, Msg.KIND_EPOCH);
        }

        // Every message implicitly SETs the user it's from
        // to 'live' in the state['user'] map.
        state.set_val(State.TYPE_USER,
                      m.from.toString(),
                      State.USER_LIVE);
    },

};

// 'user' state entries track the members of the current group, for
// purpopses of displaying a user list, guiding cross-check and re-invite
// traffic, and (more importantly) selecting the set of users who must
// participate in a key rotation within the current group.
//
// If a user is 'live', they are considered a participant in key rotation
// and their exchange-keys must be processed before rotating to a new
// epoch.
//
// If a user is 'idle', they are not a participant in key rotation, but
// should be automatically re-invited to the group any time someone
// sees them (with high confidence) in another group.

State.TYPE_USER = 'user';
State.USER_LIVE = 'live';
State.USER_IDLE = 'idle';


// 'group' state entries track links to groups that the current group is
// carrying.
//
// If a group link G has value 'share', it should be replicated in every
// other group H that this peer X has agency in, to maximize the chance
// that some other peer Y carrying H converses with a peer Z with agency in
// G, even if Y doesn't have agency in H. In such a situation, Y is unable
// to see what's inside G, but carries G between X and Z because Y
// participates in H.
//
// Conversely, if a group link is 'local', it should not be replicated to
// other groups, on the assumption that it is either too uninteresting, too
// high volume, or too private to even consider permitting other parties to
// take note of its encrypted transport.

State.TYPE_GROUP = 'group';
State.GROUP_LOCAL = 'local';
State.GROUP_SHARE = 'share';


module.exports = State;
})();
