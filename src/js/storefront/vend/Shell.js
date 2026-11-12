
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
