

// Setup
if (typeof window === 'undefined') {
    Formatter = require('./../lib/fomatto').Formatter;
    FormatError = require('./../lib/fomatto').FormatError;
    var format = Formatter();

} else {
    exports = {};
    var format = Formatter();
}

function is(type, obj) {
    return obj !== null && obj !== undefined
           && Object.prototype.toString.call(obj).slice(8, -1) === type;
}


// Plain ------------------------------------------------------------------------
// ------------------------------------------------------------------------------
exports.testBase = function(test) {
    test.expect(1);
    var string = '{1} {{} {} {{2}} { {3}} { 4} {5 } '
                 + '{6}} {{7} } \\{8\\} \\{9} \\{{10}} \\n';

    var data = ['000', '001', '002', '003', '004', '005',
                '006', '007', '008', '009', '010'];

    var expected = '001 {foo \\{bar\\} {002} { 003} 004 005 '
                   + '006} {007 } {8} {9} {010} \\n';

    test.equals(format(string, data, 'foo', '\\{bar\\}'), expected);
    test.done();
};

exports.testPlainNamed = function(test) {
    test.expect(2);
    test.equals(format('Good morning Sir {name}.', 'Lancelot'),
                'Good morning Sir Lancelot.');

    test.equals(format('Good {time} Sir {name}.', 'evening', 'Lancelot'),
                'Good evening Sir Lancelot.');

    test.done();
};

exports.testPlainAuto = function(test) {
    test.expect(3);
    test.equals(format('Good morning Sir {}.', 'Lancelot'),
                'Good morning Sir Lancelot.');

    test.equals(format('Good {} Sir {}.', 'evening', 'Lancelot'),
                'Good evening Sir Lancelot.');

    test.equals(format('Good {time} Sir {}.', 'evening', 'Lancelot'),
                'Good evening Sir Lancelot.');

    test.done();
};

exports.testPlainIndex = function(test) {
    test.expect(4);
    test.equals(format('Good morning Sir {0}.', 'Lancelot'),
                'Good morning Sir Lancelot.');

    test.equals(format('Good {0} Sir {1}.', 'evening', 'Lancelot'),
                'Good evening Sir Lancelot.');

    test.equals(format('Good {1} Sir {0}.', 'Lancelot', 'evening'),
                'Good evening Sir Lancelot.');

    test.equals(format('Good {-1} Sir {-2}.', 'Lancelot', 'evening'),
                'Good evening Sir Lancelot.');

    test.done();
};

exports.testPlainIndexWhitespace = function(test) {
    test.expect(2);
    test.equals(format('Good { 0 } Sir { 1 }.', 'evening', 'Lancelot'),
                'Good evening Sir Lancelot.');

    test.equals(format('Good { -1} Sir { -2 }.', 'Lancelot', 'evening'),
                'Good evening Sir Lancelot.');

    test.done();
};

exports.testPlainMixed = function(test) {
    test.expect(3);
    test.equals(format('Good {time} Sir {1}.', 'evening', 'Lancelot'),
                'Good evening Sir Lancelot.');

    test.equals(format('Good {0} Sir {name}.', 'evening', 'Lancelot'),
                'Good evening Sir Lancelot.');

    test.equals(format('Good {0} Sir {}.', 'evening', 'Lancelot'),
                'Good evening Sir Lancelot.');

    test.done();
};


// Arrays -----------------------------------------------------------------------
// ------------------------------------------------------------------------------
exports.testArrayToString = function(test) {
    test.expect(2);
    test.equals(format('Good morning Sir {}.', ['Lancelot']),
                'Good morning Sir Lancelot.');
    test.equals(format('Good morning {}.', ['Sir', 'Lancelot']),
                'Good morning Sir,Lancelot.');

    test.done();
};

