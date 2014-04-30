#!/usr/bin/env node

var scriptenv = require('./index'),
    bar = scriptenv('test/bar'),
    all = scriptenv('test'),
    ex = scriptenv('test', {
        exclude: /dee/
    });

console.warn(bar);
console.warn(all);
console.warn(ex);
