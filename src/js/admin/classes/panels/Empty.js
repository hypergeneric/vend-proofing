
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.panels.Empty = function () {
	/* "imported" classes
		*/
	/* private properites
		*/
	var _instance = 			this;
	var _panel = 				null;
	var _controller = 			null;
	var _uniquid = 				"";
	/* private methods
		*/
	function doOption (key) {
		switch (key) {
			case "something" :
				break;
		}
	}
	function render () {
		var parent = _panel.body();
		var xhtml = 'Empty Application';
		parent.html(xhtml);
	}
	/* public methods
		*/
	this.option = function (key) {
		doOption(key);
	};
	this.panel = function (obj) {
		_panel = obj;
	};
	this.controller = function (obj) {
		_controller = obj;
	};
	this.destroy = function () {
	};
	this.initialize = function () {
		render();
	};
};

classes.panels.Empty.prototype = new EventDispatcher();
