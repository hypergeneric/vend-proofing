
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.components.XMLPane = function () {
	/* "imported" classes
		*/
	var Func;
	var Lang;
	/* private properites
		*/
	var _instance = 			this;
	var _inner = 				null;
	var _suid = 				"";
	var _name = 				"";
	var _reference = 			null;
	var _ingest = 				null;
	var _node = 				"";
	var _parent = 				null;
	var _enumneration = 		[];
	/* private methods
		*/
	function onChanged (eo) {
		_instance.dispatch("onChanged");
	}
	function contains(a, obj) {
		for (var i = 0; i < a.length; i++) {
			if (a[i] === obj) {
				return true;
			}
		}
		return false;
	}
	function render () {
		// create the html
		var xhtml = '';
			xhtml += '<div class="XMLPane">';
			xhtml += 	'<div class="Inner">';
			xhtml += 	'</div>';
			xhtml += '</div>';
		_parent.html(xhtml);
		_inner = _parent.find('.XMLPane .Inner');
		// loop through and init each object
		_enumneration = [];
		var refobj = _reference.data[_node];
		var dataset = _ingest.data[_node];
		for (var prop in refobj) {
			// ignore these
			if (prop=="_attributes") continue;
			if (prop=="_value") continue;
			if (prop=="__proto__") continue;
			if (prop=="#text") continue;
			if (prop=="#cdata-section") continue;
			// get the data, set readability, hidden members, and non-existent members
			var row_data_ref = refobj[prop];
			if (!dataset[prop]) {
				_ingest.data[_node][prop] = {
					_value: "",
					_attributes: {}
				};
			}
			if (row_data_ref._value) {
				if (!dataset[prop]._value) {
					dataset[prop]._value = "";
				}
				if ( dataset[prop]._value=="" ) {
					dataset[prop]._value = row_data_ref._value;
				}
			}
			if (row_data_ref._attributes) {
				if (!dataset[prop]._attributes) {
					dataset[prop]._attributes = {};
				}
				for (var attr in row_data_ref._attributes) {
					if (!dataset[prop]._attributes[attr]) {
						dataset[prop]._attributes[attr] = "";
					}
					if ( dataset[prop]._attributes[attr]=="" )  {
						dataset[prop]._attributes[attr] = row_data_ref._attributes[attr];
					}
					if ( !contains(["width", "height", "target", "timezone", "offset", "href"], attr) ) {
						dataset[prop]._attributes[attr] = row_data_ref._attributes[attr];
					}
				}
			}
			//console.log(_ingest);
			var row_data = dataset[prop];
			//console.log(row_data);
			//console.log(refobj);
			var access = row_data._attributes.access || "rw";
			if (access=="h") continue; // hidden member
			//if (Lang.exists(prop)==false) continue;
			// get the label and find out what kind it is
			var label = Lang.lookup(prop);
			var bits = prop.split("_");
			var type = bits.pop();
			// find the form object
			var formobjects = classes.components.formobjects;
			var classid = formobjects.Input;
			switch (type) {
				case "ratio":
				 classid = formobjects.Ratio;
				 break;
				case "date":
				 classid = formobjects.DateSelection;
				 break;
				case "num":
				 classid = formobjects.Numeric;
				 break;
				case "bool":
				 classid = formobjects.TrueFalse;
				 break;
				case "color":
				 classid = formobjects.Picker;
				 break;
				case "asset":
				 classid = formobjects.Asset;
				 break;
				case "email":
				 classid = formobjects.Email;
				 break;
				case "url":
				 classid = formobjects.URI;
				 break;
				case "linkage":
				 classid = formobjects.Linkage;
				 break;
				default:
				 if ( row_data._attributes.options!=undefined || row_data._attributes.action!=undefined ) {
					 classid = formobjects.Combo;
				 }
			}
			// create the form object
			var formobject = new classid();
			if (formobject.suid) {
				formobject.suid(_suid);
			}
			if (formobject.name) {
				formobject.name(_name);
			}
			formobject.label(label);
			formobject.ingest(row_data);
			formobject.parent(_inner);
			formobject.addEventListener("onChanged", onChanged);
			formobject.initialize();
			_enumneration.push(formobject);
		}
			
	}
	/* public methods
		*/
	this.parent = function (obj) {
		if (obj) {
			_parent = obj;
		}
		return _parent;
	};
	this.node = function (str) {
		if (str) {
			_node = str;
		}
		return _node;
	};
	this.ingest = function (obj) {
		if (obj) {
			_ingest = obj;
		}
		return _ingest;
	};
	this.reference = function (obj) {
		if (obj) {
			_reference = obj;
		}
		return _reference;
	};
	this.suid = function (str) {
		if (str) {
			_suid = str;
		}
		return _suid;
	};
	this.name = function (str) {
		if (str) {
			_name = str;
		}
		return _name;
	};
	this.destroy = function () {
		if (_parent!=null) {
			for (var i=0; i<_enumneration.length; ++i) {
				var formobject = _enumneration[i];
				formobject.removeEventListener("onChanged", onChanged);
				formobject.destroy();
			}
			_parent.empty();
		}
	};
	this.initialize = function () {
		Func = classes.helpers.Func;
		Lang = classes.data.Lang;
		render();
	};
};

classes.components.XMLPane.prototype = new EventDispatcher();
