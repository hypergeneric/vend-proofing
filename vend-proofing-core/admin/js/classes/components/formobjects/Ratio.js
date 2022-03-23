
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.components.formobjects.Ratio = function () {
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
	/* private methods
		*/
	function resize () {
		var sw = _parent.find(".Ratio").outerWidth();
		var fw = sw-40;
		var lw = Math.round(fw/2);
		var rw = fw-lw;
		_input_left.outerWidth(lw);
		_input_right.outerWidth(rw);
	}
	function change () {
		_ingest._value = _input_left.val() + _delimiter + _input_right.val();
		_instance.dispatch("onChanged");
	}
	function render () {
		
		_uniquid = "FO" + Func.uniquid();
		_delimiter = _ingest._attributes.delimiter || "x";
		var value = _ingest._value || delimiter;
		value = value.split(_delimiter);
		
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="FormObject Ratio">';
			xhtml += 	'<div class="Label">' + _label + '</div>';
			xhtml += 	'<input class="Label Left" type="input" value="' + value[0] + '" />';
			xhtml += 	'<div class="Delimiter">' + _delimiter + '</div>';
			xhtml += 	'<input class="Label Right" type="input" value="' + value[1] + '" />';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
		_parent.append(xhtml);
		_input_left = _parent.find("#" + _uniquid + " .Left");
		_input_right = _parent.find("#" + _uniquid + " .Right");
		_input_left.on("input", change);
		_input_right.on("input", change);
		
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

classes.components.formobjects.Ratio.prototype = new EventDispatcher();
