(function() {
"use strict";

function return_true() {
	return true;
}

var Stxt = {
	return_true: return_true,

    sjcl: require('sjcl'),
	curve25519: require('./curve25519.js'),

	Assert: require('./assert.js'),
	Config: require('./config.js'),
	Fmt: require('./fmt.js'),
	Hash: require('./hash.js'),
	Tag: require('./tag.js'),
	Trace: require('./trace.js'),
	Uletter: require('./uletter.js'),
};

module.exports = Stxt;

})();
