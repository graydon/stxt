var assert = require("assert");

var nacl_tvecs = [
    ["77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a",
     "de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f",
     "4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742"]
];

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

// js-nacl
var js_nacl_factory = require("js-nacl");
var js_nacl = js_nacl_factory.instantiate();
function js_nacl_curvefn(priv, pub) {
    return js_nacl.to_hex(js_nacl.crypto_scalarmult(js_nacl.from_hex(priv),
                                                    js_nacl.from_hex(pub)))
}

// curve25519
c255 = require("../src/curve25519.js");
function c255_curvefn(priv, pub) {
    return c255.to_hex(c255.crypto_scalarmult(c255.from_hex(priv),
                                              c255.from_hex(pub)));
}

// ecma-nacl
enacl = require("../node_modules/ecma-nacl/lib/boxes/scalarmult.js");
function hex_to_uintarray(s) {
    var a = new Uint8Array(32);
    var i = 0;
    s.replace(/(..)/g, function(c) { 
        a[i] = parseInt(c, 16);
        ++i;
    });
    return a;
}
function uintarray_to_hex(a) {
    var s = "";
    var i = 0;
    var chars = "0123456789abcdef";
    while (i < 32) {
        var byte = a[i];
        s += chars[byte >> 4];
        s += chars[byte & 0xf];
        ++i;
    }
    return s;
}

function enacl_curvefn(priv,pub) {
    var out = new Uint8Array(32);
    enacl.curve25519(out,
                     hex_to_uintarray(priv),
                     hex_to_uintarray(pub));
    return uintarray_to_hex(out);
}


// correctness checks
var failures = 0;
function test_curvefn(fname, curvefn, vname, tvecs) {
    var i = 0;
    tvecs.forEach(function(triple) {
        console.log("\ntesting " + fname + " against " + vname + " vector #" + i);
        console.log(triple);
        var v = curvefn(triple[0], triple[1]);
        if (v == triple[2]) {
            console.log("=='" + v + "'");
        } else {
            console.log("!='" + v + "'");
            ++failures;
        }
        ++i;
    });
}
test_curvefn("enacl", enacl_curvefn, "nacl", nacl_tvecs);
test_curvefn("enacl", enacl_curvefn, "donna", donna_tvecs);

test_curvefn("c255", c255_curvefn, "nacl", nacl_tvecs);
test_curvefn("c255", c255_curvefn, "donna", donna_tvecs);

test_curvefn("js_nacl", js_nacl_curvefn, "nacl", nacl_tvecs);
test_curvefn("js_nacl", js_nacl_curvefn, "donna", donna_tvecs);
assert(failures == 0);


// benchmarks
Benchmark = require("benchmark");
var suite = new Benchmark.Suite;

var c255_alice_private = c255.from_hex(donna_tvecs[5][0]);
var c255_bob_public = c255.from_hex(donna_tvecs[5][1]);

var js_nacl_alice_private = js_nacl.from_hex(donna_tvecs[5][0]);
var js_nacl_bob_public = js_nacl.from_hex(donna_tvecs[5][1]);

var enacl_alice_private = hex_to_uintarray(donna_tvecs[5][0]);
var enacl_bob_public = hex_to_uintarray(donna_tvecs[5][1]);
var enacl_out = new Uint8Array(32);


suite

.add('enacl.curve25519', function() {
    enacl.curve25519(enacl_out, enacl_alice_private, enacl_bob_public);
})

.add('js_nacl.crypto_scalarmult', function() {
    js_nacl.crypto_scalarmult(js_nacl_alice_private,js_nacl_bob_public);
})

.add('c255.curve25519', function() {
    c255.crypto_scalarmult(c255_alice_private, c255_bob_public);
})


.on('cycle', function(event) {
  console.log(String(event.target));
})

.on('complete', function() {
  console.log('Fastest is ' + this.filter('fastest').pluck('name'));
})

.run();
