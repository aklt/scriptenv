# ScriptEnv

Create an object hierarchy of functions from a directory structure containing
plain `.js` files.  Useful for creating sharable JavaScript libraries from
separate components.

## Description

An object is created for each directory.  Symlinks are included as they are and
the last function of each file is added to the resulting object named as the
file name.

    Usage: scriptenv <dirname> [options]
    
      --nowrap            don't wrap each file in a closure
      --scope <scopeVar>  name of the variable the closure should be applied to
      --exclude <regExp>  exclude files/dirs matching
      --closure           use obj["prop"] to allow use of the closure compiler
    

## Example

Given a directory like this (the test directory):

    test
    ├── bar
    │   ├── apple.js
    │   └── tomato.js
    ├── deep
    │   └── a
    │       └── b
    │           └── c
    │               └── d
    │                   └── fish.js
    └── foo.js

Running

    scriptenv test

Will print a closure that creates a structure like this:

    { foo: [Function: foo_$yes],
      bar: { apple: [Function: apple], tomato: [Function: tomato] },
      deep: { a: { b: { c: { d: { fish: [Function: fishDeepInTheSea] } } } } } }

where each function in the resulting object is named as the file it resides in.

It is also possible to require a scriptenv dir in node:

    var myScriptEnv = require('scriptenv')('myScriptEnvDir', {
        exclude: /deep/,
        nowrap: true
    });
