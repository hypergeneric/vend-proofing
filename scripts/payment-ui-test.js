const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture () {
	const calls = [];
	const errors = [];
	let callbacks;
	let stripeOptions, confirmOptions, expressConfirm;
	let confirmation = {type:'success'};
	let closedCount = 0;
	function node(tag) {
		const listeners={};
		return {tag,children:[],dataset:{},disabled:false,textContent:'',
			appendChild(child){this.children.push(child);},
			setAttribute(){},addEventListener(name,callback){listeners[name]=callback;},
			showModal(){calls.push('opened');},close(){listeners.close();},remove(){calls.push('removed');},
			cancel(){let prevented=false;listeners.cancel({preventDefault(){prevented=true;}});if(!prevented)this.close();return prevented;}
		};
	}
	let eligible = true;
	let response = {success:true, status:'paid', url:'/invoice'};
	const container = {dataset:{title:'Payment',closeLabel:'Close',payLabel:'Pay',failed:'Try again',loading:'Loading',processing:'Confirming'}};
	const document = {
		createElement:node, body:node('body'),
		head:{appendChild(script){calls.push(script.src); script.onload();}}
	};
	const session = {start(options, order){calls.push(options); return order.then(value=>calls.push(value));}};
	const sdk = {
		findEligibleMethods(){return Promise.resolve({isEligible(){return eligible;}});},
		createPayPalOneTimePaymentSession(options){callbacks=options; calls.push('paypal'); return session;},
		createVenmoOneTimePaymentSession(options){callbacks=options; calls.push('venmo'); return session;}
	};
	const window = {
		location:{href:''},
		paypal:{createInstance(options){calls.push(options);return Promise.resolve(sdk);}},
		Stripe(key){calls.push(key);return {initCheckoutElementsSdk(options){stripeOptions=options;return {
			on(){},
			loadActions(){return Promise.resolve({type:'success',actions:{
				getSession(){return {total:{total:{amount:'$10.00'}}};},
				confirm(options){confirmOptions=options;calls.push('confirmed');return Promise.resolve(confirmation);}
			}});},
			createExpressCheckoutElement(){return {on(name,callback){expressConfirm=callback;},mount(){calls.push('express mounted');},destroy(){calls.push('express destroyed');}};},
			createPaymentElement(){return {mount(){calls.push('card mounted');},destroy(){calls.push('card destroyed');}};}
		};}};}

	};
	vm.runInNewContext(fs.readFileSync('src/js/payments.js','utf8'), {window,document,URLSearchParams,
		fetch(url,options){calls.push(Object.fromEntries(options.body));return response instanceof Error ? Promise.reject(response) : Promise.resolve({ok:true,json:()=>Promise.resolve(response)});}});
	return {api:window.VendPayments,window,container,calls,errors,fail:key=>errors.push(key),
		callbacks:()=>callbacks,stripeOptions:()=>stripeOptions,confirmOptions:()=>confirmOptions,
		dialog:()=>document.body.children.at(-1),closed:()=>closedCount,onClose:()=>closedCount++,
		confirmation:value=>confirmation=value,expressConfirm:()=>expressConfirm,response:value=>response=value,eligible:value=>eligible=value};
}

