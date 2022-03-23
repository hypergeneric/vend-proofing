
/*jslint browser: true, continue: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.Overlay = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var StageProxy;
		var Session;
		var Shell;
		var Browser;
		var Clickwrap;
		var Sidebar;
		var Overview;
		var Packages;
		var Package;
		var Cart;
		var Controlbar;
		var Checkout;
		var Display;
		var ContactForm;
		var Func;
		/* private properites
			*/
		var instance = 		this;
		var suid = 			"";
		var classid = 		"";
		var status = 		"closed";
		var index = 		0;
		var browseindex = 	0;
		var browseview = 	"wall";
		var wallview = 		"set";
		var lastwidth = 	0;
		var lastheight = 	0;
		var tracks = [];
		var images = {};
		var groups = [];
		// jquery selectors
		var container;
		var screen;
		var skirt;
		/* private methods
			*/
		function closeOverlay () {
			status = "closed";
			container.hide();
			Browser.clearStage();
			Display.showWall();
			Shell.killToolTip();
			instance.dispatch("onClose");
		}
		function openOverlay () {
			status = "open";
			container.show();
			resize();
			Display.hideWall();
			instance.dispatch("onOpen");
		}
		function resize () {
			// set the height of the overlay depending on the available width
			var sw = StageProxy.width();
			var sh = StageProxy.height();
			if ( sw==lastwidth && lastheight==sh ) {
				return; // no need for resize
			}
			lastwidth = StageProxy.width();
			lastheight = StageProxy.height();
			// if it's hidden, unhide
			if (status=="closed") {
				container.show();
			}
			var ch = sw<=800 ? sh : sh-65;
			if ( $.browser.safari && $.browser.mobile ) {
				if ( window.orientation==90 || window.orientation==-90 ) {
					ch -= 44;
					if (sw<=480) ch -= 44;
				}
			}
			var innerwidth = sw;
			var innerheight = ch;
			container.width(innerwidth).height(innerheight);
			if (Shell.device().touch) {
				screen.width(innerwidth+100).height(innerheight+100);
			}
			skirt.css({
				top: innerheight
			});
			var sidebartop = 0;
			var sidebarheight = innerheight;
			var browsertop = 0;
			var browserheight = innerheight;
			var sidebarwidth = 0;
			var sidebarleft = innerwidth*-1;
			if (Sidebar.available()) {
				sidebarwidth = innerwidth-1024;
				if (sidebarwidth<350) {
					sidebarwidth = 350;
				}
				if (sidebarwidth>600) {
					sidebarwidth = 600;
				}
				sidebarleft = 0;
			}
			var browserleft = sidebarwidth;
			var browserwidth = innerwidth - sidebarwidth;
			if (innerwidth<=800) {
				sidebarwidth = innerwidth;
				sidebarleft = innerwidth*-1;
				browserwidth = innerwidth;
				browserleft = 0;
			}
			Sidebar.move(sidebarleft, sidebartop);
			Sidebar.setSize(sidebarwidth, sidebarheight);
			Browser.move(browserleft, browsertop);
			Browser.setSize(browserwidth, browserheight);
			if (status=="closed") {
				container.hide();
			}
		}
		function start () {
			lastwidth = 0;
			lastheight = 0;
			resize();
		}
		function render () {
			// assign all our jquery containers
			classid = 		$("#container").attr("class");
			suid = 			$("#container").attr("data-suid");
			container = 	$("#overlay-container");
			screen = 		$("#overlay-screen");
			skirt = 		$("#overlay-skirt");
			// initialize
			Browser.initialize();
			Cart.initialize();
			Checkout.initialize();
			Overview.initialize();
			Packages.initialize();
			Package.initialize();
			Sidebar.initialize();
			Clickwrap.initialize();
			ContactForm.initialize();
			// prevent scroll and touch
			screen.bind("touchmove", Func.stop);
			screen.mousewheel(Func.stop);
			// resize it at least once
			StageProxy.addEventListener("onResize", resize);
			Session.addEventListener("onSessionLoaded", start);
			resize();
		}
		
		function dataset () {
			var arr = [];
			if (wallview=="set") {
				arr = images[groups[index]];
			} else if (wallview=="favorites") {
				arr = Session.getFavoritesPaged(index);
				if (!arr) arr = [];
			}
			return arr;
		}
		function imagedata (i) {
			var set = dataset();
			var obj = set[i];
			var obj_hash;
			var obj_puid;
			var obj_cuid;
			var obj_filename;
			var obj_width;
			var obj_height;
			var obj_xoffset = 50;
			var obj_yoffset = 50;
			if (wallview=="set") {
				obj_puid = classid=="ZipFile" ? suid + ".zip" : suid;
				obj_cuid = obj.c;
				obj_hash = md5(obj_puid+obj_cuid);
				obj_filename = obj.f;
				obj_width = parseInt(obj.w, 10);
				obj_height = parseInt(obj.h, 10);
			} else if (wallview=="favorites") {
				obj_hash = obj.hash.substr(0, 32);
				obj_puid = obj.puid;
				obj_cuid = obj.cuid;
				obj_filename = obj.filename;
				obj_width = parseInt(obj.width, 10);
				obj_height = parseInt(obj.height, 10);
			}
			return {
				child: obj_cuid,
				parent: obj_puid,
				hash: obj_hash,
				type: obj_filename.substring(obj_filename.lastIndexOf(".")+1).toUpperCase(),
				src: obj_puid + "/" + obj_cuid,
				width: obj_width,
				height: obj_height,
				alt: obj_filename,
				xoffset: obj_xoffset,
				yoffset: obj_yoffset
			};
		}
		/* public methods
			*/
		this.pageid = function() {
			return suid;
		};
		this.close = function() {
			Controlbar.dispatch("onPageView", [ "browse", "wall", wallview, index, browseindex ]);
		};
		this.addImageSet = function(str, arr) {
			images[str] = arr;
			groups.push(str);
		};
		this.getImageCount = function(str, arr) {
			var tally = 0;
			for (var i=0; i<groups.length; ++i) {
				var group = groups[i];
				var set = images[group];
				tally += set.length;
			}
			return tally;
		};
		this.addAudioTrack = function(obj) {
			tracks.push(obj);
		};
		this.getPlaylist = function() {
			return tracks;
		};
		this.getViewProvider = function() {
			var set = dataset();
			var arr = [];
			var i;
			for (i=0; i<set.length; ++i) {
				arr.push(imagedata(i));
			}
			return arr;
		};
		this.getCurrentImage = function() {
			return this.getImageInfo(browseindex);
		};
		this.getImageInfo = function(i) {
			if (i==-1) {
				return;
			}
			var set = dataset();
			if (!set) return;
			var obj = set[i];
			if (!obj) return;
			if (wallview=="set") {
				return {
					parent: 	classid=="ZipFile"  ? suid + ".zip" : suid,
					child: 		obj.c,
					filename: 	obj.f,
					width: 		parseInt(obj.w, 10),
					height: 	parseInt(obj.h, 10)
				};
			}
			if (wallview=="favorites") {
				return {
					parent: 	obj.puid,
					child: 		obj.cuid,
					filename: 	obj.filename,
					width: 		parseInt(obj.width, 10),
					height: 	parseInt(obj.height, 10)
				};
			}
		};
		this.isOpen = function() {
			return status=="open";
		};
		this.getWallView = function() {
			return wallview;
		};
		this.setWallView = function(str) {
			wallview = str;
		};
		this.getIndex = function() {
			return index;
		};
		this.setIndex = function(num) {
			index = num;
		};
		this.getBrowseIndex = function() {
			return browseindex;
		};
		this.setBrowseIndex = function(num) {
			browseindex = num;
			Browser.refresh();
		};
		this.getBrowseView = function() {
			return browseview;
		};
		this.setBrowseView = function(str) {
			browseview = str;
			if (browseview=="wall") {
				closeOverlay();
			} else {
				openOverlay();
			}
		};
		this.getImageGroupCount = function() {
			if (wallview=="set") {
				return groups.length;
			} else if (wallview=="favorites") {
				var pages = Session.getFavoritesPaged();
				return pages.length;
			}
		};
		this.getMaxImageCount = function() {
			var max = Shell.device().touch ? 150 : 300;
			var prop;
			for (prop in images) {
				if (images.hasOwnProperty(prop)) {
					max = Math.max(max, images[prop].length);
				}
			}
			return max;
		};
		this.prevBrowseIndex = function() {
			var pages, current;
			var pi = index;
			var ii = browseindex-1;
			if (wallview=="set") {
				current = images[groups[pi]];
				if (ii==-1) { // at the end of our current page array
					if (groups.length>1) { // there are more pages
						pi = index-1; // next page index
						if (pi==-1) {
							pi = groups.length-1; // we're at the end of the pages, go back to first page
						}
						current = images[groups[pi]];
					}
					ii = current.length-1; // on any page change, the next browse index will be 0
				}
			} else if (wallview=="favorites") {
				pages = Session.getFavoritesPaged();
				current = pages[pi];
				if (ii==-1) { // at the end of our current page array
					if (pages.length>1) { // there are more pages
						pi = index-1; // next page index
						if (pi==-1) {
							pi = pages.length-1; // we're at the end of the pages, go back to first page
						}
						current = pages[pi];
					}
					ii = current.length-1; // on any page change, the next browse index will be 0
				}
			}
			Controlbar.dispatch("onPageView", [ "browse", "overlay", wallview, pi, ii ]);
		};
		this.nextBrowseIndex = function() {
			var pages, current;
			var pi = index;
			var ii = browseindex+1;
			if (wallview=="set") {
				current = images[groups[index]];
				if (ii>=current.length) { // at the end of our current page array
					if (groups.length>1) { // there are more pages
						pi = index+1; // next page index
						if (pi==groups.length) {
							pi = 0; // we're at the end of the pages, go back to first page
						}
					}
					ii = 0; // on any page change, the next browse index will be 0
				}
			} else if (wallview=="favorites") {
				pages = Session.getFavoritesPaged();
				current = pages[pi];
				if (ii>=current.length) { // at the end of our current page array
					if (pages.length>1) { // there are more pages
						pi = index+1; // next page index
						if (pi==pages.length) {
							pi = 0; // we're at the end of the pages, go back to first page
						}
					}
					ii = 0; // on any page change, the next browse index will be 0
				}
			}
			Controlbar.dispatch("onPageView", [ "browse", "overlay", wallview, pi, ii ]);
		};
		this.initialize = function() {
			Func = classes.helpers.Func;
			StageProxy = classes.StageProxy;
			Shell = classes.Shell;
			Session = classes.Session;
			Browser = classes.overlay.Browser;
			Clickwrap = classes.overlay.Clickwrap;
			Sidebar = classes.overlay.Sidebar;
			Packages = classes.overlay.Packages;
			Overview = classes.overlay.Overview;
			Package = classes.overlay.Package;
			Cart = classes.overlay.Cart;
			Controlbar = classes.elements.Controlbar;
			Checkout = classes.overlay.Checkout;
			ContactForm = classes.elements.ContactForm;
			Display = classes.content.Display;
			render();
		};
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());