exports.testArrayIndex = function(test) {
    test.expect(3);
    test.equals(format('Good morning Sir {0}.', ['Lancelot']),
                'Good morning Sir Lancelot.');

    test.equals(format('Good {0} Sir {1}.', ['evening', 'Lancelot']),
                'Good evening Sir Lancelot.');

    test.equals(format('Good {-2} Sir {-1}.', ['evening', 'Lancelot']),
                'Good evening Sir Lancelot.');

    test.done();
};

exports.testArrayLikes = function(test) {
    test.expect(4);

    // Arguments should be supported
    function foo() {
        test.equals(format('Good {-2} Sir {1}.', arguments),
                    'Good evening Sir Lancelot.');
    }
    foo('evening', 'Lancelot');

    // Support array like object
    var arrayThing = {0: 'evening', 1: 'Lancelot', length: 2};
    test.equals(format('Good {-2} Sir {1}.', arrayThing),
                'Good evening Sir Lancelot.');

    // only have numeric lengths work
    arrayThing.length = '4';
    test.notEqual(format('Good {-2} Sir {1}.', arrayThing),
                   'Good evening Sir Lancelot.');

    // make sure to now fall for prototype stuff
    function Foo() {
        this[0] = 'evening';
        this[1] = 'Lancelot';
    }
    Foo.prototype.length = 4;

    // make sure it's bulletproof
    Foo.prototype.hasOwnProperty = function() {
        return false;
    };

    test.notEqual(format('Good {-2} Sir {1}.', new Foo()),
                   'Good evening Sir Lancelot.');

    test.done();
};


// Objects-----------------------------------------------------------------------
// ------------------------------------------------------------------------------
exports.testObjectAccess = function(test) {
    test.expect(4);
    test.equals(format('Good morning Sir {name}.', {name: 'Lancelot'}),
                'Good morning Sir Lancelot.');

    test.equals(format('Good {time} Sir {name}.', {time: 'evening',
                                                   name: 'Lancelot'}),
                'Good evening Sir Lancelot.');

    test.equals(format('Good morning Sir {0}.', {'0': 'Lancelot'}),
                'Good morning Sir Lancelot.');

    test.equals(format('Good {1} Sir {0}.', {'1': 'evening', '0': 'Lancelot'}),
                'Good evening Sir Lancelot.');

    test.done();
};

exports.testObjectToString = function(test) {
    var knight = {
        toString: function() {
            return 'Sir Lancelot';
        }
    };

    var time = {
        toString: function() {
            return 'morning';
        }
    };

    test.expect(3);
    test.equals(format('Good {time} {knight}.', time,knight),
                'Good morning Sir Lancelot.');

    test.equals(format('Good {0} {1}.', time, knight),
                'Good morning Sir Lancelot.');

    test.equals(format('Good {} {}.', time, knight),
                'Good morning Sir Lancelot.');

    test.done();
};


// Property Access --------------------------------------------------------------
// ------------------------------------------------------------------------------
exports.testPropertyAccess = function(test) {
    test.expect(4);
    test.equals(format('Good {msg.time} Sir {msg.name}.', {
        msg: {
            name: 'Lancelot',
            time: 'morning'
        }
    }), 'Good morning Sir Lancelot.');

    test.equals(format('Good {msg.time} Sir {msg.name}.', {
        msg: {
            name: 'Lancelot',
            time: 'evening'
        }
    }), 'Good evening Sir Lancelot.');

    test.equals(format('Good {msg["time"]} Sir {msg.name}.', {
        msg: {
            name: 'Lancelot',
            time: 'evening'
        }
    }), 'Good evening Sir Lancelot.');

    test.equals(format('Good {msg[\'values\'][1]} Sir {msg.values[0]}.', {
        msg: {
            values: ['Lancelot', 'evening']
        }
    }), 'Good evening Sir Lancelot.');

    test.done();
};

