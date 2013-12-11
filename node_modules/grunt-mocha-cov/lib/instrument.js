/**
 * grunt-mocha-cov
 * Copyright(c) 2013 Mike Moulton <mike@meltmedia.com>
 * MIT Licensed
 */
'use strict';


/**
 * Instrament source using blanket
 *
 * This is included as the first dependency by mocha to
 * instrument source prior to any test cases running.
 */

require('blanket')();
