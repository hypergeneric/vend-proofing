
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.dialogs.FormatEditor = function () {
	
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
	var _width = 			"0";
	var _height = 			"0";
	var _price = 			"";
	var _shipping = 		"";
	
	var _input_label = 		null;
	var _input_width = 		null;
	var _input_height = 	null;
	var _input_price = 		null;
	var _input_shipping = 	null;
	
	/* private methods
		*/
		
	function change () {
		var value = $(this).val();
		if ( $(this).is(_input_label) ) {
			_label = value;
		} else if ( $(this).is(_input_price) ) {
			_price = value;
		} else if ( $(this).is(_input_shipping) ) {
			_shipping = value;
		} else if ( $(this).is(_input_width) ) {
			_width = value;
		} else if ( $(this).is(_input_height) ) {
			_height = value;
		}
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
			xhtml += 		'<label>' + Lang.lookup("Format Editor Title") + '</label>';
			xhtml += 		'<input id="input_label" type="input" value="' + _label + '" />';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Group2">';
			xhtml += 		'<div class="Col">';
			xhtml += 			'<div class="Group Input Width">';
			xhtml += 				'<label>' + Lang.lookup("Format Editor Width") + '</label>';
			xhtml += 				'<input type="number" max="999999" min="0" step=".0001" value="' + _width + '" />';
			xhtml += 			'</div>';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Col">';
			xhtml += 			'<div class="Group Input Height">';
			xhtml += 				'<label>' + Lang.lookup("Format Editor Height") + '</label>';
			xhtml += 				'<input type="number" max="999999" min="0" step=".0001" value="' + _height + '" />';
			xhtml += 			'</div>';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Clear"></div>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Group Input Price">';
			xhtml += 		'<label>' + Lang.lookup("Format Editor Price") + '</label>';
			xhtml += 		'<input id="input_label" type="input" value="' + _price + '" />';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Group Input Shipping">';
			xhtml += 		'<label>' + Lang.lookup("Format Shipping Modifier") + '</label>';
			xhtml += 		'<input id="input_label" type="input" value="' + _shipping + '" />';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
			
		_parent.html(xhtml);
		
		_input_label = _parent.find("#" + _uniquid + " .Label input");
		_input_width = _parent.find("#" + _uniquid + " .Width input");
		_input_height = _parent.find("#" + _uniquid + " .Height input");
		_input_price = _parent.find("#" + _uniquid + " .Price input");
		_input_shipping = _parent.find("#" + _uniquid + " .Shipping input");
		
		_input_label.on("input", change);
		_input_width.on("input", change);
		_input_height.on("input", change);
		_input_price.on("input", change);
		_input_shipping.on("input", change);
		
		_input_price.alphanum({
			allow              : '.,()+-/*^',
			allowNewline       : false,
			allowOtherCharSets : false
		});
		_input_shipping.alphanum({
			allow              : '.,()+-/*^',
			allowNewline       : false,
			allowOtherCharSets : false
		});
		
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
	this.width = function (str) {
		if (str) {
			_width = str;
		}
		return _width;
	};
	this.height = function (str) {
		if (str) {
			_height = str;
		}
		return _height;
	};

	this.parent = function (obj) {
		_parent = obj;
	};
	this.destroy = function () {
		_input_price.off('.alphanum');
		_input_shipping.off('.alphanum');
		_input_label.off();
		_input_width.off();
		_input_height.off();
		_input_price.off();
		_input_shipping.off();
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