exports.testPropertyAccessEscaped = function(test) {
    test.expect(4);
    test.equals(format('My favorite color is {colors[\'"favorite"\']}.', {
        colors: {
            '"favorite"': 'blue'
        }
    }), 'My favorite color is blue.');

    test.equals(format('My favorite color is {colors[""favorite""]}.', {
        colors: {
            '"favorite"': 'blue'
        }
    }), 'My favorite color is blue.');

    test.equals(format('My favorite color is {colors["\'favorite\'"]}.', {
        colors: {
            '\'favorite\'': 'blue'
        }
    }), 'My favorite color is blue.');

    test.equals(format("My favorite color is {colors[''favorite'']}.", {
        colors: {
            '\'favorite\'': 'blue'
        }
    }), 'My favorite color is blue.');

    test.done();
};

exports.testPropertyAccessSquareBrackets = function(test) {
    test.expect(3);
    test.equals(format('My favorite color is {empty[""][0]}.', {
        empty: {
            '': ['blue']
        }
    }), 'My favorite color is blue.');

    test.equals(format('My favorite color is {colors["[favorite]"][0]}.', {
        colors: {
            '[favorite]': ['blue']
        }
    }), 'My favorite color is blue.');

    test.equals(format('My favorite color is {colors[\'[favorite]\'][0]}.', {
        colors: {
            '[favorite]': ['blue']
        }
    }), 'My favorite color is blue.');
    test.done();
};

exports.testPropertyAccessError = function(test) {
    test.expect(2);
    try {
        format('{favorite.color}', {msg: {name:'Lancelot'}});

    } catch(err) {
        test.ok(err instanceof FormatError);
        test.equal(err.message, 'Cannot access property "color" of undefined.');
    }
    test.done();
};


// Formatting -------------------------------------------------------------------
// ------------------------------------------------------------------------------
exports.testFormattingArgs = function(test) {
    test.expect(7);
    var custom = Formatter({
        test: function(value, boolTrue, boolFalse,
                              numPositive, numNegative,
                              strEmpty, strDouble, strSingle) {

            test.ok(boolTrue === true);
            test.ok(boolFalse === false);
            test.ok(numPositive === 1);
            test.ok(numNegative === -1);
            test.ok(strEmpty === '');
            test.ok(strDouble === 'te\'\"\"st');
            test.ok(strSingle === 'te\'\'\"st');
        }
    });
    custom('{:test(true, false, 1, -1, "", "te\'\\"\\"st", \'te\\\'\\\'"st\')}', '');
    test.done();
};

exports.testFormattingJoin = function(test) {
    test.expect(5);
    test.equals(format('{:join(" ")}', ['blue', 'red', 'green', 'yellow']),
                'blue red green yellow');

    test.equals(format('{:join(",")}', ['blue', 'red', 'green', 'yellow']),
                'blue,red,green,yellow');

    test.equals(format('{:join("")}', ['blue', 'red', 'green', 'yellow']),
                'blueredgreenyellow');

    test.equals(format('{:join()}', ['blue', 'red', 'green', 'yellow']),
                'blue, red, green, yellow');

    test.equals(format('{:join(false)}', ['blue', 'red', 'green', 'yellow']),
                'bluefalseredfalsegreenfalseyellow');

    test.done();
};

exports.testFormattingRepeat = function(test) {
    test.expect(3);
    test.equals(format('{:repeat(5)}', '-'), '-----');
    test.equals(format('{:repeat(1)}', 'Test'), 'Test');
    test.equals(format('{:repeat(0)}', 'Test'), '');
    test.done();
};

exports.testFormattingSurround = function(test) {
    test.expect(2);
    test.equals(format('{:surround("(", ")")}', 'Lancelot'), '(Lancelot)');
    test.equals(format('{:surround("-")}', 'Lancelot'), '-Lancelot-');
    test.done();
};

exports.testFormattingCase = function(test) {
    test.expect(2);
    test.equals(format('{:upper}', 'Lancelot'), 'LANCELOT');
    test.equals(format('{:lower}', 'Lancelot'), 'lancelot');
    test.done();
};

exports.testFormattingBase = function(test) {
    test.expect(4);
    test.equals(format('{:hex}', 32768), '8000');
    test.equals(format('{:bin}', 255), '11111111');
    test.equals(format('{:hex(true)}', 32768), '0x8000');
    test.equals(format('{:bin(true)}', 255), '0b11111111');
    test.done();
};

