
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
		this.trigger = function() {
			fire();
		};
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
