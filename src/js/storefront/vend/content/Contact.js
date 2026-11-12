
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
