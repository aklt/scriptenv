#!/usr/bin/env node

var scriptenv = require('./index'),
    dir1 = scriptenv('test/dir1'),
    dir2 = scriptenv('test/dir2'),
    all = scriptenv('test'),
    ex = scriptenv('test', {
        exclude: /coo/
    });

console.warn(dir1);
console.warn(dir2);
console.warn(all);
console.warn(ex);
