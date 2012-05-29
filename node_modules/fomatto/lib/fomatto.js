/*
   Copyright (c) 2011 Ivo Wetzel.

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in
   all copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   THE SOFTWARE.
*/

(function(undefined) {
    'use strict';

    // match {} placholders like {0}, {name}, {} and the inner "{{foo}}"
    // { and } can be escaped with \
    var matchExp = /([^\\]|^)\{([^\{\}]+[^\\\}]|[^\{\\\}]|)\}/g,

        // match escaped curly braces
        escapedExp = /\\(\{|\})/g,

        // match things like: foo[0].test["test"]['test']
        accessExp = /^\.?([^\.\[]+)|\[(\d+|('|")(|.*?[^\\])\3)\]/,

        // match :foo and :foo(.*?) but make sure to not greedy match :foo():bla()
        formatExp = /\:([a-zA-Z]+)(?:\((.*?)\))?(?:\:|$)/,

        // match arguments: "test", 12, -12, 'test', true, false
        // strings can contain escaped characters like \"
        argsExp = /^(?:,|^)\s*?(?:(true|false|(-?\d+))|('|")(|.*?([^\\]|\3))\3)/,

        // unescape quotes in argument strings
        quotesExp = {
            '"': /\\"/g,
            "'": /\\'/g
        };

    function Formatter(formats) {
        function format(template, object) {
            var autoIndex = 0,
                args = arguments,
                argsLength = args.length - 1,
                isObject = isType('O', object),
                isArray = isType('A', object) || isObject
                            && {}.hasOwnProperty.call(object, 'length')
                            && isType('N', object.length),

                arrayLength = isArray ? object.length : 0;

            function replace(match, pre, string) {

                // Extract id and format function call
                var formatList = [], f = null, key = string;
                while (f = string.match(formatExp)) {

                    // Strip the format syntax from the key
                    if (!formatList.length) {
                        key = string.substring(0, f.index);
                    }
                    string = string.substring(f[0].length - 1);
                    formatList.push(f);
                }

                var index = (isNaN(+key) || key === '') ? null : +key,
                            value = '';

                // Indexed Arrays
                if (isArray && index !== null) {
                    value = object[index < 0 ? arrayLength + index : index];

                // Object properties
                } else if (isObject && key !== '') {

                    // Simple keys get resolve fast and fall back to
                    // toString() in case the key does not exists
                    if (key.indexOf('.') === -1 && key.indexOf('[') === -1) {
                        if (object[key] !== undefined) {
                            value = object[key];

                        } else {
                            value = args[autoIndex + 1].toString();
                        }

                    // Complex ones need parsing and will throw a FormatError
                    } else {
                        value = accessObject(object, key);
                    }

                // Indexed arguments
                } else if (index !== null) {
                    value = args[(index < 0 ? argsLength + index : index) + 1];

                // Automatic indexes, only for arguments since there is no real
                // way of telling if {} should grab the first array element or
                // the array itself
                } else {
                    value = args[autoIndex + 1];
                }
                autoIndex++;

                // Apply formats
                while (f = formatList.shift()) {

                    // Extra formats or one of the default ones
                    var method = format.formats[f[1]] || Formatter.formats[f[1]];
                    if (method) {
                        value = applyFormat(method, [value], f[2] || '')

                    } else {
                        throw new FormatError(replace,
                                              'Undefined formatter "{}".', f[1]);
                    }
                }
                return (pre + value).replace(escapedExp, '\\\\$1');
            }
            return template.replace(matchExp, replace).replace(escapedExp, '$1');
        }

        // Allow for later extension of formats
        format.formats = formats || {};
        return format;
    }

    // Apply a formatting function
    function applyFormat(method, args, string) {
        // Parse a string like "1, 2, false, 'test'"
        var m, pos = 0;
        while (m = string.substring(pos).match(argsExp)) {
            // number
            args.push(m[2] ? +m[2]
                           // boolean
                           : (m[1] ? m[1] === 'true'
                                   // string
                                   : m[4].replace(quotesExp[m[3]], m[3])));

            pos += m[0].length;
        }
        return method.apply(null, args);
    }

    // Resolve a string like "foo[0].bla['test']"
    function accessObject(obj, string) {
        var m, pos = 0;
        while (m = string.substring(pos).match(accessExp)) {
            //         .name or       ["foo"] or [0]
            var prop = m[1] || (m[3] ? m[4] : +m[2]);
            if (obj === undefined) {
                throw new FormatError(accessObject,
                                      'Cannot access property "{}" of undefined.',
                                      prop);

            } else {
                obj = obj[prop];
            }
            pos += m[0].length;
        }
        return obj;
    }

    function isType(type, obj) {
        return obj != null && {}.toString.call(obj).slice(8, 9) === type;
    }

    // Default formats
    Formatter.formats = {
        repeat: repeat,

        join: function(value, str) {
            return value.join(str == null ? ', ' : str);
        },

        upper: function(value) {
            return value.toUpperCase();
        },

        lower: function(value) {
            return value.toLowerCase();
        },

        pad: pad,

        lpad: function(value, length, str) {
            return pad(value, length, str, 'l');
        },

        rpad: function(value, length, str) {
            return pad(value, length, str, 'r');
        },

        surround: function(value, left, right) {
            return left + value + (right || left);
        },

        hex: function(value, lead) {
            return (lead ? '0x' : '') + value.toString(16);
        },

        bin: function(value, lead) {
            return (lead ? '0b' : '') + value.toString(2);
        }
    };

    // Format helpers
    function repeat(value, count) {
        return new Array((count || 0) + 1).join(value || ' ');
    }

    function pad(value, width, character, mode) {
        value = '' + value;
        var len = width - value.length,
            half = Math.floor(len / 2);

        if (len < 0) {
            return value;
        }

        var padding = repeat(character, len);
        return mode === 'l' ? padding + value
                            : mode === 'r' ? value + padding
                                           : repeat(character, len - half)
                                             + value + repeat(character, half);
    }

    // Custom Error Type
    function FormatError(func, msg, value) {
        this.name = 'FormatError';
        this.message = Formatter()(msg, value);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, func);
        }
    }
    FormatError.prototype = new Error();

    // Exports
    var exp = typeof window === 'undefined' ? exports : window;
    exp.Formatter = Formatter;
    exp.FormatError = FormatError;
})();

