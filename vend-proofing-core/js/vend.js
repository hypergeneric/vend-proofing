
/*jslint browser: true, continue: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.helpers.Cookie = (function () {
	function Constructor () {
		/* public methods
			*/
		this.set = function(name, value, days, path) {
			if (!path) {
				path = location.pathname.split("/");
				path.pop();
				path = path.join("/") + "/";
			}
			var expires = "";
			if (days) {
				var date = new Date();
				date.setTime(date.getTime()+(days*24*60*60*1000));
				expires = "; expires="+date.toGMTString();
			}
			document.cookie = name+"="+value+expires+"; path=" + path;
		};
		this.get = function(name) {
			var nameEQ = name + "=";
			var ca = document.cookie.split(';');
			var i, c;
			for(i=0; i< ca.length; i++) {
				c = ca[i];
				while (c.charAt(0)==' ') {
					c = c.substring(1, c.length);
				}
				if (c.indexOf(nameEQ) == 0) {
					return c.substring(nameEQ.length, c.length);
				}
			}
			return "";
		};
		this.kill = function(name, path) {
			if (!path) {
				path = location.pathname.split("/");
				path.pop();
				path = path.join("/") + "/";
			}
			this.set(name,"",-1, path);
		};
	}
	return new Constructor();
}());

/*jslint browser: true, continue: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

// http://www.nonobtrusive.com/2009/07/24/custom-events-in-javascript-by-making-your-own-dispatcher-class/

function EventDispatcher() {
	this.events=[];
}
EventDispatcher.prototype.addEventListener = function(event, callback, caller) {
	this.events[event] = this.events[event] || [];
	if ( this.events[event] ) {
		this.events[event].push({
			callback : callback,
			caller : caller
		});
	}
};
EventDispatcher.prototype.removeEventListener = function(event, callback) {
	if ( this.events[event] ) {
		var listeners = this.events[event];
		var i;
		for ( i = listeners.length-1; i>=0; --i ){
			//console.log(listeners[i]);
			if ( listeners[i].callback === callback ) {
				listeners.splice( i, 1 );
				return true;
			}
		}
	}
	return false;
};
EventDispatcher.prototype.dispatch = function(event, data) {
	data = data || {};
	if(this.events[event]) {
		var listeners = this.events[event];
		var len = listeners.length;
		while(len--) {
			listeners[len].callback(data, listeners[len].caller);
		}
	}
};

/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.helpers.Func = (function () {
	function Constructor () {
		/* private properites
			*/
		var browser_title_pattern = "";
		var filtersepia = {
			r: [0.211836996078431,0.712355450980392,0.0718859843137255],
			g: [0.198492933333333,0.667482666666667,0.0673577333333333],
			b: [0.190986898039216,0.642241725490196,0.0648105921568627]
		};
		var filtermono = {
			r: [0.212671,0.71516,0.072169],
			g: [0.212671,0.71516,0.072169],
			b: [0.212671,0.71516,0.072169]
		};
		/* private methods
			*/
		function filterexec (img, tone) {
			if ( img.width==0 || img.height==0 ) {
				return;
			}
			var canvas = document.createElement('canvas');
			var context = canvas.getContext('2d');
			canvas.width = img.width;
			canvas.height = img.height;
			context.drawImage(img, 0, 0);
			var imgdata = context.getImageData(0, 0, canvas.width, canvas.height);
			var matrix = tone=="sepia" ? filtersepia : filtermono;
			var pixels = imgdata.data;
			var i, n, shift_r, shift_g, shift_b;
			for (i = 0, n = pixels.length; i < n; i += 4) {
				shift_r = pixels[i] * matrix.r[0] + pixels[i+1] * matrix.r[1] + pixels[i+2] * matrix.r[2];
				shift_g = pixels[i] * matrix.g[0] + pixels[i+1] * matrix.g[1] + pixels[i+2] * matrix.g[2];
				shift_b = pixels[i] * matrix.b[0] + pixels[i+1] * matrix.b[1] + pixels[i+2] * matrix.b[2];
				pixels[i] = shift_r;
				pixels[i+1] = shift_g;
				pixels[i+2] = shift_b;
			}
			context.putImageData(imgdata, 0, 0);
			return canvas.toDataURL();
		}
		/* public methods
			*/
		this.array_chunk = function(arr, len) {
			var chunks = [],
				i = 0,
				n = arr.length,
				start, end;
			while (i < n) {
				start = i;
				end = i + len;
				chunks.push(arr.slice(start, end));
				i += len;
			}
			return chunks;
		};
		this.setDocumentTitlePattern = function(str) {
			browser_title_pattern = str;
		};
		this.setDocumentTitle = function(title) {
			if (!title) {
				title = "";
			}
			var browser_title = browser_title_pattern.split("{PAGE_NAME}").join(title);
			document.title = browser_title;
		};
		this.getEmptyImgSrc = function() {
			return "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
		};
		this.addSalesTax = function(taxable_amount) {
			var default_country = classes.overlay.Checkout.settings().country;
			var taxes = classes.overlay.Checkout.getTaxRate();
			var tax_value;
			if (default_country=="US") {
				tax_value = taxable_amount*(taxes[0]/100);
				return taxable_amount + tax_value;
			}
			if (default_country=="CA") {
				var hst_value = taxable_amount*(taxes[0]/100);
				var gst_value = taxable_amount*(taxes[1]/100);
					if (taxes[3]==true) {
						taxable_amount += gst_value;
					}
				var pst_value = taxable_amount*(taxes[2]/100);
				return taxable_amount + hst_value + gst_value + pst_value;
			}
			tax_value = taxable_amount*(taxes[0]/100);
			return taxable_amount + tax_value;
		};
		this.getFormattedPrice = function(value) {
			var isNegative = value<0;
			value = Math.abs(value);
			var digitsAfterDecimal = classes.helpers.L10N.get("localization", "currency_digits_after_decimal_num");
			var displayLeadingZeros = classes.helpers.L10N.get("localization", "currency_display_leading_zeros_bool");
			var leadingZeroDigits = classes.helpers.L10N.get("localization", "currency_leading_zero_digits_num");
			var digitsPerGroup = classes.helpers.L10N.get("localization", "currency_digits_per_group_num");
			var groupingSymbol = classes.helpers.L10N.get("localization", "currency_grouping_symbol");
			var decimalSymbol = classes.helpers.L10N.get("localization", "currency_decimal_symbol");
			var negativePattern = classes.helpers.L10N.get("localization", "currency_negative_pattern");
			var currencyPattern = classes.helpers.L10N.get("localization", "currency_currency_pattern");
			var vstr = value.toFixed(digitsAfterDecimal);
			var sides = vstr.split(".");
			var digits;
			var length;
			var i;
			digits = sides[0].split("");
			if (displayLeadingZeros) {
				length = leadingZeroDigits-digits.length;
				if (length>0) {
					for (i=0; i<length; ++i) {
						digits.unshift("0");
					}
				}
			}
			var groups = [];
			var chunk = digits.splice(-3).reverse().join("");
			groups.push(chunk);
			length = digitsPerGroup;
			chunk = "";
			var empty = digits.length==0;
			while (!empty) {
				if (digits.length<length) {
					length = digits.length;
				}
				for (i=0; i<length; ++i) {
					if (i>=0) {
						chunk += digits.pop();
					}
				}
				if (chunk.length==length) {
					groups.push(chunk);
					chunk = "";
				}
				empty = digits.length==0;
			}
			groups = groups.join(groupingSymbol);
			groups = groups.split("");
			groups.reverse();
			sides[0] = groups.join("");
			var result = sides.join(decimalSymbol);
			if (isNegative) {
				result = negativePattern.split("#").join(result);
			}
			result = currencyPattern.split("#").join(result);
			return result;
		};
		this.filter = function(obj, tone) {
			if (tone=="") {
				if (obj.data("original-src")) {
					obj.attr("src", obj.data("original-src"));
					obj.removeAttr("original-src");
				}
				return;
			}
			var imgsrc = obj.data("original-src") || obj.attr("src");
			var img = new Image();
			img.src = imgsrc;
			if (img.width==0||img.height==0) {
				img.onload = function () {
					obj.data("original-src", this.src);
					obj.attr("src", filterexec(this, tone));
				};
			} else {
				obj.data("original-src", imgsrc);
				obj.attr("src", filterexec(img, tone));
			}
		};
		this.stop = function(event) {
			event.stopPropagation();
			event.preventDefault();
		};
		this.prevent = function(event) {
			event.preventDefault();
		};
		this.empty = function() {
			return null;
		};
		this.imgonload = function() {
			if(this.complete) {
				$(this).load();
			}
		};
		this.touchboundsstart = function(event) {
			this.allowUp = (this.scrollTop > 0);
			this.allowDown = (this.scrollTop < this.scrollHeight - this.clientHeight);
			this.prevTop = null; this.prevBot = null;
			this.lastY = event.pageY;
		};
		this.touchboundsmove = function(event) {
			var up = (event.pageY > this.lastY), down = !up;
			this.lastY = event.pageY;
			if ((up && this.allowUp) || (down && this.allowDown)) event.stopPropagation();
			else event.preventDefault();
		};
	}
	return new Constructor();
}());

	classes.helpers.ResampledImageQueue = new function () {
		var _multiplier = 			Math.min(3, Math.ceil(window.devicePixelRatio ? window.devicePixelRatio : 1)) + "x";
		var _use_srcset = 			false;
		var _image_list = 			[];
		var _image_loader = 		null;
		var _image_loader_index = 	-1;
		var _image_loader_loading = false;
		var _image_offset = 		null;
		var _image_offset_timer = 	0;
		function cancelLazyLoading () {
			var img = _image_list[_image_loader_index];
			if (img) {
				img.off();
				clearInterval(_image_loader);
			}
		}
		function lazyError () {
			var img = _image_list[_image_loader_index];
			img.attr("src", img.data("blank"));
		}
		function lazyLoaded () {
			clearInterval(_image_loader);
			_image_loader = setTimeout(lazyLoadNext, 1);
		}
		function offsetLoaded () {
			_image_offset_timer += 1;
			clearInterval(_image_offset);
			_image_offset = setTimeout(lazyLoadNext, _image_offset_timer);
		}
		function lazyComplete () {
			if( this.complete ) {
				$(this).load();
			}
		}
		function getProbableSrc (img) {
			if (_use_srcset) {
				var lookup = [];
				var srcs = img.attr("data-srcset").split(", ");
				for (var i=0; i<srcs.length; ++i) {
					var set = srcs[i].split(" ");
					lookup[set[1]] = set[0];
				}
				return lookup[_multiplier];
			} else {
				return img.attr("data-src");
			}
		}
		function lazyLoadNext () {
			_image_loader_index = _image_loader_index + 1;
			if (_image_loader_index==_image_list.length) {
				_image_loader_index = _image_loader_index - 1
				_image_loader_loading = false;
				return;
			}
			_image_loader_loading = true;
			var img = _image_list[_image_loader_index];
			var blank = img.attr("src");
			var srcset = img.attr("data-srcset");
			var src = getProbableSrc(img);
			var lazyload = src.indexOf("resample.php")!=-1;
			img
				.removeProp("src")
				.data("blank", blank)
				.one('error', lazyError);
			if (lazyload) {
				if (_use_srcset) {
					img
						.attr("srcset", srcset)
						.one('load', lazyLoaded)
						.each(lazyComplete);
				} else {
					img
						.attr("src", src)
						.one('load', lazyLoaded)
						.each(lazyComplete);
				}
			} else {
				if (_use_srcset) {
					img.attr("srcset", srcset);
				} else {
					img.attr("src", src);
				}
				offsetLoaded();
			}
		}
		function lazyLoad (img) {
			if ( img.attr("data-src")!=undefined ) {
				_image_list.push(img);
				if (_image_loader_loading==false) {
					lazyLoadNext();
				}
			}
		}
		this.addObject = function (obj) {
			obj.each(function () {
				lazyLoad($(this));
			});
		};
		this.start = function () {
			var img = new Image();
			_use_srcset = 'srcset' in img;
		};
	};
	
