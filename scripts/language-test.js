'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const requests = [];
const catalogs = {
	en: JSON.parse(fs.readFileSync(path.join(root, 'dist/vend-proofing-core/lang/en.json'))),
	es: {data: {users: {_attributes: {name: 'Usuarios'}}}},
};
const context = {
	classes: {data: {Auth: {basepath: () => './', corepath: () => 'vend-proofing-core'}}, helpers: {}},
	EventDispatcher: function () { this.dispatch = () => {}; },
	$: {ajax: (url, options) => {
		requests.push(url);
		const code = url.match(/\/lang\/([a-z]{2})\.json$/)?.[1];
		if (catalogs[code]) options.success(catalogs[code]);
		else options.error();
	}},
};
vm.runInNewContext(fs.readFileSync(path.join(root, 'src/js/admin/classes/data/Lang.js'), 'utf8'), context);
const lang = context.classes.data.Lang;
lang.initialize();
lang.code('es');
assert.equal(lang.lookup('users'), 'Usuarios');
assert.equal(lang.lookup('create_user'), 'Create User');
lang.code('zz');
assert.equal(lang.code(), 'en');
assert.equal(lang.lookup('forgot_password'), 'Forgot password?');
lang.code('../en');
assert.equal(requests.at(-1), './vend-proofing-core/lang/en.json');
assert.deepEqual(requests, ['es', 'zz', 'en', 'en'].map(code => `./vend-proofing-core/lang/${code}.json`));
console.log('PASS browser language selection, catalog URLs, English fallback, and slug labels');
