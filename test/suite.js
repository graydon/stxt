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

})();