/*jslint browser: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.Dialog = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var StageProxy;
		var L10N;
		var Shell;
		var Func;
		/* private properites
			*/
		var defaults = {
			unique: 			"",
			modal: 				true,
			title: 				"",
			description: 		"",
			confim: 			classes.helpers.Func.empty,
			cancel: 			classes.helpers.Func.empty,
			args: 				[]
		};
		var opt = {};
		var instance = this;
		var open = false;
		var noremind = {};
		// jquery cache
		var container;
		var screen;
		var dialog;
		var title;
		var description;
		var accept_obj;
		var cancel_obj;
		var noremind_obj;
		/* private methods
			*/
		function confirm () {
			opt.confim.apply(null, opt.args);
		}
		function cancel () {
			opt.cancel.apply(null, opt.args);
		}
		function remeber (bool) {
			if (bool) {
				noremind[opt.unique] = true;
			} else {
				noremind[opt.unique] = false;
			}
		}
		function keyevent (event) {
			if (open) {
				switch (event.which) {
					case 13 : // Key.ENTER :
						confirm();
						Func.stop(event);
						return false;
				}
			}
		}
		function ondestroy () {
			open = false;
			instance.dispatch("onClose");
		}
		function destroy () {
			// ditch the options
			opt = {};
			// and bye bye
			container.fadeOut("fast", ondestroy);
		}
		function click (event) {
			switch ($(this).attr("id")) {
				case noremind_obj.attr("id") :
					remeber(noremind_obj.is(':checked'));
					break;
				case accept_obj.attr("id") :
					confirm();
					destroy();
					break;
				case screen.attr("id") :
					break;
				case cancel_obj.attr("id") :
					cancel();
					destroy();
					break;
			}
			Func.stop(event);
			return false;
		}
		function resize () {
			if (!open) {
				container.show();
			}
			var sw = StageProxy.width();
			var sh = StageProxy.height();
			var dw = dialog.width();
			var dh = dialog.outerHeight();
			dialog.css({
				top: (sh-dh)/2,
				left: (sw-dw)/2
			});
			if (!open) {
				container.hide();
			}
		}
		function create () {
			// title
			title
				.html(opt.title)
				.toggle(opt.title!="");
			// description
			description
				.html(opt.description)
				.toggle(opt.description!="");
			// modal means there is a true/false
			if (opt.modal) {
				accept_obj.html(L10N.get("general", "dialog_approve"));
				cancel_obj.show();
			} else { // only confirm
				accept_obj.html(L10N.get("general", "dialog_confim"));
				cancel_obj.hide();
			}
			noremind_obj.toggle(opt.unique!="");
			noremind_label_obj.toggle(opt.unique!="");
			// display it's initial state
			open = true;
			container.fadeIn("fast");
			// resize
			resize();
			instance.dispatch("onOpen");
		}
		function render () {
			// assign jquery selectors
			container = 	$("#dialog-container");
			screen = 		$("#dialog-screen");
			dialog = 		$("#dialog");
			title = 		$("#dialog-title");
			description = 	$("#dialog-description");
			accept_obj = 	$("#dialog-accept");
			cancel_obj = 	$("#dialog-cancel");
			noremind_obj = 	$("#dialog-noremind");
			noremind_label_obj = 	$("#dialog-noremind-label");
			// submit
			screen.click(click);
			accept_obj.click(click);
			cancel_obj.click(click);
			noremind_obj.change(click);
			// listen to stage
			if (!Shell.device().touch) {
				container.mousewheel(Func.stop);
			} else {
				container.bind("touchmove", Func.stop);
			}
			$("body").keyup(keyevent);
			StageProxy.addEventListener("onResize", resize);
		}
		/* public methods
			*/
		this.options = function(obj) {
			var prop;
			for (prop in defaults) {
				if (defaults.hasOwnProperty(prop)) {
					opt[prop] = defaults[prop];
				}
			}
			for (prop in obj) {
				if (obj.hasOwnProperty(prop)) {
					opt[prop] = obj[prop];
				}
			}
		};
		this.draw = function() {
			if (noremind[opt.unique]==true) {
				confirm();
				return;
			}
			create();
		};
		this.initialize = function () {
			Func = classes.helpers.Func;
			L10N = classes.helpers.L10N;
			StageProxy = classes.StageProxy;
			Shell = classes.Shell;
			render();
		};
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());

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

