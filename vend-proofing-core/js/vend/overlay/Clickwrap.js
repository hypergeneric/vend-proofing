
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
