
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