/*jslint browser: true, continue: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.Session = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var Checkout; // shortcut
		var Overlay; // shortcut
		var Func; // shortcut
		/* private properites
			*/
		var instance = this;
		var hash = "";
		var request_id = -1;
		var requests = {};
		var type_lookup = {
			cart: [],
			cart_chunked: [],
			download: [],
			download_chunked: [],
			favorites: [],
			favorites_chunked: [],
			package: [],
			parsed: []
		};
		var type_hashtable = {
			cart: {},
			download: {},
			favorites: {},
			package: {},
			parsed: {}
		};
		var type_keys = {
			cart: [
				"hash", "puid", "cuid", // 0 1 2
				"filename", "quantity", "toning", // 3 4 5
				"format_label", "format_aspect", "format_price", "format_shipping", // 6 7 8 9
				"orientation", "orientation_x", "orientation_y", // 10 11 12
				"paper_label", "paper_price", "paper_shipping", // 13 14 15
				"modifier_label", "modifier_price", "modifier_shipping", // 16 17 18
				"subtotal", "shipping", // 19 20
				"comments" // 21
				],
			download: [
				"hash", "puid", "cuid", // 0 1 2
				"filename", "dimensions", "quality", // 3 4 5
				"subtotal", "allprice" // 6 7
				],
			favorites: [
				"hash", "puid", "cuid", // 0 1 2
				"filename", "width", "height" // 3 4 5
				],
			package: [
				"hash", "type", "nickname", "title",// 0 1 2 3
				"quantity", "subtotal", "shipping", // 4 5 6
				"format_titles", // 7
				"format_quantities", // 8
				"format_aspects", // 9
				"format_areas" // 10
				]
		};
		/* private methods
			*/
		function chunk (label) {
			var arr = type_lookup[label];
			var page_breakpoint = Overlay.getMaxImageCount();
			var chunks = [];
			if (arr.length<=page_breakpoint) {
				chunks.push(arr);
			} else {
				chunks = Func.array_chunk(arr, page_breakpoint);
			}
			type_lookup[label+"_chunked"] = chunks;
		}
		function parse (result, ruid) {
			if (result=="0") {
				result = "";
			}
			var request = requests[ruid];
			//trace ("type:" + request.type);
			//trace ("result: " + result);
			var types = [];
				if (request.type=="favorites" || request.type=="*") {
					types.push("favorites");
				}
				if (request.type=="download" || request.type=="alacarte" || request.type=="cart" || request.type=="package" || request.type=="*") {
					types.push("package");
					types.push("cart");
					types.push("download");
				}
			// low-level string parsing
			var lines = result=="" ? [] : result.split("\n");
			var rows = [];
			var i, line, values, suid, type;
			for (i=0; i<lines.length; ++i) {
				line = lines[i];
				values = line.split("\t");
				suid = values[0].split("-");
				type = "cart";
				if (suid[1]=="f") {
					type = "favorites";
				}
				if (suid[1]=="p") {
					type = "package";
				}
				if (suid[1]=="d") {
					type = "download";
				}
				rows.push({
					type: type,
					values: values
				});
			}
			// parse out all the bits and pieces
			var k, j, keys, data, table, row, obj, key, value;
			for (k=0; k<types.length; ++k) {
				type = types[k];
				keys = type_keys[type];
				data = [];
				table = {};
				for (i=0; i<rows.length; ++i) {
					row = rows[i];
					if (row.type!=type) {
						continue;
					}
					values = row.values;
					obj = {};
					for (j=0; j<keys.length; ++j) {
						key = keys[j];
						value = values[j];
						if (value==undefined) {
							value = "";
						}
						obj[key] = value;
					}
					data.push(obj);
					table[obj.hash] = obj;
				}
				type_lookup[type] = data;
				type_hashtable[type] = table;
			}
			// do a custom parse for packages
			if (request.type=="cart" || request.type=="package" || request.type=="*") {
				var package_lookup = [];
				var packages = type_lookup["package"];
				type_lookup.parsed = [];
				var pkg, total, formats, lookup, format_percent_encoded, format_titles, format_quantities, format_aspects, format_areas, format_title, format_hash, format_quantity;
				for (i=0; i<packages.length; ++i) {
					pkg = packages[i];
					total = 0;
					formats = [];
					lookup = {};
					format_percent_encoded = false;
					format_titles = pkg.format_titles;
					if (pkg.format_titles.substr(0, 2)=="%:") {
						format_percent_encoded = true;
						format_titles = pkg.format_titles.substr(2);
					}
					format_titles = format_titles=="" ? [] : format_titles.split(",");
					format_quantities = pkg.format_quantities.split(",");
					format_aspects = pkg.format_aspects.split(",");
					format_areas = pkg.format_areas.split(",");
					for (j=0; j<format_titles.length; ++j) {
						format_title = format_percent_encoded ? unescape(format_titles[j]) : $.base64.decode(format_titles[j]);
						format_hash = md5(format_title);
						format_quantity = parseInt(format_quantities[j], 10);
						total += format_quantity;
						lookup[format_hash] = j;
						formats.push({
							title: format_title,
							price: 0,
							shipping: 0,
							aspect: format_aspects[j],
							area: format_areas[j],
							total: format_quantity,
							count: 0
						});
					}
					package_lookup[pkg.hash] = i;
					type_lookup.parsed.push({
						row: pkg,
						formats: formats,
						lookup: lookup,
						total: total,
						count: 0
					});
				}
				var cart = type_lookup.cart;
				var hashbits, package_hash, format, quantity;
				for (i=0; i<cart.length; ++i) {
					row = cart[i];
					if (row.hash.indexOf(":")!=-1) {
						hashbits = row.hash.split(":");
						package_hash = hashbits[1] + "-p";
						format_hash = md5(row.format_label);
						quantity = parseInt(row.quantity, 10);
						pkg = type_lookup.parsed[package_lookup[package_hash]];
						format = pkg.formats[pkg.lookup[format_hash]];
						pkg.count += quantity;
						format.count += quantity;
					}
				}
			}
			if (request.type=="favorites") {
				chunk("favorites");
				instance.dispatch("onSessionFavorites");
			}
			if (request.type=="download" || request.type=="alacarte" || request.type=="cart" || request.type=="package") {
				chunk("cart");
				chunk("download");
				instance.dispatch("onSessionCart");
			}
			if (request.type=="*") {
				chunk("favorites");
				chunk("download");
				chunk("cart");
				instance.dispatch("onSessionLoaded");
			}
			delete requests[ruid];
		}
		function addSessionObject (type, data) {
			if (data.hash==undefined) {
				return;
			}
			// generate new row
			var keys = type_keys[type];
			var postfix = "";
				if (type=="favorites") {
					postfix = "-f";
				}
				if (type=="download") {
					postfix = "-d";
				}
				if (type=="package") {
					postfix = "-p";
				}
			var row = [];
			var i, key, value;
			for (i=0; i<keys.length; ++i) {
				key = keys[i];
				value = data[key];
				if (value==undefined) {
					value = "";
				}
				row.push(value);
			}
			row[0] = row[0] + postfix;
			// add it to the session table
			++request_id;
			var ruid = "r_"+request_id;
			var request = {
				action: 	"update_session_item",
				type: 		type,
				name: 		hash,
				puid: 		Overlay.pageid(),
				data:		row.join("\t")
			};
			requests[ruid] = request;
			$.post( APP_ROOT + "vend-proofing-gateway.php", request, function (str) {
				parse(str, ruid);
			});
		}
		function removeSessionObject (type, suid) {
			var data;
			var found = false;
			var lookup = type_lookup[type];
			var i;
			for (i=0; i<lookup.length; ++i) {
				data = lookup[i];
				if (data.hash.indexOf(suid)!=-1) {
					found = true;
					break;
				}
			}
			if (found==false) {
				return;
			}
			// add it to the session table
			++request_id;
			var ruid = "r_"+request_id;
			var request = {
				action: 	"delete_session_item",
				type: 	type,
				name: 	hash,
				puid: 	Overlay.pageid(),
				suid:		data.hash
			};
			requests[ruid] = request;
			$.post( APP_ROOT + "vend-proofing-gateway.php", request, function (str) {
				parse(str, ruid);
			});
		}
		function updateSessionObject (type, suid, names, values) {
			// get the lineitem we're working with
			var data;
			var found = false;
			var lookup = type_lookup[type];
			var i;
			for (i=0; i<lookup.length; ++i) {
				data = lookup[i];
				if (data.hash.indexOf(suid)!=-1) {
					found = true;
					break;
				}
			}
			if (found==false) {
				return;
			}
			// if not arrays, let's make them arrays
			if (!(names instanceof Array)) {
				names = [names];
				values = [values];
			}
			// update key values for each item we're updating
			var keys = type_keys[type];
			var row = [];
			var postfix = "";
				if (type=="download") {
					postfix = "-d";
				}
				if (type=="favorites") {
					postfix = "-f";
				}
				if (type=="package") {
					postfix = "-p";
				}
			var j, key, value;
			for (i=0; i<keys.length; ++i) {
				key = keys[i];
				value = data[key];
				for (j=0; j<names.length; ++j) {
					if (key==names[j]) {
						value = values[j];
					}
				}
				if (value==undefined) {
					value = "";
				}
				row.push(value);
			}
			row[0] = row[0] + postfix;
			// add it to the session table
			++request_id;
			var ruid = "r_"+request_id;
			var request = {
				action: 	"update_session_item",
				type: 		type,
				name: 		hash,
				puid: 		Overlay.pageid(),
				data:		row.join("\t")
			};
			requests[ruid] = request;
			$.post( APP_ROOT + "vend-proofing-gateway.php", request, function (str) {
				parse(str, ruid);
			});
		}
		function addAllOfType (group, quality) {
			++request_id;
			var ruid = "r_"+request_id;
			var price = group=="cart" ? Checkout.settings().downloads.all[quality] : Checkout.settings().downloads[quality].price;
			var flat = group=="cart" && Checkout.settings().downloads.all.flat ? "true" : "false";
			var request = {
				action: 	"add_all_of_type",
				name: 		hash,
				type: 		"download",
				group: 		group,
				quality: 	quality,
				price: 		price,
				flat: 		flat,
				puid: 		Overlay.pageid()
			};
			requests[ruid] = request;
			$.post( APP_ROOT + "vend-proofing-gateway.php", request, function (str) {
				parse(str, ruid);
			});
		}
		function clearSessionType (type) {
			instance.dispatch("onLoadSession");
			++request_id;
			var ruid = "r_"+request_id;
			var request = {
				action: 	"delete_session_type",
				type: 		type,
				name: 		hash,
				puid: 		Overlay.pageid()
			};
			requests[ruid] = request;
			$.post( APP_ROOT + "vend-proofing-gateway.php", request, function (str) {
				parse(str, ruid);
			});
		}
		function loadSession () {
			++request_id;
			var ruid = "r_"+request_id;
			var request = {
				action: 	"list_session_table",
				type: 		"*",
				name: 		hash,
				puid: 		Overlay.pageid()
			};
			$.post( APP_ROOT + "vend-proofing-gateway.php", request, function (str) {
				parse(str, ruid);
			});
			requests[ruid] = request;
		}
		/* public methods
			*/
		this.addItem = function(type, data) { // type:String, data:Object
			addSessionObject(type, data);
		};
		this.removeItem = function(type, suid) { // type:String, suid:String
			removeSessionObject(type, suid);
		};
		this.updateItem = function(type, suid, names, values) { // type:String, suid:String, names, values
			updateSessionObject(type, suid, names, values);
		};
		this.purge = function(type) { // type:String
			clearSessionType(type);
		};
		
		this.isFavoritesEmpty = function() { // return:Boolean
			return type_lookup.favorites.length==0;
		};
		this.getFavoritesLength = function() { // return:Array
			return type_lookup.favorites.length;
		};
		this.getFavoritesPaged = function(i) { // return:Array
			return i==undefined || i==-1 ? type_lookup.favorites_chunked : type_lookup.favorites_chunked[i];
		};
		this.getFavorites = function() { // return:Array
			return type_lookup.favorites;
		};
		this.getFavoritesTable = function() { // return:Object
			return type_hashtable.favorites;
		};
		this.getFavoriteObject = function(hash) { // return:Object
			return type_hashtable.favorites[hash];
		};
		
		this.isCartEmpty = function() { // return:Boolean
			return type_lookup.cart.length==0;
		};
		this.getCartLength = function() { // return:Number
			return type_lookup.cart.length;
		};
		this.getCartPaged = function(i) { // return:Array
			return i==undefined || i==-1 ? type_lookup.cart_chunked : type_lookup.cart_chunked[i];
		};
		this.getCart = function() { // return:Array
			return type_lookup.cart;
		};
		this.getCartTable = function() { // return:Object
			return type_hashtable.cart;
		};
		this.getCartObject = function(hash) { // return:Object
			return type_hashtable.cart[hash];
		};
		
		this.downloadAll = function(group, quality) { // group:String, quality:Object
			addAllOfType(group, quality);
		};
		this.isDownloadsEmpty = function() { // return:Boolean
			return type_lookup.download.length==0;
		};
		this.getDownloadsLength = function() { // return:Number
			return type_lookup.download.length;
		};
		this.getDownloadsPaged = function(i) { // return:Array
			return i==undefined || i==-1 ? type_lookup.download_chunked : type_lookup.download_chunked[i];
		};
		this.getDownloads = function() { // return:Array
			return type_lookup.download;
		};
		this.getDownloadsTable = function() { // return:Array
			return type_hashtable.download;
		};
		this.getDownloadObject = function(hash) { // return:Object
			return type_hashtable.download[hash];
		};
		
		this.getPackages = function() { // return:Array
			return type_lookup.package;
		};
		this.getPackagesLength = function() { // return:Number
			return type_lookup.package.length;
		};
		this.getPackagesParsed = function() { // return:Array
			return type_lookup.parsed;
		};
		
		this.getHash = function() { // return:String
			return hash;
		};
		this.setHash = function(str) { // str:String
			hash = str;
			loadSession();
		};
		
		this.initialize = function() {
			Checkout = classes.overlay.Checkout;
			Overlay = classes.Overlay;
			Func = classes.helpers.Func;
		};
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());

