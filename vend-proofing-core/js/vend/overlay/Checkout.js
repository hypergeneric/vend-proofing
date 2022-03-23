
/*jslint browser: true, continue: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.overlay.Checkout = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var StageProxy; // shortcut
		var Func; // shortcut
		var L10N; // shortcut
		var Overlay; // shortcut
		var Session; // shortcut
		var Dialog; // shortcut
		var Cart; // shortcut
		var Controlbar; // shortcut
		/* private properites
			*/
		var taxrules = 		[];
		var discount = 		[];
		var options = {
			country: 			"",
			state: 			"",
			province: 			"",
			currency: 			"",
			intl: 			false,
			pickup: 			false,
			offline: 			false,
			paypal: 			false,
			merchant: 			false,
			downloads: { 
				use: false, 
				tax: false, 
				high: {
					use: false, 
					price: "0" 
				},
				low: {
					use: false, 
					price: "0" 
				},
				all: {
					use: false, 
					high: "0",
					low: "0" 
				}
			},
			shipping: {
				use: 			true,
				tax: 			false,
				flat: 		0,
				rate: 		0
			},
			handling: {
				use: 			false,
				tax: 			false,
				flat: 		0,
				intl: 		0
			},
			tax: {
				use: 			true,
				included: 		false
			},
			discount: 			false,
			minimum: {
				value: 			0,
				count: 			0
			}
		};
		var order = {
			id: 				"",
			payment_method: 		"offline",
			shipping_method: 		"ship",
			country_code: 		"",
			postal_code: 		"",
			state_code: 		"",
			final_value: 		0,
			discount_value: 		0,
			final_shipping: 		0,
			final_handling: 		0,
			final_tax: 			0
		};
		var defaultemail = 			"";
		var inited = 			false;
		var cart_no_payment = 	false;
		var ignore_ssl_warning = false;
		var recheck = 			false;
		var container = null;
			var screen = null;
			var blocks = null;
			var summary = null;
			var back_obj = null;
			var process_obj = null;
			var accept_obj = null;
			var clickwrap_obj = null;
		var sidebar_input = null;
			var sidebar_input_content = null;
		/* private methods
			*/
		function getTaxRate () {
			var i, taxrule;
			if (order.country_code=="") {
				return [0, 0, 0, false];
			}
			if (options.country=="US") {
				if (options.country!=order.country_code) {
					return [0];
				}
				if (order.state_code=="") {
					return [0];
				}
				for (i=0; i<taxrules.length; ++i) {
					taxrule = taxrules[i];
					if (order.state_code==taxrule[0]) {
						return [taxrule[1]];
					}
				}
			} else if (options.country=="CA") {
				if (options.country!=order.country_code) {
					return [0, 0, 0, false];
				}
				if (order.state_code=="") {
					return [0, 0, 0, false];
				}
				for (i=0; i<taxrules.length; ++i) {
					taxrule = taxrules[i];
					if (order.state_code==taxrule[0]) {
						return [taxrule[1], taxrule[2], taxrule[3], (taxrule[0]=="QC")];
					}
				}
			} else {
				for (i=0; i<taxrules.length; ++i) {
					taxrule = taxrules[i];
					if (order.country_code==taxrule[0]) {
						return [taxrule[1]];
					}
				}
			}
			return [0, 0, 0, false];
		}
		function updateTotals () {
			var cart_subtotal = 0;
			var download_subtotal = 0;
			var shipping_subtotal = options.shipping.flat;
			var products = Session.getPackages();
			var cart_items = Session.getCart();
			var downloads = Session.getDownloads();
			var i, item, subtotal, shipping, display_value, handling;
			for (i=0; i<products.length; ++i) {
				item = products[i];
				subtotal = parseFloat(item.subtotal);
				shipping = parseFloat(item.shipping);
				cart_subtotal += isNaN(subtotal) ? 0 : subtotal;
				shipping_subtotal += isNaN(shipping) ? 0 : shipping;
			}
			for (i=0; i<cart_items.length; ++i) {
				item = cart_items[i];
				subtotal = parseFloat(item.subtotal) * parseFloat(item.quantity);
				shipping = parseFloat(item.shipping) * parseFloat(item.quantity);
				cart_subtotal += isNaN(subtotal) ? 0 : subtotal;
				shipping_subtotal += isNaN(shipping) ? 0 : shipping;
			}
			for (i=0; i<downloads.length; ++i) {
				item = downloads[i];
				subtotal = parseFloat(item.subtotal);
				download_subtotal += isNaN(subtotal) ? 0 : subtotal;
			}
			order.final_value = cart_subtotal + download_subtotal;
			order.discount_value = 0;
			order.final_shipping = 0;
			order.final_handling = 0;
			order.final_tax = 0;
			if (options.tax.included) {
				cart_subtotal = Func.addSalesTax(cart_subtotal);
				cart_subtotal += options.downloads.tax ? Func.addSalesTax(download_subtotal) : download_subtotal;
			} else {
				cart_subtotal += download_subtotal;
			}
			$("#cart-total").find(".Value").html(Func.getFormattedPrice(cart_subtotal));
			if (options.discount) {
				if (discount[0]=="true") {
					// true, 216d8, 9501, 50off, fdsafdas, 50, percentage, 4, 5, 0, 1
					var discount_type = discount[5];
					var discount_value = parseFloat(discount[4]);
					order.discount_value = discount_type=="percentage" ? order.final_value*(discount_value/100) : discount_value;
					if (order.discount_value>order.final_value) {
						order.discount_value = order.final_value;
					}
					display_value = order.discount_value;
					if (options.tax.included) {
						display_value = Func.addSalesTax(display_value);
					}
					$("#cart-discount").find(".Value").html(Func.getFormattedPrice(display_value*-1));
				} else if (discount[0]=="false") {
					order.discount_value = 0;
					$("#cart-discount").find(".Value").html(L10N.get("checkout", "checkout_"+discount[1]));
				} else {
					order.discount_value = 0;
					$("#cart-discount").find(".Value").html(Func.getFormattedPrice(0));
				}
				display_value = order.final_value - order.discount_value - download_subtotal;
				if (display_value<0) {
					display_value = 0;
				}
				if (options.tax.included) {
					display_value = Func.addSalesTax(display_value);
					display_value += options.downloads.tax ? Func.addSalesTax(download_subtotal) : download_subtotal;
				} else {
					display_value += download_subtotal;
				}
				$("#cart-subtotal").find(".Value").html(Func.getFormattedPrice(display_value));
			}
			shipping_subtotal += (order.final_value-order.discount_value)*(options.shipping.rate/100);
			if (options.shipping.use) {
				if (order.shipping_method=="local") {
					shipping_subtotal = 0;
				}
				if ( products.length==0 && cart_items.length==0 && downloads.length>0 ) {
					shipping_subtotal = 0;
				}
				if (options.discount) {
					if (discount[0]=="true"&&discount[10]=="1") {
						shipping_subtotal = 0;
					}
				}
				order.final_shipping = shipping_subtotal;
				display_value = shipping_subtotal;
				if (options.tax.included&&options.shipping.tax) {
					display_value = Func.addSalesTax(display_value);
				}
				$("#cart-shipping").find(".Value").html(Func.getFormattedPrice(display_value));
				if (options.intl&&options.handling.intl>0) {
					handling = options.country!=order.country_code ? options.handling.intl : 0;
					if (order.shipping_method=="local") {
						handling = 0;
					}
					if ( products.length==0 && cart_items.length==0 && downloads.length>0 ) {
						handling = 0;
					}
					if (options.discount) {
						if (discount[0]=="true"&&discount[10]=="1") {
							handling = 0;
						}
					}
					order.final_handling += handling;
					display_value = handling;
					if (options.tax.included&&options.handling.tax) {
						display_value = Func.addSalesTax(display_value);
					}
					$("#cart-handling-intl").find(".Value").html(Func.getFormattedPrice(display_value));
				}
				if (options.handling.flat>0) {
					handling = options.handling.flat;
					if (order.shipping_method=="local") {
						handling = 0;
					}
					if ( products.length==0 && cart_items.length==0 && downloads.length>0 ) {
						handling = 0;
					}
					if (options.discount) {
						if (discount[0]=="true"&&discount[10]=="1") {
							handling = 0;
						}
					}
					order.final_handling += handling;
					display_value = handling;
					if (options.tax.included&&options.handling.tax) {
						display_value = Func.addSalesTax(display_value);
					}
					$("#cart-handling").find(".Value").html(Func.getFormattedPrice(display_value));
				}
			}
			if (options.tax.use) {
				var taxes = getTaxRate();
				var taxable_amount = order.final_value - order.discount_value;
				if (options.downloads.tax==false) {
					taxable_amount -= download_subtotal;
				}
				if (taxable_amount<0) {
					taxable_amount = 0;
				}
				if (options.shipping.tax) {
					taxable_amount += order.final_shipping;
				}
				if (options.handling.tax) {
					taxable_amount += order.final_handling;
				}
				if (options.country=="CA") {
					var hst_value = taxable_amount*(taxes[0]/100);
					var gst_value = taxable_amount*(taxes[1]/100);
						if (taxes[3]==true) {
							taxable_amount += gst_value;
						}
					var pst_value = taxable_amount*(taxes[2]/100);
					order.final_tax += hst_value;
					order.final_tax += gst_value;
					order.final_tax += pst_value;
					$("#cart-tax-hst").toggle(taxes[0]!=0);
					$("#cart-tax-gst").toggle(taxes[1]!=0);
					$("#cart-tax-pst").toggle(taxes[2]!=0);
					$("#cart-tax-hst").find(".Label").html("HST" + " - " + taxes[0] + "%");
					$("#cart-tax-gst").find(".Label").html("GST" + " - " + taxes[1] + "%");
					$("#cart-tax-pst").find(".Label").html("PST" + " - " + taxes[2] + "%");
					$("#cart-tax-hst").find(".Value").html(Func.getFormattedPrice(hst_value));
					$("#cart-tax-gst").find(".Value").html(Func.getFormattedPrice(gst_value));
					$("#cart-tax-pst").find(".Value").html(Func.getFormattedPrice(pst_value));
				} else {
					var tax_label = options.country=="US" ? "Sales Tax" : L10N.get("checkout", "checkout_cart_tax");
					var tax_value = taxable_amount*(taxes[0]/100);
					order.final_tax += tax_value;
					$("#cart-tax").find(".Label").html(tax_label + " - " + taxes[0] + "%");
					$("#cart-tax").find(".Value").html(Func.getFormattedPrice(order.final_tax));
				}
			}
			$("#cart-final-total").find(".Value").html(Func.getFormattedPrice(order.final_value-order.discount_value+order.final_shipping+order.final_handling+order.final_tax));
		}
		function updatePaymentMethod () {
			var products = Session.getPackagesLength();
			var cart_items = Session.getCartLength();
			var downloads = Session.getDownloadsLength();
			var subtotal = ( order.final_value - order.discount_value ) + order.final_shipping + order.final_handling + order.final_tax;
			$("#checkout-shipping").show();
			$("#checkout-shipping h2").show();
			$("#checkout-shipping .Wrapper").show();
			$("#cart-shipping, #cart-handling-intl, #cart-handling").show();
			$("#cart-tax").show();
			if (options.tax.use) {
				var taxes = getTaxRate();
				$("#cart-tax-hst").toggle(taxes[0]!=0);
				$("#cart-tax-gst").toggle(taxes[1]!=0);
				$("#cart-tax-pst").toggle(taxes[2]!=0);
			}
			if (options.offline) {
				$("#checkout-method-offline").removeAttr("disabled", "disabled")
					.next()
					.removeClass("Disabled");
			}
			if ( downloads>0 && cart_items==0 && products==0 ) {
				order.shipping_method = "local";
				$("#checkout-shipping input[name=shipping-method][value=" + order.shipping_method + "]").prop('checked', 'checked');
				$("#checkout-shipping h2").hide();
				$("#checkout-shipping .Wrapper").hide();
				$("#cart-shipping, #cart-handling-intl, #cart-handling").hide();
				if ( options.offline && subtotal>0 ) {
					$("#checkout-method-offline").attr("disabled", "disabled")
						.next()
						.addClass("Disabled");
					if (order.payment_method=="offline") {
						if (options.paypal) {
							order.payment_method = "paypal";
						}
						if (options.merchant) {
							order.payment_method = "merchant";
						}
						$("#checkout-payment input[name=checkout-method][value=" + order.payment_method + "]").prop('checked', 'checked');
					}
				}
				if (!options.downloads.tax) {
					$("#checkout-shipping").hide();
					$("#cart-tax-hst, #cart-tax-gst, #cart-tax-pst, #cart-tax").hide();
				}
			}
			$("#checkout-country option").eq(0).html( order.shipping_method=="local" ? L10N.get("checkout", "checkout_billing_country") : L10N.get("checkout", "checkout_shipping_country") );
			$("#checkout-shipping-postal-code").attr( "placeholder", order.shipping_method=="local" ? L10N.get("checkout", "checkout_billing_postal_code") : L10N.get("checkout", "checkout_shipping_postal_code") );
			if (order.payment_method=="paypal") {
				$("#shipping-method-ship").next().html(L10N.get("checkout", "checkout_shipping_method_ship_paypal"));
				$("#checkout-cc").hide();
				$("#checkout-info").hide();
				$("#checkout-shipping_address").hide();
			} else if (order.payment_method=="offline") {
				$("#shipping-method-ship").next().html(L10N.get("checkout", "checkout_shipping_method_ship"));
				$("#checkout-cc").hide();
				$("#checkout-info").show();
				$("#checkout-shipping_address").toggle( order.shipping_method!="local" );
			} else if ( order.payment_method=="merchant") {
				$("#shipping-method-ship").next().html(L10N.get("checkout", "checkout_shipping_method_ship"));
				$("#checkout-cc").toggle(subtotal>0);
				$("#checkout-info").show();
				$("#checkout-shipping_address").toggle( order.shipping_method!="local" );
			}
			if ( options.offline && (options.merchant||options.paypal) ) {
				$("#checkout-method-merchant, #checkout-method-paypal").removeAttr("disabled", "disabled")
					.next()
					.removeClass("Disabled");
				if (subtotal==0) {
					$("#checkout-method-merchant, #checkout-method-paypal").attr("disabled", "disabled")
						.next()
						.addClass("Disabled");
					if (order.payment_method!="offline") {
						order.payment_method = "offline";
						$("#checkout-payment input[name=checkout-method][value=" + order.payment_method + "]").prop('checked', 'checked');
					}
				}
			}
			if ( !options.offline && order.payment_method=="paypal" && subtotal==0 ) {
				$("#checkout-info").show();
				$("#shipping-method-ship").next().html(L10N.get("checkout", "checkout_shipping_method_ship"));
				$("#checkout-shipping_address").toggle( order.shipping_method!="local" );
			}
			$("#checkout-country").toggle( options.tax.use || ( options.shipping.use && options.handling.intl>0 && order.shipping_method!="local" ));
			if ( options.country=="US" || options.country=="CA" ) {
				$("#checkout-state").toggle( options.country==order.country_code );
				$("#checkout-shipping-postal-code").toggle( $("#checkout-shipping_address").is(":visible") );
			} else {
				$("#checkout-shipping-postal-code").toggle( order.shipping_method!="local" );
				$("#cart-tax").toggle( options.tax.included==false );
			}
			//$("#checkout-discount").toggle(subtotal>0);
		}
		function prevent (event) {
			event.stopPropagation();
			event.preventDefault();
		}
		function applyDiscountCode (str) {
			// skip empty codes
			var input = $("#checkout-discount input");
			var button = $("#checkout-discount button");
			// enable button + field
			input.removeAttr("disabled");
			button.click(click).removeClass(".Disabled");
			if (str==""||!str) {
				discount = [];
			} else {
				discount = str.split("\t");
			}
			updateTotals();
			updatePaymentMethod();
		}
		function checkDiscountCode () {
			// skip empty codes
			var input = $("#checkout-discount input");
			var button = $("#checkout-discount button");
			var codeval = input.val();
			if (codeval=="") {
				return;
			}
			// disable button + field
			input.attr("disabled", "disabled");
			button.off().addClass(".Disabled");
			// ccall it
			$.post( APP_ROOT + "vend-proofing-gateway.php", {
				action: 	"verify_discount_code",
				puid: 	Overlay.pageid(),
				code: 	codeval,
				subtotal: 	order.final_value
			}, function(data) {
				applyDiscountCode(data);
			});
		}
		function click (event) {
			if ( $(this).attr("id") == "checkout-clickwrap" ) {
				Controlbar.dispatch("onPageView", [ "tos" ]);
			}
			if ( $(this).attr("id") == "checkout-controlbar-process" ) {
				initPayment();
			}
			if ( $(this).parent().parent().attr("id") == "checkout-discount" ) {
				checkDiscountCode();
				updateTotals();
			}
			prevent(event);
			return false;
		}
		function change (event) {
			if ( $(this).attr("id") == "checkout-accept" ) {
				if (accept_obj.is(':checked')) {
					process_obj.removeClass("Disabled").addClass("Enabled").click(click);
				} else {
					process_obj.removeClass("Enabled").addClass("Disabled").off();
				}
			}
			if ( $(this).attr("id")=="shipping-method-local" || $(this).attr("id")=="shipping-method-ship" ) {
				order.shipping_method = $(this).val();
				updatePaymentMethod();
				updateTotals();
			}
			if ( $(this).parent().parent().parent().attr("id") == "checkout-payment" ) {
				order.payment_method = $(this).val();
				updatePaymentMethod();
				updateTotals();
			}
			if ( $(this).attr("id") == "checkout-state" ) {
				order.state_code = $(this).val();
				updateTotals();
			}
			if ( $(this).attr("id") == "checkout-country" ) {
				order.country_code = $(this).val();
				updateTotals();
			}
			if ( $(this).attr("id") == "checkout-shipping-postal-code" ) {
				order.postal_code = $(this).val();
				updateTotals();
			}
			prevent(event);
			return false;
		}
		function disable (eo) {
			screen.toggle(eo.open);
			screen.progress(eo.open==false);
		}
		function checkForEmptyCart () {
			if ( location.hash=="#/checkout/" && Cart.checkout(true)==false ) {
				Controlbar.dispatch("onPageView", [ "cart" ]);
				return;
			}
		}
		function session () {
			if ( inited==false) {
				inited = true;
				setTimeout(checkForEmptyCart, 33);
			}
			updateTotals();
			updatePaymentMethod();
		}
		function draw () {
			// cache some jquery objects
			container = $("#overlay-checkout");
			screen = $("#checkout-screen");
			blocks = $("#checkout-blocks");
			summary = $("#checkout-summary");
			back_obj = $("#checkout-controlbar-back");
			process_obj = $("#checkout-controlbar-process");
			accept_obj = $("#checkout-accept");
			clickwrap_obj = $("#checkout-clickwrap");
			sidebar_input = $("#sidebar-input");
			sidebar_input_content = $("#sidebar-input-content");
			back_obj.click(click);
			if (accept_obj.length>0) {
				accept_obj.change(change);
				clickwrap_obj.click(click);
				process_obj.removeClass("Enabled").addClass("Disabled").off();
			} else {
				process_obj.click(click);
			}
			// add listener to shipping selector
			if (options.country=="US") {
				order.state_code = options.state;
			}
			if (options.country=="CA") {
				order.state_code = options.province;
			}
			order.country_code = options.country;
			if ($("#checkout-shipping .Block").children().length==0) {
				$("#checkout-shipping").hide();
			} else {
				$("#checkout-shipping input, #checkout-shipping select").change(change);
			}
			// decide on the payment view
			var count = 0;
			if (options.offline) {
				count += 1;
			}
			if (options.paypal) {
				count += 1;
			}
			if (options.merchant) {
				count += 1;
			}
			if (count<=1) {
				$("#checkout-payment").hide();
			}
			if (count==0) {
				cart_no_payment = true;
			}
			if (options.offline) {
				order.payment_method = "offline";
			}
			if (options.paypal) {
				order.payment_method = "paypal";
			}
			if (options.merchant) {
				order.payment_method = "merchant";
			}
			$("#checkout-payment input").change(change);
			$("#checkout-payment input[name=checkout-method][value=" + order.payment_method + "]").prop('checked', 'checked');
			// add listener to credit card stuff selector
			$("#checkout-cc select").change(change);
			// discount code
			$("#checkout-discount button").click(click);
			// update tally board
			var zero = Func.getFormattedPrice(0);
			var pass = L10N.get("checkout", "checkout_cart_no_calculate");
			$("#summary-table").find(".Value").html(zero);
			if (!options.shipping.use) {
				$("#cart-shipping").find(".Value").html(pass);
			}
			if (!options.tax.use) {
				$("#cart-tax, #cart-tax-hst, #cart-tax-gst, #cart-tax-pst").find(".Value").html(pass);
			}
			// update
			updateTotals();
		}
		function resize () {
			var sw = StageProxy.width();
			if (sw>600) {
				var sh = StageProxy.height();
				$("#checkout-blocks").css("min-height", sh-65-40);
			} else {
				$("#checkout-blocks").css("min-height", "auto");
			}
		}
		function onFinalizeOrder (success, data) {
			if (success==false) {
				disable({open:false});
				Dialog.options({
					modal: false,
					title: L10N.get("checkout", "checkout_credit_card_error"),
					description: L10N.get("checkout", "checkout_credit_card_"+data)
				});
				Dialog.draw();
				recheck = true;
				process_obj.click(click);
			} else {
				var form = '<form action="' + APP_ROOT + "?/order/" + order.id + "/invoice/" + '" method="post">';
				form += '<input type="text" name="email_address" value="' + $("#checkout-email-address").val() + '" />';
				form += '</form>';
				form = $(form);
				$('body').append(form);
				$(form).submit();
			}
		}
		function finalizeOrder (iscc) {
			var subtotal = ( order.final_value - order.discount_value ) + order.final_shipping + order.final_handling + order.final_tax;
				if (subtotal==0) {
					iscc = false;
				}
				subtotal = subtotal.toFixed(2);
			var shipping_address;
			if ($("#checkout-shipping_address").hasClass("INTL")) {
				shipping_address = $("#checkout-shipping_address").val();
				shipping_address = shipping_address.split("\t").join("     ").split("\r").join("<[[BR]]>").split("\n").join("<[[BR]]>");
			} else {
				shipping_address = $("#checkout-shipping_address-line1").val();
				shipping_address += "<[[BR]]>";
				shipping_address += $("#checkout-shipping_address-line2").val();
				shipping_address += "<[[BR]]>";
				shipping_address += $("#checkout-shipping_address-city").val();
			}
			var comments = $("#checkout-comments textarea").val();
				comments = comments.split("\t").join("     ").split("\r").join("<[[BR]]>").split("\n").join("<[[BR]]>");
			var dataarr = [];
				dataarr.push(order.id);						// order id
				dataarr.push(Overlay.pageid());						// original set id
				dataarr.push(0);								// order timestamp
				dataarr.push(order.payment_method);					// payment type
				dataarr.push("");								// paypal id
				dataarr.push(order.shipping_method);					// shipping type
				dataarr.push($("#checkout-discount_code").val());		// discount applied
				dataarr.push($("#checkout-fullname").val());			// full name
				dataarr.push($("#checkout-email-address").val());			// email address
				dataarr.push($("#checkout-phone-number").val());			// phone number
				dataarr.push(shipping_address);					// normalized shipping address
				dataarr.push(order.country_code);					// country
				dataarr.push(order.postal_code);					// postal code
				dataarr.push(order.state_code);					// state
				dataarr.push(subtotal);							// subtotal
				dataarr.push( ( order.final_value ).toFixed(2) );					// total cart price
				dataarr.push( ( order.discount_value ).toFixed(2) );					// discount value
				dataarr.push( ( order.final_shipping ).toFixed(2) );					// shipping
				dataarr.push( ( order.final_handling ).toFixed(2) );					// handling
				dataarr.push( ( order.final_tax ).toFixed(2) );						// tax
				dataarr.push(getTaxRate().join(","));					// taxrate info
				dataarr.push(options.tax.included);			// taxrate info
				dataarr.push(options.shipping.tax);				// taxrate info
				dataarr.push(options.handling.tax);				// taxrate info
				dataarr.push(comments);								// comments
			var post = {};
			if (iscc) {
				post.cc_num = $("#checkout-cc-number").val();
				post.cc_expiry = $("#checkout-cc-expiry-month").val() + $("#checkout-cc-expiry-year").val();
				post.cc_cvv = $("#checkout-cvv-number").val();
				post.cc_zip = $("#checkout-cc-billing-postal-code").val();
			}
			post.puid = Overlay.pageid();
			post.name = Session.getHash();
			post.data = dataarr.join("\t");
			post.action = iscc ? "process_credit_card" : "finalize_order";
			$.post( APP_ROOT + "vend-proofing-gateway.php", post, function(str) {
				var bits = str.split("\t");
				var success = bits.shift();
					success = success=="true";
				onFinalizeOrder(success, bits.join("\t"));
			});
		}
		function processPayment () {
			if (order.payment_method=="paypal") {
				if ( (order.final_value>order.discount_value) || order.final_shipping>0 || order.final_handling>0 || order.final_tax>0 ) {
					var input = $("#checkout-discount input");
					var codeval = input.val();
					var comments = $("#checkout-comments textarea").val();
						comments = comments.split("\t").join("     ").split("\r").join("<[[BR]]>").split("\n").join("<[[BR]]>");
					var post = {};
					post.on0 = L10N.get("ordering", "sidebar_comments");
					post.os0 = comments;
					post.cmd = "_xclick";
					post.notify_url = APP_ROOT_ABSOLUTE + "/vend-proofing-gateway.php?action=validate_paypal_ipn";
					post["return"] = APP_ROOT_ABSOLUTE + "/?/order/" + order.id + "/invoice/";
					post.cancel_return = window.location;
					post.rm = "2";
					post.invoice = order.id;
					post.custom = Overlay.pageid() +
								"-" + Session.getHash() +
								"-" + order.final_value +
								"-" + order.discount_value +
								"-" + codeval +
								"-" + getTaxRate().join(",") +
								"-" + (options.tax.included?"1":"0") +
								"-" + (options.shipping.tax?"1":"0") +
								"-" + (options.handling.tax?"1":"0");
					post.item_name = classes.content.Display.settings().title + " - " + L10N.get("checkout", "checkout_paypal_order");
					post.item_number = Overlay.pageid();
					if ( order.final_value==order.discount_value ) {
						post.amount = ( order.final_shipping + order.final_handling + order.final_tax ).toFixed(2);
						post.shipping = 0;
						post.handling = 0;
						post.tax = 0;
					} else {
						post.amount = ( order.final_value ).toFixed(2);
						post.discount_amount = ( order.discount_value ).toFixed(2);
						if ( options.shipping.use ) {
							post.shipping = ( order.final_shipping ).toFixed(2);
							post.handling = ( order.final_handling ).toFixed(2);
						}
						if ( options.tax.use ) {
							post.tax = ( order.final_tax ).toFixed(2);
						}
					}
					post.no_shipping = order.shipping_method=="local" ? "1" : "2";
					post.currency_code = options.currency;
					post.business = $.base64.decode(options.business);
					post.lc = order.country_code;
					post.no_note = "1";
					var form = '<form action="https://www.paypal.com/cgi-bin/webscr" method="post">';
					var prop;
					for ( prop in post ) {
						if (post.hasOwnProperty(prop)) {
							form += "\n\t" + '<input type="text" name="' + prop + '" value="' + post[prop] + '" />';
						}
					}
					form += "\n" + '</form>';
					form = $(form);
					$('body').append(form);
					$(form).submit();
				} else {
					finalizeOrder(false);
				}
			} else if ( order.payment_method=="offline" ) {
				finalizeOrder(false);
			} else if ( order.payment_method=="merchant" ) {
				finalizeOrder(true);
			} else {
				finalizeOrder(false);
			}
		}
		function onPrequalifyResponse (success, data) {
			if (success==false) {
				disable({open:false});
				if (data=="invalid_email_address") {
					$("#checkout-email-address").addClass("Highlight");
					Dialog.options({
						modal: false,
						title: L10N.get("checkout", "checkout_invalid_email_address_title"),
						description: L10N.get("checkout", "checkout_invalid_email_address_description")
					});
					Dialog.draw();
					process_obj.click(click);
				} else { // it's a discount code error
					var input = $("#checkout-discount input");
					var button = $("#checkout-discount button");
					input.removeAttr("disabled");
					button.click(click).removeClass(".Disabled");
					Dialog.options({
						modal: false,
						title: L10N.get("checkout", "checkout_discount_code_error_title"),
						description: L10N.get("checkout", "checkout_discount_code_error_description")
					});
					Dialog.draw();
					process_obj.click(click);
				}
			} else {
				order.id = data;
				processPayment();
			}
		}
		function sslCheckConfirm () {
			ignore_ssl_warning = true;
			initPayment();
		}
		function initPayment () {
			if (cart_no_payment) {
				Dialog.options({
					modal: false,
					title: "No Payment Options Available",
					description: "This cart does not have any available payment methods for ordering.  Please contact the photographer directly for help processing this order."
				});
				Dialog.draw();
				return false;
			}
			process_obj.off();
			// assume the best
			var error_code = "";
			$("#checkout-blocks input, #checkout-blocks textarea, #checkout-blocks select").removeClass("Highlight");
			if ( $("#checkout-info").is(":visible") ) {
				if ( $("#checkout-email-address").val()=="" ) {
					$("#checkout-email-address").addClass("Highlight");
					error_code = "highlighted_fields_required";
				}
				if (error_code=="") {
					if ($("#checkout-email-address").val()!=$("#checkout-email-address-check").val()) {
						$("#checkout-email-address").addClass("Highlight");
						$("#checkout-email-address-check").addClass("Highlight");
						error_code = "email_addresses_do_not_match";
					}
				}
			}
			// ok, check everything else now
			if (error_code=="") {
				var items = "#checkout-fullname, #checkout-phone-number, #checkout-shipping-postal-code, #checkout-state, #checkout-country, #checkout-cc-number, #checkout-cvv-number, #checkout-cc-expiry-month, #checkout-cc-expiry-year, #checkout-cc-billing-postal-code";
				if ($("#checkout-shipping_address").hasClass("INTL")) {
					items += ", #checkout-shipping_address";
				} else {
					items += ", #checkout-shipping_address-line1, #checkout-shipping_address-city";
				}
				$(items)
					.removeClass("Highlight")
					.each(function () {
						if ( $(this).is(":visible") && $(this).val()=="" ) {
							$(this).addClass("Highlight");
							error_code = "highlighted_fields_required";
						}
					});
			}
			if (error_code!="") {
				Dialog.options({
					modal: false,
					title: L10N.get("checkout", "checkout_" + error_code + "_title"),
					description: L10N.get("checkout", "checkout_" + error_code + "_description")
				});
				Dialog.draw();
				process_obj.click(click);
				return false;
			}
			var subtotal = ( order.final_value - order.discount_value ) + order.final_shipping + order.final_handling + order.final_tax;
			/*if ( order.payment_method=="paypal"&&subtotal==0 ) {
				Dialog.options({
					modal: false,
					title: L10N.get("checkout", "checkout_paypal_price_zero_title"),
					description: L10N.get("checkout", "checkout_paypal_price_zero_description")
				});
				Dialog.draw();
				process_obj.click(click);
				return;
			}*/
			var downloads = Session.getDownloadsLength();
			if ( subtotal>0 && order.payment_method=="offline" && downloads>0 ) {
				Dialog.options({
					modal: false,
					title: L10N.get("checkout", "checkout_offline_unavailable_with_downloads_title"),
					description: L10N.get("checkout", "checkout_offline_unavailable_with_downloads_description")
				});
				Dialog.draw();
				process_obj.click(click);
				return;
			}
			if ( order.payment_method=="merchant" && "https:"!=document.location.protocol && ignore_ssl_warning==false ) {
				Dialog.options({
					title: L10N.get("checkout", "checkout_cart_insecure_title"),
					description: L10N.get("checkout", "checkout_cart_insecure_description"),
					confim: sslCheckConfirm
				});
				Dialog.draw();
				process_obj.click(click);
				return;
			} 
			// ok, lets's do it
			disable({open:true});
			var input = $("#checkout-discount input");
			var button = $("#checkout-discount button");
			var codeval = input.val();
			input.attr("disabled", "disabled");
			button.off().addClass(".Disabled");
			$.post( APP_ROOT + "vend-proofing-gateway.php", {
				action: 	"prequalify_order",
				puid: 	Overlay.pageid(),
				orderid: 	order.id,
				subtotal: 	order.final_value,
				code: 	( recheck ? codeval : "" ),
				email: 	order.payment_method=="paypal" ? "" : $("#checkout-email-address").val()
			}, function(str) {
				var bits = str.split("\t");
				var success = bits.shift();
					success = success=="true";
				onPrequalifyResponse(success, bits.join("\t"));
			});
		}
		function init () {
			draw();
			resize();
		}
		function lateinit () {
			StageProxy.addEventListener("onResize", resize);
			Session.addEventListener("onSessionLoaded", session);
			Session.addEventListener("onSessionCart", session);
		}
		function render () {
			init();
			setTimeout(lateinit, 33);
		}
		/* public methods
			*/
		this.setMail = function(str) {
			$("#checkout-email-address").val(str);
		}
		this.update = function() {
			if ( inited==true ) {
				checkForEmptyCart();
			}
			updateTotals();
			updatePaymentMethod();
		};
		this.settings = function(obj) {
			if (obj) {
				options = obj;
			}
			return options;
		};
		this.addTaxRule = function(arr) {
			taxrules.push(arr);
		};
		this.getTaxRate = function() {
			return getTaxRate();
		};
		this.initialize = function() {
			StageProxy = classes.StageProxy;
			Func = classes.helpers.Func;
			L10N = classes.helpers.L10N;
			Overlay = classes.Overlay;
			Session = classes.Session;
			Dialog = classes.Dialog;
			Cart = classes.overlay.Cart;
			Controlbar = classes.elements.Controlbar;
			render();
		};
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());
