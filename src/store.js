// Copyright 2011-2013 Mozilla Foundation.
//
// Licensed under the Apache License, Version 2.0
// <LICENSE.txt or http://www.apache.org/licenses/LICENSE-2.0>
// This file may not be copied, modified, or distributed
// except according to those terms.

(function() {
"use strict";

var Assert = require('./assert.js');
var when = require('when');
var nodefn = require('when/node/function');

var Store = function(name, backend, Driver) {
    Assert.isString(name);
    Assert.isString(backend);
    Assert.ok(backend in Store);
    Assert.ok(Driver);
    this.name = name;
    this.backend = backend;
    this.sub = new Store[this.backend]("stxt-" + name, Driver);
};

Store.prototype = {

    // Direct promise interfaces
    has: function(kind, key) {
        return this.sub.has(kind, key);
    },
    get: function(kind, key) {
        return this.sub.get(kind, key);
    },
    put: function(kind, key, val) {
        return this.sub.put(kind, key, val);
    },
    del: function(kind, key) {
        return this.sub.del(kind, key);
    },
    keys: function(kind) {
        return this.sub.keys(kind);
    },
};

// In browser, localStorage backend (synchronous)
Store.WebStorage = function(prefix, driver) {
    Assert.isString(prefix);
    Assert.isString(driver);
    this.prefix = prefix;
    this.driver = driver;
};
Store.WebStorage.prototype = {
    key: function(kind, key) {
        return this.prefix + ":" + kind + ":" + key;
    },
    has: function(kind, key) {
        var v = this.driver.getItem(this.key(kind,key)) != null;
        return when.resolve(v);
    },
    get: function(kind, key) {
        var v = this.driver.getItem(this.key(kind,key));
        return when.resolve(v);
    },
    put: function(kind, key, val) {
        this.driver.setItem(this.key(kind,key), val);
        return when.resolve(null);
    },
    del: function(kind, key) {
        this.driver.removeItem(this.key(kind,key));
        return when.resolve(null);
    },
    keys: function(kind) {
        var re = new RegExp("^" + this.prefix + ":(\\w+):(.*)");
        var elts = [];
        for (var i = 0; i < this.driver.length; i++) {
            var k = this.driver.key(i);
            var m = k.match(re);
            if (m[1] === kind) {
                elts.push(m[2]);
            }
        }
        return when.resolve(elts);
    }
};

// In node, ministore backend (asynchronous)
Store.MiniStore = function(prefix, Driver) {
    Assert.isString(prefix);
    Assert.ok(Driver);
    this.prefix = prefix;
    this.driver = new Driver("ministore-" + prefix);
    this.db = {};
};
Store.MiniStore.prototype = {
    get_kind: function(kind) {
        var kx = null;
        if (kind in this.db) {
            kx = this.db[kind];
        } else {
            kx = this.driver(kind);
            this.db[kind] = kx;
        }
        return kx;
    },
    has: function(kind, key) {
        return nodefn.call(this.get_kind(kind).has, key);
    },
    get: function(kind, key) {
        return nodefn.call(this.get_kind(kind).get, key);
    },
    put: function(kind, key, val) {
        return nodefn.call(this.get_kind(kind).set, key, val);
    },
    del: function(kind, key) {
        return nodefn.call(this.get_kind(kind).remove, key);
    },
    keys: function(kind) {
        return nodefn.call(this.get_kind(kind).list);
    },
};

// In-memory backend (synchronous)
Store.Memory = function(prefix, driver) {
    this.prefix = prefix;
    this.driver = driver;
    this.db = {};
};

Store.Memory.driver = function() {
    return {};
};

Store.Memory.prototype = {
    get_kind: function(kind) {
        var kx = null;
        if (kind in this.db) {
            kx = this.db[kind];
        } else {
            kx = this.driver(kind);
            this.db[kind] = kx;
        }
        return kx;
    },
    has: function(kind, key) {
        var kx = this.get_kind(kind);
        return when.resolve(key in kx);
    },
    get: function(kind, key) {
        var kx = this.get_kind(kind);
        var v = null;
        if (key in kx) {
            v = kx[key];
        }
        return when.resolve(v);
    },
    put: function(kind, key, val) {
        var kx = this.get_kind(kind);
        kx[key] = val;
        return when.resolve(null);
    },
    del: function(kind, key) {
        var kx = this.get_kind(kind);
        delete kx[key];
        return when.resolve(null);
    },
    keys: function(kind) {
        var k = this.get_kind(kind);
        return when.resolve(Object.keys(k));
    }
};

module.exports = Store;
})();