/*jslint browser: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.Shell = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var StageProxy;
		var Dialog;
		var FormDialog;
		var Overlay;
		var Content;
		var L10N;
		var Func;
		/* private properites
			*/
		var tooltip;
		var tooltip_visible = false;
		var body;
		var error;
		var error_inner;
		var classname = "";
		var setup = {};
		/* private methods
			*/
		function ttposition (event) {
			if (!tooltip_visible) {
				return;
			}
			var mousex = event.pageX + 5;
			var mousey = event.pageY - (tooltip.outerHeight()+5);
			if ( mousex + tooltip.outerWidth() > StageProxy.width()) {
				mousex -= tooltip.outerWidth() + 10;
			}
			tooltip.css({
				top: mousey,
				left: mousex
			});
		}
		function resize_error () {
			var inner = error_inner.outerHeight();
			var outer = StageProxy.height();
			if (inner<outer) {
				error_inner.css("top", Math.round((outer-inner)/2)+"px");
			} else {
				error_inner.css("top", 0);
			}
		}
		function showError (type) {
			body.hide();
			error.show();
			$("#body-fail-icon").removeClass().addClass(type);
			$("#body-fail-title").html(L10N.get("general", "browser_error_" + type + "_title"));
			$("#body-fail-description").html(L10N.get("general", "browser_error_" + type + "_description"));
			resize_error();
		}
		function hideError () {
			body.show();
			error.hide();
		}
		function supported () {
			/* var props = "";
			for (var prop in $.browser) props += prop + ": " + $.browser[prop] + "\n";
			alert(props); //*/
			//return true;
			var success = true;
			// check for mobile webkit chrome/safari/android browsers based on webkit first
			if ( $.browser.mobile ) {
				var version = parseInt($.browser.version, 10);
				if ( $.browser.webkit ) {
					success = version >= 534;
				}
			}
			// mobile/desktop independant
			if ( $.browser.desktop ) {
				if ( $.browser.safari ) {
					success = $.browser.versionNumber >= 5;
				}
			}
			if ( $.browser.chrome ) {
				success = $.browser.versionNumber >= 18;
			}
			if ( $.browser.mozilla ) {
				success = $.browser.versionNumber >= 4;
			}
			if ( $.browser.msie ) {
				success = $.browser.versionNumber >= 10;
			}
			if ( $.browser.opera ) {
				success = $.browser.versionNumber >= 15;
			}
			// let them know
			if (!success) {
				showError("browser");
				return false;
			}
			hideError();
			return true;
		}
		function render () {
			$(document).bind("contextmenu", Func.stop);
			body = $("#body-inner");
			error = $("#body-error");
			error_inner = $("#body-error-inner");
			tooltip = $("#tooltip");
			if ( !supported() ) {
				StageProxy.addEventListener("onResize", resize_error);
			} else {
				FormDialog.initialize();
				Overlay.initialize();
				Content.initialize();
				Dialog.initialize();
				if ( !setup.device.touch ) {
					body.mousemove(ttposition);
				}
			}
		}
		/* public methods
			*/
		this.createToolTip = function (text, isFilename) {
			if (setup.device.touch) {
				return;
			}
			if (isFilename) {
				var bits = text.split(".");
				bits.pop();
				text = bits.join(".");
			}
			if (text=="") {
				this.killToolTip();
				return;
			}
			tooltip.html(text).show();
			tooltip_visible = true;
		};
		this.killToolTip = function () {
			if (setup.device.touch) {
				return;
			}
			tooltip.hide();
			tooltip_visible = false;
		};
		this.device = function () {
			return setup.device;
		};
		this.initialize = function (obj) {
			setup = obj;
			classname = setup.init;
				classname = classname.split(" ");
				classname = classname.pop();
			StageProxy = classes.StageProxy;
			Dialog = classes.Dialog;
			Overlay = classes.Overlay;
			FormDialog = classes.elements.FormDialog;
			L10N = classes.helpers.L10N;
			Content = classes.content[classname];
			Func = classes.helpers.Func;
			render();
		};
	}
	return new Constructor();
}());

