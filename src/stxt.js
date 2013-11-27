(function() {
"use strict";

var c255 = require('./curve25519.js');

function return_true() {
	return true;
}

module.exports = {
	return_true: return_true,
	curve25519: c255
};

})();
