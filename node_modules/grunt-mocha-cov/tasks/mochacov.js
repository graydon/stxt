/**
 * grunt-mocha-cov
 * Copyright(c) 2013 Mike Moulton <mike@meltmedia.com>
 * MIT Licensed
 */

'use strict';

var mocha = require('../lib/mocha');


/**
 * Expose `MochaCov`.
 */

exports = module.exports = MochaCov;

/**
 * The Grunt Multi-task for Mocha with code coverage support
 *
 * @param {Grunt} grunt
 * @api public
 */

function MochaCov(grunt) {
  grunt.registerMultiTask(
    'mochacov',
    'Run Mocha server-side tests in Grunt with code coverage support and optional integration to coveralls.io.',
    function () {
      var options = this.options();
      var globs = [];

      // Use the Grunt files format if the `files` option isn't set
      if (!options.files) {
        this.files.forEach(function (glob) {
          globs = globs.concat(glob.orig.src);
        });
        options.files = globs;
      }

      mocha(options, this.async());
    }
  );
}
