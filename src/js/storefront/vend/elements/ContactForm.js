
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
