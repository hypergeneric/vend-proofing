
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.dialogs.PackageEditor = function () {
	
	/* "imported" classes
		*/
		
	var Func;
	var Lang;
	var Auth;
	var Admin;
	var Dialog;
	
	/* private properites
		*/
		
	var _instance = 		this;
	var _uniquid = 			classes.helpers.Func.uniquid();
	var _parent = 			null;
	var _inited = 			null;
	
	var _label = 			"";
	var _filename = 		"";
	var _price = 			"0";
	var _shipping = 		"0";
	var _description = 		"";
	
	var _assetselector = 	null;
	var _input_label = 		null;
	var _input_filename = 	null;
	var _input_price = 		null;
	var _input_shipping = 	null;
	var _input_description = null;
	
	/* private methods
		*/
		
	function clean (str) {
		str = str.split("\t").join("");
		str = str.split("\n").join("\r");
		return str;
	}
	function change () {
		var value = $(this).val();
		if ( $(this).is(_input_label) ) {
			_label = value;
		} else if ( $(this).is(_input_price) ) {
			_price = value;
		} else if ( $(this).is(_input_shipping) ) {
			_shipping = value;
		} else if ( $(this).is(_input_description) ) {
			_description = clean(value);
		}
		Dialog.disableOptions([0]);
		if ( _label!="" ) {
			Dialog.enableOptions([0]);
		}
	}
	function onChanged () {
		_filename = _assetselector.ingest()._value;
		Dialog.disableOptions([0]);
		if ( _label!="" ) {
			Dialog.enableOptions([0]);
		}
	}

	function render () {
		
		_uniquid = "DO" + Func.uniquid();
		
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="DialogForm">';
			xhtml += 	'<div class="Group Input Label">';
			xhtml += 		'<label>' + Lang.lookup("Package Editor Title") + '</label>';
			xhtml += 		'<input id="input_label" type="input" value="' + _label + '" />';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Filename"></div>';
			xhtml += 	'<div class="Group2">';
			xhtml += 		'<div class="Col">';
			xhtml += 			'<div class="Group Input Price">';
			xhtml += 				'<label>' + Lang.lookup("Package Editor Price") + '</label>';
			xhtml += 				'<input type="number" max="999999" min="0" step=".0001" value="' + _price + '" />';
			xhtml += 			'</div>';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Col">';
			xhtml += 			'<div class="Group Input Shipping">';
			xhtml += 				'<label>' + Lang.lookup("Package Editor Shipping") + '</label>';
			xhtml += 				'<input type="number" max="999999" min="0" step=".0001" value="' + _shipping + '" />';
			xhtml += 			'</div>';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Clear"></div>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Group Input Description">';
			xhtml += 		'<label>' + Lang.lookup("Package Editor Description") + '</label>';
			xhtml += 		'<textarea rows="3" cols="50">' + _description + '</textarea>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
			
		_parent.html(xhtml);
		
		_input_label = _parent.find("#" + _uniquid + " .Label input");
		_input_filename = _parent.find("#" + _uniquid + " .Filename");
		_input_price = _parent.find("#" + _uniquid + " .Price input");
		_input_shipping = _parent.find("#" + _uniquid + " .Shipping input");
		_input_description = _parent.find("#" + _uniquid + " .Description textarea");
		
		_input_label.on("input", change);
		_input_price.on("input", change);
		_input_shipping.on("input", change);
		_input_description.on("input", change);
		
		_assetselector = new classes.components.formobjects.Asset();
		_assetselector.addEventListener("onChanged", onChanged);
		_assetselector.label(Lang.lookup("Package Editor Image"));
		_assetselector.parent(_input_filename);
		_assetselector.ingest({ _value:_filename, _attributes:{ width:"", height:"" } });
		_assetselector.key("package");
		_assetselector.initialize();
		
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
	this.filename = function (str) {
		if (str) {
			_filename = str;
		}
		return _filename;
	};
	this.price = function (str) {
		if (str) {
			_price = str;
		}
		return _price;
	};
	this.shipping = function (str) {
		if (str) {
			_shipping = str;
		}
		return _shipping;
	};
	this.description = function (str) {
		if (str) {
			_description = str;
		}
		return _description;
	};

	this.parent = function (obj) {
		_parent = obj;
	};
	this.destroy = function () {
		_assetselector.removeEventListener("onChanged", onChanged);
		_assetselector.destroy();
		_input_label.off();
		_input_price.off();
		_input_shipping.off();
		_input_description.off();
		_parent.empty();
	};
	this.resize = function () {
	};
	this.initialize = function (obj) {
		Dialog = classes.components.Dialog;
		Admin = classes.Admin;
		Auth = classes.data.Auth;
		Func = classes.helpers.Func;
		Lang = classes.data.Lang;
		for (var prop in obj) {
			this[prop](obj[prop]);
		}
		render();
	};
	
};
