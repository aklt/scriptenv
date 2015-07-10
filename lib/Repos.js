/*global console*/
// ## Repos - Maintain symlinks to interesting files
// 
// Main commands:
//
//   scriptenv link pathAt [destDir] - Import the pathAt function with a symlink in current dir or destDir
//   scriptenv add foo.js           - add the file foo.js to the repos
//   scriptenv list [match]         - list symlinks in repos filtering by RegExp match
//   scriptenv remove foo.js        - remove foo.js from repos. Checks whos linking to it

var fs     = require('fs'),
    util   = require('util'),
    cp     = require('child_process'),
    mkdirp = require('mkdirp');

function dirToBaseName(n) {
    return n.replace(/\/+$/, '').split(/\/+/g).pop();
}

function dirToReposName(n) {
    return n.replace(/\/+$/, '').replace(/\/+/g, '\#');
}

function dirOfReposName(n) {
    return n.replace(/#$/, '').replace(/#+/g, '/');
}

function removeNonExisting(paths) {
    var existing = [];
    for (var i = 0; i < paths.length; i += 1) {
        var p = paths[i];
        if (fs.existsSync(p)) {
            fs.unlinkSync(p);
        } else {
            existing.push(p);
        }
    }
    return existing;
}

//
// Users: list users using a symlink
//
// TODO:
//
//   * Use this in mv and other actions
//

function readUsers(dir) {
    var f1 = dir + '/.users.json';
    if (!fs.existsSync(f1)) return {'//': 'Users list where files are stored'};
    return JSON.parse(fs.readFileSync(f1).toString());
}

function writeUsers(dir, users) {
    return fs.writeFileSync(dir + '/.users.json', JSON.stringify(users));
}

function bad(err) {
    return err && err.code !== 1 &&
                 !err.killed &&
                  err.signal === null;
}

function git(dir, cmd, cb) {
    var run = '(cd ' + dir + ' && git ' + cmd + ')';
    console.warn('Running', run);
    cp.exec(run, function (err) {
        if (bad(err)) return cb(err);
        cb();
    });
}

function checkForGit(dir, cb) {
    if (!fs.existsSync(dir + '/.git')) {
        mkdirp.sync(dir);
        writeUsers(dir, {});
        return git(dir, 'init', function (err) {
            if (bad(err)) return cb(err);
            git(dir, 'add .users.json', function (err) {
                if (err) return cb(err);
                git(dir, 'commit -m "add ' + dir + '/.users.json"', function (err) {
                    if (bad(err)) return cb(err);
                    cb();
                });
            });
        });
    }
    process.nextTick(cb);
}

function addAndCommit(dir, msg, cb) {
    checkForGit(dir, function (err) {
        if (bad(err)) return cb(err);
        git(dir, 'add * .users.json', function (err) {
            if (bad(err)) return cb(err);
            git(dir, 'commit -m "' + msg + '"', function (err) {
                if (bad(err)) return cb(err);
                cb();
            });
        });
    });
}

// Handle the global repos of symlinks to single function files
function Repos(o) {
    o = o || {};
    this.dir = o.dir || process.env.HOME + '/.scriptenv';
    if (!fs.existsSync(this.dir)) mkdirp.sync(this.dir);
}

Repos.create = function (o) {
    return new Repos(o);
};

var logFunction = function (m) {
    console.log('LOG:', m);
};

Repos.prototype = {
    // add file paths to the repos
    add: function (fileOrSymlinkOrList, cb) {
        cb = cb || logFunction;
        var list = Array.isArray(fileOrSymlinkOrList) ? fileOrSymlinkOrList : [fileOrSymlinkOrList];
        var realPath1, dest;
        for (var i = 0; i < list.length; i += 1) {
            var path1 = list[i];
            realPath1   = fs.realpathSync(path1);
            dest = this.dir + '/' + dirToReposName(realPath1);
            if (fs.existsSync(dest)) {
                console.warn('Removing ' + dest + ' before symlinking');
                fs.unlinkSync(dest);
            }
            console.warn('add', realPath1, dest);
            fs.symlinkSync(realPath1, dest);
        }
        addAndCommit(this.dir, realPath1 + ' --> ' + dest, cb);
    },
    // list the files reachable
    list: function (match) {
        match = match || /.*/;
        if ('string' === typeof match) match = new RegExp(match);
        var links = fs.readdirSync(this.dir).filter(function (d) {
                return !/^\./.test(d) && match.test(d);
            }),
            existing = removeNonExisting(links);
        return existing.map(dirOfReposName);
    },
    // Link to a symlink in .scriptenv/ and get added to the users file
    link: function (match, cb) {
        cb = cb || logFunction;
        var list = Array.isArray(match) ? match : [match],
            linkPath,
            dest,
            users = readUsers(this.dir);

        for (var i = 0; i < list.length; i += 1) {
            var m1 = list[i];
            var l1 = this.list(m1);
            if (l1.length !== 1) {
                return console.log('Got ' + l1.length + ' results:\n' + util.inspect(l1, 0, 110, 10));
            }          
            linkPath = l1[0];
            dest = process.cwd() + '/' + dirToBaseName(linkPath);
            if (fs.existsSync(dest)) {
                console.warn('Removing ' + dest + ' before symlinking');
                fs.unlinkSync(dest);
            }
            if (!users[linkPath]) {
                users[linkPath] = {};
            }
            if (!users[linkPath][dest]) {
                users[linkPath][dest] = 0;
            }
            users[linkPath][dest] += 1;
            console.warn('Link', linkPath, dest);
            fs.symlinkSync(this.dir +'/'+ dirToReposName(linkPath), dest);
        }
        writeUsers(this.dir, users);
        console.warn('link', users);
        addAndCommit(this.dir, 'link ' + list.join(','), cb);
    },
    remove: function (fileOrSymlinkOrList) {

    }
};

module.exports = Repos;
