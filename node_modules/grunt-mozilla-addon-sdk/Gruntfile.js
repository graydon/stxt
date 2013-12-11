/*
 * grunt-mozilla-addon-sdk
 * https://github.com/rpl/grunt-mozilla-addon-sdk
 *
 * Copyright (c) 2013 Luca Greco
 * Licensed under the MPL license.
 */

'use strict';

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    jshint: {
      all: [
        'Gruntfile.js',
        'tasks/*.js',
        '<%= nodeunit.tests %>',
      ],
      options: {
        jshintrc: '.jshintrc',
      },
    },

    // Before generating any new files, remove any previously-created files.
    clean: {
      tests: ['tmp'],
    },

    // Configuration to be run (and then tested).
    'mozilla-addon-sdk': {
      '1_14': {
        options: {
          revision: "1.14"
        }
      },
      'master': {
        options: {
          revision: "master",
          github: true,
          // github_user: "mozilla" // default
        }
      }
    },

    // custom cfx xpi
    'mozilla-cfx-xpi': {
      'release': {
        options: {
          "mozilla-addon-sdk": "1_14",
          extension_dir: "test/fixtures/test-addon",
          dist_dir: "tmp/dist"
        }
      }
    },

    // custom cfx command run
    'mozilla-cfx': {
      custom_cmd: {
        options: {
          "mozilla-addon-sdk": "1_14",
          extension_dir: "test/fixtures/test-addon",
          command: 'test',
          // arguments: '-b /usr/local/bin/firefox-nightly -p /tmp/PROFILE_REUSED'
        }
      }
    },

    // Unit tests.
    nodeunit: {
      tests: ['test/*_test.js'],
    },

  });

  // Actually load this plugin's task(s).
  grunt.loadTasks('tasks');

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');

  // Whenever the "test" task is run, first clean the "tmp" dir, then run this
  // plugin's task(s), then test the result.
  grunt.registerTask('test', ['clean', 'mozilla-addon-sdk', 'mozilla-cfx-xpi', 'mozilla-cfx', 'nodeunit']);

  // By default, lint and run all tests.
  grunt.registerTask('default', ['jshint', 'test']);

};
