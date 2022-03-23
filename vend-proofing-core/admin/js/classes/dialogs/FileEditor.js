
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.dialogs.FileEditor = function () {
	/* "imported" classes
		*/
	var StageProxy;
	var Func;
	var Lang;
	var Auth;
	var Cookie;
	var Dialog;
	/* private properites
		*/
	var _instance = 		this;
	var _parent = 			null;
	var _description = 		"";
	var _label = 			"";
	var input_label = 		null;
	var input_description = null;
	/* private methods
		*/
	function clean (str) {
		str = str.split("\t").join("");
		str = str.split("\n").join("");
		str = str.split("\r").join("");
		return str;
	}
	function titlechange () {
		var value = clean(input_label.val());
		if (_label!=value) {
			Dialog.enableOptions([0]);
		}
		_label = value;
	}
	function descchange () {
		var value = clean(input_description.val());
		if (_label!=value) {
			Dialog.enableOptions([0]);
		}
		_description = value;
	}
	function render () {
		
		var xhtml = '';
			xhtml += '<div class="DialogForm">';
			xhtml += 	'<div class="Group Input">';
			xhtml += 		'<label>' + Lang.lookup("File Title") + '</label>';
			xhtml += 		'<input id="input_label" type="input" value="' + _label + '" />';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Group Input">';
			xhtml += 		'<label>' + Lang.lookup("File Description") + '</label>';
			xhtml += 		'<textarea id="input_description" rows="3" cols="50">' + _description + '</textarea>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
			
		_parent.html(xhtml);
		
		input_label = _parent.find('#input_label');
		input_description = _parent.find('#input_description');
		
		input_label.on("input", titlechange);
		input_description.on("input", descchange);
		
		Dialog.disableOptions([0]);

	}
	/* public methods
		*/
	this.description = function (str) {
		if (str) {
			_description = str;
		}
		return _description;
	};
	this.label = function (str) {
		if (str) {
			_label = str;
		}
		return _label;
	};
	this.parent = function (obj) {
		_parent = obj;
	};
	this.destroy = function () {
		input_label.off();
		input_description.off();
		_parent.empty();
	};
	this.initialize = function (obj) {
		Dialog = classes.components.Dialog;
		Auth = classes.data.Auth;
		Cookie = classes.helpers.Cookie;
		Func = classes.helpers.Func;
		Lang = classes.data.Lang;
		StageProxy = classes.StageProxy;
		for (var prop in obj) {
			this[prop](obj[prop]);
		}
		render();
	};
};
