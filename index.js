var fs = require('fs');

function _recurseDirSync(dirs, result, indent, index, o) {
    dirs = Array.isArray(dirs) ? dirs : [dirs];
    if (dirs.length > 0) {
        var dir = dirs.shift(),
            lastDir = dir.split(/\/+/).pop(),
            objPath = dir.slice(index),
            scope = objPath,
            files = [],
            filePath,
            myIndent = indent + '  ';

        result.push(indent + '(function (' + lastDir + ') {');
        fs.readdirSync(dir).forEach(function (file) {
            if (/^\./.test(file) || o.exclude && o.exclude.test(file)) return;
            filePath = dir + '/' + file;
            var parts = objPath.split(/\/+/);
            if (parts.length === 1) scope = parts[0];
            else scope = parts[0] + o.left + parts.slice(1).join(o.delim) + o.right;
            var stat = fs.lstatSync(filePath),
                isJs = /\.js$/.test(filePath);
            if (isJs && stat.isSymbolicLink()) {
                // symlinks are inserted first
                result.push(fs.readFileSync(filePath).toString().replace(/^/gm, myIndent));
            } else  if (isJs && stat.isFile()) {
                // files come after all symlinks
                files.push(filePath);
            } else if (stat.isDirectory()) {
                // finally subdirs
                dirs.push(filePath);
            }
        });

        for (var ifile = 0; ifile < files.length; ifile += 1) {
            filePath = files[ifile];
            // export last function of file named as the file
            var name = filePath.replace(/^.*\/([^\/]+)\.js$/, '$1'),
                data = fs.readFileSync(filePath).toString(),
                lines = data.split(/\r\n|\n/g),
                i = lines.length - 1,
                lastFuncName,
                line,
                m;

            do {
                line = lines[i],
                m = /^function\s+([\w_\$]+)/.exec(line);
                if (m) {
                    lastFuncName = m[1];
                    break;
                }
                i -= 1;
            } while (i > -1);
            var wrapIndent = indent + '  ';
            if (!o.nowrap) result.push(myIndent + '(function () {');
            else wrapIndent += '  ';
            result.push(data.replace(/^/gm,  wrapIndent));
            result.push(wrapIndent +  lastDir + '["' + name + '"] = ' + lastFuncName + ';');
            if (!o.nowrap) result.push(myIndent + '}());');
        }
            
        _recurseDirSync(dirs, result, indent + '  ', index, o);
        result.push(myIndent + 'return ' + lastDir + ';');
        if (o.scope && indent === '')
            scope = o.scope;
        result.push(indent  + '}(' + scope  + ' = {}));');
    }
    return result.join('\n');
}

function recurseDirSync(dir, o) {
    o = o || {};
    var apath = dir.split(/\/+/),
    last = apath.pop();
    o.delim = '.';
    o.left = '.';
    o.right = '';
    if (o.closure) {
        o.delim = '"]["';
        o.left = '["';
        o.right = '"]';
    }
    return _recurseDirSync([dir], [], '',  dir.length - last.length, o);
}

function requireCode(dir, o) {
    o = o || {};
    /*jshint evil: true*/
    return (new Function('return ' + recurseDirSync(dir, o))).call(o.scope || arguments.caller || this);
}

requireCode.code = function code(dir, o) {
    return recurseDirSync(dir, o) + '\n\n' + dir.replace(/^/gm, '// ') + '\n';
};

module.exports = requireCode;
