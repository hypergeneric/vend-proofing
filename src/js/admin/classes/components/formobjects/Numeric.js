
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.components.formobjects.Numeric = function () {
	/* "imported" classes
		*/
	var Func;
	var Lang;
	var StageProxy;
	/* private properites
		*/
	var _instance = 			this;
	var _label = 				"";
	var _puid = 				"";
	var _ingest = 				null;
	var _parent = 				null;
	var _delimiter = 			"";
	var _uniquid = 				"";
	var _input_left = 			null;
	var _input_right = 			null;
	var _use_number_polyfill = 	!Modernizr.inputtypes.number;
	var _use_range_polyfill = 	!Modernizr.inputtypes.range;
	/* private methods
		*/
	function resize () {
		var sw = _parent.find(".Numeric").outerWidth();
		var lw = _input_left.outerWidth();
		if (_use_number_polyfill) {
			lw = _input_left.parent().outerWidth();
		}
		var lh = _input_left.outerHeight();
		var rw = sw-lw-10;
		_input_right.outerWidth(rw);
		_input_right.outerHeight(lh);
	}
	function change () {
		if ($(this).hasClass("Right")) {
			_input_left.val(_input_right.val());
		} else {
			_input_right.val(_input_left.val());
		}
		_ingest._value = _input_left.val();
		_instance.dispatch("onChanged");
	}
	function render () {
		
		_uniquid = "FO" + Func.uniquid();
		var stepsize = _ingest._attributes.increment==undefined ? 1 : parseFloat(_ingest._attributes.increment);
		var maxvalue = _ingest._attributes.max==undefined ? 100 : parseFloat(_ingest._attributes.max);
		var minvalue = _ingest._attributes.min==undefined ? 0 : parseFloat(_ingest._attributes.min);
		var value = _ingest._value;
		
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="FormObject Numeric">';
			xhtml += 	'<div class="Label">' + _label + '</div>';
			xhtml += 	'<input class="Label Left" type="number" max="' + maxvalue + '" min="' + minvalue + '" step="' + stepsize + '" value="' + value + '" />';
			xhtml += 	'<input class="Label Right" type="range" max="' + maxvalue + '" min="' + minvalue + '" step="' + stepsize + '" value="' + value + '" />';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
		_parent.append(xhtml);
		_input_left = _parent.find("#" + _uniquid + " .Left");
		_input_right = _parent.find("#" + _uniquid + " .Right");
		
		if (_use_number_polyfill) {
			_input_left.addClass("Spinner").spinner();
		}
		if (_use_range_polyfill) {
			_input_right.slider();
		}
		
		_input_left.change(change);
		_input_right.on("input change", change);
		
		StageProxy.addEventListener("onResize", resize);
		resize();
		
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
		if (obj) {
			_parent = obj;
		}
		return _parent;
	};
	this.ingest = function (obj) {
		if (obj) {
			_ingest = obj;
		}
		return _ingest;
	};
	this.puid = function (str) {
		if (str) {
			_puid = str;
		}
		return _puid;
	};
	this.destroy = function () {
		_input_left.off();
		_input_right.off();
		StageProxy.removeEventListener("onResize", resize);
		if (_parent!=null) {
			_parent.empty();
		}
	};
	this.initialize = function () {
		Func = classes.helpers.Func;
		Lang = classes.data.Lang;
		StageProxy = classes.StageProxy;
		render();
	};
};

classes.components.formobjects.Numeric.prototype = new EventDispatcher();
