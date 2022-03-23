
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
