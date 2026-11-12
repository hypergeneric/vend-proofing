
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
