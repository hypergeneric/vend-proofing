
/*jslint browser: true, continue: true, eqeq: true, newcap: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.elements.Controlbar = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var StageProxy; // shortcut
		var Shell; // shortcut
		var Dialog; // shortcut
		var L10N; // shortcut
		var Session; // shortcut
		var Overlay; // shortcut
		var ContactForm; // shortcut
		var Display; // shortcut
		var Func; // shortcut
		var Cart; // shortcut
		var Checkout; // shortcut
		var Package; // shortcut
		/* private properites
			*/
		var instance = this;
		var provider_lookup = {
			set: {
				top: 0,
				bottom: -15,
				label: null,
				view: null,
				container: null,
				current: null,
				options: null,
				index: -1
			},
			favorites: {
				top: 0,
				bottom: -15,
				view: null,
				label: null,
				container: null,
				current: null,
				options: null,
				index: -1
			},
			cart:{
				top: 0,
				bottom: -15,
				view: null,
				label: null,
				container: null,
				current: null,
				options: null,
				index: -1
			}
		};
		var playing = true;
		var state = "";
		var lastview = "wall";
		// jquery holders
		var container = null;
		var icon_mail = null;
		var icon_music = null;
		var jp_player = null;
		/* private methods
			*/
		function count () {
			var cartitems = Session.getCart();
			var tally = 0;
			var i;
			for (i=0; i<cartitems.length; ++i) {
				tally += parseInt(cartitems[i].quantity, 10);
			}
			tally += Session.getDownloadsLength();
			var products_parsed = Session.getPackagesParsed();
			for (i=0; i<products_parsed.length; ++i) {
				if (products_parsed[i].total==0) {
					tally += 1;
				}
			}
			return tally;
		}
		function clear_fav_confirm () {
			instance.dispatch("onPageView", [ "browse", "wall", "set", 0, 0 ]);
			Session.purge("favorites");
		}
		function clear_fav_dialog () {
			Dialog.options({
				unique: 		"controlbarfavoriteclear",
				modal: 			true,
				title: 			L10N.get("ordering", "cart_delete_confirmation_title"),
				description: 	L10N.get("ordering", "cart_delete_confirmation_description"),
				confim: 		clear_fav_confirm
			});
			Dialog.draw();
		}
		function download_all_confirm (group, quality) {
			Session.downloadAll(group, quality);
			instance.dispatch("onPageView", [ "cart" ]);
		}
		function downloadAll (group, quality) {
			var purchase_price_includes_tax_bool = Checkout.settings().tax.included;
			var downloads_taxable_bool = Checkout.settings().downloads.tax;
			var count = group=="cart" ? Overlay.getImageCount() : Session.getFavoritesLength();
			var price = group=="cart" ? Checkout.settings().downloads.all[quality] : Checkout.settings().downloads[quality].price;
				price = parseFloat(price);
			if ( Checkout.settings().downloads.all.flat==false || group!="cart" ) {
				price = count*price;
			}
				if ( purchase_price_includes_tax_bool && downloads_taxable_bool ) {
					price = Func.addSalesTax(price);
				}
				price = Func.getFormattedPrice(price);
			var description = L10N.get("ordering", "cart_download_all_confirmation_description");
			var quality_label = L10N.get("ordering", "sidebar_" + quality + "_resolution");
			description = description.split("{QUALITY}").join(quality_label);
			description = description.split("{QUANTITY}").join(count);
			description = description.split("{PRICE}").join(price);
			Dialog.options({
				modal: 			true,
				title: 			L10N.get("ordering", "cart_download_all_confirmation_title"),
				description: 	description,
				args: 			arguments,
				confim: 		download_all_confirm
			});
			Dialog.draw();
		}
		function setActive (obj, type) {
			var popups = ["set", "favorites", "cart"];
			var i, provider;
			for (i=0; i<popups.length; ++i) {
				provider = provider_lookup[popups[i]];
				provider.view.removeClass("Active");
				provider.options.removeClass("Active");
				provider.index = -1;
				provider.current = null;
			}
			provider = provider_lookup[type];
			provider.index = obj.data("index");
			provider.current = provider.options.eq(provider.index);
			provider.current.addClass("Active");
			
		}
		function click (e) {
			var obj = $(this);
			var index = obj.data("index");
			var provider = provider_lookup[obj.data("provider")];
			if (obj.data("key")=="clear-favorites") {
				clear_fav_dialog();
				Func.stop(e);
				return false;
			}
			if (obj.data("key")=="download-all-cart-high") {
				downloadAll("cart", "high");
				Func.stop(e);
				return false;
			}
			if (obj.data("key")=="download-all-cart-low") {
				downloadAll("cart", "low");
				Func.stop(e);
				return false;
			}
			if (obj.data("key")=="download-favorites-cart-high") {
				downloadAll("favorites", "high");
				Func.stop(e);
				return false;
			}
			if (obj.data("key")=="download-favorites-cart-low") {
				downloadAll("favorites", "low");
				Func.stop(e);
				return false;
			}
			if (obj.data("key")=="cart") {
				instance.dispatch("onPageView", [ "cart" ]);
				provider.container.stop().animate({ bottom: provider.bottom });
				Func.stop(e);
				return false;
			}
			if (obj.data("key")=="checkout") {
				Cart.checkout();
				provider.container.stop().animate({ bottom: provider.bottom });
				Func.stop(e);
				return false;
			}
			if (obj.data("key")=="packages") {
				instance.dispatch("onPageView", [ "packages", 0 ]);
				provider.container.stop().animate({ bottom: provider.bottom });
				Func.stop(e);
				return false;
			}
			if (provider.index==index) {
				return false;
			}
			var view = Overlay.getBrowseView();
			if ( lastview!=Overlay.getBrowseView() ) {
				view = "wall";
			}
			instance.dispatch("onPageView", [ "browse", view, obj.data("provider"), index, 0 ]);
			provider.container.stop().animate({ bottom: provider.bottom });
			Func.stop(e);
			return false;
		}
		function open () {
			/*var obj = $(this);
			var val = obj.data("value");
			obj.find("option[data-key]").removeAttr("disabled");
			if (Overlay.getWallView()==obj.data("provider")) {
				obj.val(val);
				obj.find("option:selected").attr("disabled", "disabled");
			}*/
		}
		function change (e) {
			var obj = $(this);
			//get our info since we're gonna wipe it
			var selected = obj.find("option:selected");
			var key = selected.data("key");
			var provider = selected.data("provider");
			var index = selected.data("index");
			var lookup = provider_lookup[provider];
			// ok now wipe it, and select the first one
			var val = selected.val();
			obj.data("value", val);
			var options = obj.find("option");
			options.removeAttr("selected");
			options.eq(0).attr("selected", "selected");
			var key2, provider2;
			for (key2 in provider_lookup) {
				if (provider_lookup.hasOwnProperty(key2)) {
					if (key2==obj.data("provider")) {
						continue;
					}
					provider2 = provider_lookup[key2];
					provider2.view.data("value", "");
				}
			}
			// now do whatever
			if (key=="clear-favorites") {
				clear_fav_dialog();
				Func.stop(e);
				return false;
			}
			if (key=="download-all-cart-high") {
				downloadAll("cart", "high");
				Func.stop(e);
				return false;
			}
			if (key=="download-all-cart-low") {
				downloadAll("cart", "low");
				Func.stop(e);
				return false;
			}
			if (key=="download-favorites-cart-high") {
				downloadAll("favorites", "high");
				Func.stop(e);
				return false;
			}
			if (key=="download-favorites-cart-low") {
				downloadAll("favorites", "low");
				Func.stop(e);
				return false;
			}
			if (key=="cart") {
				instance.dispatch("onPageView", [ "cart" ]);
				Func.stop(e);
				return false;
			}
			if (key=="checkout") {
				Cart.checkout();
				Func.stop(e);
				return false;
			}
			if (key=="packages") {
				instance.dispatch("onPageView", [ "packages", 0 ]);
				Func.stop(e);
				return false;
			}
			if (lookup.index==index) {
				return false;
			}
			var view = Overlay.getBrowseView();
			if ( lastview!=Overlay.getBrowseView() ) {
				view = "wall";
			}
			instance.dispatch("onPageView", [ "browse", view, provider, index, 0 ]);
			Func.stop(e);
			return false;
		}
		function resetIndex (i) {
			$(this).data("index", i);
		}
		function resize () {
			var key, provider, options, label, width;
			if (Shell.device().touch) {
				for (key in provider_lookup) {
					if (provider_lookup.hasOwnProperty(key)) {
						provider = provider_lookup[key];
						provider.options = provider.view.find("option[data-key]");
						provider.options
							.removeAttr("disabled")
							.data("provider", key)
							.each(resetIndex);
						options = provider.view.find("option");
						options.removeAttr("selected");
						options.eq(0).attr("selected", "selected");
					}
				}
			} else {
				for (key in provider_lookup) {
					if (provider_lookup.hasOwnProperty(key)) {
						provider = provider_lookup[key];
						label = provider.label.html();
						provider.view.width("auto");
						provider.view.find("ul").width("auto");
						provider.label.html("0000");
						width = Math.max(provider.view.width(), provider.view.find("ul").width());
						provider.options = provider.view.find("li[data-key]");
						provider.options
							.off()
							.click(click)
							.data("provider", key)
							.each(resetIndex);
						provider.label.html(label);
						provider.view.width(width);
						provider.view.find("ul").width(width-2);
						provider.top = (provider.container.height())*-1;
						provider.bottom = provider.container.css("bottom");
					}
				}
			}
			center();
		}
		function onSessionLoaded () {
			$("#controlbar-inner").show();
			var page_breakpoint = Overlay.getMaxImageCount();
			var favorites = Session.getFavorites();
			var favorite_pages = [];
			var i;
			var partition;
			var provider;
			if (favorites.length<=page_breakpoint) {
				favorite_pages.push( L10N.get("ordering", "navigation_favorites_all") + " (" + favorites.length + ")" );
			} else {
				partition = Func.array_chunk(favorites, page_breakpoint);
				for (i=0; i<partition.length; ++i) {
					favorite_pages.push( L10N.get("ordering", "navigation_favorites_page") + " " + (i+1) + " (" + partition[i].length + ")");
				}
			}
			var cartitems = Session.getCart();
			var cart_length = count();
			if (Shell.device().touch) {
				provider = provider_lookup.favorites;
				if (favorites.length>0) {
					provider.view
						.removeAttr("disabled")
						.html('<option disabled="disabled">' + L10N.get("ordering", "navigation_favorites_title") + " (" + favorites.length + ")" + "</option>");
					for (i=0; i<favorite_pages.length; ++i) {
						provider.view.append('<option data-key="">' + favorite_pages[i] + "</option>");
					}
					provider.view.append('<option disabled="disabled">-----</option>');
					provider.view.append('<option data-key="clear-favorites">' + L10N.get("ordering", "navigation_clear_favorites") + "</option>");
					if (Checkout.settings().downloads.use) {
						provider.view.append('<option disabled="disabled">-----</option>');
						if (Checkout.settings().downloads.high.use) {
							provider.view.append('<option data-key="download-favorites-cart-high">' + L10N.get("ordering", "navigation_download_all_high") + '</option>');
						}
						if (Checkout.settings().downloads.low.use) {
							provider.view.append('<option data-key="download-favorites-cart-low">' + L10N.get("ordering", "navigation_download_all_low") + '</option>');
						}
					}
				} else {
					provider.view
						.attr("disabled", "disabled")
						.html("<option>" + L10N.get("ordering", "navigation_no_favorites") + "</option>");
				}
				provider = provider_lookup.cart;
				if (cart_length>0) {
					provider.view
						.removeAttr("disabled")
						.html('<option disabled="disabled">' + L10N.get("ordering", "navigation_cart_title") + " (" + cart_length + ")" + "</option>");
					provider.view
						.append('<option data-key="cart">' + L10N.get("ordering", "navigation_view_cart") + "</option>")
						.append('<option data-key="checkout">' + L10N.get("ordering", "navigation_checkout") + "</option>");
				} else {
					provider.view
						.attr("disabled", "disabled")
						.html("<option>" + L10N.get("ordering", "navigation_cart_empty") + "</option>");
				}
			} else {
				provider = provider_lookup.favorites;
				if (favorites.length>0) {
					provider.view.removeClass("Disabled");
					provider.title.html( L10N.get("ordering", "navigation_favorites_title") );
					provider.label.html( "(" + favorites.length + ")" );
					provider.container
						.show()
						.empty();
					for (i=0; i<favorite_pages.length; ++i) {
						provider.container.append('<li data-key="' + i + '">' + favorite_pages[i] + "</li>");
					}
					provider.container
						.append('<li class="BreakLine"></li>')
						.append('<li data-key="clear-favorites">' + L10N.get("ordering", "navigation_clear_favorites") + "</li>");
					if (Checkout.settings().downloads.use) {
						provider.container.append('<li class="BreakLine"></li>');
						if (Checkout.settings().downloads.high.use) {
							provider.container.append('<li data-key="download-favorites-cart-high">' + L10N.get("ordering", "navigation_download_all_high") + '</li>');
						}
						if (Checkout.settings().downloads.low.use) {
							provider.container.append('<li data-key="download-favorites-cart-low">' + L10N.get("ordering", "navigation_download_all_low") + '</li>');
						}
					}
				} else {
					provider.view.addClass("Disabled");
					provider.title.html( L10N.get("ordering", "navigation_no_favorites") );
					provider.label.html("(0)");
					provider.container.empty().hide();
				}
				provider = provider_lookup.cart;
				if (cart_length>0) {
					provider.view.removeClass("Disabled");
					provider.title.html( L10N.get("ordering", "navigation_cart_title") );
					provider.label.html( "(" + cart_length + ")" );
					provider.container
						.show()
						.empty();
					provider.container
						.append('<li data-key="cart">' + L10N.get("ordering", "navigation_view_cart") + "</li>")
						.append('<li data-key="checkout">' + L10N.get("ordering", "navigation_checkout") + "</li>");
				} else {
					provider.view.addClass("Disabled");
					provider.title.html( L10N.get("ordering", "navigation_cart_empty") );
					provider.label.html("(0)");
					provider.container.empty().hide();
				}
			}
			resize();
		}
		function toggle_soundtrack () {
			if (playing==true) {
				playing = false;
				icon_music.addClass("Paused");
				jp_player.jPlayer("pause");
			} else {
				playing = true;
				icon_music.removeClass("Paused");
				jp_player.jPlayer("play");
			}
		}
		function release (e) {
			if ($(this).data("state")=="closed") {
				$(this).mouseenter();
			} else {
				$(this).mouseleave();
			}
			Func.stop(e);
			return false;
		}
		function mouseover (e) {
			$(this).data("state", "open");
			var provider = provider_lookup[$(this).data("provider")];
			provider.container.stop().animate({ bottom: provider.top });
			Func.stop(e);
			return false;
		}
		function mouseout (e) {
			$(this).data("state", "closed");
			var provider = provider_lookup[$(this).data("provider")];
			provider.container.stop().animate({ bottom: provider.bottom });
			Func.stop(e);
			return false;
		}
		function draw () {
			// cache our jquery objects
			container = $("#controlbar");
			icon_mail = $("#icon-mail");
			icon_music = $("#icon-music");
			jp_player = $("#jp-player");
			// disable click-throughs
			container.click(function (e) {
				Func.stop(e);
				return false;
			});
			// add clicks to the mail and music icons
			icon_mail.click(function () {
				instance.dispatch("onPageView", [ "contact" ]);
			});
			icon_music.click(function () {
				toggle_soundtrack();
			});
			// enable the supernav functionality
			var popups = ["set", "favorites", "cart"];
			var i, key, view, options, provider;
			if (Shell.device().touch) {
				for (i=0; i<popups.length; ++i) {
					key = popups[i];
					view = $("#controlbar-"+key);
					options = view.find("option[data-key]");
					provider = provider_lookup[popups[i]];
					options
						.data("provider", key)
						.each(resetIndex);
					view
						.data("value", options.eq(0).val())
						.data("provider", key)
						.off()
						.mousedown(open)
						.change(change);
					provider.view = view;
					provider.options = options;
				}
			} else {
				var view_title, view_label, view_container;
				for (i=0; i<popups.length; ++i) {
					key = popups[i];
					view = $("#controlbar-"+key);
					view_title = view.find("span").eq(1);
					view_label = view.find("span").eq(2);
					view_container = view.find("ul");
					options = view.find("li[data-key]");
					provider = provider_lookup[popups[i]];
					options
						.off()
						.click(click)
						.data("provider", key)
						.each(resetIndex);
					view
						.data("state", "closed")
						.data("provider", key)
						.click(release)
						.mouseenter(mouseover)
						.mouseleave(mouseout);
					provider.view = view;
					provider.container = view_container;
					provider.title = view_title;
					provider.label = view_label;
					provider.options = options;
				}
			}
			// start up our wall view
			$(window).hashchange(onHashChange);
			var init = location.hash;
			var UNDEF;
			if ( !init || init=="" || init==null || init==UNDEF ) {
				onPageView([ "browse", "wall", "set", 0, 0 ]);
			} else {
				$(window).hashchange();
			}
			instance.addEventListener("onPageView", onPageView);
		}
		function onHashChange (eo) {
			var hash = location.hash;
			var bits = hash.split("/");
				bits.shift();
				bits.pop();
			updateViews(bits);
		}
		function onPageView (eo) {
			var hash = "#/" + eo.join("/") + "/";
			if (location.hash!=hash) {
				location.hash = "#/" + eo.join("/") + "/";
			}
		}
		function updateViews (eo) {
			state = eo[0];
			$("#overlay-cartview,#image-wall-wrapper,#overlay-container,#overlay-packages,#overlay-checkout,#overlay-clickwrap,#overlay-contact").hide();
			switch (state) {
				case "browse" :
					lastview = eo[2];
					Overlay.setBrowseView(eo[1]);
					Overlay.setWallView(eo[2]);
					Overlay.setIndex(parseInt(eo[3], 10));
					Overlay.setBrowseIndex(parseInt(eo[4], 10));
					Display.update();
					break;
				case "contact" :
					$("#overlay-contact").show();
					break;
				case "cart" :
					$("#overlay-cartview").show();
					break;
				case "tos" :
					$("#overlay-clickwrap").show();
					break;
				case "checkout" :
					$("#overlay-checkout").show();
					Checkout.update();
					break;
				case "packages" :
					Package.setBackStyle(eo[1]);
					$("#overlay-packages").show();
					break;
			}
		}
		function soundtrack () {
			// setup our music
			var playlist = Overlay.getPlaylist();
			if (playlist.length>0) {
				var player = new jPlayerPlaylist({
					jPlayer: "#jp-player",
					cssSelectorAncestor: "#jp-container"
				}, playlist, {
					playlistOptions: {
						autoPlay: true
					},
					wmode: "window",
					swfPath: APP_ROOT + 'vend-proofing-core/swf/Jplayer.swf',
					solution: 'html, flash',
					supplied: 'mp3',
					volume: 50,
					loop: true
				});
				player.option();
			}
		}
		function noscroll () {
			container.bind("touchmove", Func.stop);
			container.mousewheel(Func.stop);
		}
		function rescroll () {
			container.unbind("touchmove", Func.stop);
			container.unmousewheel();
		}
		function center () {
			$("#controlbar").removeClass("Compact");
			var minx = $("#controlbar-left").width();
			var sw = StageProxy.width();
			var cw = $("#controlbar-inner").width();
			var center = (sw-cw)/2;
			var xpos = Math.max(minx, center);
			var remainder = sw - minx - cw - $("#controlbar-right").width();
			if (remainder<0) {
				xpos = center;
				$("#controlbar").addClass("Compact");
			}
			$("#controlbar-inner").css("left", xpos);
		}
		function lateinit () {
			StageProxy.addEventListener("onResize", center);
			Session.addEventListener("onSessionLoaded", onSessionLoaded);
			Session.addEventListener("onSessionCart", onSessionLoaded);
			Session.addEventListener("onSessionFavorites", onSessionLoaded);
			Overlay.addEventListener("onOpen", noscroll);
			Overlay.addEventListener("onClose", rescroll);
			center();
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
		this.start = function() {
			soundtrack();
		};
		this.getState = function() {
			return state;
		};
		this.initialize = function() {
			StageProxy = classes.StageProxy;
			L10N = classes.helpers.L10N;
			Shell = classes.Shell;
			Session = classes.Session;
			Overlay = classes.Overlay;
			Dialog = classes.Dialog;
			ContactForm = classes.elements.ContactForm;
			Func = classes.helpers.Func;
			Cart = classes.overlay.Cart;
			Checkout = classes.overlay.Checkout;
			Package = classes.overlay.Package;
			Display = classes.content.Display;
			render();
			resize();
		};
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());
