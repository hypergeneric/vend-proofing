
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