/*jslint browser: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.StageProxy = (function () {
	function Constructor () {
		/* private properties
			*/
		var instance = this;
		var resize_interval_id;
		var resize_interval = 500;
		/* private methods
			*/
		function fire () {
			instance.dispatch("onResize");
		}
		function resize () {
			clearTimeout(resize_interval_id);
			resize_interval_id = setTimeout(fire, resize_interval);
		}
		/* public methods
			*/
		this.width = function() {
			var w = $(window).width();
			return Math.round(w);
		};
		this.height = function() {
			var h = $(window).height();
			return Math.round(h);
		};
		/* constructor
			*/
		$(window).resize(resize);
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());

/*jslint browser: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.elements.ContactForm = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var StageProxy;
		var Dialog; // shortcut
		var L10N;
		/* private properites
			*/
		// jquery containers
		var form;
		var inputs;
		/* private methods
			*/
		function fulfilled () {
			var response = true;
			form.find(".Required").each(function () {
				var obj = $(this);
				var input = obj.find("input");
				if (obj.hasClass("Dropdown")) {
					input = obj.find("select");
				} else if (obj.hasClass("Area")) {
					input = obj.find("textarea");
				}
				var val = input.val();
				if (obj.hasClass("Checkbox")) {
					val = obj.find("input:checked").val();
				}
				if (obj.hasClass("Radio")) {
					val = obj.find("input:checked").val();
				}
				obj.removeClass("Focused");
				obj.removeClass("Invalid");
				obj.addClass("Default");
				if ( val=="" || val==undefined ) {
					obj.removeClass("Default");
					obj.addClass("Invalid");
					if (response==true) {
						response = false;
					}
				}
			});
			return response;
		}
		function resize () {
			var sw = StageProxy.width();
			if (sw>600) {
				var sh = StageProxy.height();
				$(".Contact .Column2 .Inner").css("min-height", sh-65);
			} else {
				$(".Contact .Column2 .Inner").css("min-height", "auto");
			}
		}
		function submit_response (data) {
			var success = data=="contact_form_send_success";
			inputs.removeAttr("disabled");
			Dialog.options({
				modal: false,
				title: ( success ? L10N.get("contact", "contact_form_title_success")  : L10N.get("contact", "contact_form_title_fail") ),
				description: L10N.get("contact", data)
			});
			Dialog.draw();
			if (success) {
				form[0].reset();
			}
		}
		function submit (e) {
			e.preventDefault();
			// check the required fields
			if (!fulfilled()) {
				Dialog.options({
					modal: false,
					title: L10N.get("contact", "contact_form_title_fail"),
					description: L10N.get("contact", "highlighted_fields_required")
				});
				Dialog.draw();
				return;
			}
			//loading();
			// ok, everything checks out let's submit
			var postobj = {
				action: "send_email",
				set_url: window.location.href
			};
			form.find(".Input input, .Dropdown select, .Date input, .Area textarea, .Checkbox input:checked, .Radio input:checked").each(function () {
				var input = $(this);
				var name = input.attr("name");
				var val = input.val();
				if ( val!="" ) {
					if (!postobj[name]) {
						postobj[name] = val;
					} else {
						postobj[name] += "\n" + val;
					}
				}
			});
			inputs.attr("disabled", true);
			$.post( APP_ROOT + "vend-proofing-gateway.php", postobj, submit_response );
		}
		function draw () {
			// assign jquery selectors
			form = 			$("#contact-form");
			inputs = 		form.find("input, textarea, select");
			// form
			form
				.submit(submit)
				.find("input, textarea")
					.focus(function () {
						$(this).parent().removeClass("Default");
						$(this).parent().addClass("Focused");
					})
					.blur(function () {
						$(this).parent().removeClass("Focused");
						$(this).parent().addClass("Default");
					})
					.blur();
			if (!Modernizr.inputtypes.date) {
				$('input[type=date]').each(function() {
					var $input = $(this);
					$input.datepicker({
						dateFormat: 'yy-mm-dd'
					});
				});
			}
		}
		function init () {
			draw();
			resize();
		}
		function lateinit () {
			StageProxy.addEventListener("onResize", resize);
		}
		function render () {
			init();
			setTimeout(lateinit, 33);
		}
		/* public methods
			*/
		this.initialize = function () {
			StageProxy = classes.StageProxy;
			L10N = classes.helpers.L10N;
			Dialog = classes.Dialog;
			render();
		};
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());

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

