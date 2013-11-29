(function() {
"use strict";

/* global describe */
/* global it */
/* jshint maxlen: 100 */

var Assert = require('chai').assert;
var Stxt = require('../src/stxt.js');

var Hash = Stxt.Hash;
var Tag = Stxt.Tag;

describe('Basic', function(){
    it('testsuite functions', function(){
        Assert.ok(Stxt.return_true());
    });
});

describe('Hash (sha256)', function(){
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
    var bob = Tag.new_user('bob');
    it('generates tags with correct nick and kind', function(){
        Assert.equal(bob.kind, 'u');
        Assert.equal(bob.nick, 'bob');
    });
    it('can re-parse its own stringification', function(){
        Assert.deepEqual(bob, Tag.parse(bob.toString()));
    });
});

describe('Curve25519', function() {
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
            var c255 = Stxt.curve25519;
            var r = c255.crypto_scalarmult(c255.from_hex(triple[0]),
                                           c255.from_hex(triple[1]));
            Assert.equal(c255.to_hex(r), triple[2]);
        });
    });
});


})();
