/* Provider UI shared by storefront checkout and invoice retries. Prices stay on the server. */
window.VendPayments = (function () {
	var scripts = {};
	var paypalInstances = {};
	var activeDialog = null;

	function load (url) {
		if (!scripts[url]) scripts[url] = new Promise(function (resolve, reject) {
			var script = document.createElement("script");
			script.src = url;
			script.onload = resolve;
			script.onerror = function () { delete scripts[url]; script.remove(); reject(new Error("payment_connection_failed")); };
			document.head.appendChild(script);
		});
		return scripts[url];
	}

	function request (endpoint, action, order) {
		return fetch(endpoint, {method:"POST", body:new URLSearchParams({action:action, order:order.order, access:order.access})})
			.then(function (response) { if (!response.ok) throw new Error("payment_connection_failed"); return response.json(); })
			.then(function (result) { if (!result.success) throw new Error(result.error || "payment_connection_failed"); return result; });
	}

	function paypal (options) {
		var key = options.paypalMode + ":" + options.paypalClientId;
		if (!paypalInstances[key]) {
			var host = options.paypalMode==="live" ? "https://www.paypal.com" : "https://www.sandbox.paypal.com";
			paypalInstances[key] = load(host + "/web-sdk/v6/core").then(function () {
				return window.paypal.createInstance({clientId:options.paypalClientId, components:["paypal-payments", "venmo-payments"], pageType:"checkout"});
			}).catch(function (error) { delete paypalInstances[key]; throw error; });
		}
		return paypalInstances[key];
	}

	function stripeModal (order, container, endpoint, onClose) {
		if (activeDialog) return Promise.resolve();
		var labels = container.dataset;
		var dialog = document.createElement("dialog");
		dialog.className = "vend-payment-dialog";
		dialog.setAttribute("aria-label", labels.title);
		function node (tag, text) {
			var element = document.createElement(tag);
			if (text) element.textContent = text;
			dialog.appendChild(element);
			return element;
		}
		var close = node("button", labels.closeLabel);
		close.type = "button";
		close.className = "vend-payment-close";
		node("h2", labels.title);
		var total = node("p");
		total.className = "vend-payment-total";
		var expressHost = node("div");
		var paymentHost = node("div");
		var message = node("p", labels.loading);
		message.setAttribute("role", "status");
		var submit = node("button", labels.payLabel);
		submit.type = "button";
		submit.className = "vend-payment-submit";
		submit.disabled = true;
		var elements = [], closed = false, busy = false;
		close.onclick = function () { if (!busy) dialog.close(); };
		dialog.addEventListener("cancel", function (event) { if (busy) event.preventDefault(); });
		dialog.addEventListener("close", function () {
			closed = true;
			elements.forEach(function (element) { element.destroy(); });
			dialog.remove();
			activeDialog = null;
			if (onClose) onClose();
		});
		document.body.appendChild(dialog);
		activeDialog = dialog;
		dialog.showModal();
		return load("https://js.stripe.com/clover/stripe.js").then(function () {
			if (closed) return;
			var checkout = window.Stripe(order.publishableKey).initCheckoutElementsSdk({clientSecret:order.clientSecret});
			return checkout.loadActions().then(function (result) {
				if (closed) return;
				if (result.type!=="success") throw new Error("payment_connection_failed");
				var actions = result.actions;
				function amount () { total.textContent = actions.getSession().total.total.amount; }
				amount();
				checkout.on("change", amount);
				function confirm (event) {
					if (busy || closed) return;
					busy = true;
					submit.disabled = close.disabled = true;
					message.textContent = labels.processing;
					amount();
					return actions.confirm({redirect:"if_required", expressCheckoutConfirmEvent:event}).then(function (confirmation) {
						if (confirmation.type==="error") {
							message.textContent = confirmation.error.message;
							return;
						}
						return request(endpoint, "payment_status", order).then(function (payment) { window.location.href = payment.url; });
					}).catch(function () { message.textContent = labels.failed; }).finally(function () {
						busy = false;
						submit.disabled = close.disabled = false;
					});
				}
				var express = checkout.createExpressCheckoutElement();
				var payment = checkout.createPaymentElement({layout:"tabs", wallets:{link:"never"}});
				elements.push(express, payment);
				express.on("confirm", confirm);
				express.mount(expressHost);
				payment.mount(paymentHost);
				submit.onclick = function () { return confirm(); };
				submit.disabled = false;
				message.textContent = "";
			});
		}).catch(function () { if (!closed) message.textContent = labels.failed; });
	}

	function pay (order, container, endpoint, onError, onClose) {
		function fail (error) {
			var key = ["invalid_order", "payment_cancelled", "payment_unavailable", "payment_requires_review"].indexOf(error.message)>=0 ? error.message : "payment_connection_failed";
			onError(key);
		}
		function invoice (result) { window.location.href = result.url; }
		if (order.url) { invoice(order); return Promise.resolve(); }
		if (order.clientSecret) return stripeModal(order, container, endpoint, onClose);
		return paypal(order).then(function (sdk) {
			return sdk.findEligibleMethods({currencyCode:order.currency}).then(function (methods) {
				var funding = order.funding;
				if (!methods.isEligible(funding)) throw new Error("payment_unavailable");
				var callbacks = {
					onApprove:function (data) {
						if (data.orderId!==order.providerOrder) { fail(new Error("invalid_order")); return; }
						return request(endpoint, "payment_capture", order).then(invoice).catch(fail);
					},
					onCancel:function () {
						return request(endpoint, "payment_cancel", order).then(function (result) {
							if (result.status==="paid" || result.status==="refunded") invoice(result);
							else fail(new Error("payment_cancelled"));
						}).catch(fail);
					},
					onError:function () { fail(new Error("payment_connection_failed")); }
				};
				var session = funding==="venmo" ? sdk.createVenmoOneTimePaymentSession(callbacks) : sdk.createPayPalOneTimePaymentSession(callbacks);
				return session.start({presentationMode:"auto"}, Promise.resolve({orderId:order.providerOrder}));
			});
		}).catch(fail);
	}

	return {pay:pay, paypal:paypal, request:request};
}());