/*jslint browser: true, continue: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.elements.FormDialog = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var StageProxy;
		var Cookie;
		var Shell; // shortcut
		var Func;
		/* private properites
			*/
		var defaults = {
			view: 					"init",
			inline: 				false,
			modal: 					false,
			bg_image: 				["", "", ""],
			description: 			"",
			footer: 				"",
			description_markdown: 	false,
			footer_markdown: 		false,
			prefill_variable_name: 	"",
			prefill_variable_value: "",
			field_password: 		false,
			field_label: 			"",
			field_type: 			"text",
			submit_label: 			"",
			error_label: 			"",
			confirm_label: 			"",
			cancel_label: 			"",
			submit:				false,
			cancel:				false,
			confirm:				false
		};
		var opt = {};
		var instance = this;
		var open = false;
		var container;
			var screen;
			var background;
			var dialog;
				var description;
				var form;
				var footer;
					var field;
					var submit_obj;
					var cancel1_obj;
				var response;
					var error;
					var confirm_obj;
					var cancel2_obj;
				var screen2;
		/* private methods
			*/
		function resize () {
			if (!open) {
				container.show();
			}
			var cheight = Math.max(form.height(), response.height());
			$("#form-dialog-content").height(cheight);
			var sw = StageProxy.width();
			var sh = StageProxy.height();
			if (!opt.inline) {
				var dw = dialog.width();
				var dh = dialog.outerHeight();
				dialog.css({
					top: (sh-dh)/2,
					left: (sw-dw)/2
				});
			}
			if (opt.bg_image) {
				if (opt.bg_image[0]!="") {
					var img = background.find("img");
					var iw = img.attr("width");
					var ih = img.attr("height");
					var nw = sw;
					var nh = nw*(ih/iw);
					if (nh<sh) {
						nh = sh;
						nw = nh*(iw/ih);
					}
					img.width(nw).height(nh)
						.offset({
							top: (sh-nh)/2,
							left: (sw-nw)/2
						});
				}
			}
			if (!open) {
				container.hide();
			}
		}
		function loading () {
			screen2.show();
			screen2.css('z-index', 3);
			response.css('opacity', .5);
			form.css('opacity', .5);
			dialog.progress();
		}
		function showForm () {
			opt.view = "form";
			dialog.progress(true);
			response.css('opacity', 1);
			form.css('opacity', 1);
			response.css('z-index', 1).hide();
			form.css('z-index', 2).show();
			screen2.hide();
			resize();
		}
		function showError () {
			opt.view = "error";
			dialog.progress(true);
			response.css('opacity', 1);
			form.css('opacity', 1);
			form.css('z-index', 1).hide();
			response.css('z-index', 2).show();
			screen2.hide();
			resize();
		}
		function change () {
			submit_obj.attr("disabled", "disabled");
			if (field.val()!="") {
				submit_obj.removeAttr("disabled");
			}
			if (opt.prefill_variable_name) {
				Cookie.set(opt.prefill_variable_name, field.val(), 365);
			}
		}
		function destroy () {
			field.blur();
			dialog.progress(true);
			opt = {};
			container.hide();
			open = false;
			instance.dispatch("onClose");
		}
		function confirm () {
			if (opt.confirm) {
				opt.confirm();
			} else {
				showForm();
			}
		}
		function cancel () {
			if (opt.cancel) {
				opt.cancel();
			} else {
				destroy();
			}
		}
		function submit () {
			if (opt.submit) {
				loading();
				opt.submit();
			} else {
				destroy();
			}
		}
		function keyevent (event) {
			if (open) {
				switch (event.which) {
					case 13 : // Key.ENTER :
						if ( opt.view=="form" && submit_obj.attr("disabled")!="disabled" ) {
							submit();
						} else if ( opt.view=="error" ) {
							confirm();
						}
						Func.stop(event);
						return false;
					default :
						if (opt.field_label!="") {
							change();
						}
				}
			}
		}
		function click (event) {
			switch ($(this).attr("id")) {
				case screen.attr("id") :
					if (opt.modal) {
						cancel();
					}
					break;
				case confirm_obj.attr("id") :
					confirm();
					break;
				case cancel1_obj.attr("id") :
				case cancel2_obj.attr("id") :
					cancel();
					break;
				case submit_obj.attr("id") :
					submit();
					break;
			}
			Func.stop(event);
			return false;
		}
		function create () {
			// listen for key events
			// if it's inline, set the class
			if (opt.inline) {
				container.addClass("Inline");
			} else {
				container.removeClass("Inline");
			}
			if (opt.bg_image[0]!="") {
				container.addClass("BgImage");
				background
					.show()
					.find("img")
						.attr("src", opt.bg_image[0])
						.attr("width", opt.bg_image[1])
						.attr("height", opt.bg_image[2]);
			} else {
				container.removeClass("BgImage");
				background
					.hide()
					.find("img")
						.attr("src", "")
						.attr("width", "")
						.attr("height", "");
			}
			background.toggle(opt.bg_image!="");
			// decide if the form is pre-filled
			var prefill_value = "";
			if (opt.prefill_variable_name) {
				prefill_value = Cookie.get(opt.prefill_variable_name);
			}
			// blurb setup
			description.removeClass("Description");
			if (opt.description_markdown) {
				description.addClass("Description");
			}
			description
				.html(opt.description)
				.toggle(opt.description!="");
			// field -- choose if password or not
			field = $("#form-dialog-field");
			field.val(prefill_value)
				.removeAttr("type")
				.prop("type", opt.field_type)
				.attr("placeholder", opt.field_label)
				.toggle(opt.field_label!="");
			// submit button
			submit_obj.html(opt.submit_label).attr("disabled", "disabled");
			if (prefill_value!=""||opt.field_label=="") {
				submit_obj.removeAttr("disabled");
			}
			// cancel button
			cancel1_obj.html(opt.cancel_label).toggle(opt.modal==true);
			// error field
			error.html(opt.error_label).toggle(opt.error_label!="");
			// confirm button
			confirm_obj.html(opt.confirm_label);
			// cancel button
			cancel2_obj.html(opt.cancel_label).toggle(opt.modal==true);
			// blurb setup
			footer.removeClass("Description");
			if (opt.footer_markdown) {
				footer.addClass("Description");
			}
			footer
				.html(opt.footer)
				.toggle(opt.footer!="");
			// screen2
			screen2.hide();
			// display it's initial state
			open = true;
			container.show();
			form.hide();
			response.hide();
			if (opt.view=="init"||opt.view=="form") {
				showForm();
			} else {
				showError();
			}
			// resize
			resize();
			instance.dispatch("onOpen");
		}
		function render () {
			// assign jquery selectors
			container = 	$("#form-dialog-container");
			screen = 		$("#form-dialog-screen");
			background = 	$("#form-dialog-background");
			dialog = 		$("#form-dialog");
			description = 	$("#form-dialog-description");
			footer = 		$("#form-dialog-footer");
			form = 			$("#form-dialog form");
			submit_obj = 	$("#form-dialog-submit");
			cancel1_obj = 	$("#form-dialog-cancel");
			response = 		$("#form-dialog-response");
			error = 		$("#form-dialog-error");
			confirm_obj = 	$("#form-dialog-confirm");
			cancel2_obj = 	$("#form-dialog-cancel2");
			screen2 = 		$("#form-dialog-screen2");
			// submit
			screen.click(click);
			submit_obj.click(click);
			cancel1_obj.click(click);
			confirm_obj.click(click);
			cancel2_obj.click(click);
			// listen to stage
			if (!Shell.device().touch) {
				container.mousewheel(Func.stop);
			} else {
				container.bind("touchmove", Func.stop);
			}
			$("body").keyup(keyevent);
			StageProxy.addEventListener("onResize", resize);
		}
		/* public methods
			*/
		this.kill = function () {
			destroy();
		};
		this.options = function(obj) {
			var prop;
			for (prop in defaults) {
				if (defaults.hasOwnProperty(prop)) {
					opt[prop] = defaults[prop];
				}
			}
			for (prop in obj) {
				if (obj.hasOwnProperty(prop)) {
					opt[prop] = obj[prop];
				}
			}
		};
		this.draw = function() {
			create();
		};
		this.error = function () {
			showError();
		};
		this.inputvalue = function () {
			return $.trim(field.val().split("\t").join("").split("\n").join("").split("\r").join(""));
		};
		this.initialize = function () {
			Func = classes.helpers.Func;
			StageProxy = classes.StageProxy;
			Cookie = classes.helpers.Cookie;
			Shell = classes.Shell;
			render();
		};
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());

