
/*jslint browser: true, continue: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.overlay.Browser = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var StageProxy; // shortcut
		var Shell; // shortcut
		var Func; // shortcut
		var L10N; // shortcut
		var Overlay; // shortcut
		var Session; // shortcut
		var Sidebar; // shortcut
		var Controlbar; // shortcut
		var Graphic; // shortcut
		/* private properites
			*/
		var instance = 		this;
		var width = 		0;
		var height = 		0;
		var appx = 			0;
		var appy = 			0;
		var appwidth = 		0;
		var appheight = 	0;
		var maxwidth = 		1000;
		var maxheight = 	1000;
		var index = 		-1;
		var inited = 		false;
		var keylisten = 	true;
		var container;
		var inner;
		var paddles;
		var favorite = {
			ui: 			null,
			active: 		false,
			disabled: 		false,
			next: 			false,
			hash: 			""
		};
		var current = {
			layer: 			null,
			title: 			null,
			info: 			{},
			bounds: 		{}
		};
		var crop = {
			container: 		null,
			o: 				null,
			t: 				null,
			l: 				null,
			b: 				null,
			r: 				null,
			x_offset: 		50,
			y_offset: 		50,
			direction: 		"v",
			limits: 		{},
			width: 			0,
			height: 		0
		};
		var zoom = {
			container: 		null,
			img: 			null,
			ui: 			null,
			open: 			false,
			disabled: 		false,
			active: 		false,
			limits: 		{},
			width: 			0,
			height: 		0
		};
		/* private methods
			*/
		
		/* --- Crop Functions --- */
		function updateCropView () {
			if (!crop.o.position()) {
				return;
			}
			var outline_x = crop.o.position().left;
			var outline_y = crop.o.position().top;
			var outline_w = crop.o.outerWidth();
			var outline_h = crop.o.outerHeight();
			var image_width = appwidth;
			var image_height = appheight;
			var top_w = image_width;
			var top_h = outline_y;
			var left_w = outline_x;
			var left_h = image_height;
			var bottom_y = outline_y+outline_h;
			var bottom_w = image_width;
			var bottom_h = image_height-(outline_y+outline_h);
			var right_x = outline_x+outline_w;
			var right_w = image_width-(outline_x+outline_w);
			var right_h = image_height;
			crop.container.width(appwidth).height(appheight);
			crop.t.width(top_w).height(top_h);
			crop.l.width(left_w).height(left_h);
			crop.b.width(bottom_w).height(bottom_h).css("top", bottom_y);
			crop.r.width(right_w).height(right_h).css("left", right_x);
		}
		function stopCropDrag () {
			var x_offset = crop.direction=="h" ? (crop.o.position().left/crop.limits.right)*100 : 50;
			var y_offset = crop.direction=="v" ? (crop.o.position().top/crop.limits.bottom)*100 : 50;
			crop.x_offset = x_offset;
			crop.y_offset = y_offset;
			instance.dispatch("onCropMove", {x:x_offset, y:y_offset});
		}
		function drawCropView () {
			crop.container.hide();
			crop.o
				.drag(function (ev, dd) {
					$(this).css({
						left: Math.min(crop.limits.right, Math.max(crop.limits.left, dd.offsetX)),
						top: Math.min(crop.limits.bottom, Math.max(crop.limits.top, dd.offsetY))
					});
					updateCropView();
				}, { relative:true })
				.drag("end", stopCropDrag);
		}
		function updateCrop () {
			if (current.layer==null) {
				return;
			}
			var aspect = Sidebar.getFormatAspect();
			if (Sidebar.getOrientation()=="l") {
				aspect = 1/aspect;
			}
			var image_width = Math.round(current.bounds.right-current.bounds.left);
			var image_height = Math.round(current.bounds.bottom-current.bounds.top);
			var outline_x = Math.round(current.bounds.left);
			var outline_y = Math.round(current.bounds.top);
			var outline_h = image_height;
			var outline_w = Math.round(image_height*aspect);
				outline_x += Math.round((image_width-outline_w)*(crop.x_offset/100));
			if (outline_w>image_width) {
				outline_w = image_width;
				outline_h = Math.round(image_width/aspect);
				outline_x = Math.round(current.bounds.left);
				outline_y += Math.round((image_height-outline_h)*(crop.y_offset/100));
			}
			crop.direction = outline_w==image_width ? "v" : "h";
			crop.limits = {
				left: current.bounds.left,
				top: current.bounds.top,
				right: current.bounds.left+(image_width-outline_w),
				bottom: current.bounds.top+(image_height-outline_h)
			};
			crop.o
				.width(outline_w-2).height(outline_h-2)
				.css({
					left: outline_x,
					top: outline_y
				});
			updateCropView();
		}
		function hideCrop () {
			crop.x_offset = 50;
			crop.y_offset = 50;
			crop.container.hide();
			updateCrop();
		}
		function showCrop () {
			crop.container.show();
			updateCrop();
		}
		
		/* --- Zoom Functions --- */
		function drawZoom () {
			zoom.img
				.drag(function (ev, dd) {
					if (zoom.disabled) {
						return;
					}
					$(this).css({
						left: Math.min(zoom.limits.right, Math.max(zoom.limits.left, dd.offsetX)),
						top: Math.min(zoom.limits.bottom, Math.max(zoom.limits.top, dd.offsetY))
					});
				}, { relative:true });
		}
		function updateZoomIcon (forceoff) {
			zoom.ui.addClass("Off");
			zoom.ui.addClass("Disabled");
			zoom.disabled = true;
			if (forceoff==true) {
				return;
			}
			if (zoom.width<maxwidth||zoom.height<maxheight) {
				zoom.ui.removeClass("Off");
				zoom.ui.removeClass("Disabled");
				zoom.disabled = false;
			}
		}
		function closeZoom () {
			if (zoom.open==false) {
				return;
			}
			zoom.open = false;
			// broadcast it
			instance.dispatch("onZoomView", zoom.open);
			// hide it
			zoom.container.hide();
			// update button
			zoom.ui.removeClass("Active");
			// kill image
			zoom.img.attr("src", Func.getEmptyImgSrc());
		}
		function updateZoom () {
			if (zoom.open==false) {
				updateZoomIcon(false);
				return;
			}
			// set sizes
			zoom.container.css({
				width: zoom.width,
				height: zoom.height
			});
			zoom.img.css({
				left: Math.round((zoom.width-zoom.img.width())/2),
				top: Math.round((zoom.height-zoom.img.height())/2)
			});
			// drag points
			var left = zoom.width-zoom.img.width();
			var right = 0;
			if (left>0) {
				left = right = Math.round(left/2);
			}
			var top = zoom.height-zoom.img.height();
			var bottom = 0;
			if (top>0) {
				top = bottom = Math.round(top/2);
			}
			zoom.limits = {
				left: left,
				top: top,
				right: right,
				bottom: bottom
			};
			// force clsoe/disable the zoom
			var force = zoom.width>=zoom.img.width() && zoom.height>=zoom.img.height();
			updateZoomIcon(force);
			if (force) {
				closeZoom();
			}
		}
		function openZoom () {
			if (zoom.open==true) {
				return;
			}
			zoom.open = true;
			zoom.ui.addClass("Disabled");
			zoom.disabled = true;
			// broadcast it
			instance.dispatch("onZoomView", { open:zoom.open });
			// show it
			zoom.container.show();
			// update button
			zoom.ui.addClass("Active");
			// show loader
			zoom.container.progress();
			// load up the new image
			var graphic = new Graphic();
				graphic.provider(current.info);
				graphic.watermark(true);
				graphic.letterbox(true);
				graphic.setSize(maxwidth, maxheight);
			var iw = current.info.width;
			var ih = current.info.height;
			var nw = maxwidth;
			var nh = Math.round(nw*(ih/iw));
			if (nh>maxheight) {
				nh = maxheight;
				nw = Math.round(nh*(iw/ih));
			}
			zoom.img
				.css("opacity", 0)
				.attr("src", graphic.source())
				.width(nw).height(nh)
				.one('load', function () {
					// re-enable
					zoom.ui.removeClass("Disabled");
					zoom.disabled = false;
					// hide loader
					zoom.container.progress(true);
					// make this active, bring it to the front, and fade it up
					zoom.img.css("opacity", 1);
					// call the update first
					updateZoom();
				})
				.each(function(){
					if (this.complete) {
						$(this).load();
					}
				});
			// call the update first
			updateZoom();
		}
		function toggleZoom () {
			if (zoom.disabled) {
				return;
			}
			if (zoom.open==true) {
				closeZoom();
			} else if (zoom.open==false) {
				openZoom();
			}
		}
		
		function resize () {
			var sw = StageProxy.width();
			appx = 			0;
			appwidth = 		width;
			if (appwidth>maxwidth) {
				appwidth = maxwidth;
				appx = (width-appwidth)/2;
			}
			appy = 			44;
			appheight = 	height-44;
			if (appheight>maxheight) {
				appheight = maxheight;
				appy += (height-appheight-appy)/3;
			}
			if (sw<=800) {
				appy = 			0;
				appheight = 	height-50;
				if (appheight>maxheight) {
					appheight = maxheight;
					appy = (height-appheight)/2;
				}
			}
			container.css({
				width: width,
				height: height
			});
			inner.css({
				left: appx,
				top: appy,
				width: appwidth,
				height: appheight
			});
			paddles.css({
				left: appx*-1,
				top: appy*-1,
				width: width,
				height: height
			});
			zoom.width = appwidth;
			zoom.height = appheight;
			crop.width = appwidth;
			crop.height = appheight;
			if (!current.info) return;
			var sw, sh, iw, ih, nw, nh, nx, ny;
			if (current.layer!=null) {
				sw = appwidth;
				sh = appheight;
				iw = current.info.width;
				ih = current.info.height;
				nw = sw;
				nh = Math.round(nw*(ih/iw));
				if (nh>sh) {
					nh = sh;
					nw = Math.round(nh*(iw/ih));
				}
				nx = Math.round((sw-nw)/2);
				ny = Math.round((sh-nh)/2);
				current.layer
					.width(sw).height(sh)
					.find("img")
						.width(nw).height(nh)
						.css({
							left: nx,
							top: ny
						});
				current.bounds = {
					left: nx,
					top: ny,
					right: nx+nw,
					bottom: ny+nh
				};
				updateCrop();
				updateZoom();
			}
		}
		
		/* --- Favorite Functions --- */
		function disableFavorite () {
			favorite.ui.removeClass("Active");
			favorite.active = false;
		}
		function enableFavorite () {
			favorite.ui.addClass("Active");
			favorite.active = true;
		}
		function toggleFavorite () {
			if (favorite.disabled) {
				return;
			}
			if (favorite.active) {
				if (Overlay.getWallView()=="favorites") {
					disableFavorite();
					favorite.next = true;
					// kill zoom
					if (zoom.open==true) {
						zoom.ui.addClass("Disabled");
						zoom.disabled = true;
					}
					// negate any current images
					current.layer.find("img")
						.off()
						.css("opacity", 0)
						.data("original-src", "")
						.attr("src", Func.getEmptyImgSrc());
					current.title.html("---");
					hideCrop();
					resize();
				}
				Session.removeItem("favorites", favorite.hash);
			} else {
				var obj = {
					hash: favorite.hash,
					puid: current.info.parent,
					cuid: current.info.child,
					filename: current.info.filename,
					width: current.info.width,
					height: current.info.height
				};
				Session.addItem("favorites", obj);
			}
			favorite.ui.addClass("Disabled");
			favorite.disabled = true;
		}
		function favorites () {
			disableFavorite();
			if (favorite.next==true) {
				favorite.next = false;
				instance.refresh();
			}
			favorite.ui.removeClass("Disabled");
			favorite.disabled = false;
			var items = Session.getFavorites();
			var i, row, hash;
			for (i=0; i<items.length; ++i) {
				row = items[i];
				hash = md5(row.puid+row.cuid);
				if (hash==favorite.hash) {
					enableFavorite();
					break;
				}
			}
		}
		function openeditor () {
			Sidebar.abscond();
			container.addClass("Editor");
		}
		function closeeditor () {
			Sidebar.reveal();
			container.removeClass("Editor");
		}
		function sidebarevent () {
			Func.filter(current.layer.find("img"), Sidebar.getColorTone());
			if (Sidebar.getShowCrop()==false) {
				hideCrop();
				return;
			}
			showCrop();
		}
		function prev () {
			Overlay.prevBrowseIndex();
		}
		function next () {
			Overlay.nextBrowseIndex();
		}
		function close () {
			Overlay.close();
		}
		function reveal () {
			Sidebar.reveal();
		}
		function abscond () {
			Sidebar.abscond();
		}
		function killProgress () {
			current.layer.progress(true);
		}
		function keyevent (event) {
			if ( Controlbar.getState()!="browse" ) {
				return;
			}
			if ( Overlay.isOpen()==false ) {
				return;
			}
			if ( keylisten==false ) {
				return;
			}
			switch (event.which) {
				case 32 : // Key.SPACE :
				case 39 : // Key.RIGHT :
					$("#browser-hitarea-next, #browse-controlbar-next")
						.data("tooltip", "")
						.unbind("mouseenter")
						.unbind("mouseleave");
					$("#browse-controlbar-next")
						.click();
					break;
				case 37 : // Key.LEFT :
					$("#browser-hitarea-prev, #browse-controlbar-prev")
						.data("tooltip", "")
						.unbind("mouseenter")
						.unbind("mouseleave");
					$("#browse-controlbar-prev")
						.click();
					break;
				case 38 : // Key.UP :
				case 40 : // Key.DOWN :
					$("#browse-controlbar-fav")
						.data("tooltip", "")
						.unbind("mouseenter")
						.unbind("mouseleave")
						.click();
					break;
			}
			Func.stop(event);
			return false;
		}
		function drawControls () {
			$("#browser-hitarea-prev, #browse-controlbar-prev, #browser-hitarea-next, #browse-controlbar-next, #browse-controlbar-fs, #browse-controlbar-fav, #browse-controlbar-close, #browse-controlbar-options, #browse-controlbar-return, #browse-controlbar-return-icon, #browse-controlbar-done")
				.each(function () {
					var self = $(this);
					var tooltip = self.attr("data-tooltip");
					var func = self.attr("id");
						func = func.split("-");
						func = func.pop();
						switch (func) {
							case "prev" :
								func = prev;
								break;
							case "next" :
								func = next;
								break;
							case "fs" :
								func = toggleZoom;
								break;
							case "fav" :
								func = toggleFavorite;
								break;
							case "close" :
								func = close;
								break;
							case "options" :
								func = reveal;
								break;
							case "return" :
							case "icon" :
								func = abscond;
								break;
							case "done" :
								func = closeeditor;
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
							.click(function () {
								$(this).unbind("mouseenter").unbind("mouseleave");
								Shell.killToolTip();
								func();
							});
					} else {
						self.click(func);
					}
					self.addClass("Enabled")
				});
				if ( !Shell.device().touch ) {
					$("body").keydown(keyevent);
				} else {
					$("#browser-hitarea-prev, #browser-hitarea-next")
						.touchwipe({
							wipeLeft: next,
							wipeRight: prev
						});
				}
				// prevent scroll and touch
				container.bind("touchmove", Func.stop);
				container.mousewheel(Func.stop);
		}
		function draw () {
			maxwidth = 1000;
			maxheight = 1000;
			var classid = $("#container").attr("class");
			if (classid=="DropboxSet") {
				maxwidth = 1024;
				maxheight = 768;
			}
			//maxwidth = 500;
			//maxheight = 500;
			// cache some jquery lookups
			container = $("#overlay-browser");
			inner = $("#overlay-browser .Inner");
			paddles = $("#browser-paddles");
			input = $("#sidebar-input");
			current.title = $("#browse-controlbar-title");
			current.layer = container.find(".Display");
			crop.container = $("#browser-cropview");
			crop.o = $("#browser-cropview-o");
			crop.t = $("#browser-cropview-t");
			crop.l = $("#browser-cropview-l");
			crop.b = $("#browser-cropview-b");
			crop.r = $("#browser-cropview-r");
			zoom.container = $("#browser-zoom");
			zoom.img = $("#browser-zoom img");
			zoom.ui = $("#browse-controlbar-fs");
			favorite.ui = $("#browse-controlbar-fav");
			// draw up our controls
			drawControls();
			drawCropView();
			drawZoom();
		}
		function lateinit () {
			Session.addEventListener("onSessionFavorites", favorites);
			Sidebar.addEventListener("onChanged", sidebarevent);
			Sidebar.addEventListener("onImageModify", openeditor);
		}
		function init () {
			draw();
			resize();
		}
		function render () {
			init();
			setTimeout(lateinit, 33);
		}
		function onLoaded () {
			// hide loader
			if ($.browser.mozilla) {
				setTimeout(killProgress, 100);
			} else {
				killProgress();
			}
			// fade it up
			$(this).css("opacity", 1)
			// reset the zoom and appearance
			if (zoom.open==true) {
				zoom.container.hide();
				closeZoom();
				zoom.ui.removeClass("Disabled");
				zoom.disabled = false;
			}
			updateZoomIcon(false);
		}
		function showChild (i) {
			if ( i==-1 && index==-1 ) {
				return; // if we are already clear, skip it.
			}
			// set index
			index = i;
			// kill zoom
			if (zoom.open==true) {
				zoom.ui.addClass("Disabled");
				zoom.disabled = true;
			}
			// if we're clearing, stop here
			if (index==-1) {
				current.title.html("---");
				hideCrop();
				resize();
				current.info = {};
				favorite.hash = "";
				instance.dispatch("onIndex", index);
				return;
			}
			// get info
			current.info = Overlay.getImageInfo(index);
			if (!current.info) return;
			favorite.hash = md5(current.info.parent+current.info.child);
			instance.dispatch("onIndex", index);
			// load up the new image
			var sw = StageProxy.width();
			var ih = sw<=800 ? height : height-44;
			var multiplier = window.devicePixelRatio ? window.devicePixelRatio : 1;
			var rw = width;
			var rh = ih;
			if ( multiplier>1 ) {
				var rw = width*multiplier;
				if (rw>maxwidth) {
					rw = maxwidth;
				}
				var rh = ih*multiplier;
				if (rh>maxheight) {
					rh = maxheight;
				}
			}
			var graphic = new Graphic();
				graphic.provider(current.info);
				graphic.watermark(true);
				graphic.letterbox(true);
				graphic.setSize(rw, rh);
			current.layer.progress();
			current.layer.find("img")
				.off()
				.data("original-src", "")
				.attr("src", Func.getEmptyImgSrc())
				.attr("src", graphic.source())
				.one('load', onLoaded).each(function() {
					if (this.complete) {
						$(this).load();
					}
				});
			// change the label
			var filelabel = "";
			if (Overlay.getWallView()=="favorites") {
				filelabel += L10N.get("ordering", "favorites_label");
			}
			if (filelabel!="") {
				filelabel += ": ";
			}
			var filename = current.info.filename;
			var bits = filename.split(".");
				bits.pop();
				filename = bits.join(".");
			filelabel += filename;
			current.title.html(filelabel);
			// resize
			resize();
		}
		/* public methods
			*/
		this.freeKeys = function() {
			keylisten = false;
		};
		this.takeKeys = function() {
			keylisten = true;
		};
		this.hideCropView = function() {
			hideCrop();
		};
		this.showCropView = function() {
			showCrop();
		};
		this.refresh = function() {
			showChild(Overlay.getBrowseIndex());
			favorites();
			hideCrop();
		};
		this.clearStage = function() {
			closeZoom();
			showChild(-1);
		};
		this.move = function(x, y) {
			container.css({
				top: y,
				left: x
			});
		};
		this.setSize = function(w, h) {
			width = w;
			height = h;
			resize();
		};
		this.initialize = function() {
			Controlbar = classes.elements.Controlbar;
			StageProxy = classes.StageProxy;
			Graphic = classes.elements.Graphic;
			Func = classes.helpers.Func;
			L10N = classes.helpers.L10N;
			Overlay = classes.Overlay;
			Session = classes.Session;
			Shell = classes.Shell;
			Sidebar = classes.overlay.Sidebar;
			render();
		};
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());
