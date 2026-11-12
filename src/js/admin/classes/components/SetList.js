
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.components.SetList = function () {
	/* "imported" classes
		*/
	var Func;
	var XMLPane;
	var TabPanel;
	var Auth;
	var Lang;
	var Dialog;
	/* private properites
		*/
	var _instance = 			this;
	var _name = 				"";
	var _puid = 				"";
	var _columns = 				[];
	var _ingest = 				[];
	var _selected = 			[];
	/* private methods
		*/
	function onSetData (success, data) {
		_ingest = new Array();
		var lines = data=="" || data==undefined ? [] : data.split("\n");
		for (var i=0; i<lines.length; ++i) {
			var line = lines[i];
			var values = line.split("\t");
			var thesuid = values.shift();
			var obj = {
				index: i,
				suid: thesuid
			};
			for (var j=0; j<values.length; ++j) {
				var value = values[j];
				var column_id = _columms[j];
				obj[column_id] = value;
			}
			_ingest.push(obj);
		}
		for (var i=0; i<_selected.length; ++i) {
			addBySuid(_selected[i].suid);
		}
		_instance.dispatch("onDataLoaded");
	}
	function create (obj, uid) {
		_instance.dispatch("onStartLoad");
		var suid = uid || "";
		var data = [];
		for (var i=0; i<_columms.length; ++i) {
			var key = _columms[i];
			var value = obj[key]!=undefined ? obj[key] : "null";
			data.push(value);
		}
		data = data.join("\t");
		Auth.send(this, onSetData, {
			action: "set_create",
			suid:  suid,
			puid: _puid,
			name: _name,
			data: data
		});
	}
	function update (obj, suid) {
		if (!suid) suid = _selected[0].suid;
		_instance.dispatch("onStartLoad");
		var data = [];
		for (var i=0; i<_columms.length; ++i) {
			var key = _columms[i];
			var value = obj[key]!=undefined ? obj[key] : "null";
			data.push(value);
		}
		data = data.join("\t");
		Auth.send(this, onSetData, {
			action: "set_update",
			suid:  suid,
			puid: _puid,
			name: _name,
			data: data
		});
	}
	function remove (suid) {
		if (!suid) suid = _selected[0].suid;
		_instance.dispatch("onStartLoad");
		Auth.send(this, onSetData, {
			action: "set_delete",
			suid: suid,
			puid: _puid,
			name: _name
		});
		removeBySuid(suid);
	}
	function loadSetData () {
		_instance.dispatch("onStartLoad");
		Auth.send(this, onSetData, {
			action: "set_list",
			puid: _puid,
			name: _name
		});
	}
	function move (from, to) {
		_instance.dispatch("onStartLoad");
		Auth.send(this, onSetData, {
			action: "set_reindex",
			puid: _puid,
			name: _name,
			from: from,
			to: to
		});
	}
	function addBySuid (suid) {
		var doadd = true;
		var obj;
		for (var i=0; i<_ingest.length; ++i) {
			if (_ingest[i].suid==suid) {
				obj = _ingest[i];
				break;
			}
		}
		for (var i=0; i<_selected.length; ++i) {
			if (_selected[i].suid==suid) {
				_selected[i] = obj; // update
				doadd = false
				break;
			}
		}
		if (doadd) {
			_selected.push(obj);
			_instance.dispatch("onSelected");
		}
	}
	function removeBySuid (suid) {
		for (var i=0; i<_selected.length; ++i) {
			if (_selected[i].suid==suid) {
				_selected.splice(i, 1);
				break;
			}
		}
		_instance.dispatch("onSelected");
	}
	function render () {
		loadSetData();
	}
	/* public methods
		*/
	this.reload = function (obj) {
		loadSetData();
	};
	this.ingest = function (obj) {
		if (obj) {
			_ingest = obj;
		}
		return _ingest;
	};
	this.parent = function (obj) {
		if (obj) {
			_parent = obj;
		}
		return _parent;
	};
	this.puid = function (str) {
		if (str) {
			_puid = str;
		}
		return _puid;
	};
	this.name = function (str) {
		if (str) {
			_name = str;
		}
		return _name;
	};
	this.columms = function (arr) {
		if (arr!=undefined) {
			_columms = arr;
		}
		return _columms;
	};
	this.selected = function (arr) {
		if (arr!=undefined) {
			_selected = arr;
		}
		return _selected;
	};
	this.reIndex = function (oldIndex, newIndex, suid) {
		if (suid!=undefined) {
			addBySuid(suid);
		}
		move(oldIndex, newIndex);
	};
	this.deleteSet = function (uid) {
		remove(uid);
	};
	this.createObject = function (obj, uid) {
		create(obj, uid);
	};
	this.updateObject = function (obj, uid) {
		update(obj, uid);
	};
	this.addSelected = function (str) {
		addBySuid(str);
	};
	this.removeSelected = function (str) {
		removeBySuid(str);
	};
	this.destroy = function () {
	};
	this.initialize = function () {
		Dialog = classes.components.Dialog;
		Lang = classes.data.Lang;
		Auth = classes.data.Auth;
		TabPanel = classes.components.TabPanel;
		XMLPane = classes.components.XMLPane;
		Func = classes.helpers.Func;
		render();
	};
};

classes.components.SetList.prototype = new EventDispatcher();