/*jslint browser: true, bitwise: true, continue: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.elements.Graphic = function () {
	/* private properites
		*/
	var flag_encode = true;
	var flag_resample = "auto";
	var flag_width = 0;
	var flag_height = 0;
	var flag_fitstyle = "noBorder";
	var flag_watermark = false;
	var flag_source = {};
	/* private methods
		*/
	function isVideo () {
		return (flag_source.type=="FLV"||flag_source.type=="MP4");
	}
	function toHex (num) {
		var result = '';
		var digitArray = ['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'];
		var start = true;
		var i=32, digit;
		while(i>0) {
			i-=4;
			digit = (num>>i) & 0xf;
			if (!start||digit!=0){
				start = false;
				result += digitArray[digit];
			}
		}
		return (result==''?'0':result);
	}
	function pad (str, len, chr) {
		var result = str;
		var i;
		for (i=str.length; i<len; i++){
			result = chr + result;
		}
		return result;
	}
	function encodeHex (str) {
		var result = "";
		var i;
		for (i=0; i<str.length; i++){
			result += pad(toHex(str.charCodeAt(i)&0xff), 2, '0');
		}
		return result;
	}
	/* public methods
		*/
	this.encode = function(bool) {
		flag_encode = bool;
	};
	this.resample = function(type) {
		flag_resample = type;
	};
	this.watermark = function(bool) {
		flag_watermark = bool;
	};
	this.letterbox = function(bool) {
		flag_fitstyle = bool ? "letterBox" : "noBorder";
	};
	this.setSize = function(width, height) {
		if (width) {
			flag_width = width;
		}
		if (height) {
			flag_height = height;
		}
	};
	this.provider = function(obj) {
		var localpath = obj.src;
		if ( !localpath && obj.parent && obj.child) {
			localpath = "vend-proofing-data/storage/" + obj.parent + "/" + obj.child;
		}
		if ( obj.parent.indexOf("zip")!=-1 ) {
			obj.type = "JPG";
		}
		if ( !obj.type || obj.type=="" ) {
			obj.type = localpath.substring(localpath.lastIndexOf(".")+1).toUpperCase();
		}
		flag_source = obj;
	};
	this.source = function() {
		var src_path = APP_ROOT + "vend-proofing-data/storage/" + flag_source.parent + "/" + flag_source.child + (isVideo()?".snapshot.jpg":"");
		var src_type = isVideo() ? "JPG" : flag_source.type;
		/* if the resample mechanism is on, reconstruct the url
			*/
		if (	flag_resample!="none"	&&
			(src_type=="PNG"||src_type=="GIF"||src_type=="JPEG"||src_type=="JPG")
		) {
			/* {PARENT_NAME}:{CHILD_NAME}:{WIDTH}:{HEIGHT}:{EXACT}:{FORMAT}:{QUALITY}:{CACHE}:{WATERMARK}:{WATERMARK_NAME}:{WATERMARK_X%}:{WATERMARK_Y%}:{WATERMARK_ALPHA}:{CROSSHAIRS}:{CROSSHAIRS_COLOR}:{CROSSHAIRS_ALPHA}
				*/
			var path = APP_ROOT + "vend-proofing-resample.php";
			var query = "";
			/* decide on base query
				*/
			query += flag_source.parent + ":" + flag_source.child + (isVideo()?".snapshot.jpg":"");
			if (flag_resample=="postal") {
				/* round to the nearest 50 pixel increment
					*/
				var image_width = (Math.ceil(flag_width/50)*50);
				var image_height = (Math.ceil(flag_height/50)*50);
				switch (flag_fitstyle) {
					case "letterBox" :
						query += ":" + image_width + ":" + image_height + ":0";
						break;
					case "noBorder" :
						if (image_width>image_height) {
							query += ":" + image_width + ":" + ":1";
						} else {
							query += ":" + ":" + image_height + ":1";
						}
						break;
				}
			} else if (flag_resample=="auto") {
				switch (flag_fitstyle) {
					case "letterBox" :
						query += ":" + flag_width + ":" + flag_height + ":0";
						break;
					case "noBorder" :
						query += ":" + flag_width + ":" + flag_height + ":1";
						break;
				}
			}
			/* add the type
				*/
			query += "," + (flag_source.xoffset||50) + "," + (flag_source.yoffset||50);
			/* add the type
				*/
			query += ":" + src_type.toLowerCase();
			/* add the quality
				*/
			query += ":" + VEND_GRAPHIC_QUALITY + "," + (VEND_GRAPHIC_SHARPEN?"1":"0") + "," + (VEND_GRAPHIC_IMAGIC?"1":"0");
			/* add the cache flag
				*/
			query += ":1";
			/* add the watermarking
				*/
			query += ":" + (flag_watermark&&VEND_GRAPHIC_WATERMARK?"1":"0") + ":" + VEND_GRAPHIC_WATERMARK_ASSET + ":" + VEND_GRAPHIC_WATERMARK_X + ":" + VEND_GRAPHIC_WATERMARK_Y + ":" + VEND_GRAPHIC_WATERMARK_ALPHA;
			query += ":" + (flag_watermark&&VEND_GRAPHIC_CROSSHAIRS?"1":"0") + ":" + VEND_GRAPHIC_CROSSHAIRS_COLOR + ":" + VEND_GRAPHIC_CROSSHAIRS_ALPHA;
			/* set our final path
				*/
			if (flag_encode) {
				path += "?hash=" + encodeHex(query);
			} else {
				path += "?q=" + escape(query);
			}
			src_path = path;
		}
		return src_path;
	};
};

