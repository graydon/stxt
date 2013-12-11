/**
 * grunt-mocha-cov
 * Copyright(c) 2013 Mike Moulton <mike@meltmedia.com>
 * MIT Licensed
 */
'use strict';

var fs = require('fs'),
    lcovParse = require('lcov-parse'),
    request = require('request');


/**
 * Expose `Coveralls`.
 */

exports = module.exports = coveralls();

/**
 * Coveralls Handlers
 *
 * @api public
 */

function coveralls() {
  return {
    convertLcovToCoveralls: function (input, options, callback) {

      var jobId = options.serviceJobId,
          serviceName = options.serviceName,
          postJson = { source_files : [] };

      // Set the repo token if present
      if (options.repoToken) {
        postJson.repo_token = options.repoToken;
      }

      // If we are using Travic CI or Travis Pro, use the TRAVIS_JOB_ID env variable as the job id
      if (serviceName && serviceName.match(/^travis-(ci|pro)$/)) {
        jobId = process.env.TRAVIS_JOB_ID || jobId;
      }

      if (jobId && serviceName) {
        postJson.service_job_id = jobId;
        postJson.service_name = options.serviceName;
      }

      // Validate coveralls.io API requirements
      // Per: https://coveralls.io/docs/api_reference
      // Either `repo_token` or `service_name` and `service_job_id` are required
      if (!(postJson.repo_token || (postJson.service_name && postJson.service_job_id))) {
        throw new Error('Unable to send data to coveralls.io, \'repoToken\' or \'serviceJobId\' and \'serviceName\' are required');
      }

      var detailsToCoverage = function (length, details) {
        var coverage = new Array(length);
        details.forEach(function (obj) {
          coverage[obj.line - 1] = obj.hit;
        });
        return coverage;
      };

      var convertLcovFileObject = function (file) {
        var source = fs.readFileSync(file.file, 'utf8');
        var lines = source.split('\n');
        var coverage = detailsToCoverage(lines.length, file.lines.details);
        return {
          name: file.file.replace(process.cwd(), ''),
          source: source,
          coverage: coverage
        };
      };

      lcovParse(input, function (err, parsed) {
        if (err) {
          return callback(err);
        }

        parsed.forEach(function (file) {
          postJson.source_files.push(convertLcovFileObject(file));
        });

        return callback(null, postJson);
      });
    },

    sendToCoveralls: function (payload, callback) {
      var req = {
        url: 'https://coveralls.io/api/v1/jobs',
        method: 'POST',
        form: {
          json: JSON.stringify(payload)
        }
      };

      request(req, function (err, response, body) {
        callback(err, response, body);
      });
    }

  };
}
