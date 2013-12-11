/*
 * grunt-mozilla-addon-sdk
 * https://github.com/rpl/grunt-mozilla-addon-sdk
 *
 * Copyright (c) 2013 Luca Greco
 * Licensed under the MPL license.
 */

'use strict';

var path = require('path'),
    fs = require('fs'),
    request = require('request'),
    Q = require('q'),
    targz = require('tar.gz'),
    mv = require('mv');

var BASE_OFFICIAL_URL = "https://ftp.mozilla.org/pub/mozilla.org/labs/jetpack",
    DEFAULT_GITHUB_USER = "mozilla",
    DEFAULT_DEST_DIR = path.join("tmp", "mozilla-addon-sdk");

function get_download_type(download_options) {
  if (download_options.download_url) {
    return "custom";
  } else if (download_options.github) {
    return "github";
  } else {
    return "official";
  }
}

function get_downloaded_dirname(download_options) {
  var type = get_download_type(download_options);
  var suffix = "";

  if (type == "github") {
    var user = download_options.github_user ? download_options.github_user : DEFAULT_GITHUB_USER;
    suffix = "-" + user;
  }

  return "addon-sdk-" + download_options.revision + "-" + type + suffix;
}

function get_download_url(download_options) {
  switch (get_download_type(download_options)) {
  case "custom":
    return download_options.download_url;
    break;
  case "github":
    return ["https://github.com", download_options.github_user || DEFAULT_GITHUB_USER,
            "addon-sdk", "archive", download_options.revision].join("/") + ".tar.gz";
    break;
  case "official":
    return [BASE_OFFICIAL_URL, "addon-sdk-" + download_options.revision].join("/") + ".tar.gz";
    break;
  }

  return null;
}

function cfx(grunt, addon_sdk, ext_dir, cfx_cmd, cfx_args) {
  var download_options = grunt.config('mozilla-addon-sdk')[addon_sdk].options;
  var dest_dir = download_options.dest_dir || DEFAULT_DEST_DIR;
  var sdk_dir = path.resolve(dest_dir,
                             get_downloaded_dirname(download_options));
  var completed = Q.defer();
  var scriptFilename = process.platform.match(/^win/) ? 'cfx.bat' : 'cfx.sh';
  var xpi_script = path.resolve(__dirname, '..', 'scripts', scriptFilename);

  var package_json = path.resolve(ext_dir, "package.json");
  var error;

  if (!grunt.file.exists(package_json)) {
    error = new Error("package.json doesn't exist");
  }

  if (error) {
    completed.reject(error);
    return completed.promise;
  }

  grunt.log.debug(["Running cfx", cfx_cmd, cfx_args].join(' '));

  var args = [
      sdk_dir,
      ext_dir,
      cfx_cmd
    ];

  if (cfx_args) {
    args.push(cfx_args);
  }

  if (process.env["FIREFOX_BIN"]) {
    args.push("-b " + process.env["FIREFOX_BIN"]);
  }

  if (process.env["FIREFOX_PROFILE"]) {
    args.push("-p " + process.env["FIREFOX_PROFILE"]);
  }

  grunt.util.spawn({
    cmd: xpi_script,
    opts: grunt.option("debug") ? {stdio: 'inherit'} : {},
    args: args,
  }, function (error, result, code) {
    if (error) {
      completed.reject(error);
    } else {
      completed.resolve();
    }
  });

  return completed.promise;
}

function xpi(grunt, options) {
  var ext_dir = path.resolve(options.extension_dir);
  var dist_dir = path.resolve(options.dist_dir);
  var cfx_args = options.arguments;
  var completed = Q.defer();

  grunt.log.writeln("Creating dist dir '" + dist_dir + "'...");

  grunt.file.mkdir(dist_dir);

  grunt.log.writeln("Creating xpi...");

  cfx(grunt, options['mozilla-addon-sdk'], ext_dir, "xpi", cfx_args).
    then(function () {
      var xpi_files = grunt.file.expand(options.extension_dir + "/*.xpi");

      if (xpi_files.length === 0) {
        var no_xpi_error = new Error("no xpi found");
        completed.reject(no_xpi_error);
        return;
      }

      if (xpi_files.length > 1) {
        grunt.log.warn('There was more than one xpi: ', xpi_files);
      }

      var dist_xpi = path.resolve(dist_dir, path.basename(xpi_files[0]));
      mv(path.resolve(xpi_files[0]),
         dist_xpi,
         function () {
           grunt.log.writeln("Generated XPI:", dist_xpi);
           completed.resolve();
         });
    }).
    catch(function (error) {
      completed.reject(error);
    });

  return completed.promise;
}

