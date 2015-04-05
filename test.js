#!/usr/bin/env node

var scriptenv = require('./index'),
    conf = {
        scope: '{}'
    },
    bar = scriptenv.code('test/bar', conf),
    all = scriptenv.code('test', conf),
    ex;
    
conf.exclude = /dee/;
ex = scriptenv('test', conf);

console.warn(scriptenv);
console.warn(bar);
console.warn(all);
console.warn(ex);
