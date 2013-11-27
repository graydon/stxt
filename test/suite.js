(function() {
"use strict";

/* global describe */
/* global it */

var assert = require('chai').assert;
var stxt = require('../src/stxt.js');

describe('Basic', function(){
    it('testsuite functions', function(){
        assert(stxt.return_true());
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
            var c255 = stxt.curve25519;
            var r = c255.crypto_scalarmult(c255.from_hex(triple[0]),
                                           c255.from_hex(triple[1]));
            assert.equal(c255.to_hex(r), triple[2]);
        });
    });
});


})();