/*jslint browser: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.content.Contact = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var ContactForm;
		/* private properites
			*/
		/* private methods
			*/
		function render() {
			ContactForm.initialize();
		}
		/* public methods
			*/
		this.initialize = function() {
			ContactForm = classes.elements.ContactForm;
			render();
		};
	}
	return new Constructor();
}());

/*jslint browser: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.content.Expired = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var Func;
		var L10N;
		var FormDialog;
		/* private methods
			*/
		function dialog_confirm () {
			window.location = APP_ROOT;
		}
		function render() {
			Func.setDocumentTitle(L10N.get("general", "set_expired_error"));
			FormDialog.options({
				view: 			"error",
				error_label: 	L10N.get("general", "set_expired_error"),
				confirm_label: 	L10N.get("general", "return_to_gateway"),
				confirm: 		dialog_confirm
			});
			FormDialog.draw();
		}
		/* public methods
			*/
		this.initialize = function() {
			Func = classes.helpers.Func;
			L10N = classes.helpers.L10N;
			FormDialog = classes.elements.FormDialog;
			render();
		};
	}
	return new Constructor();
}());

/*jslint browser: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.content.Login = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var Func;
		var L10N;
		var FormDialog;
		var Overlay;
		/* private properites
			*/
		/* private methods
			*/
		function dialog_response (str) {
			if (str!="d41d8cd98f00b204e9800998ecf8427e") {
				window.location.reload(true);
			} else {
				FormDialog.error();
			}
		}
		function dialog_submit () {
			$.post( APP_ROOT + "vend-proofing-gateway.php", {
				action: 	"validate_login",
				password: 	FormDialog.inputvalue(),
				suid: 		Overlay.pageid()
			}, dialog_response);
		}
		function render() {
			Func.setDocumentTitle(L10N.get("general", "password_required"));
			FormDialog.options({
				field_type: 		"password",
				field_label: 		L10N.get("general", "password_required"),
				submit_label: 		L10N.get("general", "dialog_submit"),
				error_label: 		L10N.get("general", "password_incorrect"),
				confirm_label: 		L10N.get("general", "dialog_confim"),
				submit: 			dialog_submit
			});
			FormDialog.draw();
		}
		/* public methods
			*/
		this.initialize = function() {
			Overlay = classes.Overlay;
			Func = classes.helpers.Func;
			L10N = classes.helpers.L10N;
			FormDialog = classes.elements.FormDialog;
			render();
		};
	}
	return new Constructor();
}());

/*jslint browser: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.content.Splash = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var Func;
		var L10N;
		var FormDialog;
		var Shell;
		var ResampledImageQueue; // shortcut
		/* private properites
			*/
		var thumbnails = 			[];
		var splash_page_view = 		"wall";
		var current_suid = 			"";
		/* private methods
			*/
		function password_response (str) {
			if (str!="d41d8cd98f00b204e9800998ecf8427e") {
				window.location.assign( APP_ROOT + "?/" + URI_PAGE_PREFIX + "/" + current_suid + "/" );
			} else {
				FormDialog.error();
			}
		}
		function password_submit () {
			$.post( APP_ROOT + "vend-proofing-gateway.php", {
				action: 	"validate_login",
				password: 	FormDialog.inputvalue(),
				suid: 		current_suid
			}, password_response);
		}
		function password (suid) {
			current_suid = suid;
			FormDialog.options({
				modal: 				true,
				field_type: 		"password",
				cancel_label: 		L10N.get("general", "dialog_cancel"),
				field_label: 		L10N.get("general", "password_required"),
				submit_label: 		L10N.get("general", "dialog_submit"),
				error_label: 		L10N.get("general", "password_incorrect"),
				confirm_label: 		L10N.get("general", "dialog_confim"),
				submit: 			password_submit
			});
			FormDialog.draw();
		}
		function imageclick () {
			$(this).parent().find(".uiPushButton").trigger("click");
		}
		function click (event) {
			var child = $(this);
			if (child.hasClass("Disabled")) {
				return false;
				Func.stop(event);
			}
			if (child.hasClass("Login")) {
				password(child.attr("data-suid"));
				Func.stop(event);
			}
			var href = child.attr('href');
			window.location.href = href;
		}
		function wall () {
			var wallitems = $(".WallItem");
			wallitems.find(".uiPushButton").click(click);
			wallitems.find(".GraphicWrapper").click(imageclick);
			thumbnails = wallitems.find("img");
			ResampledImageQueue.addObject(thumbnails);
		}
		function dialog_response (str) {
			if (str=="true") {
				window.location.assign( APP_ROOT + "?/" + URI_PAGE_PREFIX + "/" + FormDialog.inputvalue() + "/" );
			} else {
				FormDialog.error();
			}
		}
		function dialog_submit () {
			$.post( APP_ROOT + "vend-proofing-gateway.php", {
				action: 	"validate_suid",
				suid: 		FormDialog.inputvalue()
			}, dialog_response);
		}
		function dialog () {
			var welcome = $(".WelcomeBox");
			FormDialog.options({
				inline: 			welcome.length>0,
				field_label: 		L10N.get("splash", "login_field_prompt"),
				submit_label: 		L10N.get("splash", "login_submit"),
				error_label: 		L10N.get("splash", "login_failure"),
				confirm_label: 		L10N.get("general", "dialog_confim"),
				submit: 			dialog_submit
			});
			FormDialog.draw();
		}
		function render() {
			if (splash_page_view=="wall") {
				wall();
			} else {
				dialog();
			}
		}
		/* public methods
			*/
		this.setPageView = function(str) {
			splash_page_view = str;
		};
		this.initialize = function() {
			Func = classes.helpers.Func;
			Shell = classes.Shell;
			L10N = classes.helpers.L10N;
			FormDialog = classes.elements.FormDialog;
			ResampledImageQueue = classes.helpers.ResampledImageQueue;
			render();
		};
	}
	return new Constructor();
}());

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

/*jslint browser: true, continue: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.overlay.Clickwrap = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var Controlbar; // shortcut
		/* private properites
			*/
		/* private methods
			*/
		function back () {
			Controlbar.dispatch("onPageView", [ "checkout" ]);
		}
		function draw () {
			$("#clickwrap-controlbar-back").click(back);
		}
		function render () {
			draw();
		}
		/* public methods
			*/
		this.initialize = function() {
			Controlbar = classes.elements.Controlbar;
			render();
		};
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());

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

/*jslint browser: true, continue: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.overlay.Packages = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		/* private properites
			*/
		var instance = 			this;
		var packages_packages = null;
		var packages_products = null;
		/* private methods
			*/
		function select (t, i, id) {
			var ui = t=="package" ? packages_packages : packages_products;
			$(".LineItem").removeClass("Active");
			$("#"+id).addClass("Active");
			instance.dispatch("onPackageSelected", { type:t, index:i, key:$("#"+id).data("value") });
		}
		function draw () {
			packages_packages = $("#packages-packages");
			packages_products = $("#packages-products");
			packages_packages.find(".LineItem").click(function () {
				select("package", $(this).index(), $(this).attr('id'));
			});
			packages_products.find(".LineItem").click(function () {
				select("product", $(this).index(), $(this).attr('id'));
			});
		}
		function render () {
			draw();
		}
		/* public methods
			*/
		this.initialize = function() {
			render();
		};
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());

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