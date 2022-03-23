
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.dialogs.SetEditor = function () {
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
	var _type = 			"";
	var _label = 			"";
	var _edit = 			false;
	var input_label = 		null;
	var input_type = 		null;
	/* private methods
		*/
	function titlechange () {
		var value = input_label.val();
		var selected = $("option:selected", input_type);
		var selectedvalue = selected.attr("data-value");
		if ( _label!=value && value!="" && selectedvalue!="" ) {
			Dialog.enableOptions([0]);
		}
		_label = value;
	}
	function typechange () {
		var selected = $("option:selected", this);
		var value = selected.attr("data-value");
		var labelvalue = input_label.val();
		if ( _type!=value && value!="" && labelvalue!="" ) {
			Dialog.enableOptions([0]);
		}
		_type = value;
	}
	function render () {
		
		_uniquid = "DO" + Func.uniquid();
		
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="DialogForm">';
			xhtml += 	'<div class="Group Input Title">';
			xhtml += 		'<label>' + Lang.lookup("Page Name Label") + '</label>';
			xhtml += 		'<input type="input" value="' + _label + '" />';
			xhtml += 	'</div>';
		if (_edit==false) {
			xhtml += 	'<div class="Group Input Type">';
			xhtml += 		'<label>' + Lang.lookup("Render Type") + '</label>';
			xhtml += 		'<select></select>';
			xhtml += 	'</div>';
		}
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
			
		_parent.html(xhtml);
		
		input_label = _parent.find("#" + _uniquid + " .Title input");
		input_type = _parent.find("#" + _uniquid + " .Type select");

		input_label.on("input", titlechange);
		
		if (_edit==false) {
			var provider = [];
			provider.unshift({
				label: Lang.lookup("Please Choose"),
				data: ""
			});
			for (var i=0; i<Admin.config().setup.content.type.length; ++i) {
				var type = Admin.config().setup.content.type[i];
				provider.push({
					data: type._attributes.key,
					label: Lang.lookup(type._attributes.key) + " - " + Lang.lookup(type._attributes.key + " Description")
				});
			}
			for (var i=0; i<provider.length; ++i) {
				var selected = provider[i].data==_type;
				input_type.append('<option data-value="' + provider[i].data + '" ' + (selected?"selected":"") + '>' + provider[i].label + '</option>');
			}
			input_type.change(typechange);
		}
		
		Dialog.disableOptions([0]);

	}
	/* public methods
		*/
	this.edit = function (bool) {
		if (bool===true||bool===false) {
			_edit = bool;
		}
		return _edit;
	};
	this.type = function (str) {
		if (str) {
			_type = str;
		}
		return _type;
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
		input_type.off();
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
