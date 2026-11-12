
/*jslint browser: true, continue: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.overlay.Overview = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var StageProxy; // shortcut
		var Shell; // shortcut
		var Func; // shortcut
		var L10N; // shortcut
		var Session; // shortcut
		var Cart; // shortcut
		var Graphic; // shortcut
		var Checkout; // shortcut
		/* private properites
			*/
		var download = 			false;
		var remainder = 		-1;
		var maximum = 			null;
		var data = 				{};
		var datahash = 			"";
		var overlay_overview = 	null;
		var overview_screen = 	null;
		var overview_options = 	null;
		var overview_quantity = null;
		var update_obj = 		null;
		/* private methods
			*/
		function disable (eo) {
			overview_screen.toggle(eo.open);
			overview_screen.progress(eo.open==false);
		}
		function getQuantityVal () {
			return parseInt($("#overview-quantity").find("span").html(), 10);
		}
		function update () {
			disable({open:true});
			Session.updateItem("cart", data.hash, "quantity", getQuantityVal());
		}
		function clearcart () {
			Cart.clear();
		}
		function checkout () {
			Cart.checkout();
		}
		function check () {
			// disable the add button for now
			update_obj.removeClass("Enabled").addClass("Disabled").off();
			var quantity = parseInt(data.quantity, 10);
			if (getQuantityVal()==quantity) {
				return;
			}
			// enable the control
			update_obj.removeClass("Disabled").addClass("Enabled").click(update);
		}
		function numberevent (event) {
			var self = $(this);
			var parent = self.parent();
			var current = parseInt(parent.find("span").html(), 10);
			var delta = parseInt(self.val(), 10);
			var value = current + delta;
				if (value<=0) {
					value = 1;
				}
				if (maximum!=null) {
					if (value>maximum) {
						value = maximum;
					}
				}
			$("#overview-quantity").find("span").html(value);
			check();
			return false;
		}
		function close () {
			$("#overlay-cartview .Wide").removeClass("Column1");
			$("#overlay-cartview .Column2").hide();
			$(".LineItem").removeClass("Active");
			return false;
		}
		function resize () {
			var sw = StageProxy.width();
			var sh = StageProxy.height();
			$("#overlay-overview").off();
			if (sw>600) {
				var left = $("#overlay-cartview .Column1").height()+65;
				var sh = Math.max(left, StageProxy.height());
				$("#overlay-overview").css("min-height", sh-65);
				$("#overlay-overview").css("height", "auto");
			} else {
				$("#overlay-overview").css("min-height", "none");
				$("#overlay-overview").css("height", sh);
				if (Shell.device().touch) {
					$("#overlay-overview").bind('touchstart', Func.touchboundsstart);
					$("#overlay-overview").bind('touchmove', Func.touchboundsmove);
				} else {
					$("#overlay-overview").mousewheelStopPropagation();
				}
			}
		}
		function drawControls () {
			$("#overview-controlbar-clearcart, #overview-controlbar-checkout, #overview-controlbar-update, #overview-controlbar-cancel")
				.each(function () {
					var self = $(this);
					var tooltip = self.attr("data-tooltip");
					var func = self.attr("id");
						func = func.split("-");
						func = func.pop();
						switch (func) {
							case "cancel" :
								func = close;
								break;
							case "clearcart" :
								func = clearcart;
								break;
							case "checkout" :
								func = checkout;
								break;
							case "next" :
								func = next;
								break;
							case "update" :
								func = update;
								break;
							case "prev" :
								func = prev;
								break;
						}
					if ( tooltip!="" && !Shell.device().touch ) {
						self
							.data("tooltip", tooltip)
							.mouseenter(function () {
								Shell.createToolTip($(this).data("tooltip"));
							})
							.mouseleave(function () {
								Shell.killToolTip();
							})
							.click(function (event) {
								$(this).unbind("mouseenter").unbind("mouseleave");
								Shell.killToolTip();
								func(event);
							});
					} else {
						self.click(func);
					}
				});
			overview_quantity.find("button").click(numberevent);
		}
		function draw () {
			overlay_overview = $("#overlay-overview");
			overview_screen = $("#overview-screen");
			overview_options = $("#overview-options");
			overview_quantity = $("#overview-quantity");
			update_obj = $("#overview-controlbar-update");
			update_obj.removeClass("Enabled").addClass("Disabled").off();
			overview_options.hide();
			drawControls();
		}
		function init () {
			draw();
			resize();
		}
		function onLoaded () {
			overview_options.find(".Display").progress(true);
			if (!download) {
				Func.filter($(this), data.toning);
			}
		}
		function redraw () {
			disable({open:false});
			// make sure there is a valid data object
			if (!data) {
				overview_options.hide();
				// disable the add button for now
				update_obj.removeClass("Enabled").addClass("Disabled").off();
				overview_options.hide();
				return;
			}
			// turn on tings
			overview_options.show();
			// disable the add button for now
			update_obj.removeClass("Enabled").addClass("Disabled").off();
			// these will affect the pricing labels
			var calculate_and_display_shipping_bool = Checkout.settings().shipping.use;
			var purchase_price_includes_tax_bool = Checkout.settings().tax.included;
			var shipping_taxable_bool = Checkout.settings().shipping.tax;
			var downloads_taxable_bool = Checkout.settings().downloads.tax;
			var letterbox = true;
			var width = $("#overlay-overview").width();
			var image_width = width-24;
			var image_height = 200;
			var aspect = parseFloat(data.format_aspect);
			if (!isNaN(aspect)) {
				if (data.orientation=="l") {
					aspect = 1/aspect;
				}
				letterbox = false;
				image_width = Math.round(image_height*aspect);
			}
			var multiplier = window.devicePixelRatio ? window.devicePixelRatio : 1;
			var rw = image_width;
			var rh = image_height;
			if ( multiplier>1 ) {
				var rw = image_width*multiplier;
				if (rw>1000) {
					rw = 1000;
				}
				var rh = image_height*multiplier;
				if (rh>1000) {
					rh = 1000;
				}
			}
			var graphic = new Graphic();
				graphic.provider({
					child: data.cuid,
					parent: data.puid,
					hash: data.hash,
					src: data.puid + "/" + data.cuid,
					alt: data.filename,
					xoffset: data.orientation_x,
					yoffset: data.orientation_y
				});
				graphic.letterbox(letterbox);
				graphic.setSize(rw, rh);
			overview_options.find(".Display").progress();
			overview_options.find("img")
				.off()
				.data("original-src", "")
				.attr("src", Func.getEmptyImgSrc())
				.attr("src", graphic.source())
				.one('load', onLoaded)
				.each(function() {
					if(this.complete) {
						$(this).load();
					}
				});
			var title, price, shipping;
			var filename = data.filename;
			var bits = filename.split(".");
			bits.pop();
			filename = bits.join(".");
			$("#overview-options")
				.find("h2")
				.html(filename);
			if ( data.quality!="" && data.quality!=undefined ) {
				$("#overview-quality")
					.show()
					.find("h3")
					.html( L10N.get("ordering", "overview_image_quality") );
				title = data.quality;
				price = parseFloat(data.subtotal);
					if (isNaN(price)) {
						price = 0;
					}
				if (price>0) {
					if ( purchase_price_includes_tax_bool && downloads_taxable_bool ) {
						price = Func.addSalesTax(price);
					}
					title += " (" + Func.getFormattedPrice(price) + ")";
				}
				$("#overview-quality")
					.find("span")
					.html( title );
			} else {
				$("#overview-quality").hide();
			}
			if ( data.format_label!="" && data.format_label!=undefined ) {
				$("#overview-format")
					.show()
					.find("h3")
					.html( L10N.get("ordering", "overview_image_format") );
				title = data.format_label;
				price = parseFloat(data.format_price);
					if (isNaN(price)) {
						price = 0;
					}
				shipping = parseFloat(data.format_shipping);
					if (isNaN(shipping)) {
						shipping = 0;
					}
				if (price>0) {
					if (purchase_price_includes_tax_bool) {
						price = Func.addSalesTax(price);
					}
					title += " (" + Func.getFormattedPrice(price) + ")";
				}
				if (calculate_and_display_shipping_bool&&shipping>0) {
					if (purchase_price_includes_tax_bool&&shipping_taxable_bool) {
						shipping = Func.addSalesTax(shipping);
					}
					title += " + " + Func.getFormattedPrice(shipping) + " " + L10N.get("localization", "currency_shipping_and_handling_abbreviation");
				}
				$("#overview-format")
					.find("span")
					.html( title );
			} else {
				$("#overview-format").hide();
			}
			var quantity = parseInt(data.quantity, 10);
			if (!isNaN(quantity)) {
				$("#overview-controlbar-update").show();
				overview_quantity
					.show()
					.find("h3")
					.html( L10N.get("ordering", "overview_change_quantity") + (remainder==-1?"":" ("+(quantity+remainder)+") "+L10N.get("ordering", "overview_package_maximum")) );
				maximum = remainder==-1 ? null : quantity+remainder;
				overview_quantity
					.find("span")
						.empty()
						.html(quantity);
			} else {
				$("#overview-controlbar-update").hide();
				overview_quantity.hide();
			}
			if ( data.toning!="" && data.toning!=undefined ) {
				$("#overview-tone")
					.show()
					.find("h3")
					.html( L10N.get("ordering", "overview_toning") );
				title = data.toning=="sepia" ? L10N.get("ordering", "sidebar_tone_sepia") : L10N.get("ordering", "sidebar_tone_black_and_white");
				$("#overview-tone")
					.find("span")
					.html( title );
			} else {
				$("#overview-tone").hide();
			}
			if ( data.paper_label!="" && data.paper_label!=undefined ) {
				$("#overview-paper")
					.show()
					.find("h3")
					.html( L10N.get("ordering", "overview_paper_format") );
				title = data.paper_label;
				price = parseFloat(data.paper_price);
					if (isNaN(price)) {
						price = 0;
					}
				shipping = parseFloat(data.paper_shipping);
					if (isNaN(shipping)) {
						shipping = 0;
					}
				if (price>0) {
					if (purchase_price_includes_tax_bool) {
						price = Func.addSalesTax(price);
					}
					title += " (" + Func.getFormattedPrice(price) + ")";
				}
				if (calculate_and_display_shipping_bool&&shipping>0) {
					if (purchase_price_includes_tax_bool&&shipping_taxable_bool) {
						shipping = Func.addSalesTax(shipping);
					}
					title += " + " + Func.getFormattedPrice(shipping) + " " + L10N.get("localization", "currency_shipping_and_handling_abbreviation");
				}
				$("#overview-paper")
					.find("span")
					.html( title );
			} else {
				$("#overview-paper").hide();
			}
			if ( data.modifier_label!="" && data.modifier_label!=undefined ) {
				$("#overview-modifier")
					.show()
					.find("h3")
					.html( L10N.get("ordering", "overview_modifier") );
				title = data.modifier_label;
				price = parseFloat(data.modifier_price);
					if (isNaN(price)) {
						price = 0;
					}
				shipping = parseFloat(data.modifier_shipping);
					if (isNaN(shipping)) {
						shipping = 0;
					}
				if (price>0) {
					if (purchase_price_includes_tax_bool) {
						price = Func.addSalesTax(price);
					}
					title += " (" + Func.getFormattedPrice(price) + ")";
				}
				if (calculate_and_display_shipping_bool&&shipping>0) {
					if (purchase_price_includes_tax_bool&&shipping_taxable_bool) {
						shipping = Func.addSalesTax(shipping);
					}
					title += " + " + Func.getFormattedPrice(shipping) + " " + L10N.get("localization", "currency_shipping_and_handling_abbreviation");
				}
				$("#overview-modifier")
					.find("span")
					.html( title );
			} else {
				$("#overview-modifier").hide();
			}
			if ( data.orientation!="" && data.orientation!=undefined ) {
				$("#overview-orientation")
					.show()
					.find("h3")
					.html( L10N.get("ordering", "overview_orientation") );
				title = data.orientation=="p" ? L10N.get("ordering", "sidebar_crop_portrait") : L10N.get("ordering", "sidebar_crop_landscape");
				$("#overview-orientation")
					.find("span")
					.html( title );
			} else {
				$("#overview-orientation").hide();
			}
			if ( data.comments!="" && data.comments!=undefined ) {
				$("#overview-comments")
					.show()
					.find("h3")
					.html( L10N.get("ordering", "overview_comments") );
				$("#overview-comments")
					.find("span")
					.html( data.comments );
			} else {
				$("#overview-comments").hide();
			}
		}
		function selected (eo) {
			$("#overlay-cartview .Wide").addClass("Column1");
			$("#overlay-cartview .Column2").show();
			datahash = eo.item + ":" + eo.group;
			if (eo.group=="alacarte") {
				datahash = eo.item;
			}
			if (eo.group=="download") {
				download = true;
				datahash = eo.item;
				data = Session.getDownloadObject(datahash);
			} else {
				download = false;
				data = Session.getCartObject(datahash);
			}
			if (!data) {
				redraw();
				return;
			}
			remainder = -1;
			if ( eo.group!="alacarte" && eo.group!="download" ) {
				var products_parsed = Session.getPackagesParsed();
				var i, product, format_hash, format_index, format;
				for (i=0; i<products_parsed.length; ++i) {
					product = products_parsed[i];
					if (product.row.hash==eo.group+"-p") {
						format_hash = md5(data.format_label);
						format_index = product.lookup[format_hash];
						format = product.formats[format_index];
						remainder = format.total - format.count;
						break;
					}
				}
			}
			redraw();
			resize();
		}
		function lateinit () {
			Cart.addEventListener("onCartItem", selected);
			StageProxy.addEventListener("onResize", resize);
		}
		function render () {
			init();
			setTimeout(lateinit, 33);
		}
		/* public methods
			*/
		this.show = function(eo) {
			selected(eo);
		};
		this.hide = function() {
			close();
		};
		this.initialize = function() {
			StageProxy = classes.StageProxy;
			Graphic = classes.elements.Graphic;
			Func = classes.helpers.Func;
			L10N = classes.helpers.L10N;
			Session = classes.Session;
			Shell = classes.Shell;
			Cart = classes.overlay.Cart;
			Checkout = classes.overlay.Checkout;
			render();
		};
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());
