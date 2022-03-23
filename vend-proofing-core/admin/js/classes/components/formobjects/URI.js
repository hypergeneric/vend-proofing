
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.components.formobjects.URI = function () {
	
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
	var _uniquid = 				"";
	
	var _input_left = 			null;
	var _input_right = 			null;
	
	/* private methods
		*/
		
	function resize () {
		var sw = _parent.find(".Email").outerWidth();
		var lw = _input_left.outerWidth();
		var rw = sw-lw-10;
		_input_right.outerWidth(rw);
	}
	
	function change () {
		_ingest._attributes.href = _input_left.val();
		_ingest._value = _input_right.val();
		_instance.dispatch("onChanged");
	}
	
	function render () {
		
		_uniquid = "FO" + Func.uniquid();

		var value = _ingest._value;
		
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="FormObject Email">';
			xhtml += 	'<div class="Label">' + _label + '</div>';
			xhtml += 	'<input class="Label Left" placeholder="' + Lang.lookup("website_url") + '" type="text" value="' + _ingest._attributes.href + '" />';
			xhtml += 	'<input class="Label Right" placeholder="' + Lang.lookup("website_title") + '" type="text" value="' + _ingest._value + '" />';
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

classes.components.formobjects.URI.prototype = new EventDispatcher();
