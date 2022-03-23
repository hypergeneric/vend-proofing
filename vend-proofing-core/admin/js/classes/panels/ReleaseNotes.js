
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.panels.ReleaseNotes = function () {
	/* "imported" classes
		*/
	var Admin;
	/* private properites
		*/
	var _instance = 			this;
	var _panel = 				null;
	var _controller = 			null;
	/* private methods
		*/
	function doOption (key) {
	}
	function render () {
		var converter = new showdown.Converter();
		var changelog = converter.makeHtml(Admin.productinfo().data.product.ChangeLog._value);
		var parent = _panel.body();
		var xhtml = '';
			xhtml += '<div class="ReleaseNotes">';
			xhtml += 	'<div class="Group Changelog">';
			xhtml += 		'<div>' + changelog + '</div>';
			xhtml += 	'</div>';
			xhtml += '</div>';
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
		Admin = classes.Admin;
		render();
	};
};

classes.panels.ReleaseNotes.prototype = new EventDispatcher();
