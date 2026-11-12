
/*jslint browser: true, continue: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.overlay.Cart = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var Func; // shortcut
		var L10N; // shortcut
		var Session; // shortcut
		var Dialog; // shortcut
		var Controlbar; // shortcut
		var Overview; // shortcut
		var Checkout; // shortcut
		/* private properites
			*/
		var cart_index = 		[];
		var cart_tree = 		{};
		var selected_group = 	null;
		var selected_item = 	null;
		var overview_screen = 	null;
		var groups = null;
		/* private methods
			*/
		function disable (eo) {
			overview_screen.toggle(eo.open);
			overview_screen.progress(eo.open==false);
		}
		function select (eo) {
			selected_group = eo.group;
			selected_item = eo.item;
			$(".LineItem").removeClass("Active");
			$("#cart-item-" + selected_item).addClass("Active");
			Overview.show({group:selected_group, item:selected_item});
		}
		function onClearCartConfim () {
			disable({open:true});
			Session.purge("cart");
			Overview.hide();
		}
		function clearCart () {
			Dialog.options({
				unique: "clearcart",
				modal: true,
				title: L10N.get("ordering", "cart_delete_confirmation_title"),
				description: L10N.get("ordering", "cart_delete_confirmation_description"),
				confim: onClearCartConfim
			});
			Dialog.draw();
		}
		function onDeleteConfim (type, hash) {
			disable({open:true});
			if ( !hash || hash=="" || hash==undefined ) {
				Session.purge(type);
			} else {
				Session.removeItem(type, hash);
			}
			//if (hash!=selected_item) {
				selected_item = null;
				selected_group = null;
				Overview.hide();
			//}
		}
		function deleteCartItem () {
			Dialog.options({
				unique: "cartdeleteitem",
				modal: true,
				title: L10N.get("ordering", "cart_delete_confirmation_title"),
				description: L10N.get("ordering", "cart_delete_confirmation_description"),
				args: arguments,
				confim: onDeleteConfim
			});
			Dialog.draw();
		}
		function updatecart () {
			disable({open:false});
			var purchase_price_includes_tax_bool = Checkout.settings().tax.included;
			var downloads_taxable_bool = Checkout.settings().downloads.tax;
			var session_cart = Session.getCart();
			var products_parsed = Session.getPackagesParsed();
			var download = Session.getDownloads();
			var i, j, product, hash, completion, row, hashbits;
			var group_data, cart_data, group_price, group_clip, item_hash, item_data, quantity, format_price, paper_price, modifier_price, item_price;
			// the holders of all our important data
			cart_index = [];
			cart_tree = {};
			// loop through the packages to create groups
			for (i=0; i<products_parsed.length; ++i) {
				product = products_parsed[i];
				hash = product.row.hash.substr(0, 32); // clean up our hashes
				completion = ( product.total==0 ? 1 : product.count/product.total ); // if no items, it's complete unto itself
				cart_tree[hash] = {
					index: cart_index.length,
					data: product.row,
					children: [],
					lookup: {},
					indexes: {},
					metrics: {
						total: product.total,
						count: product.count
					}
				};
				cart_index.push({
					completion: completion, // if no items, it's complete unto itself
					hash: hash,
					title: product.row.nickname,
					metadata: product.row.title,
					price: parseFloat(product.row.subtotal)
				});
			}
			// tentatively add allacarte
			cart_tree.alacarte = {
				index: cart_index.length,
				data: {},
				children: [],
				lookup: {},
				indexes: {}
			};
			cart_index.push({
				completion: 1,
				hash: "alacarte",
				title: L10N.get("ordering", "alacarte_label"),
				metadata: "",
				price: 0
			});
			// parse through all the cart items and put them in the right containers
			for (i=0; i<session_cart.length; ++i) {
				row = session_cart[i];
				hashbits = row.hash.split(":");
				if (hashbits.length==1) { // alacarte
					cart_tree.alacarte.indexes[row.hash] = cart_tree.alacarte.children.length;
					cart_tree.alacarte.children.push(row.hash);
					cart_tree.alacarte.lookup[row.hash] = row;
				} else {
					product = hashbits[1];
					cart_tree[product].indexes[hashbits[0]] = cart_tree[product].children.length;
					cart_tree[product].children.push(hashbits[0]);
					cart_tree[product].lookup[hashbits[0]] = row;
				}
			}
			// check if we should ditch alacarte entirely
			if ( cart_tree.alacarte.children.length==0 ) {
				cart_index.pop();
				delete cart_tree.alacarte;
			} else {
				cart_index[cart_tree.alacarte.index].metadata = cart_tree.alacarte.children.length + " " + L10N.get("ordering", "cart_alacarte_items");
			}
			// tentatively add downloads
			cart_tree.download = {
				index: cart_index.length,
				data: {},
				children: [],
				lookup: {},
				indexes: {}
			};
			cart_index.push({
				completion: 1,
				hash: "download",
				title: L10N.get("ordering", "downloads_label"),
				metadata: "",
				price: 0
			});
			// parse through all the cart items and put them in the right containers
			for (i=0; i<download.length; ++i) {
				row = download[i];
				hashbits = row.hash.split(":");
				cart_tree.download.indexes[hashbits[0]] = cart_tree.download.children.length;
				cart_tree.download.children.push(row.hash);
				cart_tree.download.lookup[row.hash] = row;
			}
			// check if we should ditch alacarte entirely
			if ( cart_tree.download.children.length==0 ) {
				cart_index.pop();
				delete cart_tree.download;
			} else {
				cart_index[cart_tree.download.index].metadata = cart_tree.download.children.length + " " + L10N.get("ordering", "cart_alacarte_items");
			}
			// do some garbage removal
			groups.empty();
			// check to see if it's empty
			if (cart_index.length==0) {
				groups.html('<div class="EmptyNotice">' + L10N.get("ordering", "cart_empty") + '</div>');
				$('#overlay-cartview-controlbar').hide();
				return;
			}
			// ok, now that we have any crap out of the way, lets
			// start building in earnest
			// obviously skipping over things already rendered
			var table = '';
			for (i=0; i<cart_index.length; ++i) {
				// create cart groups
				group_data = cart_index[i];
				cart_data = cart_tree[group_data.hash];
				group_price = group_data.price;
				if (purchase_price_includes_tax_bool) {
					group_price = Func.addSalesTax(group_price);
				}
				table += '<table id="cart-group-' + group_data.hash + '">';
				table += 	'<tr class="GroupHeading">';
				if (group_data.hash=="alacarte") {
					table += 	'<td class="col1">' + group_data.title + '</td>';
					table += 	'<td class="col2" colspan="2">' + group_data.metadata + '</td>';
				} else if (group_data.hash=="download") {
					table += 	'<td class="col1">' + group_data.title + '</td>';
					table += 	'<td class="col2" colspan="2">' + group_data.metadata + '</td>';
				} else {
					table += 	'<td class="col1">' + group_data.title + " (" + group_data.metadata + ") " + '</td>';
					table += 	'<td class="col2" colspan="2">' + Math.round(group_data.completion*100) + "% " + L10N.get("ordering", "cart_package_completion") + '</td>';
				}
				table += 		'<td class="col4">GROUP_PRICE_FORMATTED_TEMP</td>';
				if (group_data.hash=="alacarte") {
					table += 	'<td class="col5"><button data-type="alacarte" data-hash="">' + L10N.get("ordering", "cart_alacarte_delete")  + '</button></td>';
				} else if (group_data.hash=="download") {
					table += 	'<td class="col5"><button data-type="download" data-hash="">' + L10N.get("ordering", "cart_alacarte_delete")  + '</button></td>';
				} else {
					table += 	'<td class="col5"><button data-type="package" data-hash="' + group_data.hash + "-p" + '">' + L10N.get("ordering", "cart_package_delete")  + '</button></td>';
				}
				table += 	'</tr>';
				// loop through all the children and draw anything missing
				var j, delete_type, item_data, item, filename, bits, quantity, format_label, format_price, paper_price, modifier_price, item_price, item_title;
				for (j=0; j<cart_data.children.length; ++j) {
					item_hash = cart_data.children[j];
					item_data = cart_data.lookup[item_hash];
					delete_type = "cart";
					var active = selected_item==item_hash && selected_group==group_data.hash;
					filename = item_data.filename;
						bits = filename.split(".");
							bits.pop();
						filename = bits.join(".");
					if (group_data.hash=="download") {
						delete_type = "download";
						format_label = item_data.quality;
						quantity = 1;
						item_price = parseFloat(item_data.subtotal, 10);
					} else {
						format_label = item_data.format_label;
						quantity = parseFloat(item_data.quantity, 10);
						format_price = parseFloat(item_data.format_price, 10);
						paper_price = parseFloat(item_data.paper_price, 10);
						modifier_price = parseFloat(item_data.modifier_price, 10);
						item_price = 0;
						if (!isNaN(format_price)) {
							item_price += format_price;
						}
						if (!isNaN(paper_price)) {
							item_price += paper_price;
						}
						if (!isNaN(modifier_price)) {
							item_price += modifier_price;
						}
					}
						if (item_price>0) {
							if ( purchase_price_includes_tax_bool) {
								if ( group_data.hash!="download" || (group_data.hash=="download" && downloads_taxable_bool) ) {
									item_price = Func.addSalesTax(item_price);
								}
							}
							group_price += item_price*quantity;
						}
					table += 	'<tr class="LineItem' + (active?" Active":"") + '" id="cart-item-' + item_hash + '" data-group-hash="' + group_data.hash + '" data-item-hash="' + item_hash + '">';
					table += 		'<td class="col1">' + filename + '</td>';
					table += 		'<td class="col2">' + format_label + '</td>';
					table += 		'<td class="col3">' + quantity + '</td>';
					if (group_data.hash=="download") {
						if (item_data.allprice=="0") {
							table += 		'<td class="col4">' + Func.getFormattedPrice(item_price*quantity) + '</td>';
						} else {
							table += 		'<td class="col4">---</td>';
						}
					} else {
						table += 		'<td class="col4">' + Func.getFormattedPrice(item_price*quantity) + '</td>';
					}
					//table += 		'<td class="col4">' + Func.getFormattedPrice(item_price*quantity) + '</td>';
					if (group_data.hash=="download") {
						if (item_data.allprice=="0") {
							table += 	'<td class="col5"><button data-type="' + delete_type + '" data-hash="' + item_hash + '">' + L10N.get("ordering", "cart_item_delete")  + '</button></td>';
						}
					} else {
						table += 	'<td class="col5"><button data-type="' + delete_type + '" data-hash="' + item_hash + '">' + L10N.get("ordering", "cart_item_delete")  + '</button></td>';
					}
					table += 	'</tr>';
				}
				table = table.split("GROUP_PRICE_FORMATTED_TEMP").join(Func.getFormattedPrice(group_price));
				table += '</table>';
			}
			
			groups.html(table);
			groups.find(".GroupHeading button").click(function () {
				deleteCartItem($(this).data("type"), $(this).data("hash"));
			});
			groups.find(".LineItem").click(function () {
				select({group:$(this).data("group-hash"), item:$(this).data("item-hash")});
			});
			groups.find(".LineItem button").click(function (e) {
				deleteCartItem($(this).data("type"), $(this).data("hash"));
				e.stopPropagation()
			});
			
			$('#overlay-cartview-controlbar').show();

			if ( selected_group!=null && selected_item!=null ) {
				select({group:selected_group, item:selected_item});
			}
			
		}
		function doCheckout (returnonly) {
			if (cart_index.length==0) {
				if (returnonly==false) {
					Dialog.options({
						unique: "cartincomplete",
						modal: false,
						title: L10N.get("checkout", "checkout_package_incomplete_title"),
						description: L10N.get("checkout", "checkout_package_incomplete_description")
					});
					Dialog.draw();
				}
				return false;
			}
			// check to see if all the cart items are fulfilled
			var completion = 0;
			var i;
			for (i=0; i<cart_index.length; ++i) {
				completion += cart_index[i].completion;
			}
			if (completion<cart_index.length) {
				if (returnonly==false) {
					Dialog.options({
						unique: "cartincomplete",
						modal: false,
						title: L10N.get("checkout", "checkout_package_incomplete_title"),
						description: L10N.get("checkout", "checkout_package_incomplete_description")
					});
					Dialog.draw();
				}
				return false;
			}
			// check to see if the cart minimums are reached
			var purchase_price_includes_tax_bool = Checkout.settings().tax.included;
			var cart_minimum_value_num = Checkout.settings().minimum.value;
			var cart_minimum_count_num = Checkout.settings().minimum.count;
			var tally = 0;
			var subtotal = 0;
			var rows = Session.getCart();
			var price, quantity;
			for (i=0; i<rows.length; ++i) {
				price = parseFloat(rows[i].subtotal);
				quantity = parseInt(rows[i].quantity, 10);
					if (purchase_price_includes_tax_bool) {
						price = Func.addSalesTax(price);
					}
				subtotal += price*quantity;
				tally += quantity;
			}
			rows = Session.getDownloads();
			var price, quantity;
			for (i=0; i<rows.length; ++i) {
				price = parseFloat(rows[i].subtotal);
					if (purchase_price_includes_tax_bool) {
						price = Func.addSalesTax(price);
					}
				subtotal += price;
				tally += 1;
			}
			rows = Session.getPackagesParsed();
			for (i=0; i<rows.length; ++i) {
				if (rows[i].total==0) {
					tally += 1;
				}
			}
			rows = Session.getPackages();
			for (i=0; i<rows.length; ++i) {
				price = parseFloat(rows[i].subtotal);
				quantity = 1;
					if (purchase_price_includes_tax_bool) {
						price = Func.addSalesTax(price);
					}
				subtotal += price*quantity;
			}
			if (tally<cart_minimum_count_num||subtotal<cart_minimum_value_num) {
				var description = tally<cart_minimum_count_num ? L10N.get("checkout", "checkout_minimum_count_description") : L10N.get("checkout", "checkout_minimum_subtotal_description");
				description = description.split("{COUNT_MINIMUM}").join(cart_minimum_count_num).split("{SUBTOTAL_MINIMUM}").join(Func.getFormattedPrice(cart_minimum_value_num));
				if (returnonly==false) {
					Dialog.options({
						unique: "cartminimum"+(tally<cart_minimum_count_num?"count":"subtotal"),
						modal: false,
						title: L10N.get("checkout", "checkout_minimum_title"),
						description: description
					});
					Dialog.draw();
				}
				return false;
			}
			// we made it!
			if (returnonly==false) {
				Controlbar.dispatch("onPageView", [ "checkout" ]);
			}
			return true;
		}
		function draw () {
			groups = $("#cart-groups");
			overview_screen = $("#overview-screen");
		}
		function init () {
			draw();
		}
		function lateinit () {
			Session.addEventListener("onSessionLoaded", updatecart);
			Session.addEventListener("onSessionCart", updatecart);
		}
		function render () {
			init();
			setTimeout(lateinit, 33);
		}
		/* public methods
			*/
		this.checkout = function(returnonly) {
			var UNDEF;
			if (returnonly==UNDEF) {
				returnonly = false;
			}
			return doCheckout(returnonly);
		};
		this.clear = function() {
			clearCart();
		};
		this.initialize = function() {
			Func = classes.helpers.Func;
			L10N = classes.helpers.L10N;
			Session = classes.Session;
			Controlbar = classes.elements.Controlbar;
			Overview = classes.overlay.Overview;
			Checkout = classes.overlay.Checkout;
			Dialog = classes.Dialog;
			render();
		};
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());
