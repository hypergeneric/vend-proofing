const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const filename of process.argv.slice(2)) {
	const html = fs.readFileSync(filename, 'utf8');
	let count = 0;
	for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
		if (/\bsrc\s*=/.test(match[1])) continue;
		if (/\btype\s*=/.test(match[1]) && !/type=["'](?:text|application)\/javascript["']/.test(match[1])) continue;
		new vm.Script(match[2], { filename: `${filename}:inline-${++count}` });
	}
	if (html.includes('/js/admin.js')) {
		assert.ok(!html.includes('window.VEND_CONFIG'), `${filename}: admin still exports inline configuration`);
		const encoded = html.match(/data-config="([^"]*)"/);
		assert.ok(encoded, `${filename}: missing admin runtime config`);
		const runtime = JSON.parse(encoded[1].replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
		assert.deepEqual(Object.keys(runtime).sort(), ['basepath', 'indexpath', 'language']);
		assert.equal(runtime.language, 'en');
	} else {
		const configMatch = html.match(/window\.VEND_CONFIG = (.*);/);
		assert.ok(configMatch, `${filename}: page configuration missing`);
		const config = JSON.parse(configMatch[1]);
		assert.equal(config.namespace, 'vend-proofing');
		assert.ok(html.indexOf(configMatch[0]) < html.indexOf('/js/storefront.js'), `${filename}: configuration loads after bundle`);
	}
	assert.ok(!html.includes('?/js/'), `${filename}: PHP script route`);
	console.log(`PASS ${filename}: ${count} inline scripts parse; runtime settings and static bundle checked`);
}
