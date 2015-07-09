/*global console*/
// ## Repos - Maintain symlinks to interesting files
// 
// Main commands:
//
//   scriptenv get pathAt [destDir] - Import the pathAt function with a symlink in current dir or destDir
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

function git(dir, cmd, cb) {
    var run = '(cd ' + dir + ' && git ' + cmd + ')';
    console.warn('Running', run);
    cp.exec(run, cb);
}

function checkForGit(dir, cb) {
    if (!fs.existsSync(dir + '/.git')) {
        writeUsers(dir, {});
        return git(dir, 'init', function (err) {
            if (err) return cb(err);
            git(dir, 'add .users.json', function (err) {
                if (err) return cb(err);
                git(dir, 'commit -m "add .users.json"', cb);
            });
        });
    }
    process.nextTick(cb);
}

function addAndCommit(dir, msg, cb) {
    checkForGit(dir, function (err) {
        if (err) return cb(err);
        git(dir, 'add * .users.json', function (err) {
            if (err) return cb(err);
            git(dir, 'commit -m "' + msg + '"', function (err) {
                if (err) {
                    // This is ok meaning nothing to commit
                    if (err.code === 1 && !err.killed && err.signal === null)
                        return cb(null);
                    cb(err);
                }
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
    add: function (fileOrSymlink, cb) {
        cb = cb || logFunction;
        var p1   = fs.realpathSync(fileOrSymlink),
            dest = this.dir + '/' + dirToReposName(fileOrSymlink);
        if (fs.existsSync(dest)) {
            console.warn('Removing ' + dest + ' before symlinking');
            fs.unlinkSync(dest);
        }
        fs.symlinkSync(p1, dest);
        addAndCommit(this.dir, p1 + ' --> ' + dest, cb);
        return dest;
    },
    list: function (match) {
        match = match || /.*/;
        if ('string' === typeof match) match = new RegExp(match);
        var links = fs.readdirSync(this.dir).filter(function (d) {
                return !/^\./.test(d) && match.test(d);
            }),
            existing = removeNonExisting(links);
        return existing.map(dirOfReposName);
    },
    get: function (match, cb) {
        cb = cb || logFunction;
        var l1 = this.list(match);
        if (l1.length !== 1) {
            return console.log('Got ' + l1.length + ' results:\n' + util.inspect(l1, 0, 110, 10));
        }          
        var linkPath = l1[0],
            dest = process.cwd() + '/' + dirToBaseName(linkPath);
        if (fs.existsSync(dest)) {
            console.warn('Removing ' + dest + ' before symlinking');
            fs.unlinkSync(dest);
        }
        var users = readUsers(this.dir);
        if (!users[linkPath]) {
            users[linkPath] = {};
        }
        if (!users[linkPath][dest]) {
            users[linkPath][dest] = 0;
        }
        users[linkPath][dest] += 1;
        writeUsers(this.dir, users);
        fs.symlinkSync(linkPath, dest);
        addAndCommit(this.dir, 'get ' + linkPath + ' to ' + dest, cb);
    },
    remove: function (fileOrSymlink) {

    }
};

var r1 = Repos.create();

r1.add('/tmp/awesome-mpd.log');
r1.add('/home/alt/todo.txt');
r1.get('alt');
console.warn(r1.list());
console.warn(r1.list('alt'));
