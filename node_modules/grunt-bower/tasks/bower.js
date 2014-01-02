/*
 * grunt-bower
 * https://github.com/curist/grunt-bower
 *
 * Copyright (c) 2012 curist
 * Licensed under the MIT license.
 */

module.exports = function(grunt) {

  // Please see the grunt documentation for more information regarding task and
  // helper creation: https://github.com/gruntjs/grunt/blob/master/docs/toc.md

  // ==========================================================================
  // TASKS
  // ==========================================================================

  var task_name = 'bower';
  var task_desc = 'Copy bower installed components to dist folder.';
  var _ = grunt.utils ? grunt.utils._ : grunt.util._;
  var path = require('path');
  var bower = require('bower');
  var log = grunt.log.write;
  var helpers = require('./lib/helpers').init(grunt);

  grunt.registerMultiTask(task_name, task_desc, function() {
    var done = this.async();
    var targets = (this.file) ? [this.file] : this.files;
    var options = this.data.options || {};
    var base_path = options.basePath;
    var stripJsAffix = options.stripJsAffix;


    bower.commands.list({paths: true})
      .on('end',  function (data) {
        _(data).each(function(lib_paths, lib_name) {

          lib_paths = lib_paths.split(",");

          _(lib_paths).each(function(lib_path){
            var preserved_path;
            var dest_file_path;
            var src_path = helpers.getLibFilename(
              lib_path,
              bower.config.directory,
              lib_name
            );

            var file_ext = src_path.split(".").pop();

            if(base_path !== undefined) {
              preserved_path = helpers.strippedBasePath(base_path, src_path);
            } else {
              preserved_path = '';
            }

            try {
              targets.forEach(function(target) {
                var dest = target.dest || path.join('public', 'scripts' ,'vendor');
                var dest_file_name;

                // check if we want to strip 'js' affix in lib_name
                if(stripJsAffix) {
                  dest_file_name = lib_name.replace(/\W?js$/, '') + '.' + file_ext;
                } else {
                  dest_file_name = lib_name + '.' + file_ext;
                }

                dest_file_path = path.join(dest, preserved_path, dest_file_name);
                grunt.file.copy(src_path, dest_file_path);
              });
              log(src_path.cyan + ' copied to.\n');
            } catch (err) {
              log(('Fail to copy lib file for ' + lib_name + '!\n').red);
            }
          });
        });
        done();
      })
      .on('error', function (err) {
        grunt.fail.warn(err);
      });
  });
};
