
/*jslint browser: true, continue: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.overlay.Sidebar = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var Shell; // shortcut
		var Func; // shortcut
		var L10N; // shortcut
		var Overlay; // shortcut
		var Session; // shortcut
		var Browser; // shortcut
		var Package; // shortcut
		var Checkout; // shortcut
		var Display; // shortcut
		var Controlbar; // shortcut
		/* private properites
			*/
		var instance = 			this;
		var original_x = 		0;
		var original_y = 		0;
		var hidden = 			true;
		var width = 			0;
		var height = 			0;
		var alacarte = 			[];
		var alacarte_lookup = 	{};
		var papers = 			[];
		var papers_lookup = 	{};
		var modifiers = 		[];
		var modifiers_lookup = 	{};
		var selection = {
			type:				"",
			quality:			"",
			browse_provider: 	[],
			browse: 			{ label:"", type: "none", hash: "none" },
			format_provider: 	[],
			format: 			{ price:"0", area:0, aspect:NaN, shipping:"0", maximum:-1 },
			paper_provider: 	[],
			paper: 				{ title:"", price:"0", shipping:"0" },
			modifier_provider:	[],
			modifier: 			{ title:"", price:"0", shipping:"0" },
			quantity: 			1,
			orientation:		"",
			toning:				"",
			x_offset: 			50,
			y_offset: 			50,
			comment: 			""
		};
		var cart_object = 	{};
		var last_selected_hash = 	"";

		var downloads_available = 	false;
		var packages_available = 	false;
		var alacarte_available = 	false;
		var packages_in_cart = 		false;
		var formats_available = 	false;
		var quantity_available = 	false;
		var toning_available = 		false;
		var papers_available = 		false;
		var modifiers_available = 	false;
		var cropping_available = 	false;
		var comments_available = 	false;
		var formats_visible = 		false;

		var overlay_sidebar= null;
			var sidebar_input = null;
			var sidebar_screen = null;
			var sidebar_input_screen = null;
			var sidebar_input_content = null;
				var sidebar_download = null;
				var sidebar_browse = null;
				var sidebar_selection = null;
				var sidebar_formats = null;
				var sidebar_quantity = null;
				var sidebar_toning = null;
				var sidebar_papers = null;
				var sidebar_modifiers = null;
				var sidebar_crop = null;
				var sidebar_comments = null;
			var sidebar_control = null;
			var checkout_obj = null;
		/* private methods
			*/
		function prevent (event) {
			event.stopPropagation();
			event.preventDefault();
		}
		function convertToJsEval (str) {
			if (str.indexOf("function")!=-1) {
				return str;
			}
			if (str.indexOf("Math")!=-1) {
				return str;
			}
			var math_props = ["E", "LN2", "LN10", "LOG2E", "LOG10E", "PI", "SQRT1_2", "SQRT2", "abs", "acos", "asin", "atan", "atan2", "ceil", "cos", "exp", "floor", "log", "max", "min", "pow", "random", "round", "sin", "sqrt", "tan"];
			var i, prop;
			for (i=0; i<math_props.length; ++i) {
				prop = math_props[i];
				str = str.split(prop).join("Math."+prop);
			}
			return str;
		}
		function evaluate (expr, format_area, quantity, format_price) {
			if (!expr) {
				expr = "0";
			}
			if (!format_area) {
				format_area = "0";
			}
			if (!quantity) {
				quantity = "0";
			}
			if (!format_price) {
				format_price = "0";
			}
			expr = expr.split("A").join(format_area);
			expr = expr.split("Q").join(quantity);
			expr = expr.split("P").join(format_price);
			expr = convertToJsEval(expr);
			try {
				return eval(expr);
			} catch(err) {
				return parseFloat(expr);
			}
		}
		function click (event) {
			if ( $(this).parent().attr("id") == "sidebar-browse" ) {
				Controlbar.dispatch("onPageView", [ "packages", "1" ]);
			}
			if ( $(this).attr("id") == "browse-controlbar-cart" ) {
				Controlbar.dispatch("onPageView", [ "cart" ]);
			}
			if ( $(this).attr("id") == "browse-controlbar-add" ) {
				disable({open:true});
				Session.addItem(selection.type, cart_object);
			}
			prevent(event);
			return false;
		}
		function radioevent (event) {
			var self = $(this);
			var form = self.parent();
			var parent = form.parent();
			if (parent.data("enabled")==false) return;
			var checked = form.find(':checked');
			parent.find("select")
				.val(checked.val())
				.trigger("change");
		}
		function numberevent (event) {
			var self = $(this);
			var parent = self.parent();
			if (parent.data("enabled")==false) return;
			var current = parseInt(parent.find("span").html(), 10);
			var delta = parseInt(self.val(), 10);
			var value = current + delta;
				if (value<=0) {
					value = 1;
				}
				if (value>selection.format.maximum) {
					value = selection.format.maximum;
				}
			parent.data("value", value);
			parent.find("span").html(value);
			check();
		}
		function textevent (event) {
			var self = $(this);
			var form = self.parent();
			var parent = form.parent();
			if (parent.data("enabled")==false) return;
			var input = form.find("textarea");
			var value = input.val();
			parent.data("value", value);
			check();
		}
		function downloadchange (event) {
			var self = $(this);
			var form = self.parent();
			var parent = form.parent();
			var checked = form.find(':checked');
			var value = checked.val();
			if ( value=="" || value==undefined || !value  ) {
				selection.type = "cart";
				selection.quality = "";
				enableinputs();
			} else if (value=="high" || value=="low") {
				selection.type = "download";
				selection.quality = value;
				disableinputs();
			}
			check();
		}
		function change (event) {
			var self = $(this);
			var parent = self.parent().attr("id") == "sidebar-input-content" ? sidebar_input_content.data("parent") : self.parent();
			var selected = self.find(':selected');
			var value = self.val();
			if (parent.data("enabled")==false) return;
			parent
				.data("index", selected.index())
				.data("value", value)
				.find("span").html(selected.html());
			if ( parent.attr("id") == "sidebar-selection" ) {
				group(value);
			} else {
				if ( parent.attr("id") == "sidebar-formats" ) {
					fixOrientation();
				}
				check();
				instance.dispatch("onChanged");
			}
			if ( parent.attr("id") == "sidebar-crop" || parent.attr("id") == "sidebar-toning" ) {
				instance.dispatch("onImageModify");
			}
			sidebar_input.hide();
			prevent(event);
			return false;
		}
		function showInputUI (event) {
			var self = $(this);
			var value = self.data("value");
			sidebar_input.show();
			sidebar_input_content
				.empty()
				.append('<div class="UIText"><div class="Wrapper"><textarea>' + value + '</textarea><button>' + L10N.get("ordering", "sidebar_comments_done") + '</button></div></div>')
				.data("parent", self)
				.find("button").click(hideInputUI);
			Browser.freeKeys();
			prevent(event);
			return false;
		}
		function hideInputUI () {
			var self = $(this);
			var parent = sidebar_input_content.data("parent");
			var input= self.parent().find("textarea");
			var value = input.val();
			var label = value.length>32 ? value.substr(0, 32) + " ..." : value;
			if (value=="") {
				label = L10N.get("ordering", "sidebar_none_selected");
			}
			parent.data("value", value);
			parent.find("span").html(label);
			Browser.takeKeys();
			sidebar_input.hide();
			check();
		}
		function group () {
			selection.browse = selection.browse_provider[sidebar_selection.data("index")];
			last_selected_hash = selection.browse.hash;
			redraw();
			reset(false);
			check();
		}
		function offsets (eo) {
			selection.x_offset = Math.round(eo.x);
			selection.y_offset = Math.round(eo.y);
			check();
		}
		function disable (eo) {
			sidebar_screen.toggle(eo.open);
		}
		function disableinputs () {
			$("#overlay-sidebar .Inner div > div").show();
			if (!isNaN(selection.format.aspect)) {
				Browser.hideCropView();
			}
		}
		function enableinputs () {
			$("#overlay-sidebar .Inner div > div").hide();
			if (!isNaN(selection.format.aspect)) {
				Browser.showCropView();
			}
		}
		function updateDownloadOptions () {
			var info = Overlay.getCurrentImage();
			var hash = md5( Overlay.pageid() + info.filename + "high" );
			var obj = Session.getDownloadObject(hash+"-d");
			if (obj==undefined) {
				$("#sidebar-download-high")
					.removeAttr("disabled")
					.next()
						.removeClass("Disabled");
			} else {
				$("#sidebar-download-high")
					.attr("disabled", "disabled")
					.next()
						.addClass("Disabled");
			}
			var hash = md5( Overlay.pageid() + info.filename + "low" );
			var obj = Session.getDownloadObject(hash+"-d");
			if (obj==undefined) {
				$("#sidebar-download-low")
					.removeAttr("disabled")
					.next()
						.removeClass("Disabled");
			} else {
				$("#sidebar-download-low")
					.attr("disabled", "disabled")
					.next()
						.addClass("Disabled");
			}
		}
		function image () {
			reset();
			check();
			updateDownloadOptions();
		}
		function start () {
			disable({open:false});
			redraw();
			reset();
			check();
			updateDownloadOptions();
			instance.dispatch("onChanged");
		}
		function resize () {
			var ih = height-50;
			overlay_sidebar.css({
				left: (hidden?original_x:0),
				width: width,
				height: height
			});
			overlay_sidebar.find(".Inner").css({
				width: width,
				height: ih
			});
		}
		function draw () {
			overlay_sidebar = $("#overlay-sidebar");
			sidebar_input = $("#sidebar-input");
			sidebar_screen = $("#sidebar-screen");
			sidebar_input_screen = $("#sidebar-input-screen");
			sidebar_input_content = $("#sidebar-input-content");
			sidebar_selection = $("#sidebar-selection");
			sidebar_browse = $("#sidebar-browse");
			sidebar_control = $("#browse-controlbar-add");
			checkout_obj = $("#browse-controlbar-cart");
			sidebar_formats = $("#sidebar-formats");
			sidebar_quantity = $("#sidebar-quantity");
			sidebar_toning = $("#sidebar-toning");
			sidebar_papers = $("#sidebar-papers");
			sidebar_modifiers = $("#sidebar-modifiers");
			sidebar_crop = $("#sidebar-crop");
			sidebar_comments = $("#sidebar-comments");
			sidebar_download = $("#sidebar-download");
			
			// prevent scroll and touch
			if (Shell.device().touch) {
				overlay_sidebar.find(".ControlBar").bind("touchmove", Func.stop);
				overlay_sidebar.find(".Inner").bind('touchstart', Func.touchboundsstart);
				overlay_sidebar.find(".Inner").bind('touchmove', Func.touchboundsmove);
			} else {
				overlay_sidebar.find(".ControlBar").mousewheel(Func.stop);
				overlay_sidebar.find(".Inner").mousewheelStopPropagation();
			}
			sidebar_input.mousewheel(Func.stop);
			sidebar_input.mousewheelStopPropagation();
			
			// package/product button
			checkout_obj.addClass("Enabled").click(click);
			sidebar_browse.find("button").click(click);
			sidebar_input_screen.click(hideInputUI);
			if (Shell.device().touch) {
				overlay_sidebar.find(".Selection").each(function () {
					$(this).find("span").css("visibility", "hidden");
					$(this)
						.data("enabled", true)
						.data("index", 0)
						.data("value", null)
						.find("select")
							.change(change);
				});
				overlay_sidebar.find(".Text").each(function () {
					$(this).click(showInputUI);
				});
				overlay_sidebar.find("form").hide();
				$("#sidebar-download").find("form").show();
			} else {
				overlay_sidebar.find(".Selection").each(function () {
					$(this).find("span").hide();
					$(this).find("select").change(change).hide();
					$(this)
						.data("enabled", true)
						.data("index", 0)
						.data("value", null);
				});
				overlay_sidebar.find(".Text").each(function () {
					$(this).find("span").hide();
				});
			}
			overlay_sidebar.find(".Numeric button").click(numberevent);
			
			downloads_available = Checkout.settings().downloads.use;
			if (downloads_available) {
				sidebar_download.find("input").click(downloadchange);
			}
			
		}
		function lateinit () {
			Browser.addEventListener("onCropMove", offsets);
			Browser.addEventListener("onZoomView", disable);
			Browser.addEventListener("onIndex", image);
			Session.addEventListener("onSessionLoaded", start);
			Session.addEventListener("onSessionCart", start);
		}
		function init () {
			draw();
			resize();
		}
		function render () {
			init();
			setTimeout(lateinit, 33);
		}
		function fixOrientation () {
			var current = Overlay.getCurrentImage();
			var aspect = current.width/current.height;
			var parent = sidebar_crop;
			var provider = selection.orientation_provider;
			var input = parent.find("select");
			var label = parent.find("span");
			var index = aspect<1 ? 1 : 2;
			var value = provider[index].value;
			var form = parent.find("form input[value=" + value + "]");
			var text = provider[index].label;
			parent
				.data("index", index)
				.data("value", value);
			input.val(value);
			form.prop('checked', true);
			label.html(text);
			selection.orientation = provider[index];
		}
		function check () {
			// these will affect the pricing labels
			var calculate_and_display_shipping_bool = Checkout.settings().shipping.use;
			var purchase_price_includes_tax_bool = Checkout.settings().tax.included;
			var shipping_taxable_bool = Checkout.settings().shipping.tax;
			var downloads_taxable_bool = Checkout.settings().downloads.tax;
			// create a new cart object
			cart_object = {};
			// disable the add button for now
			sidebar_control.removeClass("Enabled").addClass("Disabled").off();
			if (selection.type=="cart") {
				// set the selected format
				if (formats_available) {
					selection.format = selection.format_provider[sidebar_formats.data("index")];
				}
				// set some defaults
				if (toning_available) {
					selection.toning = sidebar_toning.data("value");
				}
				// update quantity selection
				if (quantity_available) {
					selection.quantity = sidebar_quantity.data("value");
					if ( selection.quantity==0 || isNaN(selection.quantity) ) {
						selection.quantity = 1;
					}
					if ( selection.quantity > selection.format.maximum ) {
						selection.quantity = selection.format.maximum;
					}
				}
				if (selection.format.maximum==-1) {
					selection.quantity = 1;
					sidebar_quantity.hide();
				} else {
					sidebar_quantity.show();
				}
				// update crop option
				if (cropping_available) {
					selection.orientation = sidebar_crop.data("value");
				}
				if (isNaN(selection.format.aspect)) {
					selection.orientation = "";
					sidebar_crop.hide();
				} else {
					sidebar_crop.show();
				}
				// kill this if formats are available, but none are selected
				if ( formats_available && ( selection.format.label==L10N.get("ordering", "sidebar_none_selected") || !selection.format ) ) {
					return;
				}
				// get the format basics
				var format_area = isNaN(selection.format.area) ? 0 : selection.format.area;
				var format_price = selection.format.price;
					format_price = evaluate(format_price, format_area, selection.quantity, null);
				// modify the paper labels
				if (papers_available) {
					selection.paper = selection.paper_provider[sidebar_papers.data("index")];
					sidebar_papers.find("option").each(function (i) {
						if (i==0) {
							return;
						}
						var input = sidebar_papers.find("label").eq(i);
						var paper = selection.paper_provider[i];
						var label = paper.title;
						var price = paper.price;
							if (price==""||!price) {
								price = "0";
							}
							price = evaluate(price, format_area, selection.quantity, format_price);
						var shipping = paper.shipping;
							if (shipping==""||!shipping) {
								shipping = "0";
							}
							shipping = evaluate(shipping, format_area, selection.quantity, format_price);
							if (calculate_and_display_shipping_bool==false) {
								shipping = 0;
							}
						if (price>0) {
							if (purchase_price_includes_tax_bool) {
								price = Func.addSalesTax(price);
							}
							label += " (" + Func.getFormattedPrice(price) + ")";
							
						}
						if (calculate_and_display_shipping_bool&&shipping>0) {
							if (purchase_price_includes_tax_bool&&shipping_taxable_bool) {
								shipping = Func.addSalesTax(shipping);
							}
							label += " + " + Func.getFormattedPrice(shipping) + " " + L10N.get("localization", "currency_shipping_and_handling_abbreviation");
						}
						$(this).html(label);
						input.html(label);
					});
				}
				// modify the paper labels
				if (modifiers_available) {
					selection.modifier = selection.modifier_provider[sidebar_modifiers.data("index")];
					sidebar_modifiers.find("option").each(function (i) {
						if (i==0) {
							return;
						}
						var input = sidebar_modifiers.find("label").eq(i);
						var modifier = selection.modifier_provider[i];
						var label = modifier.title;
						var price = modifier.price;
							if (price==""||!price) {
								price = "0";
							}
							price = evaluate(price, format_area, selection.quantity, format_price);
						var shipping = modifier.shipping;
							if (shipping==""||!shipping) {
								shipping = "0";
							}
							shipping = evaluate(shipping, format_area, selection.quantity, format_price);
							if (calculate_and_display_shipping_bool==false) {
								shipping = 0;
							}
						if (price>0) {
							if (purchase_price_includes_tax_bool) {
								price = Func.addSalesTax(price);
							}
							label += " (" + Func.getFormattedPrice(price) + ")";
						}
						if (calculate_and_display_shipping_bool&&shipping>0) {
							if (purchase_price_includes_tax_bool&&shipping_taxable_bool) {
								shipping = Func.addSalesTax(shipping);
							}
							label += " + " + Func.getFormattedPrice(shipping) + " " + L10N.get("localization", "currency_shipping_and_handling_abbreviation");
						}
						$(this).html(label);
						input.html(label);
					});
				}
				// get final values for cart object
				var comment_text = comments_available ? sidebar_comments.data("value") : "";
					comment_text = comment_text.split("\t").join("").split("\r").join(" ").split("\n").join(" ");
				var format_shipping = selection.format.shipping;
					format_shipping = evaluate(format_shipping, format_area, selection.quantity, format_price);
					if (calculate_and_display_shipping_bool==false) {
						format_shipping = 0;
					}
				var paper_price = papers_available ? selection.paper.price : "0";
					paper_price = evaluate(paper_price, format_area, selection.quantity, format_price);
				var paper_shipping = papers_available ? selection.paper.shipping : "0";
					paper_shipping = evaluate(paper_shipping, format_area, selection.quantity, format_price);
					if (calculate_and_display_shipping_bool==false) {
						paper_shipping = 0;
					}
				var modifier_price = modifiers_available ? selection.modifier.price : "0";
					modifier_price = evaluate(modifier_price, format_area, selection.quantity, format_price);
				var modifier_shipping = modifiers_available ? selection.modifier.shipping : "0";
					modifier_shipping = evaluate(modifier_shipping, format_area, selection.quantity, format_price);
					if (calculate_and_display_shipping_bool==false) {
						modifier_shipping = 0;
					}
				// create a unique hash for the cart object
				var info = Overlay.getCurrentImage();
				var hash_obj = {
					pageid: Overlay.pageid(),
					filename: info.filename,
					tone: ( toning_available ? instance.getColorTone() : "" ),
					format: ( formats_available ? selection.format.title : "" ),
					orientation: ( instance.getShowCrop() ? instance.getOrientation() : "" ),
					x_offset: ( instance.getShowCrop() ? selection.x_offset : "" ),
					y_offset: ( instance.getShowCrop() ? selection.y_offset : "" ),
					paper: ( papers_available ? selection.paper.title : "" ),
					modifier: ( modifiers_available ? selection.modifier.title : "" ),
					comment: comment_text
				};
				/*var hash_prop_str = "";
				for (var prop in hash_obj) {
					if (hash_obj.hasOwnProperty(prop)) {
						hash_prop_str += prop + ": " + hash_obj[prop] + "\n";
					}
					alert(hash_prop_str);
				}*/
				var hash = md5( hash_obj.pageid +
						hash_obj.filename +
						hash_obj.tone +
						hash_obj.format +
						hash_obj.orientation +
						hash_obj.x_offset +
						hash_obj.y_offset +
						hash_obj.paper +
						hash_obj.modifier +
						hash_obj.comment );
				if ( selection.browse.type=="product" || selection.browse.type=="package" ) {
					hash += ":" + selection.browse.hash;
				}
				/* add any and all pertinent info to the cart object
					*/
				cart_object.hash = hash;
				cart_object.puid = info.parent;
				cart_object.cuid = info.child;
				cart_object.filename = info.filename;
				cart_object.quantity = selection.quantity;
				cart_object.toning = selection.toning;
				if (formats_available) {
					cart_object.format_label = selection.format.title;
					if (isNaN(instance.getFormatAspect())==false) {
						cart_object.format_aspect = instance.getFormatAspect();
					}
					cart_object.format_price = format_price;
					cart_object.format_shipping = format_shipping;
				}
				if (instance.getShowCrop()) {
					cart_object.orientation = instance.getOrientation();
					cart_object.orientation_x = selection.x_offset;
					cart_object.orientation_y = selection.y_offset;
				}
				if (papers_available) {
					cart_object.paper_label = selection.paper.title;
					cart_object.paper_price = paper_price;
					cart_object.paper_shipping = paper_shipping;
				}
				if (modifiers_available) {
					cart_object.modifier_label = selection.modifier.title;
					cart_object.modifier_price = modifier_price;
					cart_object.modifier_shipping = modifier_shipping;
				}
				cart_object.comments = comment_text;
				cart_object.subtotal = format_price + paper_price + modifier_price;
				cart_object.shipping = format_shipping + paper_shipping + modifier_shipping;
			} else if (selection.type=="download") {
				// create a unique hash for the cart object
				var info = Overlay.getCurrentImage();
				var hash = md5( Overlay.pageid() + info.filename + selection.quality );
				var price = Checkout.settings().downloads[selection.quality].price;
					price = evaluate(price, null, null, null);
				/* add any and all pertinent info to the cart object
					*/
				cart_object.hash = hash;
				cart_object.puid = info.parent;
				cart_object.cuid = info.child;
				cart_object.filename = info.filename;
				cart_object.dimensions = info.width + "x" + info.height;
				cart_object.quality = selection.quality;
				cart_object.subtotal = price;
				cart_object.allprice = 0;
			}
			// enable the control
			sidebar_control.removeClass("Disabled").addClass("Enabled").click(click);
		}
		
		/*
			this function updates the views, but keeps the selections the same.  
			updates labels
			adds newly added packages (and auto-selects them)
			turns on/off functionality (like quantities)
			basically gets called when things get clicked that changes what is visible and available in the sidebar view
			*/
		function redraw () {
			// these will affect the pricing labels
			var calculate_and_display_shipping_bool = Checkout.settings().shipping.use;
			var purchase_price_includes_tax_bool = Checkout.settings().tax.included;
			var shipping_taxable_bool = Checkout.settings().shipping.tax;
			var downloads_taxable_bool = Checkout.settings().downloads.tax;
			// get a list of packages in the cart
			var packages = [];
			var packages_parsed = Session.getPackagesParsed();
			var i, provider, pkg, package_hash, parent, form, input, label, index, value, text, dataset, format, area, price, shipping, remaining, paper, modifier;
			for (i=0; i<packages_parsed.length; ++i) {
				pkg = packages_parsed[i];
				if ( pkg.total==0 || pkg.total==pkg.count ) {
					continue;
				}
				packages.push(pkg.row);
			}
			// decide on display flags
			packages_available = Package.available();
			alacarte_available = alacarte.length > 0;
			packages_in_cart = packages.length > 0;
			formats_available = alacarte_available || packages_in_cart;
			formats_visible = formats_available;
			quantity_available = sidebar_quantity.length > 0;
			toning_available = sidebar_toning.length > 0;
			papers_available = papers.length > 0;
			modifiers_available = modifiers.length > 0;
			cropping_available = formats_available && sidebar_crop.length > 0;
			comments_available = sidebar_comments.length > 0;
			
			sidebar_browse.toggle(packages_available);
			
			// create a cart provider array and decide on what we should be seeing
			provider = [];
			index = 0;
			provider.push({
				label: L10N.get("ordering", "sidebar_none_selected"),
				type: "none",
				hash: "none"
			});
			for (i=0; i<packages.length; ++i) {
				pkg = packages[i];
				package_hash = pkg.hash.substr(0, 32);
				if (
					( last_selected_hash == package_hash ) || // known last hash
					( selection.browse.hash == package_hash) || // the selection object has been selected manually
					( alacarte_available==false && packages.length==1 ) // only packages are available, and there is only one in the cart
				) {
					index = provider.length;
				}
				provider.push({
					label: pkg.nickname + " (" + pkg.title + ")",
					type: pkg.type,
					hash: package_hash
				});
			}
			if (alacarte_available) {
				if ( index==0) {
					if (
						( selection.browse.type=="alacarte" ) || // manual selection of alacarte
						( packages_available==true && packages_in_cart==false ) || // packages are available for choosing, but none have been added to cart
						( packages_available==false ) // packages are not available, but alacarte formats are
					) {
						index = provider.length;
					}
				}
				provider.push({
					label: L10N.get("ordering", "alacarte_label"),
					type: "alacarte",
					hash: "alacarte"
				});
			}
			
			parent = sidebar_download;
			parent.find("#sidebar-download-none").next().html(L10N.get("ordering", "sidebar_none_selected"));
				label = L10N.get("ordering", "sidebar_high_resolution");
				price = Checkout.settings().downloads.high.price;
					if (price==""||!price) {
						price = "0";
					}
					price = evaluate(price, null, null, null);
					if (price>0) {
						if ( purchase_price_includes_tax_bool && downloads_taxable_bool ) {
							price = Func.addSalesTax(price);
						}
						label += " (" + Func.getFormattedPrice(price) + ")";
					}
			parent.find("#sidebar-download-high").next().html(label);
				label = L10N.get("ordering", "sidebar_low_resolution");
				price = Checkout.settings().downloads.low.price;
					if (price==""||!price) {
						price = "0";
					}
					price = evaluate(price, null, null, null);
					if (price>0) {
						if ( purchase_price_includes_tax_bool && downloads_taxable_bool ) {
							price = Func.addSalesTax(price);
						}
						label += " (" + Func.getFormattedPrice(price) + ")";
					}
			parent.find("#sidebar-download-low").next().html(label);
				
			// update the text labels of the downloads
			// enable/disable quantity
			parent = sidebar_quantity;
			parent.toggle(quantity_available); // && !formats_visible );
				
			// now that we have an array of views, setup the select
			parent = sidebar_selection;
			input = parent.find("select");
			label = parent.find("span");
			form = parent.find("form");
			form.off().empty();
			input.empty();
			value = provider[index].hash;
			text = provider[index].label;
			for (i=0; i<provider.length; ++i) {
				input.append('<option value="' + provider[i].hash  + '">' + provider[i].label  + '</option>');
				form.append('<input id="selection-radio-' + i  + '" name="selection" ' + (provider[i].hash==value?' checked ':'') + 'type="radio" value="' + provider[i].hash  + '" /><label for="selection-radio-' + i  + '">' + provider[i].label  + '</label><br />');
			}
			parent
				.data("index", index)
				.data("value", value);
			input.val(value);
			form.find("input").change(radioevent);
			label.html(text);
			selection.browse_provider = provider;
			selection.browse = provider[index];
			parent.toggle(provider.length>=3);

			// turn off everything if there is none selected
			if (selection.browse.type=="none") {
				formats_visible = false;
				quantity_available = false;
				toning_available = false;
				papers_available = false;
				modifiers_available = false;
				cropping_available = false;
				comments_available = false;
			}

			// decide on the format dataset
			// assume alacarte by default
			dataset = alacarte;
			if ( selection.browse.type=="package" || selection.browse.type=="product" ) {
				for (i=0; i<packages_parsed.length; ++i) {
					pkg = packages_parsed[i];
					if ( pkg.row.hash.substr(0, 32) == selection.browse.hash ) {
						dataset = pkg.formats;
						break;
					}
				}
				formats_visible = dataset.length>0;
			}
			provider = [];
				provider.push({
					label: L10N.get("ordering", "sidebar_none_selected"),
					price: "",
					area: NaN,
					aspect: NaN,
					shipping: "",
					maximum: -1
				});
			for (i=0; i<dataset.length; ++i) {
				format = dataset[i];
				area = parseFloat(format.area);
				price = format.price;
				if ( price=="" || !price ) {
					price = "0";
				}
					price = evaluate(price, area, null, null);
				shipping = format.shipping;
				if ( shipping=="" || !shipping ) {
					shipping = "0";
				}
					shipping = evaluate(shipping, area, null, null);
				if ( calculate_and_display_shipping_bool==false ) {
					shipping = 0;
				}
				label = format.title;
				if (format.total) {
					remaining = format.total - format.count;
					if (remaining==0) {
						continue;
					}
					label += " (" + remaining + ") " + L10N.get("ordering", "sidebar_package_remaining");
				}
				if (price>0) {
					if (purchase_price_includes_tax_bool) {
						price = Func.addSalesTax(price);
					}
					label += " (" + Func.getFormattedPrice(price) + ")";
				}
				if (calculate_and_display_shipping_bool&&shipping>0) {
					if (purchase_price_includes_tax_bool&&shipping_taxable_bool) {
						shipping = Func.addSalesTax(shipping);
					}
					label += " + " + Func.getFormattedPrice(shipping) + " " + L10N.get("localization", "currency_shipping_and_handling_abbreviation");
				}
				provider.push({
					label: label,
					area: area,
					maximum: (remaining||9999),
					title: format.title,
					price: format.price,
					aspect: parseFloat(format.aspect),
					shipping: format.shipping
				});
			}
			parent = sidebar_formats;
			input = parent.find("select");
			form = parent.find("form");
			form.off().empty();
			input.empty();
			for (i=0; i<provider.length; ++i) {
				input.append('<option value="' + i  + '">' + provider[i].label  + '</option>');
				form.append('<input id="formats-radio-' + i  + '" name="formats" ' + (i==0?' checked ':'') + 'type="radio" value="' + i  + '" /><label for="formats-radio-' + i  + '">' + provider[i].label  + '</label><br />');
			}
			form.find("input").change(radioevent);
			selection.format_provider = provider;
			parent.toggle(formats_visible);

			// enable/disable quantity
			parent = sidebar_quantity;
			parent.toggle(quantity_available); // && !formats_visible );

			// enable/disable toning
			provider = [{
				label: L10N.get("ordering", "sidebar_none_selected"),
				value: ""
			}];
			if (Display.settings().mono) {
				provider.push({
					label: L10N.get("ordering", "sidebar_tone_black_and_white"),
					value: "mono"
				});
			}
			if (Display.settings().sepia) {
				provider.push({
					label: L10N.get("ordering", "sidebar_tone_sepia"),
					value: "sepia"
				});
			}
			parent = sidebar_toning;
			input = parent.find("select");
			form = parent.find("form");
			form.off().empty();
			input.empty();
			for (i=0; i<provider.length; ++i) {
				input.append('<option value="' + provider[i].value  + '">' + provider[i].label  + '</option>');
				form.append('<input id="toning-radio-' + i  + '" name="toning" ' + (i==0?' checked ':'') + 'type="radio" value="' + provider[i].value  + '" /><label for="toning-radio-' + i  + '">' + provider[i].label  + '</label><br />');
			}
			form.find("input").change(radioevent);
			selection.toning_provider = provider;
			parent.toggle(toning_available);

			// papers
			dataset = papers;
			provider = [];
			provider.push({
				label: L10N.get("ordering", "sidebar_none_selected"),
				title: "",
				price: "",
				shipping: ""
			});
			for (i=0; i<dataset.length; ++i) {
				paper = dataset[i];
				label = paper.title;
				price = paper.price;
					if (price==""||!price) {
						price = "0";
					}
					price = evaluate(price, null, null, null);
				shipping = paper.shipping;
					if (shipping==""||!shipping) {
						shipping = "0";
					}
					shipping = evaluate(shipping, null, null, null);
					if (calculate_and_display_shipping_bool==false) {
						shipping = 0;
					}
				if (price>0) {
					if (purchase_price_includes_tax_bool) {
						price = Func.addSalesTax(price);
					}
					label += " (" + Func.getFormattedPrice(price) + ")";
				}
				if (calculate_and_display_shipping_bool&&shipping>0) {
					if (purchase_price_includes_tax_bool&&shipping_taxable_bool) {
						shipping = Func.addSalesTax(shipping);
					}
					label += " + " + Func.getFormattedPrice(shipping) + " " + L10N.get("localization", "currency_shipping_and_handling_abbreviation");
				}
				provider.push({
					label: label,
					title: paper.title,
					price: paper.price,
					shipping: paper.shipping
				});
			}
			parent = sidebar_papers;
			input = parent.find("select");
			form = parent.find("form");
			form.off().empty();
			input.empty();
			for (i=0; i<provider.length; ++i) {
				input.append('<option value="' + i  + '">' + provider[i].label  + '</option>');
				form.append('<input id="papers-radio-' + i  + '" name="papers" ' + (i==0?' checked ':'') + 'type="radio" value="' + i  + '" /><label for="papers-radio-' + i  + '">' + provider[i].label  + '</label><br />');
			}
			form.find("input").change(radioevent);
			selection.paper_provider = provider;
			parent.toggle(papers_available);

			// modifiers
			dataset = modifiers;
			provider = [];
			provider.push({
				label: L10N.get("ordering", "sidebar_none_selected"),
				title: "",
				price: "",
				shipping: ""
			});
			for (i=0; i<dataset.length; ++i) {
				modifier = dataset[i];
				label = modifier.title;
				price = modifier.price;
					if (price==""||!price) {
						price = "0";
					}
					price = evaluate(price, null, null, null);
				shipping = modifier.shipping;
					if (shipping==""||!shipping) {
						shipping = "0";
					}
					shipping = evaluate(shipping, null, null, null);
					if (calculate_and_display_shipping_bool==false) {
						shipping = 0;
					}
				if (price>0) {
					if (purchase_price_includes_tax_bool) {
						price = Func.addSalesTax(price);
					}
					label += " (" + Func.getFormattedPrice(price) + ")";
				}
				if (calculate_and_display_shipping_bool&&shipping>0) {
					if (purchase_price_includes_tax_bool&&shipping_taxable_bool) {
						shipping = Func.addSalesTax(shipping);
					}
					label += " + " + Func.getFormattedPrice(shipping) + " " + L10N.get("localization", "currency_shipping_and_handling_abbreviation");
				}
				provider.push({
					label: label,
					title: modifier.title,
					price: modifier.price,
					shipping: modifier.shipping
				});
			}
			parent = sidebar_modifiers;
			input = parent.find("select");
			form = parent.find("form");
			form.off().empty();
			input.empty();
			for (i=0; i<provider.length; ++i) {
				input.append('<option value="' + i  + '">' + provider[i].label  + '</option>');
				form.append('<input id="modifiers-radio-' + i  + '" name="modifiers" ' + (i==0?' checked ':'') + 'type="radio" value="' + i  + '" /><label for="modifiers-radio-' + i  + '">' + provider[i].label  + '</label><br />');
			}
			form.find("input").change(radioevent);
			selection.modifier_provider = provider;
			parent.toggle(modifiers_available);

			// enable/disable crop
			provider = [{
				label: L10N.get("ordering", "sidebar_none_selected"),
				value: ""
			},{
				label: L10N.get("ordering", "sidebar_crop_portrait"),
				value: "p"
			},{
				label: L10N.get("ordering", "sidebar_crop_landscape"),
				value: "l"
			}];
			parent = sidebar_crop;
			input = parent.find("select");
			form = parent.find("form");
			form.off().empty();
			input.empty();
			for (i=0; i<provider.length; ++i) {
				input.append('<option value="' + provider[i].value  + '">' + provider[i].label  + '</option>');
				form.append('<input id="crop-radio-' + i  + '" name="crop" ' + (i==0?' checked ':'') + 'type="radio" value="' + provider[i].value  + '" /><label for="crop-radio-' + i  + '">' + provider[i].label  + '</label><br />');
			}
			form.find("input").change(radioevent);
			selection.orientation_provider = provider;
			parent.toggle(cropping_available);

			// enable/disable quantity
			parent = sidebar_comments;
			form = parent.find("form");
			form.off().empty();
			form.append('<textarea></textarea>');
			form.find("textarea").change(textevent).focus(function () { Browser.freeKeys(); }).blur(function () { Browser.takeKeys(); });
			parent.toggle(comments_available);
			
			if (!isavailable()) {
				$("#overlay-container").addClass("NoSidebar");
			}

		}
		
		/*
			this function resets everything to default state
			the hide vairbale re-hides the sidebar if it's in a hidden mobile view
			*/
		function reset (hide) {
			var undef;
			if (hide==undef) hide = true;
			// take it to the top
			overlay_sidebar.find(".Inner").scrollTop(0);
			// create a new cart object
			cart_object = {};
			// disable the add button for now
			sidebar_control.removeClass("Enabled").addClass("Disabled").off();
			// reset the format
			var provider, parent, input, form, label, index, value, text;
			var input = sidebar_download.find("input");
			if (downloads_available) {
				if (input.length>1) {
					sidebar_download.find("input").eq(0).click();
				} else {
					sidebar_download.find("input").attr('checked', false);
				}
				enableinputs();
				selection.quality = "";
			}
			selection.type = "cart";
			if (formats_visible) {
				provider = selection.format_provider;
				parent = sidebar_formats;
				input = parent.find("select");
				label = parent.find("span");
				index = 0;
				value = index;
				text = provider[index].label;
				parent
					.data("index", index)
					.data("value", value);
				form = parent.find("form input[value=" + value + "]");
				form.prop('checked', true);
				input.val(value);
				label.html(text);
				selection.format = provider[index];
			}
			// reset the quantity
			if (quantity_available) {
				parent = sidebar_quantity;
				label = parent.find("span");
				value = 1;
				text = "1";
				parent
					.data("value", value);
				label.html(text);
				selection.quantity = value;
			}
			// reset the papers
			if (papers_available) {
				provider = selection.paper_provider;
				parent = sidebar_papers;
				input = parent.find("select");
				label = parent.find("span");
				index = 0;
				value = index;
				text = provider[index].label;
				parent
					.data("index", index)
					.data("value", value);
				form = parent.find("form input[value=" + value + "]");
				form.prop('checked', true);
				input.val(value);
				label.html(text);
				selection.paper = provider[index];
			}
			// reset the modifiers
			if (modifiers_available) {
				provider = selection.modifier_provider;
				parent = sidebar_modifiers;
				input = parent.find("select");
				label = parent.find("span");
				index = 0;
				value = index;
				text = provider[index].label;
				parent
					.data("index", index)
					.data("value", value);
				form = parent.find("form input[value=" + value + "]");
				form.prop('checked', true);
				input.val(value);
				label.html(text);
				selection.modifier = provider[index];
			}
			// reset the toning
			if (toning_available) {
				provider = selection.toning_provider;
				parent = sidebar_toning;
				input = parent.find("select");
				label = parent.find("span");
				index = 0;
				value = provider[index].value;
				text = provider[index].label;
				parent
					.data("index", index)
					.data("value", value);
				form = parent.find("form input[value=" + value + "]");
				form.prop('checked', true);
				input.val(value);
				label.html(text);
				selection.toning = provider[index];
			}
			// reset the crop
			if (cropping_available) {
				provider = selection.orientation_provider;
				parent = sidebar_crop;
				input = parent.find("select");
				label = parent.find("span");
				index = 0;
				value = provider[index].value;
				text = provider[index].label;
				parent
					.data("index", index)
					.data("value", value);
				form = parent.find("form input[value=" + value + "]");
				form.prop('checked', true);
				input.val(value);
				label.html(text);
				selection.orientation = provider[index];
			}
			// reset the comments
			if (comments_available) {
				parent = sidebar_comments;
				label = parent.find("span");
				value = "";
				text = L10N.get("ordering", "sidebar_none_selected");
				parent
					.data("value", value);
				form = parent.find("textarea");
				form.val(value);
				label.html(text);
				selection.comment = value;
			}
			// reset the offsets
			selection.x_offset = 50;
			selection.y_offset = 50;
			// re-hide
			if (hide) {
				hidden = true;
				overlay_sidebar.css({
					left: original_x,
					top: 0
				});
			}
		}
		function isavailable () {
			return ( downloads_available || packages_available || formats_available || quantity_available || toning_available || papers_available || modifiers_available || cropping_available || comments_available );
		}
		/* public methods
			*/
		this.available = function() {
			return isavailable();
		};
		this.addFormat = function(key, obj) {
			alacarte_lookup[key] = alacarte.length;
			alacarte.push(obj);
		};
		this.hasFormats = function() {
			return alacarte.length > 0;
		};
		this.addPaper = function(key, obj) {
			papers_lookup[key] = papers.length;
			papers.push(obj);
		};
		this.addModifier = function(key, obj) {
			modifiers_lookup[key] = modifiers.length;
			modifiers.push(obj);
		};
		this.getOrientation = function() {
			return selection.orientation || "";
		};
		this.getFormatAspect = function() {
			return selection.format.aspect || NaN;
		};
		this.getShowCrop = function() {
			return !isNaN(this.getFormatAspect()) && cropping_available && this.getOrientation()!="";
		};
		this.getColorTone = function() {
			return selection.toning || "";
		};
		this.move = function(x, y) {
			original_x = x;
			original_y = y;
			overlay_sidebar.css({
				top: y,
				left: x
			});
		};
		this.setSize = function(w, h) {
			width = w;
			height = h;
			resize();
		};
		this.reveal = function() {
			hidden = false;
			overlay_sidebar.css({
				top: 0,
				left: 0
			});
		};
		this.abscond = function() {
			hidden = true;
			overlay_sidebar.css({
				top: 0,
				left: original_x
			});
		};
		this.setActiveSelctionHash = function(hash) {
			last_selected_hash = hash;
		};
		this.initialize = function() {
			Func = classes.helpers.Func;
			L10N = classes.helpers.L10N;
			Overlay = classes.Overlay;
			Session = classes.Session;
			Shell = classes.Shell;
			Browser = classes.overlay.Browser;
			Package = classes.overlay.Package;
			Checkout = classes.overlay.Checkout;
			Display = classes.content.Display;
			Controlbar = classes.elements.Controlbar;
			render();
		};
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());