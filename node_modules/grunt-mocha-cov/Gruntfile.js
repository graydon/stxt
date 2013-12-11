'use strict';

module.exports = function (grunt) {
  grunt.initConfig({
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      all: [
        '.jshintrc',
        'package.json',
        '**/*.js',
        '!node_modules/**/*'
      ]
    },

    mochacov: {
      unit: {
        options: {
          reporter: 'spec'
        }
      },
      coverage: {
        options: {
          reporter: 'mocha-term-cov-reporter',
          coverage: true
        }
      },
      coveralls: {
        options: {
          coveralls: {
            serviceName: 'travis-ci'
          }
        }
      },
      options: {
        files: 'test/*.js',
        ui: 'bdd',
        colors: true
      }
    }
  });

  grunt.loadTasks('tasks');
  grunt.loadNpmTasks('grunt-contrib-jshint');

  grunt.registerTask('test', ['jshint', 'mochacov:unit', 'mochacov:coverage']);
  grunt.registerTask('travis', ['jshint', 'mochacov:unit', 'mochacov:coverage', 'mochacov:coveralls']);
  grunt.registerTask('default', 'test');
};
