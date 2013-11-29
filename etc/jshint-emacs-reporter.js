/*jshint node: true */

module.exports = {
    reporter: function (errors) {
        "use strict";

        errors.forEach(function (error) {
            var str = (error.file + ':' +
                       error.error.line + ':' +
                       error.error.character + ': error: ' +
                       error.error.reason);
            process.stdout.write(str + "\n");
        });
        
    }
};