exports.testFormattingNumber = function(test) {
    test.expect(3);
    test.equals(format('{:lpad(4, "0")}', 3), '0003');
    test.equals(format('{:rpad(4, "0")}', 1), '1000');
    test.equals(format('{:pad(4, "0")}', 2), '0020');
    test.done();
};

exports.testFormattingPad = function(test) {
    test.expect(8);
    test.equals(format('{:lpad(2)}', 'Lancelot'), 'Lancelot');
    test.equals(format('{:lpad(12)}', 'Lancelot'), '    Lancelot');
    test.equals(format('{:rpad(2, " ")}', 'Lancelot'), 'Lancelot');
    test.equals(format('{:rpad(12, " ")}', 'Lancelot'), 'Lancelot    ');
    test.equals(format('{:pad(12, "=")}', 'Lancelot'), '==Lancelot==');
    test.equals(format('{:pad(2, "=")}', 'Lancelot'), 'Lancelot');
    test.equals(format('{:pad(3, "=")}', 'I'), '=I=');
    test.equals(format('{:pad(4, "=")}', 'I'), '==I=');
    test.done();
};

exports.testFormattingMultiple = function(test) {
    test.expect(3);
    test.equals(format('{:upper:lpad(12, " ")}', 'Lancelot'), '    LANCELOT');
    test.equals(format('{:surround("i", "i"):upper}', 'Lancelot'), 'ILANCELOTI');
    test.equals(format('{:join(", "):surround("[", "]"):upper:pad(30, "-")}',
                      ['blue', 'red', 'green', 'yellow']),
                       '--[BLUE, RED, GREEN, YELLOW]--');
    test.done();
};

exports.testFormattingAccess = function(test) {
    test.expect(4);
    test.equals(format('{:upper}', 'Lancelot'), 'LANCELOT');
    test.equals(format('{0:lower}', 'Lancelot'), 'lancelot');
    test.equals(format('{name:upper}', {name: 'Lancelot'}), 'LANCELOT');
    test.equals(format('{name[0]:lower}', {name: ['Lancelot']}), 'lancelot');
    test.done();
};

exports.testFormattingEscaped = function(test) {
    test.expect(3);
    test.equals(format('{:surround(\'i\', \'i\'):upper}', 'Lancelot'),
               'ILANCELOTI');

    test.equals(format('{:pad(12, "\\"=")}', 'Lancelot'), '"="=Lancelot"="=');
    test.equals(format('{:pad(12, "\'=")}', 'Lancelot'), '\'=\'=Lancelot\'=\'=');
    test.done();
};

exports.testFormattingError = function(test) {
    test.expect(2);
    try {
        format('{:unicornify}', 'Lancelot');

    } catch(err) {
        test.ok(err instanceof FormatError);
        test.equal(err.message, 'Undefined formatter "unicornify".');
    }
    test.done();
};

exports.testFormattingCustom = function(test) {
    test.expect(2);
    var custom = Formatter({
        unicorns: function(value) {
            return value + ' unicorns!';
        }
    });

    test.equals(custom('Here come the {:unicorns}', 'five'),
                       'Here come the five unicorns!');

    // add another custom one
    custom.formats.foo = function(value) {
        return 'foo';
    };
    test.equals(custom('{:foo}', ''), 'foo');
    test.done();
};

exports.testFormattingAddDefault = function(test) {
    test.expect(1);
    Formatter.formats.bar = function(value) {
        return 'bar';
    };
    test.equals(format('{:bar}', ''), 'bar');
    test.done();
};

exports.testFormattingCustomPreceedence = function(test) {
    test.expect(1);
    Formatter.formats.preceeds = function(value) {
        return 'false';
    };

    var custom = Formatter({
        preceeds: function(value) {
            return 'true';
        }
    });
    test.equals(custom('{:preceeds}', ''), 'true');
    test.done();
};

