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
    has: function(kind, key) {
        return this.sub.has(kind, key);
    },
    get: function(kind, key) {
        return this.sub.get(kind, key);
    },
    put: function(kind, key, val) {
        return this.sub.put(kind, key, val);
    },
    del: function(kind, key, val) {
        return this.sub.del(kind, key, val);
    },
    keys: function(kind) {
        return this.sub.keys(kind);
    }
};

// In browser, localStorage backend
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
    has: function(kind, key, cb) {
        var v = this.driver.getItem(this.key(kind,key)) != null;
        when(v, cb);
    },
    get: function(kind, key, cb) {
        var v = this.driver.getItem(this.key(kind,key));
        when(v, cb);
    },
    put: function(kind, key, val, cb) {
        this.driver.setItem(this.key(kind,key), val);
        when(null, cb);
    },
    del: function(kind, key, val, cb) {
        this.driver.removeItem(this.key(kind,key));
        when(null, cb);
    },
    keys: function(kind, cb, done) {
        var re = new RegExp("^" + this.prefix + ":(\\w+):(.*)");
        for (var i = 0; i < this.driver.length; i++) {
            var k = this.driver.key(i);
            var m = k.match(re);
            if (cb && m && m[1] === kind) {
                cb(m[2]);
            }
        }
        when(null, done);
    }
};

// In node, ministore backend
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
    has: function(kind, key, cb) {
        this.get_kind(kind).has(key, function(err, has) {
            when(has, cb);
        });
    },
    get: function(kind, key, cb) {
        this.get_kind(kind).get(key, function(err, data) {
            when(data, cb);
        });
    },
    put: function(kind, key, val, cb) {
        this.get_kind(kind).set(key, val, function() {
            when(null, cb);
        });
    },
    del: function(kind, key, cb) {
        this.get_kind(kind).remove(key, function() {
            when(null, cb);
        });
    },
    keys: function(kind, cb, done) {
        var k = this.get_kind(kind);
        k.length(function(length) {
            var n = 0;
            k.forEach(function(key) {
                if (cb) {
                    cb(key);
                }
                n++;
                if (n === length && done) {
                    when(null, done);
                }
            });
        });
    }
};

// In-memory backend
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
    has: function(kind, key, cb) {
        var kx = this.get_kind(kind);
        when(key in kx, cb);
    },
    get: function(kind, key, cb) {
        var kx = this.get_kind(kind);
        var v = null;
        if (key in kx) {
            v = kx[key];
        }
        when(v, cb);
    },
    put: function(kind, key, val, cb) {
        var kx = this.get_kind(kind);
        kx[key] = val;
        when(null, cb);
    },
    del: function(kind, key, cb) {
        var kx = this.get_kind(kind);
        delete kx[key];
        when(null, cb);
    },
    keys: function(kind, cb, done) {
        var k = this.get_kind(kind);
        for (var j in k) {
            cb(j);
        }
        when(null, done);
    }
};

module.exports = Store;
})();
