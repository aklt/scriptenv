/*global console, gulp, gulpShell, gulpJshint*/

var mkdirp        = require('mkdirp'),
    jshintStylish = require('jshint-stylish'),
    del           = require('del'),
    jsScripts     = 'lib/*.js';

require('matching-deps')(/^gulp/, {dev: 1});

gulp.task('code-tagdir', gulpShell.task(['tagdir']));

gulp.task('default', ['build', 'code-tagdir']);

function serveDir(dir) {
    return function () {
        gulp.watch(jsScripts, ['code-tagdir', 'build-script-jshint', 'test']);
        return gulp.watch('gulpfile.js', ['code-tagdir', 'test']);
    };
}

gulp.task('serve', serveDir('.'));

//
// Script
//
gulp.task('build-script-jshint', function () {
    gulp.src(jsScripts)
        .pipe(gulpJshint())
        .pipe(gulpJshint.reporter(jshintStylish));
});

var se = './node_modules/.bin/scriptenv';
gulp.task('build-appjs', gulpShell.task([
    se + ' lib --cat > build/app.js'
]));

gulp.task('test', ['build-script'], gulpShell.task([
    './node_modules/.bin/mocha'
]));

gulp.task('build', function () {
    gulp.start('code-tagdir', 'build-script-jshint', 'test');
});

gulp.task('clean', function (cb) {
    del(['./build']);
});
