
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.components.formobjects.Combo = function () {
	/* "imported" classes
		*/
	var Func;
	var Lang;
	var Auth;
	/* private properites
		*/
	var _instance = 			this;
	var _label = 				"";
	var _puid = 				"";
	var _ingest = 				null;
	var _parent = 				null;
	var _input = 				null;
	var _uniquid = 				"";
	/* private methods
		*/
	function onSetData (success, str) {
		var dataset = new Array();
		/*
			parse it all out
			*/
		var value = _ingest._value;
		var lines = str=="" || str==undefined ? [] : str.split("\n");
		for (var i=0; i<lines.length; ++i) {
			var row = lines[i].split("\t");
			dataset.push({
				label: row[1],
				data: row[0]
			});
		}
		dataset.unshift({
			label: Lang.lookup("Please Choose"),
			data: ""
		});
		_input.prop("disabled", false);
		_input.empty();
		for (var i=0; i<dataset.length; ++i) {
			var selected = dataset[i].data==value;
			_input.append('<option data-value="' + dataset[i].data + '" ' + (selected?"selected":"") + '>' + dataset[i].label + '</option>');
		}
	}
	function change () {
		var selected = $("option:selected", this);
		_ingest._value = selected.attr("data-value");
		_instance.dispatch("onChanged");
	}
	function render () {
		_uniquid = "FO" + Func.uniquid();
		var value = _ingest._value;
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="FormObject Combo">';
			xhtml += 	'<div class="Label">' + _label + '</div>';
			xhtml += 	'<select><option>' + Lang.lookup("Loading Data Set") + '</option></select>';
			xhtml += '</div>';
		_parent.append(xhtml);
		_input = _parent.find("#" + _uniquid + " select");
		if (_ingest._attributes.options) {
			var dataset = Lang.sets(_ingest._attributes.options);
			_input.empty();
			for (var i=0; i<dataset.length; ++i) {
				var selected = dataset[i].data==value;
				_input.append('<option data-value="' + dataset[i].data + '" ' + (selected?"selected":"") + '>' + dataset[i].label + '</option>');
			}
		} else {
			_input.prop("disabled", true);
			Auth.send(this, onSetData, {
				action: _ingest._attributes.action,
				name: _ingest._attributes.name,
				suid: _ingest._attributes.suid
			});
		}
		_input.change(change);
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
		Auth = classes.data.Auth;
		Func = classes.helpers.Func;
		Lang = classes.data.Lang;
		render();
	};
};

classes.components.formobjects.Combo.prototype = new EventDispatcher();
