var fs = require('fs');

var hasAppended;
function _recurseDirSync(dirs, result, indent, index, o) {
    dirs = Array.isArray(dirs) ? dirs : [dirs];
    if (dirs.length > 0) {
        var dir = dirs.shift(),
            lastDir = dir.split(/\/+/).pop(),
            objPath = dir.slice(index),
            files = [],
            filePath,
            scope,
            myIndent = indent + '  ';

        result.push(indent + '(function (' + lastDir + ') {');
        fs.readdirSync(dir).forEach(function (file) {
            // TODO Add inclusion via SCRIPTENV variable
            // TODO Add markdown
            // if (o.markdown) {
            //     return result.push(fs.readFileSync(filePath).toString()
            //                                        .split(/\r\n|\n|\r/)
            //                                        .filter(function (t) { return /^\/\/ /.test(t); })
            //                                        .map(function (line) {
            //                                           return line.replace(/^\/\/ /, '');
            //                                        })
            //                                        .join('\n'));
            // }
            filePath = dir + '/' + file;
            if (/^\./.test(file) || o.exclude && o.exclude.test(filePath)) return;
            var parts = objPath.split(/\/+/);
            if (parts.length === 1) scope = parts[0];
            else {
                scope = parts[parts.length - 2] + o.left + parts.slice(parts.length - 1).join(o.delim) + o.right;
            }
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
                lastFuncName = null,
                line,
                m;

            do {
                line = lines[i],
                m = /^function\s+([\w\$_]+)\s*\(/.exec(line);
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
            if (lastFuncName) {
                result.push(wrapIndent +  lastDir + o.left + name + o.right + ' = ' + lastFuncName + ';');
            }
            if (!o.nowrap) result.push(myIndent + '}());');
        }

        _recurseDirSync(dirs, result, indent + '  ', index, o);
        if (o.append && !hasAppended) {
            var k = Object.keys(o.append);
            if (k.length > 0) {
                result.push((k + ' = ' + fs.readFileSync(o.append[k]).toString()).replace(/^/gm, indent + '  '));
                hasAppended = true;
            }
        }
            
        result.push(myIndent + 'return ' + lastDir + ';');
        if (o.scope && indent === '')
            scope = o.scope;
        if (!scope) {
            parts = objPath.split(/\/+/);
            scope = parts[1] + o.left + parts.slice(2).join(o.delim) + o.right;
        }
        if (o.defined) {
            if (indent === '')
                scope = scope + ' = typeof ' + scope + ' !== "undefined" ? ' + scope + ' :';
            else
                scope = scope + ' = ' + scope + ' ||';
        }
        else scope += ' =';
        result.push(indent  + '}(' + scope + ' {}));');
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
    hasAppended = false;
    return _recurseDirSync([dir], [], '',  dir.length - last.length, o);
}

function requireCode(dir, o) {
    o = o || {};
    try {
        /*jshint evil: true*/
        return (new Function('return ' + recurseDirSync(dir, o)))
                            .call(o.scope || arguments.caller || this);
    } catch (e) {
        setImmediate(function () {
            console.warn(e.stack.replace(/<anonymous>/g, dir + '/*.js'));
        });
    }
}

requireCode.code = function code(dir, o) {
    return recurseDirSync(dir, o) + '\n\n' + dir.replace(/^/gm, '// ') + '\n';
};

module.exports = requireCode;
