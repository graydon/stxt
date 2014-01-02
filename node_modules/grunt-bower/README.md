# grunt-bower

Copy bower installed components to dist folder.

## Getting Started
Install this grunt plugin next to your project's [grunt.js gruntfile][getting_started] with: `npm install grunt-bower`

Then add this line to your project's `grunt.js` gruntfile:

```javascript
grunt.loadNpmTasks('grunt-bower');
```

[grunt]: http://gruntjs.com/
[getting_started]: https://github.com/gruntjs/grunt/wiki/Getting-started

## Documentation
To your [grunt.js gruntfile][getting_started], add:

```javascript
bower: {
  dev: {
    dest: 'dest/path'
  }
}
```

add **basePath** option if you want to preserve library path:

```javascript
bower: {
  dev: {
    dest: 'dest/path',
    options: {
      basePath: 'components/'
    }
  }
}
```

add **stripJsAffix** option if you'd like to have lib names with 'js' affix to be stripped:

```javascript
bower: {
  dev: {
    dest: 'dest/path',
    options: {
      stripJsAffix: true
    }
  }
}
```
**stripJsAffix** could cause name confliction, use with caution!

## Change Logs
- Sep 30, 2013 v0.7.0

  Added css and multiple file support  
  Thank you, [Juri Saltbacka](https://github.com/3bola)!!

- Jul 28, 2013 v0.6.1

  support bower v1.0.0

- Feb 05, 2013 v0.5.0

  add option `stripJsAffix` to strip `/\W?js$/` in outputed file name.

- Feb 05, 2013 v0.4.4

  Grunt v0.4.0+ support, for real.

- Jan 31, 2013 v0.4.3

  Don't throw user out with error, and provides a little more informative warning messages.

- Jan 11, 2013 v0.4.2a

  Grunt v0.4.0+ support

- Dec 15, 2012 v0.4.2

  better handling the way to get file path to be copied, Bower v0.4.0 and above are supported

- Dec 14, 2012 v0.4.1

  try to guess the library file name if not provided by the installed component

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [grunt][grunt].


## License
Copyright (c) 2012 curist
Licensed under the MIT license.
