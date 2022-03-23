
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
