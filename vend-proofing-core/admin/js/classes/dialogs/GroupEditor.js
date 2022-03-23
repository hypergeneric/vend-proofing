
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.dialogs.GroupEditor = function () {
	
	/* "imported" classes
		*/
		
	var StageProxy;
	var Func;
	var Lang;
	var Auth;
	var Cookie;
	var Dialog;
	var Admin;
	
	/* private properites
		*/
		
	var _instance = 		this;
	var _uniquid = 			"";
	var _parent = 			null;
	
	var _label = 			"";
	var input_label = 		null;
	
	/* private methods
		*/
	function titlechange () {
		var value = input_label.val();
		if ( _label!=value && value!="" ) {
			Dialog.enableOptions([0]);
		}
		_label = value;
	}
	function render () {
		
		_uniquid = "DO" + Func.uniquid();
		
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="DialogForm">';
			xhtml += 	'<div class="Group Input Title">';
			xhtml += 		'<label>' + Lang.lookup("Group Label") + '</label>';
			xhtml += 		'<input type="input" value="' + _label + '" />';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
			
		_parent.html(xhtml);
		
		input_label = _parent.find("#" + _uniquid + " .Title input");
		input_label.on("input", titlechange);
		
		Dialog.disableOptions([0]);

	}
	/* public methods
		*/
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
		_parent.empty();
	};
	this.initialize = function (obj) {
		Admin = classes.Admin;
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
