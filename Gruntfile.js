module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		clean: {
			// remove all previous browserified builds
			pkg: [
				'./pkg/*.js',
				'./pkg/*/stxt.standalone.js',
				'./pkg/*/test/stxt.require.js',
				'./pkg/*/test/suite.js',
			],
			// remove all distrbutable artifacts (zip/xpi/crx)
			dist: [
				'./dist/**/*.*',
			]
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
		// local (command-line) execution of testsuite
		//////////////////////////////////////////////////
		mochacov: {
			options: {
				reporter: 'spec',
				coverage: true
			},
			all: ['test/**/*.js']
		},


		//////////////////////////////////////////////////
		// grunt-crx (chrome extension) section
		//////////////////////////////////////////////////
		crx: {
			sneakertext: {
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


	grunt.registerTask("copylibs", "copy libs into pkg dirs, before packaging", function() {
		grunt.file.copy("pkg/stxt.standalone.js", "pkg/chrome-packaged-app/stxt.standalone.js");
		grunt.file.copy("pkg/stxt.require.js", "pkg/chrome-packaged-app/test/stxt.require.js");
		grunt.file.copy("pkg/suite.js", "pkg/chrome-packaged-app/test/suite.js");

		grunt.file.copy("node_modules/mocha/mocha.js", "pkg/chrome-packaged-app/test/mocha.js");
		grunt.file.copy("node_modules/mocha/mocha.css", "pkg/chrome-packaged-app/test/mocha.css");
	});

	grunt.loadNpmTasks('grunt-contrib-clean');

	// Static checking tasks
	grunt.loadNpmTasks('grunt-lint5');
	grunt.loadNpmTasks('grunt-jslint');
	grunt.loadNpmTasks('grunt-eslint');
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
		"mochacov",
		"clean",
		"browserify",
		"copylibs",
		"mozilla-cfx-xpi",
		"crx",
		"zip"
	]);

	grunt.registerTask('test', [ "mochacov" ]);
	grunt.registerTask('tidy', [ "clean" ]);

};
