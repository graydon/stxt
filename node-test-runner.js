// Stxt test runner
// run under node

console.log("node started");
"use strict";
var requirejs = require("requirejs");
requirejs.config({ baseUrl: "./public",
           paths: {fomatto: "/hide-me1",
                   sjcl: "/hide-me2"},
           nodeRequire: require });
requirejs(["sjcl", "stxt/test", "crypto"],
function(sjcl, Test, crypto) {
    console.log("require loaded sjcl, Test, crypto");
    sjcl.random.addEventListener("seeded", function() {
        console.log("PRNG seeded, running tests");
        Test.all_tests();
    });
    sjcl.random.addEntropy(crypto.randomBytes(1024));
});
