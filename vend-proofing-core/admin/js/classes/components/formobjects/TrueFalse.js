
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.components.formobjects.TrueFalse = function () {
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
	var _uniquid = 				"";
	var _input = 				null;
	/* private methods
		*/
	function change (e, active) {
		_ingest._value = active ? "true" : "false";
		_instance.dispatch("onChanged");
	}
	function render () {
		
		_uniquid = "FO" + Func.uniquid();
		var value = _ingest._value=="true" ? true : false;
		
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="FormObject TrueFalse">';
			xhtml += 	'<div class="Label">' + _label + '</div>';
			xhtml += 	'<div class="toggle toggle-modern"></div>';
			xhtml += '</div>';
		_parent.append(xhtml);
		_input = _parent.find("#" + _uniquid + " .toggle");
		_input.toggles({
			drag: false,
			click: true,
			text: {
				on: Lang.lookup("true"),
				off: Lang.lookup("false")
			},
			on: value,
			width: 125,
			height: 40
		});
		_input.on('toggle', change);
		
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
		_input.off();
		if (_parent!=null) {
			_parent.empty();
		}
	};
	this.initialize = function () {
		Func = classes.helpers.Func;
		Lang = classes.data.Lang;
		render();
	};
};

classes.components.formobjects.TrueFalse.prototype = new EventDispatcher();
