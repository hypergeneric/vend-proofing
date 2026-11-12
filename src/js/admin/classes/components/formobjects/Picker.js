
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.components.formobjects.Picker = function () {
	/* "imported" classes
		*/
	var Func;
	var Lang;
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
	var _use_spectrum = 		!Modernizr.inputtypes.color;
	/* private methods
		*/
	function resize () {
		var sw = _parent.find(".Picker").outerWidth();
		lw = _input_left.outerWidth();
		if (_use_spectrum) {
			lw = _input_left.next().outerWidth();
		} else {
			lw = _input_left.outerWidth();
		}
		rh = _input_right.outerHeight();
		rw = sw-lw-10;
		_input_right.outerWidth(rw);
		if (_use_spectrum) {
			_input_left.next().outerHeight(rh);
		} else {
			_input_left.outerHeight(rh);
		}
	}
	function change () {
		if ($(this).hasClass("Right")) {
			var value = _input_right.val();
			if (value.charAt(0)!="#") {
				value = "#" + value;
				_input_right.val(value);
			}
			if (_use_spectrum) {
				_input_left.spectrum("set", value);
			} else {
				_input_left.val(value);
			}
		} else {
			var value = _input_left.val();
			_input_right.val(value);
		}
		value = "0x" + value.substr(1);
		_ingest._value = value;
		_instance.dispatch("onChanged");
	}
	function render () {
		
		_uniquid = "FO" + Func.uniquid();
		var value = _ingest._value;
			value = value.split("0x").join("#");
		
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="FormObject Picker">';
			xhtml += 	'<div class="Label">' + _label + '</div>';
			xhtml += 	'<input class="Label Left" type="color" value="' + value + '" />';
			xhtml += 	'<input class="Label Right" type="text" value="' + value + '" />';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
		_parent.append(xhtml);
		_input_left = _parent.find("#" + _uniquid + " .Left");
		_input_right = _parent.find("#" + _uniquid + " .Right");
		
		if (_use_spectrum) {
			_input_left.addClass("PickerObj").spectrum({
				showInput: true,
				preferredFormat: "hex",
				cancelText: Lang.lookup("Cancel"),
				chooseText: Lang.lookup("Save")
			});
		}
		
		_input_left.change(change);
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

classes.components.formobjects.Picker.prototype = new EventDispatcher();
