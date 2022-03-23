
/*jslint browser: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.content.Display = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var L10N; // shortcut
		var Func; // shortcut
		var FormDialog; // shortcut
		var Controlbar; // shortcut
		var Checkout; // shortcut
		var StageProxy; // shortcut
		var Overlay; // shortcut
		var Shell; // shortcut
		var Session; // shortcut
		var Graphic; // shortcut
		/* private properites
			*/
		var lastview = 				0;
		var lastindex = 			0;
		var lastwidth = 			0;
		var inited = 				false;
		var row_height = 			200;
		var welcome_str = 			"";
		var intro_str = 			"";
		var bg_image_arr = 			["", "", ""];
		var children = 				[];
		var lookup = 				{};
		var thumb_loader_index = 	-1;
		var thumbnail_interval_id;
		var stack = 				[];
		var categoryblock;
		var thumbnails;
		var favorites;
		var setup = {
			title: 					"",
			expiry: 				"0",
			gutter: 				1,
			seed_height: 			250,
			expired: 				false,
			tooltips: 				false
		};
		/* private methods
			*/
		function thumbnail_loaded () {
			var child = thumbnails.eq(thumb_loader_index);
			var img = child.find("img");
			child.find(".FavoriteButton").data("loaded", true).show();
			clearInterval(thumbnail_interval_id);
			thumbnail_interval_id = setTimeout(thumbnail_loadnext, 1);
		}
		function thumbnail_loadnext () {
			thumb_loader_index = thumb_loader_index + 1;
			if (thumb_loader_index==children.length) {
				return;
			}
			var img = thumbnails.eq(thumb_loader_index).find("img");
			img
				.attr("src", img.data("source"))
				.one('load', thumbnail_loaded)
				.each(Func.imgonload);
		}
		function drawThumbnails () {
			//kill any previous stuff
			clearTimeout(thumbnail_interval_id);
			thumb_loader_index = -1;
			lookup = {};
			thumbnails.each(function (i) {
				var provider = children[i];
				if (provider) {
					var button_w = 0;
					var graphic = new Graphic();
						graphic.provider(provider);
						graphic.letterbox(false);
					if ( Shell.device().phone ) {
						graphic.watermark(true);
						graphic.setSize(480);
					} else {
						graphic.setSize(button_w*1.5, row_height*1.5);
					}
					$(this)
						.show()
						.css("visibility", "visible")
						.css("opacity", 1)
						.removeClass("Active")
						.data("index", i)
						.data("hash", provider.hash)
						.data("provider", provider)
						.find("img")
							.off()
							.data("original-src", "")
							.attr("src", Func.getEmptyImgSrc())
							.data("source", graphic.source());
					lookup[provider.hash] = $(this);
				} else {
					$(this)
						.hide()
						.data("index", -1)
						.data("hash", "")
						.data("provider", {})
						.find("img")
							.attr("src", Func.getEmptyImgSrc());
				}
			});
			favorites.each(function () {
				$(this)
					.hide()
					.removeClass("Active")
					.data("tiptext", L10N.get("ordering", "favorites_tooltip_add"))
					.data("loaded", false)
					.data("active", false);
			});
			thumbnail_loadnext();
		}
		function drawSetImages () {
			children = Overlay.getViewProvider();
			drawThumbnails();
		}
		function onSessionCart () {
			thumbnails.removeClass("Active");
			var cart = Session.getCart();
			var i, row, cuid, thumbnail;
			for (i=0; i<cart.length; ++i) {
				row = cart[i];
				cuid = md5(row.puid+row.cuid);
				thumbnail = lookup[cuid];
				if (thumbnail) {
					thumbnail.addClass("Active");
				}
			}
			var downloads = Session.getDownloads();
			var i, row, cuid, thumbnail;
			for (i=0; i<downloads.length; ++i) {
				row = downloads[i];
				cuid = md5(row.puid+row.cuid);
				thumbnail = lookup[cuid];
				if (thumbnail) {
					thumbnail.addClass("Active");
				}
			}
		}
		function onSessionFavorites () {
			if ( Overlay.getWallView()=="favorites" && Session.getFavoritesLength()==0 ) {
				Controlbar.dispatch("onPageView", [ "browse", "wall", "set", 0, 0 ]);
				Overlay.close();
				return;
			}
			var favorites_table = Session.getFavoritesTable();
			favorites.each(function () {
				var active = favorites_table[$(this).parent().data("hash")+"-f"];
				if (active) {
					$(this)
						.addClass("Favorited")
						.data("tiptext", L10N.get("ordering", "favorites_tooltip_remove"))
						.data("active", true);
				} else {
					$(this)
						.removeClass("Favorited")
						.data("tiptext", L10N.get("ordering", "favorites_tooltip_add"))
						.data("active", false);
					if ( Overlay.getWallView()=="favorites" ) {
						$(this).parent().css("visibility", "hidden");
					}
				}
				if ($(this).data("loaded")==true) {
					$(this).show();
				}
			});
		}
		function onSessionLoaded () {
			if (Overlay.getWallView()=="favorites") {
				lastview = Overlay.getWallView();
				lastindex = Overlay.getIndex();
				lastwidth = 0;
				drawSetImages();
				resize();
				reposition();
			}
			var length = Overlay.getImageGroupCount();
			if (length==1) {
				$("#image-wall-wrapper .ControlBar").hide();
			} else {
				$("#image-wall-wrapper .ControlBar").show();
			}
			onSessionCart();
			onSessionFavorites();
		}
		function updateBatch (i) {
			var row = stack[i];
			var j, obj, button, sw, sh, nw, nh;
			for (j=0; j<row.length; ++j) {
				obj = row[j];
				button = obj.clip;
				button
					.css({
						width: (obj.w) + "px",
						height: (obj.h) + "px",
						top: obj.y + "px",
						left: obj.x + "px"
					});
				button.find(".Highlight").css({
						width: (obj.w-10) + "px",
						height: (obj.h-10) + "px"
					});
				sw = obj.w;
				sh = obj.h;
				nw = sw;
				nh = nw/obj.r;
				if (nh<sh) {
					nh = sh;
					nw = nh*obj.r;
				}
				button.find("img").css({
						width: nw + "px",
						height: nh + "px",
						top: ((sh-nh)/2) + "px",
						left: ((sw-nw)/2) + "px"
					});
			}
		}
		function resize () {
			if (!thumbnails) {
				return;
			}
			/* redraw thumbnails
				*/
			var sw = StageProxy.width();
			if ( sw==lastwidth ) {
				return;
			}
			var totalwidth = StageProxy.width() - setup.gutter;
			var xpos = 0;
			var ypos = 0;
			var stackindex = 0;
			stack = [[]];
			thumbnails.each(function (i) {
				var button = $(this);
				var provider = children[i];
				var ratio = 1;
				var button_x = 0;
				var button_y = 0;
				var button_h = 0;
				var button_w = 0;
				if (provider) {
					ratio = provider.width/provider.height;
					button_x = xpos;
					button_y = ypos;
					button_h = row_height-setup.gutter;
					button_w = Math.round(button_h*ratio);
					if (button_x+button_w+setup.gutter>totalwidth) {
						stack.push([]);
						stackindex += 1;
						xpos = 0;
						ypos += row_height;
						button_x = xpos;
						button_y = ypos;
					}
					xpos += button_w+setup.gutter;
					stack[stackindex].push({
						clip: button,
						r: ratio,
						x: button_x,
						y: button_y,
						w: button_w,
						h: button_h
					});
				}
			});
			var i, j, rowitems, lastitem, rowwidth, offset, offset_last, rowitem;
			ypos = 0;
			for (i=0; i<stack.length; ++i) {
				xpos = 0;
				rowitems = stack[i];
				lastitem = rowitems[rowitems.length-1];
				if (!lastitem) continue;
				rowwidth = lastitem.x+lastitem.w+setup.gutter;
				offset = (totalwidth/rowwidth);
				if ( offset>2 && totalwidth>=600 ) offset = 1;
				for (j=0; j<rowitems.length; ++j) {
					rowitem = rowitems[j];
					rowitem.x = xpos;
					rowitem.y = ypos;
					rowitem.w *= offset;
					rowitem.w = Math.round(rowitem.w);
					rowitem.h = Math.round(rowitem.w/rowitem.r);
					xpos += rowitem.w+setup.gutter;
				}
				rowwidth = lastitem.x+lastitem.w+setup.gutter;
				offset = totalwidth-rowwidth;
				if ( offset!=0 && i!=stack.length-1 ) {
					rowitem.w += offset;
				}
				ypos += rowitem.h+setup.gutter;
			}
			for (i=0; i<stack.length; ++i) {
				updateBatch(i);
			}
			categoryblock.height( ypos + setup.gutter );
		}
		function reposition () {
			var sw = StageProxy.width();
			var i = Overlay.getBrowseIndex();
			var elm = thumbnails.eq(i);
			var ypos = sw<=800 ? elm.offset().top-(i==0?65:0) : elm.offset().top-65;
			window.scrollTo(0, ypos);
		}
		function refresh () {
			var view = Overlay.getWallView();
			var index = Overlay.getIndex();
			if ( view!=lastview || index !=lastindex ) {
				lastview = view;
				lastindex = index;
				lastwidth = 0;
				drawSetImages();
				onSessionLoaded();
			}
			resize();
			reposition();
		}
		function onClose () {
			if (Overlay.getWallView()=="favorites") {
				if (Session.isFavoritesEmpty()) {
					Controlbar.dispatch("onPageView", [ "browse", "wall", "set", 0, 0 ]);
				} else {
					if (children.length!=Session.getFavoritesLength()) {
						refresh();
					}
				}
			}
		}
		function fixIndexes () {
			var i, j, button;
			j = 0;
			for (i=0; i<children.length; ++i) {
				button = thumbnails.eq(i);
				if (button.data("index")!=-1) {
					button.data("index", j);
					++j;
				}
			}
		}
		function init () {
			categoryblock = $("#image-wall");
			thumbnails = Overlay.getMaxImageCount();
			var i;
			for (i=0; i<thumbnails; ++i) {
				categoryblock.append('<div class="Graphic"><div class="Wrapper"><img src="' + Func.getEmptyImgSrc() + '" width="" height="" alt="" /><div class="Highlight"></div></div><div class="FavoriteButton"></div></div>');
			}
			thumbnails = $("#image-wall .Graphic");
			thumbnails.click(function (e) {
				if ( setup.tooltips && $(this).data("provider").alt!="" ) {
					Shell.killToolTip();
				}
				Controlbar.dispatch("onPageView", [ "browse", "overlay", Overlay.getWallView(), Overlay.getIndex(), $(this).data("index") ]);
				Func.stop(e);
				return false;
			});
			if ( !Shell.device().touch ) {
				thumbnails.mouseenter(function (e) {
					$(this).find(".Wrapper").css("opacity", 0.5);
					if ( setup.tooltips && $(this).data("provider").alt!="" ) {
						Shell.createToolTip($(this).data("provider").alt, true);
					}
					Func.stop(e);
					return false;
				}).mouseleave(function (e) {
					$(this).find(".Wrapper").css("opacity", 1);
					if ( setup.tooltips && $(this).data("provider").alt!="" ) {
						Shell.killToolTip();
					}
					Func.stop(e);
					return false;
				});
			}
			favorites = thumbnails.find(".FavoriteButton");
			favorites.click(function (e) {
				if (setup.tooltips) {
					Shell.killToolTip();
				}
				if (Overlay.getWallView()=="favorites") {
					fixIndexes();
					Session.removeItem("favorites", $(this).parent().data("hash"));
				} else {
					var info = Overlay.getImageInfo($(this).parent().data("index"));
					if ($(this).data("active")) {
						Session.removeItem("favorites", $(this).parent().data("hash"));
					} else {
						var obj = {
							hash: $(this).parent().data("hash"),
							puid: info.parent,
							cuid: info.child,
							filename: info.filename,
							width: info.width,
							height: info.height
						};
						Session.addItem("favorites", obj);
					}
				}
				$(this).hide();
				Func.stop(e);
				return false;
			});
			if ( !Shell.device().touch ) {
				favorites
				.mouseenter(function (e) {
					$(this).parent().mouseleave();
					if (setup.tooltips) {
						Shell.createToolTip($(this).data("tiptext"), false);
					}
					Func.stop(e);
					return false;
				})
				.mouseleave(function (e) {
					$(this).parent().mouseenter();
					if (setup.tooltips) {
						Shell.killToolTip();
					}
					Func.stop(e);
					return false;
				});
			}
			if ( !Shell.device().tablet ) {
				row_height = 175;
			}
			
			$("#imagewall-controlbar-more").click(nextpage);
			$("#imagewall-controlbar-top").click(gototop);
			
			$("#start-screen").show();
			
		}
		function nextpage (eo) {
			var length = Overlay.getImageGroupCount();
			var index = Overlay.getIndex()+1; // next page index
			if (index==length) {
				index = 0; // we're at the end of the pages, go back to first page
			}
			Controlbar.dispatch("onPageView", [ "browse", "wall", Overlay.getWallView(), index, 0 ]);
		}
		function gototop (eo) {
			$('html, body').scrollTop(0);
		}
		function dialog_response (str) {
			if (str=="email_invalid") {
				FormDialog.error();
			} else {
				Checkout.setMail(FormDialog.inputvalue());
				FormDialog.kill();
				Session.setHash(str);
				Controlbar.start();
				inited = true;
				if (Controlbar.getState()=="browse") {
					openWall();
				}
				$("#start-screen").hide();
			}
		}
		function dialog_submit () {
			$.post( APP_ROOT + "vend-proofing-gateway.php", {
				action: 	"open_session",
				email: 		FormDialog.inputvalue().toLowerCase(),
				puid: 		Overlay.pageid()
			}, dialog_response);
		}
		function dialog_open () {
			var expiry = setup.expiry=="0" ? L10N.get("splash", "expiration_never") : setup.expiry;
			var expiry_text = setup.expired ? L10N.get("splash", "set_expired_on") + " " + expiry : L10N.get("splash", "set_expires_on") + " " + expiry;
			var session_desc = '<h2>' + setup.title + '</h2>';
			var session_footer;
				if ( welcome_str!="" ) {
					session_desc += welcome_str.split('{EXPIRY}').join(expiry_text);;
				}
				if ( intro_str!="" ) {
					session_footer = intro_str.split('{EXPIRY}').join(expiry_text);
				}
			FormDialog.options({
				markdown: 		true,
				bg_image: 		bg_image_arr,
				description: 	session_desc,
				footer: 		session_footer,
				prefill_variable_name: "vend_proofing_session_email_" + $("#container").attr("data-suid"),
				field_type: 	"email",
				field_label: 	L10N.get("general", "session_enter_email_address"),
				submit_label: 	L10N.get("general", "session_start_resume"),
				error_label: 	L10N.get("general", "session_invalid_email_address"),
				confirm_label: 	L10N.get("general", "dialog_confim"),
				submit: 		dialog_submit
			});
			FormDialog.draw();
		}
		function render () {
			StageProxy.addEventListener("onResize", resize);
			Overlay.addEventListener("onClose", onClose);
			Session.addEventListener("onSessionLoaded", onSessionLoaded);
			Session.addEventListener("onSessionCart", onSessionCart);
			Session.addEventListener("onSessionFavorites", onSessionFavorites);
			init();
			closeWall();
			dialog_open();
		}
		function appear () {
			Session.initialize();
			Controlbar.initialize();
		}
		function closeWall () {
			$("#image-wall-wrapper").hide();
		}
		function openWall () {
			$("#image-wall-wrapper").show();
			resize();
			reposition();
		}
		/* public methods
			*/
		this.initialize = function() {
			L10N = classes.helpers.L10N;
			Func = classes.helpers.Func;
			FormDialog = classes.elements.FormDialog;
			Graphic = classes.elements.Graphic;
			Checkout = classes.overlay.Checkout;
			Controlbar = classes.elements.Controlbar;
			StageProxy = classes.StageProxy;
			Overlay = classes.Overlay;
			Shell = classes.Shell;
			Session = classes.Session;
			render();
			resize();
			appear();
		};
		this.settings = function(obj) {
			if (obj) {
				setup = obj;
			}
			return setup;
		};
		this.setCoverImage = function(arr) {
			bg_image_arr = arr;
		};
		this.setIntroText = function(str) {
			intro_str = str;
		};
		this.setWelcomeText = function(str) {
			welcome_str = str;
		};
		this.showWall = function() {
			if (inited==false) return;
			openWall();
		};
		this.hideWall = function() {
			closeWall();
		};
		this.update = function() {
			refresh();
		};
	}
	return new Constructor();
}());
