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
	const configMatch = html.match(/window\.VEND_CONFIG = (.*);/);
	assert.ok(configMatch, `${filename}: page configuration missing`);
	const config = JSON.parse(configMatch[1]);
	assert.equal(config.namespace, 'vend-proofing');
	assert.ok(html.indexOf(configMatch[0]) < html.indexOf('/js/' + (config.adminConfig ? 'admin' : 'storefront') + '.js'), `${filename}: configuration loads after bundle`);
	assert.ok(!html.includes('?/js/'), `${filename}: PHP script route`);
	console.log(`PASS ${filename}: ${count} inline scripts parse; configuration precedes static bundle`);
}
