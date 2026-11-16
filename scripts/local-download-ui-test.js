const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/js/storefront/vend/elements/Controlbar.js', 'utf8');
const start = source.indexOf('function downloadAll (');
const end = source.indexOf('\n\t\tfunction ', start + 1);
const code = source.slice(start, end);
let result;
const context = {
	Checkout: { settings: () => ({ tax: { included: false }, downloads: { tax: false, keys: ['one.jpg', 'two.png'], all: { flat: false, high: '4' }, high: { price: '4' } } }) },
	Session: { getFavorites: () => [{ cuid: 'two.png' }, { cuid: 'movie.mp4' }] },
	Func: { getFormattedPrice: value => String(value) },
	L10N: { get: (section, key) => key === 'cart_download_all_confirmation_description' ? '{QUANTITY}|{PRICE}' : key },
	Dialog: { options: options => { result = options; }, draw: () => {} },
	download_all_confirm: () => {}
};
vm.runInNewContext(code, context);
context.downloadAll('cart', 'high'); assert.equal(result.description, '2|8');
context.downloadAll('favorites', 'high'); assert.equal(result.description, '1|4');
context.Session.getFavorites = () => [{ cuid: 'movie.mp4' }]; result = null;
context.downloadAll('favorites', 'high'); assert.equal(result, null);
console.log('PASS local download-all and favorites confirmation counts/prices exclude unsupported media');
