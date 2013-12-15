(function() {
"use strict";

module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),


        clean: {
            // remove all previous browserified builds
            pkg: [
                './pkg/*.js',
                './pkg/**/stxt.standalone.js',
                './pkg/**/test/stxt.require.js',
                './pkg/**/test/suite.js',
                './pkg/**/test/mocha.*',
            ],
            // remove all distrbutable artifacts (zip/xpi/crx)
            dist: [
                './dist/**/*.*',
            ]
        },

        //////////////////////////////////////////////////
        // static analysis section
        //////////////////////////////////////////////////
        jshint: {
            options: {
                jshintrc: '.jshintrc',
                reporter: './etc/jshint-emacs-reporter.js'
            },
            src: [ 'Gruntfile.js',
                   '.jshintrc',
                   'package.json',
                   'src/**/*.js',
                   'test/**/*.js'],
        },


        //////////////////////////////////////////////////
        // local (command-line) execution of testsuite
        //////////////////////////////////////////////////

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
        },

        //////////////////////////////////////////////////
        // library combination ("browserification")
        //////////////////////////////////////////////////
        browserify: {

            // This is the browserification of stxt for use as
            // a global, in web pages and apps.
            standalone: {
                src: [ './src/stxt.js' ],
                dest: './pkg/stxt.standalone.js',
                options: {
                    standalone: 'stxt'
                }
            },

            // This is the browserification of stxt for use in
            // other require() calls, namely the testsuite when
            // bundled and run beside it in a browser.
            require: {
                src: [ 'src/stxt.js' ],
                dest: 'pkg/stxt.require.js',
                options: {
                    alias: [ './src/stxt.js:' ],
                    // Embed source map
                    debug: true
                }
            },

            // This is the set of browserified tests that
            // require()-in the previous browserified stxt.
            tests: {
                src: [ 'test/suite.js' ],
                dest: 'pkg/suite.js',
                options: {
                    external: [ './src/stxt.js' ],
                    // Embed source map
                    debug: true
                }
            }
        },

        //////////////////////////////////////////////////
        // grunt-mozilla-addon-sdk section
        //////////////////////////////////////////////////
        "mozilla-addon-sdk": {
            '1_14': {
                options: {
                    revision: "1.14"
                }
            },
        },
        "mozilla-cfx-xpi": {
            'stable': {
                options: {
                    "mozilla-addon-sdk": "1_14",
                    extension_dir: "pkg/firefox-addon",
                    dist_dir: "dist/firefox-addon"
                }
            },
        },
        "mozilla-cfx": {
            'test': {
                options: {
                    "mozilla-addon-sdk": "1_14",
                    extension_dir: "pkg/firefox-addon",
                    command: "test"
                }
            },
            'run': {
                options: {
                    "mozilla-addon-sdk": "1_14",
                    extension_dir: "pkg/firefox-addon",
                    command: "run"
                }
            },
        },

        //////////////////////////////////////////////////
        // grunt-crx (chrome extension) section
        //////////////////////////////////////////////////
        crx: {
            stxt: {
                "src": "pkg/chrome-extension",
                "baseURL": "https://stxt.net/pkg/chrome-extension",
                "dest": "dist/chrome-extension",
                "key": "key.pem"
            }
        },


        //////////////////////////////////////////////////
        // packaged app section
        //////////////////////////////////////////////////
        zip: {
            chrome_app: {
                src: [ "pkg/chrome-packaged-app/**/*.*" ],
                cwd: "pkg/chrome-packaged-app",
                dest: "dist/chrome-packaged-app/stxt-<%= pkg.version %>.zip"
            },
            firefox_app: {
                src: [ "pkg/firefox-packaged-app/**/*.*" ],
                cwd: "pkg/firefox-packaged-app",
                dest: "dist/firefox-packaged-app/stxt-<%= pkg.version %>.zip"
            }
        }


    });


    grunt.registerTask("copylibs",
                       "copy libs into pkg dirs, before packaging",
                       function() {

        ["chrome-packaged-app",
         "chrome-extension",
         "firefox-addon/data",
         "firefox-packaged-app"].forEach(function(dir) {

             function pkg(s,d) {
                 d = "pkg/" + dir + "/" + d;
                 grunt.log.writeln("Copying " + s + " to " + d);
                 grunt.file.copy(s, d);
             }

             pkg("pkg/stxt.standalone.js", "js/stxt.standalone.js");
             pkg("pkg/stxt.require.js", "js/test/stxt.require.js");
             pkg("pkg/suite.js", "js/test/suite.js");

             pkg("node_modules/mocha/mocha.js", "js/test/mocha.js");
             pkg("node_modules/mocha/mocha.css", "css/test/mocha.css");
         });
    });

    grunt.loadNpmTasks('grunt-contrib-clean');

    // Static checking tasks
    grunt.loadNpmTasks('grunt-lint5');
    grunt.loadNpmTasks('grunt-contrib-jshint');

    // Testsuite task
    grunt.loadNpmTasks('grunt-mocha-cov');

    // Module combining task
    grunt.loadNpmTasks('grunt-browserify');

    // Browser packaging tasks
    grunt.loadNpmTasks('grunt-mozilla-addon-sdk');
    grunt.loadNpmTasks('grunt-crx');
    grunt.loadNpmTasks('grunt-zip');

    // Default task(s).
    grunt.registerTask('default', [
        "clean",
        "test",
        "browserify",
        "copylibs",
        "mozilla-addon-sdk",
        "mozilla-cfx-xpi",
        "crx",
        "zip"
    ]);

    grunt.registerTask('unit', [ 'mochacov:unit' ]);
    grunt.registerTask('test', [ 'jshint', 'mochacov:unit',
                                 'mochacov:coverage']);

    grunt.registerTask('travis', ['jshint', 'mochacov:unit',
                                  'mochacov:coverage', 'mochacov:coveralls']);
};
})();
