const gulp = require('gulp');
const browserSync = require('browser-sync').create();

const cssSources = ['src/**/*.scss', 'src/**/*.css'];
const jsSources = ['src/**/*.js'];

async function css() {
	delete require.cache[require.resolve('./scripts/build-css')];
	await require('./scripts/build-css').buildCss();
}

async function js() {
	delete require.cache[require.resolve('./scripts/build-js')];
	require('./scripts/build-js').buildJs();
}

const build = gulp.parallel(css, js);

function refreshCss(done) {
	browserSync.reload('*.css');
	done();
}

function reload(done) {
	browserSync.reload();
	done();
}

function watchCss() {
	return gulp.watch([...cssSources, 'assets.config.js', 'scripts/build-css.js'], gulp.series(css, refreshCss));
}

function watchJs() {
	return gulp.watch([...jsSources, 'assets.config.js', 'scripts/build-js.js'], gulp.series(js, reload));
}

function watchAssets() {
	gulp.watch(cssSources, gulp.series(css, refreshCss));
	gulp.watch(jsSources, gulp.series(js, reload));
	return gulp.watch(['assets.config.js', 'scripts/build-css.js', 'scripts/build-js.js'], gulp.series(build, reload));
}

function serve(done) {
	browserSync.init({
		proxy: {
			target: process.env.VEND_PROXY || 'https://vend-proofing.lndo.site',
			proxyReq: [(request) => request.setHeader('accept-encoding', 'identity')],
		},
		listen: '127.0.0.1',
		port: Number(process.env.VEND_DEV_PORT || 3000),
		open: false,
		ui: false,
		ghostMode: false,
		online: false,
	}, done);
}

function watchTemplates() {
	return gulp.watch(['vend-proofing-core/tmpl/html/**/*.tmpl'], reload);
}

exports.css = css;
exports.js = js;
exports.build = build;
exports.watchCss = watchCss;
exports.watchJs = watchJs;
exports.default = gulp.series(build, serve, gulp.parallel(watchAssets, watchTemplates));
