const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Exercise the real metadata callback with the Gateway's empty-payload behavior.
const source = fs.readFileSync('src/js/admin/classes/panels/DropboxSet.js', 'utf8');
const callback = source.slice(source.indexOf('function onMetaLoaded ('), source.indexOf('function onDataLoaded ('));
for (const data of [undefined, '', 'image_count=2&category_count=1']) {
	const requests = [];
	let enabled = false;
	let displayed = null;
	const context = {
		_panel: {screen() {}},
		_meta_table: {clear() {}, rows: {add(rows) {displayed = rows;}}, draw() {}},
		_obj_sync: {removeClass(name) {assert.equal(name, 'Disabled'); enabled = true;}},
		Lang: {lookup: value => value},
		Auth: {send(owner, handler, request) {requests.push(request);}},
		_suid: 'abcd',
		onDataLoaded() {},
		data
	};
	vm.runInNewContext(callback + '\nonMetaLoaded(true, data);', context);
	assert.equal(enabled, true, 'Sync stays disabled after metadata loads');
	assert.equal(displayed.length, data ? 2 : 0);
	assert.equal(requests[0].action, 'set_list');
	assert.equal(requests[0].puid, 'abcd');
}
console.log('PASS Dropbox empty/new and populated set metadata enables Sync');
