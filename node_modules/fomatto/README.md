Fōmatto - Japanese for Format
=============================

Fōmatto provides leightweight string interpolation and formatting for
JavaScript.

The library brings with it the `Formatter` factory and the `FormatError`.

# Usage
    
In order to use Fōmatto it is necessary to create a `format` function with the 
`Formatter` factory.

    Formatter([formats])

### The `format` function

    format(template, arg1[, arg2, arg3, ...argN])

The `format` function takes a **template** and either  **multiple arguments**, 
an **array** or **array like object** (an object with a `length` property of type
`Number`) or a standard **object** as its arguments. 

    > format('Good {} Sir {}.', 'morning', 'Lancelot')
    'Good morning Sir Lancelot.'

    > format('Good {0} Sir {1}.', 'morning', 'Lancelot')
    'Good morning Sir Lancelot.'

    > format('Good {time} Sir {name}.', 'morning', 'Lancelot')
    'Good morning Sir Lancelot.'

    > format('Good {0} Sir {1}.', ['morning', 'Lancelot'])
    'Good morning Sir Lancelot.'

    > format('Good {time} Sir {name}.', {time: 'morning', name: 'Lancelot'})
    'Good morning Sir Lancelot.'

    > format('Good {0} Sir {1}.', {0: 'morning', 1: 'Lancelot', length: 2})
    'Good morning Sir Lancelot.'

### Templates

String templates contain placeholders wrapped in `{}`. There are a number of
different ways in which these placeholders can be used to insert data into a
template.

 - Auto indexes via `{}`, these automatically insert the **next item** from an 
   array or a list of arguments.

 - Positive `{1}` or negative `{-1}` indexes, these will insert the **Nth** or 
   **length + Nth** index of an array or a list of arguments.

 - Property access via `{name}`, these will either insert the corresponding
   **property of an object** or behave like auto indexes in case of an array or 
   a list of arguments.

 - Complex property access via `{users.names[2]['first']}`, these will query an
   **object** for the specified property and throw a `FormatError` in case the 
   property could not be resolved.

# Formats

By appending a semicolon at the end of a placeholder it is possible to apply a
formatting function to the value before it is inserted.

    > format('{0:upper}!', 'banana')
    'BANANA!'

    > format('Some fruits: {:join(', ')}!', ['melons', 'oranges', 'strawberries'])
    'Some fruits: melons, oranges, strawberries!'

### Standard formats
    
- `upper` will transform to UPPER case.
- `lower` will transform to lower case.
- `lpad(count [, padding=' '])` will pad to `count` characters on the left side.
- `rpad(count [, padding=' '])` will pad to `count` characters on the right side.
- `pad(count [, padding=' '])` will equally pad to `count` characters on both sides.

> **Note:** The `pad` formats only support single characters for padding.

- `surround(left=' ' [, right=left])` will surround with `left` and `right`.
- `repeat(count=0)` will repeat `count` times.
- `join([character=' '])` will join an array with `character`.
- `hex([leading=false])` will convert to hexadecimal representation. If leading
  is true `0x` will be prepended.

- `bin([leading=false])` will convert to binary representation. If leading
  is true `0b` will be prepended.                                     

### Custom formats

Using the `Formatter` factory one can add their own formatters.

    var custom = Formatter({
        unicorns: function(value) {
            return value + ' unicorns!';
        }
    });

    > custom('Here come the {:unicorns}', 'five')
    'Here come the five unicorns!'

It is also possible to add more formats later on by setting properties on the
`formats` object of a `format` function.

    custom.formats.foo = function(value) {
        return 'foo';
    };

This will add the format `:foo`.

### Adding default formats

By extending `Formatter.formats` it's also possible to add more default
formats.

    Formatter.formats.bonsai = function(value) {
        // ...   
    };

The format `:bonsai` will now be available to all `format` functions.

