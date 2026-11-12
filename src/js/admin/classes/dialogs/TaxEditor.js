
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.dialogs.TaxEditor = function () {
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
	var _uniquid = 			"DO" + classes.helpers.Func.uniquid();
	var _parent = 			null;
	var _use_number_polyfill = 	false; //!Modernizr.inputtypes.number;
	var _edit = 			false;
	var _country = 			"";
	var _name = 			"";
	var _code = 			"";
	var _hst = 				"0";
	var _gst = 				"0";
	var _pst = 				"0";
	var _percent = 			"0";
	var input_code = 		null;
	var input_hst = 		null;
	var input_gst = 		null;
	var input_pst = 		null;
	var input_percent = 	null;
	/* private methods
		*/
		
	function change () {
		var selected = $("option:selected", this);
		var value = selected.attr("data-value");
		if ( _code!=value && value!="" && value!="--" ) {
			Dialog.enableOptions([0]);
		}
		_name = selected.val();
		_code = value;
	}
	function valchange () {
		var value = $(this).val();
		var selected = $("option:selected", input_code);
		var selectedvalue = selected.attr("data-value");
		if ( value!="" && (selectedvalue!=""&&selectedvalue!="--"&&_edit==false) ) {
			Dialog.enableOptions([0]);
		}
		if ($(this).parent().hasClass("HST")) {
			_hst = value;
		}
		if ($(this).parent().hasClass("GST")) {
			_gst = value;
		}
		if ($(this).parent().hasClass("PST")) {
			_pst = value;
		}
		if ($(this).parent().hasClass("Percent")) {
			_percent = value;
		}
	}
	
	function render () {
		
		var locale = "Country";
		var dataname = "country_iso_codes";
		var stepsize = .001;
		var maxvalue = 100;
		var minvalue = 0;
		if (_country=="US") {
			locale = "State";
			dataname = "us_states";
		} else if (_country=="CA") {
			locale = "Province";
			dataname = "ca_province";
		}
		
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="DialogForm">';
		if (_edit==false) {
			xhtml += 	'<div class="Group Input Code">';
			xhtml += 		'<label>' + locale + '</label>';
			xhtml += 		'<select></select>';
			xhtml += 	'</div>';
		}
		if (_country=="CA") {
			xhtml += 	'<div class="Group Input HST">';
			xhtml += 		'<label>' + Lang.lookup("HST Percent") + '</label>';
			xhtml += 		'<input type="number"  type="number" max="' + maxvalue + '" min="' + minvalue + '" step="' + stepsize + '" value="' + _hst + '" />';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Group Input GST">';
			xhtml += 		'<label>' + Lang.lookup("GST Percent") + '</label>';
			xhtml += 		'<input type="number"  type="number" max="' + maxvalue + '" min="' + minvalue + '" step="' + stepsize + '" value="' + _gst + '" />';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Group Input PST">';
			xhtml += 		'<label>' + Lang.lookup("PST Percent") + '</label>';
			xhtml += 		'<input type="number"  type="number" max="' + maxvalue + '" min="' + minvalue + '" step="' + stepsize + '" value="' + _pst + '" />';
			xhtml += 	'</div>';
		} else {
			xhtml += 	'<div class="Group Input Percent">';
			xhtml += 		'<label>' + Lang.lookup("Percent") + '</label>';
			xhtml += 		'<input type="number"  type="number" max="' + maxvalue + '" min="' + minvalue + '" step="' + stepsize + '" value="' + _percent + '" />';
			xhtml += 	'</div>';
		}
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
			
		_parent.html(xhtml);
		
		input_code = _parent.find("#" + _uniquid + " .Code select");
		input_hst = _parent.find("#" + _uniquid + " .HST input");
		input_gst = _parent.find("#" + _uniquid + " .GST input");
		input_pst = _parent.find("#" + _uniquid + " .PST input");
		input_percent = _parent.find("#" + _uniquid + " .Percent input");
		
		if (_use_number_polyfill) {
			if (_country=="CA") {
				input_hst.addClass("Spinner").spinner();
				input_gst.addClass("Spinner").spinner();
				input_pst.addClass("Spinner").spinner();
			} else {
				input_percent.addClass("Spinner").spinner();
			}
		}
		
		input_hst.change(valchange);
		input_gst.change(valchange);
		input_pst.change(valchange);
		input_percent.change(valchange);
		
		if (_edit==false) {
			var dataset = Lang.sets(dataname+".code");
			for (var i=0; i<dataset.length; ++i) {
				var selected = dataset[i].data==_code;
				input_code.append('<option data-value="' + dataset[i].data + '" ' + (selected?"selected":"") + '>' + dataset[i].label + '</option>');
			}
			input_code.change(change);
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
	this.country = function (str) {
		if (str) {
			_country = str;
		}
		return _country;
	};
	this.name = function (str) {
		if (str) {
			_name = str;
		}
		return _name;
	};
	this.code = function (str) {
		if (str) {
			_code = str;
		}
		return _code;
	};
	this.percent = function (str) {
		if (str) {
			_percent = str;
		}
		return _percent;
	};
	this.hst = function (str) {
		if (str) {
			_hst = str;
		}
		return _hst;
	};
	this.gst = function (str) {
		if (str) {
			_gst = str;
		}
		return _gst;
	};
	this.pst = function (str) {
		if (str) {
			_pst = str;
		}
		return _pst;
	};
	this.parent = function (obj) {
		_parent = obj;
	};
	this.destroy = function () {
		input_code.off();
		input_hst.off();
		input_gst.off();
		input_pst.off();
		input_percent.off();
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
