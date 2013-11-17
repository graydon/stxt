module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		browserify: {
			dist: {
				files: {
					'pkg/stxt.js': ['src/**/*.js'],
				}
			}
		},

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


		// packaged app section
		//////////////////////////////////////////////////
		zip: {
			chrome_app: {
				src: [ "pkg/chrome-packaged-app/*.*" ],
				cwd: "pkg/chrome-packaged-app",
				dest: "dist/chrome-packaged-app/<%= pkg.name %>-<%= pkg.version %>.zip"
			},
			firefox_app: {
				src: [ "pkg/firefox-packaged-app/*.*" ],
				cwd: "pkg/firefox-packaged-app",
				dest: "dist/firefox-packaged-app/<%= pkg.name %>-<%= pkg.version %>.zip"
			}
		}


	});

	// Static checking tasks
	grunt.loadNpmTasks('grunt-lint5');
	grunt.loadNpmTasks('grunt-jslint');
	grunt.loadNpmTasks('grunt-eslint');
	grunt.loadNpmTasks('grunt-contrib-jshint');

	// Module combining task
	grunt.loadNpmTasks('grunt-browserify');

	// Browser packaging tasks
	grunt.loadNpmTasks('grunt-mozilla-addon-sdk');
	grunt.loadNpmTasks('grunt-crx');
	grunt.loadNpmTasks('grunt-zip');

	// Default task(s).
	grunt.registerTask('default', [
		"browserify",
		"mozilla-cfx-xpi",
		"crx",
		"zip"
	]);
};