(async function () {
	const stripe = fixture();
	const order = {order:'test',access:'token',clientSecret:'synthetic-session-secret',publishableKey:'pk_test_synthetic',invoice:'/invoice'};
	await stripe.api.pay(order,stripe.container,'/gateway',stripe.fail,stripe.onClose);
	assert.ok(stripe.calls.includes('card mounted'));
	assert.ok(stripe.calls.includes('express mounted'));
	assert.equal(stripe.stripeOptions().clientSecret, order.clientSecret);
	let dialog=stripe.dialog();
	assert.equal(dialog.children[2].textContent,'$10.00');
	dialog.children[0].onclick();
	assert.equal(stripe.closed(),1);
	assert.equal(stripe.window.location.href,'');
	assert.ok(stripe.calls.includes('card destroyed'));
	assert.ok(!stripe.calls.some(call=>call.action));
	await stripe.api.pay(order,stripe.container,'/gateway',stripe.fail,stripe.onClose);
	dialog=stripe.dialog();
	stripe.confirmation({type:'error',error:{message:'Card declined'}});
	await dialog.children[6].onclick();
	assert.equal(dialog.children[5].textContent,'Card declined');
	assert.equal(dialog.children[6].disabled,false);
	assert.equal(stripe.window.location.href,'');
	stripe.confirmation({type:'success'});
	stripe.response(new Error('network down'));
	await dialog.children[6].onclick();
	assert.equal(dialog.children[5].textContent,'Try again');
	assert.equal(stripe.window.location.href,'');
	stripe.response({success:true,status:'paid',url:'/invoice'});
	const confirming=dialog.children[6].onclick();
	assert.equal(dialog.cancel(),true,'Cannot close during confirmation');
	const count=stripe.calls.filter(call=>call==='confirmed').length;
	dialog.children[6].onclick();
	assert.equal(stripe.calls.filter(call=>call==='confirmed').length,count,'Ignore duplicate confirmation');
	await confirming;
	assert.equal(stripe.confirmOptions().redirect,'if_required');
	assert.equal(stripe.window.location.href,'/invoice');
	assert.ok(stripe.calls.some(call=>call.action==='payment_status' && call.access==='token'));
	dialog.children[0].onclick();
	await stripe.api.pay(order,stripe.container,'/gateway',stripe.fail,stripe.onClose);
	const walletEvent={synthetic:true};
	await stripe.expressConfirm()(walletEvent);
	assert.equal(stripe.confirmOptions().expressCheckoutConfirmEvent,walletEvent);
	assert.equal(stripe.dialog().cancel(),false);
	assert.equal(stripe.calls.filter(call=>call==='https://js.stripe.com/clover/stripe.js').length,1);
	// A close before SDK loading completes must not mount stale Elements.
	const early=fixture();
	const loading=early.api.pay(order,early.container,'/gateway',early.fail,early.onClose);
	early.dialog().children[0].onclick();
	await loading;
	assert.ok(!early.calls.includes('card mounted'));

	for (const funding of ['paypal','venmo']) {
		const f=fixture();
		const payment={order:'test',access:'token',providerOrder:'PP_TEST',funding,currency:'USD',paypalClientId:'synthetic-client',paypalMode:'test'};
		await f.api.pay(payment,f.container,'/gateway',f.fail);
		assert.ok(f.calls.includes(funding));
		await f.callbacks().onApprove({orderId:'wrong'});
		assert.deepEqual(f.errors,['invalid_order']);
		assert.ok(!f.calls.some(call=>call.action==='payment_capture'));
		await f.callbacks().onApprove({orderId:'PP_TEST'});
		assert.ok(f.calls.some(call=>call.action==='payment_capture'));
		assert.equal(f.window.location.href,'/invoice');
		for (const status of ['paid','refunded','pending']) {
			f.window.location.href=''; f.errors.length=0;
			f.response({success:true,status,url:'/invoice'});
			await f.callbacks().onCancel();
			assert.equal(f.window.location.href,status==='pending' ? '' : '/invoice');
			assert.deepEqual(f.errors,status==='pending' ? ['payment_cancelled'] : []);
		}
		f.response(new Error('offline')); f.errors.length=0;
		await f.callbacks().onCancel();
		assert.equal(f.errors.length,1);
		f.eligible(false); f.calls.length=0; f.errors.length=0;
		await f.api.pay(payment,f.container,'/gateway',f.fail);
		assert.ok(!f.calls.includes(funding));
		assert.deepEqual(f.errors,['payment_unavailable']);
	}
	console.log('PASS Stripe modal close/reopen, declines, verification failure, double-submit guard, wallet confirmation, PayPal/Venmo eligibility and shared approval/cancellation/error handling');
})().catch(error=>{console.error(error);process.exitCode=1;});
