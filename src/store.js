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

var Store = function(name, backend, driver) {
    Assert.isString(name);
    Assert.isString(backend);
    Assert.ok(backend in Store);
    Assert.ok(driver);
    this.name = name;
    this.backend = backend;
    this.sub = new Store[this.backend]("stxt-" + name, driver);
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
    Stxt.assert(prefix);
    Stxt.assert(driver);
    this.prefix = prefix;
    this.driver = driver;
};
Store.WebStorage.prototype = {
    key: function(kind, key) {
        return this.prefix + ":" + kind + ":" + key;
    },
    has: function(kind, key, cb) {
        var v = this.driver.getItem(this.key(kind,key)) != null;
        Stxt.then(cb, [v]);
    },
    get: function(kind, key, cb) {
        var v = this.driver.getItem(this.key(kind,key));
        Stxt.then(cb, [v]);
    },
    put: function(kind, key, val, cb) {
        this.driver.setItem(this.key(kind,key), val);
        Stxt.then(cb);
    },
    del: function(kind, key, val, cb) {
        this.driver.removeItem(this.key(kind,key));
        Stxt.then(cb);
    },
    keys: function(kind, cb, done) {
        var re = new RegExp("^" + this.prefix + ":(\w+):(.*)");
        for (var i = 0; i < this.driver.length; i++) {
            var k = this.driver.key(i);
            var m = k.match(re);
            if (cb && m && m[1] == kind) {
                cb(m[2]);
            }
        }
        Stxt.then(done);
    }
};

// In node, ministore backend
Store.MiniStore = function(prefix, driver) {
    Stxt.assert(prefix);
    Stxt.assert(driver);
    this.prefix = prefix;
    this.driver = new driver("ministore-" + prefix);
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
            Stxt.then(cb, [has]);
        });
    },
    get: function(kind, key, cb) {
        this.get_kind(kind).get(key, function(err, data) {
            Stxt.then(cb, [data]);
        })
    },
    put: function(kind, key, val, cb) {
        this.get_kind(kind).set(key, val, function(err) {
            Stxt.then(cb);
        })
    },
    del: function(kind, key, cb) {
        this.get_kind(kind).remove(key, function(err) {
            Stxt.then(cb);
        })
    },
    keys: function(kind, cb, done) {
        var k = this.get_kind(kind);
        k.length(function(length) {
            var n = 0;
            k.forEach(function(key) {
                if (cb) cb(key);
                n++;
                if (n == length && done) {
                    Stxt.then(done);
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
Store.Memory.driver = function(kind) { return {} };
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
        Stxt.then(cb, [key in kx]);
    },
    get: function(kind, key, cb) {
        var kx = this.get_kind(kind);
        var v = null;
        if (key in kx) {
            v = kx[key];
        }
        Stxt.then(cb, [v]);
    },
    put: function(kind, key, val, cb) {
        var kx = this.get_kind(kind);
        kx[key] = val;
        Stxt.then(cb);
    },
    del: function(kind, key, cb) {
        var kx = this.get_kind(kind);
        delete kx[key];
        Stxt.then(cb);
    },
    keys: function(kind, cb, done) {
        var k = this.get_kind(kind);
        for (var j in k) {
            cb(j);
        }
        Stxt.then(done);
    }
};

Stxt.Store = Store;
return Store;
});
