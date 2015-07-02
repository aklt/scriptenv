
var fs = require('fs');

function readFunctionsDefined(lines) {
    var result = {}, count = 0;
    for (var i = 0; i < lines.length; i += 1) {
        var line0 = lines[i];
        var m1 = /^function\s+([\w$_][\w$_\d]*)\s*/.exec(line0);
        if (m1) result[m1[1]] = count += 1;
    }
    if (count === 0) return null;
    return result;
}

function readGlobals(text) {
    var t0 = '/*global',
        t1 = '*/',
        first  = text.indexOf(t0),
        last   = text.indexOf(t1),
        result = null;

    if (first < last) {
        result = {};
        var count = 0,
            a1 = text.slice(first + t0.length, last)
                     .split(/(?:\s*,\s*|\s+)/gm);
        for (var i = 0; i < a1.length; i += 1)
            if (a1[i])
                result[a1[i]] = count += 1;
    }
    return result;
}

function readFilesInDir(dir, o) {
    var files = fs.readdirSync(dir).filter(function (d) { return !/^\./.test(d); }),
        result  = [];

    for (var i = 0; i < files.length; i += 1) {
        var file0 = files[i],
            filePath = dir + '/' + file0,
            stat = fs.lstatSync(filePath),
            isJs = /\.js$/.test(file0),
            r1 = {
                file: file0
            },
            data = fs.readFileSync(filePath)
                     .toString();

        if (isJs && stat.isSymbolicLink()) {
            o.result += data;
        } else if (isJs) {
            r1.data = data;
            var defines = readFunctionsDefined(
                    r1.data.split(/\r\n|\n|\r/g)),
                needs = readGlobals(r1.data);
            if (defines)
                r1.defines = defines;
            if (needs)
                r1.needs = needs;
            result.push(r1);
        }
    }
    return result;
}

function calcDeps(files) {
    for (var i = 0; i < files.length; i += 1) {
        var file = files[i], count = 0;
        file.deps = {};
        if (file.needs) {
            for (var need in file.needs) {
                for (var j = 0; j < files.length; j += 1) {
                    var file1 = files[j];
                    if (file1.defines[need]) {
                        file.deps[file1.file] = 1;
                        count += 1;
                        break;
                    }
                }
            }
        }
        if (count === 0) delete file.deps;
    }
}

function findUnmarked(files) {
    var result = [];
    for (var i = 0; i < files.length; i += 1) {
        var f0 = files[i];
        if (!f0.mark) {
            result.push(f0);
        }
    }
    return result;
}

function sortFiles(filesArray) {
    var result = [],
        filesIndex = {},
        unmarked;

    for (var i = 0; i < filesArray.length; i += 1) {
        var f0 = filesArray[i];
        filesIndex[f0.file] = f0;
    }

    function visit(n) {
        if (n.mark === 'temp') throw new Error("Not a DAG");
        if (!n.mark) {
            n.mark = 'temp';
            for (var k in n.deps)
                visit(filesIndex[k]);
            n.mark = 'perm';
            result.push(n);
        }
    }
    do {
        unmarked = findUnmarked(filesArray);
        for (var j = 0; j < unmarked.length; j += 1)
            visit(unmarked[j]);
    } while (unmarked.length > 0);

    for (var k = 0; k < filesArray.length; k += 1) {
        var f1 = filesArray[k];
        if (!f1.mark) {
            f1.mark = 'temp';
            visit(f1);
        }
    }
    return result;
}

function catFiles(filesArray, o) {
    o = o || {};
    var result = '';
    for (var i = 0; i < filesArray.length; i += 1) {
        var f0 = filesArray[i];
        result += f0.data;
    }
    var scope = o.scope || 'this',
        scopeName = o.scopeName || 'scope';

    if (o.scope) {
        result = '(function (' + scopeName + ') {\n' +
                       result.replace(/^/gm, '    ') + '\n}(' + scope + '));';
    }
    return result;
}

function jsFileFromDir(dir, o) {
    var r0 = {result: ''},
        files = readFilesInDir(dir, r0);
    calcDeps(files);
    var ordered = sortFiles(files);
    return r0.result + catFiles(ordered, o);
}

// var file = jsFileFromDir('/home/alt/projects/spanish-app/lib/RefDb', {
    // scope: 'this',
    // scopeName: 'lib'
// });
// console.warn(file);

module.exports = jsFileFromDir;