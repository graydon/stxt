/*
 * grunt-zip
 * https://github.com/twolfson/grunt-zip
 *
 * Copyright (c) 2013 Todd Wolfson
 * Licensed under the MIT license.
 */

var fs = require('fs'),
    path = require('path'),
    Zip = require('node-zip'),
    gruntRetro = require('grunt-retro');
module.exports = function(grunt) {
  // Load and bind grunt-retro
  grunt = gruntRetro(grunt);

  // Please see the grunt documentation for more information regarding task and
  // helper creation: https://github.com/gruntjs/grunt/blob/master/docs/toc.md

  // ==========================================================================
  // TASKS
  // ==========================================================================

  // Localize underscore
  var _ = grunt.utils._;

  grunt.registerMultiTask('zip', 'Zip files together', function() {
    // Localize variables
    var file = this.file,
        data = this.data,
        src = file.src,
        dest = file.dest,
        router = data.router;

    // Fallback options (e.g. base64, compression)
    _.defaults(data, {
      base64: false
    });

    // Collect our file paths
    var globOptions = {dot: data.dot},
        srcFolders = grunt.file.expandDirs(globOptions, src),
        srcFiles = grunt.file.expandFiles(globOptions, src);

    // If there is no router
    if (!router) {
      // Grab the cwd and return the relative path as our router
      var cwd = data.cwd || process.cwd(),
          separator = new RegExp(path.sep.replace('\\', '\\\\'), 'g');
      router = function routerFn (filepath) {
        // Join path via /
        // DEV: Files zipped on Windows need to use /  to have the same layout on Linux
        return path.relative(cwd, filepath).replace(separator, '/');
      };
    } else if (data.cwd) {
    // Otherwise, if a `cwd` was specified, throw a fit and leave
      grunt.fail.warn('grunt-zip does not accept `cwd` and `router` in the same config due to potential ordering complications. Please choose one.');
    }

    // Generate our zipper
    var zip = new Zip();

    // For each of the srcFolders
    srcFolders.forEach(function (folderpath) {
      // Route the folder
      var routedPath = router(folderpath);

      // If there is a folder, add it to the zip (allows for skipping)
      if (routedPath) {
        zip.folder(routedPath);
      }
    });

    // For each of the srcFiles
    srcFiles.forEach(function (filepath) {
      // Read in the content and add it to the zip
      var input = fs.readFileSync(filepath, 'binary'),
          routedPath = router(filepath);

      // If it has a path, add it (allows for skipping)
      if (routedPath) {
        zip.file(routedPath, input, {binary: true});
      }
    });

    // Create the destination directory
    var destDir = path.dirname(dest);
    grunt.file.mkdir(destDir);

    // Write out the content
    var output = zip.generate({base64: data.base64, compression: data.compression});
    fs.writeFileSync(dest, output, 'binary');

    // Fail task if errors were logged.
    if (this.errorCount) { return false; }

    // Otherwise, print a success message.
    grunt.log.writeln('File "' + dest + '" created.');
  });

  function echo(a) {
    return a;
  }
  grunt.registerMultiTask('unzip', 'Unzip files into a folder', function() {
    // Collect the filepaths we need
    var file = this.file,
        data = this.data,
        src = file.src,
        srcFiles = grunt.file.expand(src),
        dest = file.dest,
        router = data.router || echo;

    // Fallback options (e.g. checkCRC32)
    _.defaults(data, {
      base64: false,
      checkCRC32: true
    });

    // Iterate over the srcFiles
    srcFiles.forEach(function (filepath) {
      // Read in the contents
      var input = fs.readFileSync(filepath, 'binary');

      // Unzip it
      var zip = new Zip(input, {base64: data.base64, checkCRC32: data.checkCRC32});

      // Pluck out the files
      var files = zip.files,
          filenames = Object.getOwnPropertyNames(files);

      // Filter out all non-leaf files
      filenames = filenames.filter(function filterNonLeafs (filename) {
        // Iterate over the other filenames
        var isLeaf = true,
            i = filenames.length,
            otherFile,
            pathToFile,
            isParentDir;
        while (i--) {
          // If the other file is the current file, skip it
          otherFile = filenames[i];
          if (otherFile === filename) {
            continue;
          }

          // Determine if this file contains the other
          pathToFile = path.relative(filename, otherFile);
          isParentDir = pathToFile.indexOf('..') === -1;

          // If it does, falsify isLeaf
          if (isParentDir) {
            isLeaf = false;
            break;
          }
        }

        // Return that the file was a leaf
        return isLeaf;
      });

      // Iterate over the files
      filenames.forEach(function (filename) {
        // Find the content
        var fileObj = files[filename],
            content = fileObj.data,
            routedName = router(filename);

        // If there is a file path (allows for skipping)
        if (routedName) {
          // Determine the filepath
          var filepath = path.join(dest, routedName);

          // If the routedName ends in a `/`, treat it as a/an (empty) directory
          // DEV: We use `/` over path.sep since it is consistently `/` across all platforms
          if (routedName.slice(-1) === '/') {
            grunt.file.mkdir(filepath);
          } else {
            // Create the destination directory
            var fileDir = path.dirname(filepath);

            // Write out the content
            grunt.file.mkdir(fileDir);
            fs.writeFileSync(filepath, content, 'binary');
          }
        }
      });
    });

    // Fail task if errors were logged.
    if (this.errorCount) { return false; }

    // Otherwise, print a success message.
    grunt.log.writeln('File "' + this.file.dest + '" created.');
  });

};
