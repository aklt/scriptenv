/*global console*/

var fs = require('fs');

/// Read files from a directory with no subdirectories and catenate all the js
/// files to a single .js file with dependencies from /*global ...*/ comments
/// respected in the orderings.
//
// TODO
//
//  * Only include files that are named in global declarations
//  * Include other formats in output: coffeescript, json, markdown, sweetjs

function readFunctionsDefined(lines) {
    var result = {}, count = 0;
    for (var i = 0; i < lines.length; i += 1) {
        var line0 = lines[i];
        var m1 = /^function\s+([\w$_][\w$_\d]*)\s*/i.exec(line0);
        if (m1) result[m1[1]] = count += 1;
    }
    if (count === 0) return null;
    return result;
}

var _globals_to_ignore = {
    console: 1,
    setImmediate: 1,
    clearTimeout: 1,
    setTimeout: 1,
    setInterval: 1,
    clearInterval: 1
};

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
            if (a1[i] && !_globals_to_ignore[a1[i]])
                result[a1[i]] = count += 1;
    }
    return result;
}

function readFilesInDir(dir, o) {
    var result = [];
    _readFilesInDir(result, dir, o);
    return result;
}

function _readFilesInDir(result, dir, o) {
    var files = fs.readdirSync(dir).filter(function (d) { return !/^\./.test(d); }),
        dirs = [];

    for (var i = 0; i < files.length; i += 1) {
        var file0 = files[i],
            filePath = dir + '/' + file0,
            stat = fs.lstatSync(filePath),
            isJs = /\.js$/.test(file0),
            r1 = {
                file: filePath
            },
            data;
            
        if (stat.isDirectory()) {
            dirs.push(filePath);
            continue;
        }

        data = fs.readFileSync(filePath)
                 .toString();

        if (isJs && stat.isSymbolicLink()) {
            o.result += data;
        } else if (isJs && stat.isFile()) {
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
    for (var k = 0; k < dirs.length; k += 1)
        _readFilesInDir(result, dirs[k], o);
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
                    if (file1.defines && file1.defines[need]) {
                        file.deps[file1.file] = 1;
                        count += 1;
                        break;
                    }
                }
            }
        }
        if (count === 0) delete file.deps;
    }

    // TODO: Calculate and remove files not reachable from index.js, i.e. files that
    // are not depended upon and are not called index.js
    for (i = 0; i < files.length; i += 1) {
        var file2 = files[i],
            dependedOn = 0;

        if (file2.name === 'index.js') continue;
        if (Object.keys(file2.deps || {}).length > 0) continue;

        for (var l = 0; l < files.length; l += 1) {
            if (i === l) continue;
            var file3 = files[i];
            if (file3.deps && file3.deps[file2.name]) dependedOn = 1;
        }

        // TODO Do this properly
        // if (!dependedOn)
            // files.splice(i, 1);
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
        if (!n) return;
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

function basename(t) {
    return t.replace(/^.*?\/?([^\/]+)\/?$/, '$1');
}

function catFiles(filesArray, o) {
    o = o || {};
    var result = '';
    for (var i = 0; i < filesArray.length; i += 1) {
        var f0 = filesArray[i];
        result += f0.data;
    }
    result = ('this.' + basename(o.dir) + ' = (function () {\n' + result.replace(/^/gm, '    ') + '\n}.call(this));\n')
            .replace(/^/gm, '    ');
    return result;
}

function packageFilesInMain(filesArray, o) {
    o = o || {};
    var result = '(function () {\n';
    for (var i = 0; i < filesArray.length; i += 1) {
        var f0 = filesArray[i];
        result += f0.data;
    }
    result += '}.call(' + (o.scope || 'this') + '));';
    return result;
}

function docFile(filesArray, o) {
    o = o || {};
    var result = [];
    for (var i = 0; i < filesArray.length; i += 1) {
        console.warn('File', filesArray[i].file);
        var f0 = filesArray[i].data.split(/\r\n|\n|\r/g);
        for (var j = 0; j < f0.length; j += 1) {
            var e = f0[j];
            var m1 = /^\s*\/\/\/*\s*(.*)$/.exec(e);
            if (m1)
                result.push(m1[1]);
        }
    }
    return result.join('\n');
}

function fileFromDir(dir, o) {
    o = o || {};
    if (!o.dir) o.dir = dir;
    var r0 = {result: ''},
        files = readFilesInDir(dir, r0);
        if (!o.scope) o.scope = 'this';
        if (!o.scopeName) o.scopeName = 
        dir.replace(/\/+$/, '')
           .split(/\/+/g)
           .pop();
    calcDeps(files);
    var ordered = sortFiles(files);
    if (o.cat)
        return r0.result + catFiles(ordered, o);
    if (o.packaged)
        return packageFilesInMain(ordered, o);
    if (o.docs)
        return docFile(ordered, o);
    throw new Error("Badness");
}


// var file = fileFromDir('/home/alt/projects/spanish-app/lib/RefDb', {
    // scope: 'this',
    // scopeName: 'libs'
// });
// console.warn(file);

module.exports = fileFromDir;
