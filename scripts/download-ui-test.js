const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/js/downloads.js', 'utf8');
function fixture(action = 'start') {
	const calls = [], timers = [], links = [];
	const config = { url: '?/order/test/process/', labels: { start: 'Prepare', next: 'Continue', download: 'Show', reset: 'Reset' }, hints: {}, processing: 'Processing', progress: '{PERCENT}%', link: '{COUNT}/{TOTAL}', error: 'Retry', sent: 'Sent', reply: 'Requested' };
	function element() {
		return { length: 1, values: {}, data(key, value) { if (value === undefined) return this.values[key]; this.values[key] = value; return this; },
			attr(value) { this.attrs = value; return this; }, text(value) { this.content = value; return this; }, prop(key, value) { this.values[key] = value; return this; },
			on(event, callback) { this.click = callback; return this; }, empty() { this.content = ''; return this; }, appendTo() { links.push(this); return this; } };
	}
	const button = element(), text = element(); button.data('action', action);
	const panel = { length: 1, attr() { return JSON.stringify(config); } };
	function $(selector) { return selector === '#download-process' ? panel : selector === '#download-button' ? button : selector === '#download-text' ? text : element(); }
	$.ajax = function (options) { const call = { options, done(fn) { this.resolve = fn; return this; }, fail(fn) { this.reject = fn; return this; } }; calls.push(call); return call; };
	vm.runInNewContext(source, { jQuery: $, setTimeout(fn) { timers.push(fn); } });
	return { button, text, calls, timers, links };
}
let ui = fixture(); ui.button.click();
assert.equal(ui.calls[0].options.type, 'POST');
ui.calls[0].resolve({ success: true }); ui.timers.shift()();
assert.ok(ui.calls[1].options.url.endsWith('/next/'));
ui.calls[1].resolve({ success: false, error: 'Missing image' });
assert.equal(ui.timers.length, 0); assert.equal(ui.text.content, 'Missing image'); assert.equal(ui.button.values.disabled, false);
ui.button.click(); assert.ok(ui.calls[2].options.url.endsWith('/next/'));
ui.calls[2].resolve({ success: true, progress: 1 }); assert.equal(ui.button.data('action'), 'download');
ui.button.click(); ui.calls[3].resolve({ success: true, links: ['https://www.dropbox.com/example?rlkey=abc&dl=1'] });
assert.equal(ui.links.length, 1); assert.equal(ui.links[0].content, '1/1'); assert.equal(ui.button.values.disabled, true);
ui = fixture('next'); ui.button.click(); ui.calls[0].reject(); assert.equal(ui.text.content, 'Retry'); assert.equal(ui.button.values.disabled, false); assert.equal(ui.timers.length, 0);
ui = fixture('download'); ui.button.click(); ui.calls[0].resolve({ success: true, links: [] }); assert.equal(ui.button.data('action'), 'reset');
ui.button.click(); ui.calls[1].resolve('1'); assert.equal(ui.text.content, 'Requested');
console.log('PASS invoice preparation progression, stopped errors, explicit retries, network failure, links and reset requests');
