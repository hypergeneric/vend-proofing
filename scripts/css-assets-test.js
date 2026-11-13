const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const postcssUrl = require('postcss-url');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist/vend-proofing-core/css');

async function testAssets() {
	const expected = ['admin.css', 'invoice.css', 'invoice-print.css', 'storefront.css'].sort();
	assert.deepEqual(fs.readdirSync(output).filter((name) => name.endsWith('.css')).sort(), expected);
	let assetCount = 0;
	for (const name of expected) {
		const filename = path.join(output, name);
		const css = fs.readFileSync(filename, 'utf8');
		const tree = postcss.parse(css, { from: filename, map: { prev: false } });
		tree.walkAtRules('import', () => assert.fail(`Unbundled CSS import in ${name}`));
		await postcss([postcssUrl({
			url: (asset) => {
				assert.ok(fs.existsSync(asset.absolutePath), `${name}: missing ${asset.url}`);
				assert.ok(asset.absolutePath.startsWith(path.join(root, 'dist/vend-proofing-core') + path.sep), `${name}: asset outside core`);
				assert.ok(!asset.absolutePath.startsWith(path.join(root, 'dist/vend-proofing-core/admin') + path.sep), `${name}: asset still in legacy admin directory`);
				assetCount++;
				return asset.url;
			},
		})]).process(tree, { from: filename, map: false });
	}
	for (const name of ['admin', 'content', 'credits', 'eula', 'setup', 'order']) {
		const html = fs.readFileSync(path.join(root, 'dist/vend-proofing-core/tmpl/html', `1.page.${name}.tmpl`), 'utf8');
		const markup = html.replace(/<\?php[\s\S]*?\?>/g, 'PHP');
		const links = markup.match(/<link\b[^>]*>/g) || [];
		for (const link of links.filter((link) => /rel="stylesheet"/.test(link))) {
			assert.ok(link.includes('/css/'), `${name}: stylesheet outside the four bundles`);
		}
		assert.ok(!html.includes('2.styles-admin.tmpl'), `${name}: obsolete stylesheet helper`);
	}
	console.log(`PASS four CSS bundles, ${assetCount} local font/image references, and application stylesheet links`);
}

testAssets().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