function download(grunt, options) {
  var completed = Q.defer();

  var downloaded_dirname = get_downloaded_dirname(options);

  var dest_dir = options.dest_dir || DEFAULT_DEST_DIR;

  if (grunt.file.exists(path.resolve(dest_dir, downloaded_dirname))) {
    grunt.log.writeln("Mozilla Addon SDK already downloaded");
    completed.resolve();
    return completed.promise;
  }

  grunt.file.mkdir(dest_dir);

  var destFilePath = path.resolve(dest_dir, downloaded_dirname + ".tar.gz"),
      destFileStream = fs.createWriteStream(destFilePath),
      downloadUrl = get_download_url(options),
      downloadRequest = request(downloadUrl);

  grunt.log.writeln('Downloading: ' + downloadUrl);

  destFileStream.on('close', function() {
    new targz().extract(destFilePath, dest_dir, function (error) {
      grunt.file.delete(destFilePath);
      if (error) {
        grunt.log.error(error);
        grunt.fail.warn('There was an error while extracting.');
        completed.reject(error);
      } else {
        mv(path.resolve(dest_dir, "addon-sdk-" + options.revision),
                      path.resolve(dest_dir, downloaded_dirname), completed.resolve);
      }
    });
  });

  destFileStream.on('error', function(error) {
    grunt.log.error(error);
    grunt.fail.warn('Download write failed.');
    completed.reject(error);
  });

  downloadRequest.on('error', function(error) {
    grunt.log.error(error);
    grunt.fail.warn('There was an error while downloading.');
    completed.reject(error);
  });

  downloadRequest.pipe(destFileStream);

  return completed.promise;
}

module.exports = function(grunt) {
  grunt.registerMultiTask('mozilla-addon-sdk', 'Download Mozilla Addon SDK', function() {
    var options = this.options();
    var done = this.async();

    if (this.target.lastIndexOf('.') > 0) {
      grunt.fail.warn("ERROR: target name '"  + this.target + "' contains a '.' in its name.");
    }

    grunt.config.requires(["mozilla-addon-sdk",this.target,"options","revision"].join('.'));

    download(grunt, options).
      then(done).
      catch(function (error) {
        grunt.fail.warn('There was an error downloading mozilla-addon-sdk ' + this.target + '.'
                        + error);
        done();
      });
  });

  grunt.registerMultiTask('mozilla-cfx-xpi', 'Create an XPI package', function() {
    var options = this.options();
    var done = this.async();

    if (this.target.lastIndexOf('.') >= 0) {
      grunt.fail.warn("ERROR: target name '"  + this.target + "' contains a '.' in its name.");
    }

    grunt.config.requires(["mozilla-cfx-xpi",this.target,"options","extension_dir"].join('.'));
    grunt.config.requires(["mozilla-cfx-xpi",this.target,"options","dist_dir"].join('.'));
    grunt.config.requires(["mozilla-cfx-xpi",this.target,"options","mozilla-addon-sdk"].join('.'));

    xpi(grunt, options).
      then(done).
      catch(function (error) {
          grunt.fail.warn('There was an error running mozilla-cfx-xpi. ' + error);
          done();
      });
  });

  grunt.registerMultiTask('mozilla-cfx', 'Run Mozilla Addon SDK command line tool', function() {
    var options = this.options();
    var done = this.async();

    if (this.target.lastIndexOf('.') >= 0) {
      grunt.fail.warn("ERROR: target name '"  + this.target + "' contains a '.' in its name.");
    }

    grunt.config.requires(["mozilla-cfx",this.target,"options","extension_dir"].join('.'));
    grunt.config.requires(["mozilla-cfx",this.target,"options","command"].join('.'));

    cfx(grunt, options['mozilla-addon-sdk'], path.resolve(options.extension_dir),
        options.command, options.arguments).
      then(done).
      catch(function (error) {
        grunt.fail.warn('There was an error running mozilla-cfx. ' + error);
        done();
      });
  });
};
