
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.dialogs.DiscountEditor = function () {
	
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
	
	var _code = 			"";
	var _expires = 			"0";
	var _type = 			"percentage";
	var _amount = 			"0";
	var _maxuses = 			"0";
	var _cartmin = 			"0";
	var _freeshipping = 	"0";
	
	var _dateselection = 	null;
	var _input_type = 		null;
	var _input_code = 		null;
	var _input_amount = 	null;
	var _input_maxuses = 	null;
	var _input_cartmin = 	null;
	var _input_freeship = 	null;
	
	/* private methods
		*/
		
	function change () {
		var value = $(this).val();
		if ( $(this).is(_input_type) ) {
			_type = value;
		} else if ( $(this).is(_input_code) ) {
			_code = value;
		} else if ( $(this).is(_input_amount) ) {
			_amount = value;
		} else if ( $(this).is(_input_maxuses) ) {
			_maxuses = value;
		} else if ( $(this).is(_input_cartmin) ) {
			_cartmin = value;
		} else if ( $(this).is(_input_freeship) ) {
			var value = this.checked ? "1" : "0";
			_freeshipping = value;
		}
		Dialog.disableOptions([0]);
		if ( _code!="" ) {
			Dialog.enableOptions([0]);
		}
	}
	function onChanged () {
		_expires = _dateselection.ingest()._value;
		Dialog.disableOptions([0]);
		if ( _code!="" ) {
			Dialog.enableOptions([0]);
		}
	}

	function render () {
		
		_uniquid = "DO" + Func.uniquid();
		
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="DialogForm">';
			xhtml += 	'<div class="Group2">';
			xhtml += 		'<div class="Col">';
			xhtml += 			'<div class="Group Input Code">';
			xhtml += 				'<label>' + Lang.lookup("Discount Code Description") + '</label>';
			xhtml += 				'<input type="text" value="' + _code + '" />';
			xhtml += 			'</div>';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Clear"></div>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Expires"></div>';
			xhtml += 	'<div class="Group2">';
			xhtml += 		'<div class="Col">';
			xhtml += 			'<div class="Group Input Type">';
			xhtml += 				'<label>' + Lang.lookup("Discount Type") + '</label>';
			xhtml += 				'<select></select>';
			xhtml += 			'</div>';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Col">';
			xhtml += 			'<div class="Group Input Amount">';
			xhtml += 				'<label>' + Lang.lookup("Discount Amount") + '</label>';
			xhtml += 				'<input type="number" max="9999" min="0" step=".1" value="' + _amount + '" />';
			xhtml += 			'</div>';
			xhtml += 		'</div>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Group2">';
			xhtml += 		'<div class="Col">';
			xhtml += 			'<div class="Group Input MaxUses">';
			xhtml += 				'<label>' + Lang.lookup("Maximum Uses") + '</label>';
			xhtml += 				'<input type="number" max="9999" min="0" step="1" value="' + _maxuses + '" />';
			xhtml += 			'</div>';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Col">';
			xhtml += 			'<div class="Group Input CartMin">';
			xhtml += 				'<label>' + Lang.lookup("Cart Minimum") + '</label>';
			xhtml += 				'<input type="number" max="9999" min="0" step=".01" value="' + _cartmin + '" />';
			xhtml += 			'</div>';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Clear"></div>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Checkbox FreeShip">';
			xhtml += 		'<input type="checkbox" ' + (_freeshipping=="1"?"checked":"") + '>&nbsp;&nbsp;' + Lang.lookup("Free Shipping") + '</input>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
			
		_parent.html(xhtml);
		
		_input_type = _parent.find("#" + _uniquid + " .Type select");
		_input_code = _parent.find("#" + _uniquid + " .Code input");
		_input_amount = _parent.find("#" + _uniquid + " .Amount input");
		_input_maxuses = _parent.find("#" + _uniquid + " .MaxUses input");
		_input_cartmin = _parent.find("#" + _uniquid + " .CartMin input");
		_input_freeship = _parent.find("#" + _uniquid + " .FreeShip input");
		
		var expires = _parent.find("#" + _uniquid + " .Expires");
		
		_dateselection = new classes.components.formobjects.DateSelection();
		_dateselection.addEventListener("onChanged", onChanged);
		_dateselection.label(Lang.lookup("Assign an Expiration Date"));
		_dateselection.parent(expires);
		_dateselection.ingest({ _value:_expires, _attributes:{} });
		_dateselection.initialize();
		
		var provider = [{
			data: "percentage",
			label: Lang.lookup("Percentage of Total")
		},{
			data: "exact",
			label: Lang.lookup("Subtract Exact Amount")
		}];
		for (var i=0; i<provider.length; ++i) {
			var selected = provider[i].data==_type;
			_input_type.append('<option value="' + provider[i].data + '" ' + (selected?"selected":"") + '>' + provider[i].label + '</option>');
		}
		
		_input_type.change(change);
		_input_code.on("input", change);
		_input_amount.on("input", change);
		_input_maxuses.on("input", change);
		_input_cartmin.on("input", change);
		_input_freeship.change(change);
		
		_input_maxuses.numeric("positiveInteger");
		
		Dialog.disableOptions([0]);

	}
	
	/* public methods
		*/
		
	this.freeshipping = function (str) {
		if (str) {
			_freeshipping = str;
		}
		return _freeshipping;
	};
	this.type = function (str) {
		if (str) {
			_type = str;
		}
		return _type;
	};
	this.expires = function (str) {
		if (str) {
			_expires = str;
		}
		return _expires;
	};
	this.code = function (str) {
		if (str) {
			_code = str;
		}
		return _code;
	};
	this.amount = function (str) {
		if (str) {
			_amount = str;
		}
		return _amount;
	};
	this.maxuses = function (str) {
		if (str) {
			_maxuses = str;
		}
		return _maxuses;
	};
	this.cartmin = function (str) {
		if (str) {
			_cartmin = str;
		}
		return _cartmin;
	};

	this.parent = function (obj) {
		_parent = obj;
	};
	this.destroy = function () {
		_input_maxuses.off('.alphanum');
		_dateselection.removeEventListener("onChanged", onChanged);
		_dateselection.destroy();
		_input_freeship.off();
		_input_code.off();
		_input_amount.off();
		_input_maxuses.off();
		_input_cartmin.off();
		_input_type.off();
		_parent.empty();
	};
	this.resize = function () {
		if (_inited==null) {
			_inited = setInterval(classes.StageProxy.trigger, 33);
			setTimeout(function () {
				clearInterval(_inited);
				_inited = true;
			}, 500);
		}
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
