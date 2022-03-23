
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.components.formobjects.Linkage = function () {
	/* "imported" classes
		*/
	var Func;
	var Lang;
	var Dialog;
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
	var _input_mid = 			null;
	var _input_right = 			null;
	/* private methods
		*/
	function resize () {
		var sw = _parent.find(".Linkage").outerWidth();
		var lw = _input_left.outerWidth();
		var rh = _input_right.outerHeight();
		var rw = sw-lw-10;
		_input_right.outerWidth("auto");
		_input_left.outerHeight(rh);
		if (sw>480) {
			_input_right.outerWidth(rw);
		}
	}
	function click () {
		Dialog.create({
			size: "520x*",
			title: Lang.lookup("Create Link"),
			content: classes.dialogs.LinkChooser,
			init: {
				"uri": _input_mid.val(),
				"target": _input_right.val(),
				"showlabel": false,
				"showassets": false,
				"showtarget": true
			},
			owner: this,
			options: [{
				label: Lang.lookup("Save"),
				func: linkConfirm
			},{
				label: Lang.lookup("Cancel")
			}]
		});
	}
	function linkConfirm () {
		var obj = Dialog.last().classobj;
		_input_mid.val(obj.uri());
		_input_right.find('option[data-value="' + obj.target() + '"]').prop('selected', true);
		_input_right.val(obj.target());
		_ingest._value = obj.uri();
		_ingest._attributes.target = obj.target();
		_instance.dispatch("onChanged");
	}
	function combo () {
		var selected = $("option:selected", this);
		_ingest._attributes.target = selected.val();
		_instance.dispatch("onChanged");
	}
	function change () {
		_ingest._value = _input_mid.val();
		_instance.dispatch("onChanged");
	}
	function render () {
		
		_uniquid = "FO" + Func.uniquid();
		var value = _ingest._value;
		var target = _ingest._attributes.target;
		
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="FormObject Linkage">';
			xhtml += 	'<div class="Label">' + _label + '</div>';
			xhtml += 	'<input class="Label Mid" type="input" placeholder="' + Lang.lookup("Or Enter URL") + '" value="' + value + '" />';
			xhtml += 	'<div class="Left">' + Lang.lookup("Link to a Page You Created") + '</div>';
			xhtml += 	'<select class="Right"></select>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
		_parent.append(xhtml);
		
		_input_left = _parent.find("#" + _uniquid + " .Left");
		_input_mid = _parent.find("#" + _uniquid + " .Mid");
		_input_right = _parent.find("#" + _uniquid + " .Right");
		
		var dataset = Lang.sets("uri_target.target");
		for (var i=0; i<dataset.length; ++i) {
			var selected = dataset[i].data==target;
			_input_right.append('<option value="' + dataset[i].data + '" ' + (selected?"selected":"") + '>' + dataset[i].label + '</option>');
		}
		
		_input_left.click(click);
		_input_mid.on("input", change);
		_input_right.change(combo);
		
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
		_input_mid.off();
		_input_right.off();
		StageProxy.removeEventListener("onResize", resize);
		if (_parent!=null) {
			_parent.empty();
		}
	};
	this.initialize = function () {
		Dialog = classes.components.Dialog;
		Func = classes.helpers.Func;
		Lang = classes.data.Lang;
		StageProxy = classes.StageProxy;
		render();
	};
};

classes.components.formobjects.Linkage.prototype = new EventDispatcher();
