const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'vend-proofing-core/js');
const expected = ['admin.js', 'jquery.js', 'storefront.js'];
const { copy } = require('../assets.config');
assert.deepEqual(fs.readdirSync(output).filter((name) => name.endsWith('.js')).sort(), expected);
let sourceCount = 0;
for (const name of expected) {
	const code = fs.readFileSync(path.join(output, name), 'utf8');
	new vm.Script(code, { filename: name });
	assert.ok(!code.includes('<?php'), `${name}: PHP in static bundle`);
	if (copy[name]) {
		assert.equal(code, fs.readFileSync(path.join(root, copy[name]), 'utf8'), `${name}: vendor copy changed`);
		continue;
	}
	const map = JSON.parse(fs.readFileSync(path.join(output, name + '.map'), 'utf8'));
	assert.ok(map.sources.length > 0, `${name}: empty source map`);
	assert.equal(new Set(map.sources).size, map.sources.length, `${name}: duplicate source`);
	for (const source of map.sources) {
		assert.ok(fs.existsSync(path.join(output, source)), `${name}: missing source ${source}`);
		assert.ok(source.startsWith('../../src/'), `${name}: source outside src`);
		sourceCount++;
	}
}
const admin = fs.readFileSync(path.join(output, 'admin.js'), 'utf8');
assert.equal((admin.match(/classes\.panels\.Orders = /g) || []).length, 1, 'Panels included more than once');
for (const [template, bundle] of [['admin', 'admin'], ['content', 'storefront'], ['order', 'jquery']]) {
	const html = fs.readFileSync(path.join(root, 'vend-proofing-core/tmpl/html', `1.page.${template}.tmpl`), 'utf8');
	assert.ok(html.includes(`/js/${bundle}.js?v=`), `${template}: missing static script`);
	assert.ok(!html.includes('?/js/'), `${template}: PHP script route`);
}
assert.ok(!fs.existsSync(path.join(root, 'vend-proofing-core/admin')), 'Admin sources remain in core');
assert.ok(!fs.existsSync(path.join(root, 'vend-proofing-core/tmpl/js')), 'PHP script templates remain');
console.log(`PASS two JS bundles and copied invoice jQuery, ${sourceCount} mapped sources, script links, and one panel inclusion`);
