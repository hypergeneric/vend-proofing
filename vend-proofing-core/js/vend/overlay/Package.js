
/*jslint browser: true, continue: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.overlay.Package = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var StageProxy; // shortcut
		var Shell; // shortcut
		var Func; // shortcut
		var L10N; // shortcut
		var Overlay; // shortcut
		var Session; // shortcut
		var Packages; // shortcut
		var Graphic; // shortcut
		var Sidebar; // shortcut
		var FormDialog; // shortcut
		var Checkout; // shortcut
		var Controlbar; // shortcut
		/* private properites
			*/
		var type = 			"";
		var key = 			"";
		var backtobrowse = 	false;
		var data = 			null;
		var provider = 		{};
		var overlay_package = null;
		var package_display = null;
		var package_context = null;
		/* private methods
			*/
		function addPackage (nickname) {
			var uuid = new Date().getTime();
			var format_titles = [];
			var format_quantities = [];
			var format_aspects = [];
			var format_areas = [];
			var i, format;
			for (i=0; i<provider.formats.length; ++i) {
				format = provider.formats[i];
				format_titles.push(escape(format.title));
				format_quantities.push(format.quantity);
				format_aspects.push(format.aspect);
				format_areas.push(format.area);
			}
			var hash = md5(uuid+nickname+key);
			Session.addItem("package", {
				hash: 				hash,
				type: 				type,
				nickname: 			nickname,
				title: 				provider.title,
				quantity: 			1,
				subtotal: 			provider.price,
				shipping: 			provider.shipping,
				format_titles: 		"%:" + format_titles.join(","),
				format_quantities: 	format_quantities.join(","),
				format_aspects: 	format_aspects.join(","),
				format_areas: 		format_areas.join(",")
			});
			Sidebar.setActiveSelctionHash(hash.substr(0, 32));
			back();
			if (backtobrowse) {
				cancel();
			}
		}
		function cancel () {
			Controlbar.dispatch("onPageView", [ "browse", Overlay.getBrowseView(), Overlay.getWallView(), Overlay.getIndex(), Overlay.getBrowseIndex() ]);
		}
		function back () {
			$("#overlay-packages .Wide").removeClass("Column2");
			$("#overlay-packages .Column1").hide();
			$("#overlay-packages .LineItem").removeClass("Active");
		}
		function cart () {
			FormDialog.options({
				modal: 			true,
				field_label: 	L10N.get("ordering", "package_add_dialog_enter_nickname"),
				submit_label: 	L10N.get("ordering", "package_add_dialog_submit"),
				cancel_label: 	L10N.get("general", "dialog_cancel"),
				submit: 		function () {
					addPackage(FormDialog.inputvalue());
					FormDialog.kill();
				}
			});
			FormDialog.draw();
		}
		function processData (obj) {
			var calculate_and_display_shipping_bool = Checkout.settings().shipping.use;
			var purchase_price_includes_tax_bool = Checkout.settings().tax.included;
			var shipping_taxable_bool = Checkout.settings().shipping.tax;
			var price_label = "";
			var price = parseFloat(obj.price);
			if (isNaN(price)) {
				price = 0;
			}
			var shipping = parseFloat(obj.shipping);
			if (isNaN(shipping)) {
				shipping = 0;
			}
			if (price>0) {
				if (purchase_price_includes_tax_bool) {
					price = Func.addSalesTax(price);
				}
				price_label += Func.getFormattedPrice(price);
			}
			if (calculate_and_display_shipping_bool&&shipping>0) {
				if (purchase_price_includes_tax_bool&&shipping_taxable_bool) {
					shipping = Func.addSalesTax(shipping);
				}
				if (price_label!="") {
					price_label += " + ";
				}
				price_label += Func.getFormattedPrice(shipping) + " " + L10N.get("localization", "currency_shipping_and_handling_abbreviation");
			}
			var desc = obj.description;
			if (desc=="") {
				desc = "<p>" + L10N.get("ordering", "package_no_description_heading") + "</p>";
				desc += "<ul>";
				var i, format;
				for (i=0; i<obj.formats.length; ++i) {
					format = obj.formats[i];
					desc += "<li>(" + format.quantity + ") " + format.title + "</li>";
				}
				desc += "</ul>";
			}
			var items = 0;
			for (var i=0; i<obj.formats.length; ++i) {
				var format = obj.formats[i];
				items += parseFloat(format.quantity);
			}
			if (items==0) items = "---";
			if (price_label=="") price_label = "---";
			return {
				price_label: price_label,
				items: items,
				desc: desc
			};
		}
		function onLoaded () {
		}
		function redraw () {
			$("#overlay-packages .Wide").addClass("Column2");
			$("#overlay-packages .Column1").show();
			$("#overlay-packages  .Column1 .Inner").scrollTop(0);
			var calculate_and_display_shipping_bool = Checkout.settings().shipping.use;
			var purchase_price_includes_tax_bool = Checkout.settings().tax.included;
			var shipping_taxable_bool = Checkout.settings().shipping.tax;
			var price_label = "";
			var price = parseFloat(provider.price);
			if (isNaN(price)) {
				price = 0;
			}
			var shipping = parseFloat(provider.shipping);
			if (isNaN(shipping)) {
				shipping = 0;
			}
			if (price>0) {
				if (purchase_price_includes_tax_bool) {
					price = Func.addSalesTax(price);
				}
				price_label += Func.getFormattedPrice(price);
			}
			if (calculate_and_display_shipping_bool&&shipping>0) {
				if (purchase_price_includes_tax_bool&&shipping_taxable_bool) {
					shipping = Func.addSalesTax(shipping);
				}
				if (price_label!="") {
					price_label += " + ";
				}
				price_label += Func.getFormattedPrice(shipping) + " " + L10N.get("localization", "currency_shipping_and_handling_abbreviation");
			}
			var desc = provider.description;
			if (desc=="") {
				desc = "<p>" + L10N.get("ordering", "package_no_description_heading") + "</p>";
				desc += "<ul>";
				var i, format;
				for (i=0; i<provider.formats.length; ++i) {
					format = provider.formats[i];
					desc += "<li>(" + format.quantity + ") " + format.title + "</li>";
				}
				desc += "</ul>";
			}
			overlay_package.show();
			$("#overlay-packages-controlbar").show();
			overlay_package.find("h2").empty().html(provider.title);
			overlay_package.find("h3").empty().html(price_label);
			overlay_package.find(".Description").empty().html(desc);
			package_display.find("img").off().attr("src", Func.getEmptyImgSrc());
			if (provider.filename) {
				var width = $("#overlay-packages  .Column1 .Inner").width();
				var image_width = width-24;
				var image_height = 200;
				var graphic = new Graphic();
					graphic.provider({
						child: provider.filename,
						parent: type
					});
					graphic.letterbox(true);
					graphic.setSize(image_width, image_height);
				package_display
					.show()
					.find("img")
						.attr("src", graphic.source())
						.one('load', onLoaded)
						.each(function() {
							if(this.complete) {
								$(this).load();
							}
						});
			} else {
				package_display.hide();
			}
			resize();
		}
		function draw () {
			overlay_package = $("#overlay-package");
			package_display = overlay_package.find(".Display");
			package_context = $("#package-context");
			overlay_package.hide();
			$("#overlay-packages-controlbar").hide();
			$("#packages-controlbar-add, #packages-controlbar-back, #overlay-package-cancel")
				.each(function () {
					var self = $(this);
					var tooltip = self.attr("data-tooltip");
					var func = self.attr("id");
						func = func.split("-");
						func = func.pop();
						switch (func) {
							case "cancel" :
								func = cancel;
								break;
							case "add" :
								func = cart;
								break;
							case "back" :
								func = back;
								break;
						}
					if ( tooltip!="" && !Shell.device().touch ) {
						self
							.data("tooltip", tooltip)
							.data("func", func)
							.mouseenter(function () {
								Shell.createToolTip($(this).data("tooltip"));
							})
							.mouseleave(function () {
								Shell.killToolTip();
							})
							.click(function () {
								$(this).unbind("mouseenter").unbind("mouseleave");
								Shell.killToolTip();
								$(this).data("func")();
							});
					} else {
						self.click(func);
					}
				});
			for (var prop in data) {
				var obj = data[prop];
				var meta = processData(obj);
				$("#cart-item-"+obj.hash+" .col2").html(meta.items);
				$("#cart-item-"+obj.hash+" .col3").html(meta.price_label);
			}
		}
		function resize () {
			var sw = StageProxy.width();
			var sh = StageProxy.height();
			$("#overlay-packages  .Column1 .Inner").off();
			if (sw>600) {
				var left = $("#overlay-packages  .Column2").height()+65;
				var sh = Math.max(left, StageProxy.height());
				$("#overlay-packages  .Column1 .Inner").css("min-height", sh-65);
				$("#overlay-packages  .Column1 .Inner").css("height", "auto");
			} else {
				$("#overlay-packages  .Column1 .Inner").css("min-height", "none");
				$("#overlay-packages  .Column1 .Inner").css("height", sh);
				if (Shell.device().touch) {
					$("#overlay-packages  .Column1 .Inner").bind('touchstart', Func.touchboundsstart);
					$("#overlay-packages  .Column1 .Inner").bind('touchmove', Func.touchboundsmove);
				} else {
					$("#overlay-packages  .Column1 .Inner").mousewheelStopPropagation();
				}
			}
		}
		function select (eo) {
			type = eo.type;
			key = eo.key;
			provider = data[key];
			redraw();
			resize();
		}
		function lateinit () {
			Packages.addEventListener("onPackageSelected", select);
			StageProxy.addEventListener("onResize", resize);
		}
		function init () {
			draw();
			resize();
		}
		function render () {
			init();
			setTimeout(lateinit, 33);
		}
		/* public methods
			*/
		this.setBackStyle = function(str) {
			backtobrowse = str=="1";
			$("#overlay-package-controlbar").toggle(backtobrowse);
			back();
		}
		this.add = function(key, obj) {
			if (data==null) {
				data = {};
			}
			data[key] = obj;
		};
		this.available = function() {
			return data!=null;
		};
		this.initialize = function() {
			StageProxy = classes.StageProxy;
			Func = classes.helpers.Func;
			L10N = classes.helpers.L10N;
			Overlay = classes.Overlay;
			Session = classes.Session;
			Shell = classes.Shell;
			Packages = classes.overlay.Packages;
			Graphic = classes.elements.Graphic;
			FormDialog = classes.elements.FormDialog;
			Sidebar = classes.overlay.Sidebar;
			Checkout = classes.overlay.Checkout;
			Controlbar = classes.elements.Controlbar;
			render();
		};
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());
