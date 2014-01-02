// http://en.wikipedia.org/wiki/Levenshtein_distance#Computing_Levenshtein_distance
function levenshteinDistanceAux(str1, str2) {
  var memo = {};

  function levenshteinDistance(str1, i, len1, str2, j, len2) {
    var key = [i,len1,j,len2].join(',');
    if(memo[key] !== undefined) {
      return memo[key];
    }

    if(len1 === 0) {
      return len2;
    }
    if(len2 === 0) {
      return len1;
    }
    var cost = 0;
    if(str1[i] !== str2[j]) {
      cost = 1;
    }

    var dist = Math.min(
      levenshteinDistance(str1, i+1,len1-1, str2,j,len2)+1,
      levenshteinDistance(str1,i,len1,str2,j+1,len2-1)+1,
      levenshteinDistance(str1,i+1,len1-1,str2,j+1,len2-1)+cost
    );
    memo[key] = dist;
    return dist;
  }

  return levenshteinDistance(str1, 0, str1.length, str2, 0, str2.length);
}

exports.init = function(grunt) {
  var exports = {};
  var fs = require('fs');
  var path = require('path');
  var _ = grunt.utils ? grunt.utils._ : grunt.util._;

  exports.strippedBasePath = function(base_path, src_path) {
    var base_path_arr = _(path.normalize(base_path).split(path.sep)).compact();
    var src_path_arr = _(path.normalize(src_path).split(path.sep)).compact();
    var i = 0;

    // we want path only, no filename
    src_path_arr.pop();

    while(base_path_arr[i] === src_path_arr[i]) {
      i++;
    }

    return src_path_arr.slice(i).join(path.sep);
  };

  exports.getLibFilename = function(main_path, components_path, lib_name) {
    // In Nodejs 0.8.0, existsSync moved from path -> fs.
    var existsSync = fs.existsSync || path.existsSync;

    var lib_root = path.join(components_path, lib_name);
    var lib_filename = path.join(lib_root, lib_name + '.js'); // Why?

    // 0.
    // check if main attr in components.json have file exists
    if(main_path) {
      if(typeof main_path === 'string') {
        if(!_(main_path).endsWith('.js') && !_(main_path).endsWith('.css')) {
          main_path += '.js';
        }
        if(existsSync(main_path)) {
          return main_path;
        }
      } else {
        // array, falling through
      }
    }

    // 1.
    // check if package.json exists, and contains attribute "main"
    var package_json_path = path.join(lib_root, 'package.json');
    var main;

    if(existsSync(package_json_path)) {
      main = grunt.file.readJSON(package_json_path).main;

      if(main) {
        if(typeof main === 'string') {
          if(!_(main).endsWith('.js')) {
            main += '.js';
          }
          main = path.join(lib_root, main);
          if(existsSync(main)) {
            // all good, returning
            return main;
          }
        } else {
          // array, falling through
        }
      }
    }

    // 2.
    // computing Levenshtein distance to guess a lib file path
    var min_dist = 1e13;
    var min_dist_index = 0;

    var all_js_files = grunt.file.expand(path.join(lib_root, '**', '*.js'))
      .sort(function(a, b) {
        // reverse order by path length
        return b.length - a.length;
      });

    all_js_files.forEach(function(file_path, i) {
      var file_name = file_path.split(path.sep).pop();
      var dist = levenshteinDistanceAux(lib_name, file_name);
      if(dist <= min_dist) {
        min_dist = dist;
        min_dist_index = i;
      }
    });

    return all_js_files[min_dist_index];
  };

  return exports;
};

