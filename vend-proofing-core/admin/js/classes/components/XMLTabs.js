
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.components.XMLTabs = function () {
	/* "imported" classes
		*/
	var Func;
	var XMLPane;
	var TabPanel;
	var Auth;
	var Lang;
	var Dialog;
	var Admin;
	/* private properites
		*/
	var _instance = 			this;
	var _tabindex = 			0;
	var _type = 				"";
	var _suid = 				"";
	var _state = 				"";
	var _loaded = 				false;
	var _inited = 				false;
	var _redraw = 				false;
	var _reference = 			null;
	var _unsaved = 				false;
	var _revert_is_delete = 	false;
	var _ingest = 				null;
	var _parent = 				null;
	var _panel = 				null;
	var _editor = 				null;
	var _prepend_apps = 		[];
	var _append_apps = 			[];
	/* private methods
		*/
	function saveClick () {
		_ingest.data._attributes["default"] = "false";
		var xmlstr = Func.JsonToXML(_ingest);
		_panel.screen(true);
		Auth.send(this, saveComplete, {
			action: "setup_save",
			suid: _suid,
			type: _type,
			data: '<?xml version="1.0"?>' + xmlstr
		});
	}
	function saveComplete (success, data) {
		_unsaved = false;
		_panel.screen(false);
		_panel.disableOptions("save", "cancel");
		_panel.enableOptions("revert");
		if (success) {
			_instance.dispatch("onDataChanged");
		}
	}
	function cancelClick () {
		Dialog.create({
			size: "420x*",
			title: Lang.lookup("Cancel Changes Confirmation"),
			content: Lang.lookup("Cancel Changes Confirmation Description"),
			owner: this,
			options: [{
				label: Lang.lookup("OK"),
				func: cancelConfirm
			},{
				label: Lang.lookup("Cancel")
			}]
		});
	}
	function cancelConfirm () {
		loadBaseFile();
	}
	function revertClick () {
		Dialog.create({
			size: "420x*",
			title: Lang.lookup("Revert Confirmation"),
			content: Lang.lookup("Revert Confirmation Description"),
			owner: this,
			options: [{
				label: Lang.lookup("Yes Revert"),
				func: revertConfirm
			},{
				label: Lang.lookup("Cancel")
			}]
		});
	}
	function revertConfirm () {
		_redraw = true;
		_panel.screen(true);
		Auth.send(this, revertComplete, {
			action: "setup_revert",
			suid: _suid,
			type: _type
		});
	}
	function revertComplete (success, data) {
		loadBaseFile();
		if (success) {
			_instance.dispatch("onDataChanged");
		}
	}
	function updateView () {
		if (_loaded) {
			_tabindex = 0;
			var tabdata = _panel.tabdata();
			for (var i=0; i<tabdata.length; ++i) {
				if (_state[0]==tabdata[i].key) {
					_tabindex = i;
					break;
				}
			}
			if (_redraw) {
				_redraw = false;
				_panel.index(-1);
			}
			_panel.index(_tabindex);
			destroyEditor();
			drawEditor();
		}
	}
	function initApps () {
		_loaded = true;
		/*
			create the tab data
			*/
		var tabdata = [];
		for (var i=0; i<_prepend_apps.length; ++i) {
			tabdata.push(_prepend_apps[i]);
		}
		for (var i=0; i<_append_apps.length; ++i) {
			tabdata.push(_append_apps[i]);
		}
		/*
			setup the tab panel
			*/
		_panel.screen(false);
		_panel.tabdata(tabdata);
		_instance.dispatch("onTabData");
	}
	function dataLoaded (success, response) {
		/*
			parse the incomming data
			*/
		var xmlobj = $.parseXML(response);
		_ingest = Func.xmlToJson(xmlobj);
		_loaded = true;
		
		/*
			create the tab data
			*/
		var tabdata = [];
		for (var i=0; i<_prepend_apps.length; ++i) {
			tabdata.push(_prepend_apps[i]);
		}
		for (var prop in _reference.data) {
			if (prop=="_attributes") continue;
			if (prop=="_value") continue;
			if (prop=="__proto__") continue;
			if (prop=="#text") continue;
			if (prop=="#cdata-section") continue;
			tabdata.push({
				label: Lang.lookup(prop),
				key: prop,
				options: [
				{
					label: Lang.lookup("Save"),
					primary: true,
					key: "save"
				},{
					label: Lang.lookup("Cancel"),
					key: "cancel"
				},{
					label: _revert_is_delete ? Lang.lookup("Delete Page") : Lang.lookup("Revert To Default"),
					key: "revert"
				}
			]});
		}
		for (var i=0; i<_append_apps.length; ++i) {
			tabdata.push(_append_apps[i]);
		}
		/*
			setup the tab panel
			*/
		_panel.screen(false);
		_panel.tabdata(tabdata);
		updateView();
		_instance.dispatch("onTabData");
		_instance.dispatch("dataLoaded");
	}
	function referenceLoaded (success, response) {
		var xmlobj = $.parseXML(response);
		_reference = Func.xmlToJson(xmlobj);
		_inited = true;
		loadBaseFile();
	}
	function loadBaseFile () {
		_panel.screen(true);
		_loaded = false;
		_unsaved = false;
		if (_inited==false) {
			Auth.send(this, referenceLoaded, {
				action: "setup_defaults",
				type: _type
			});
			return;
		}
		Auth.send(this, dataLoaded, {
			action: "setup_load",
			suid: _suid,
			type: _type
		});
	}
	function onChanged () {
		var tab = _panel.tab();
		if (tab.classid) {
			_instance.dispatch("onDataChanged");
		} else {
			_unsaved = true;
			_panel.enableOptions("save", "cancel");
			_instance.dispatch("onChanged");
		}
	}
	function drawEditor () {
		if (_panel.index()==-1) return;
		var tab = _panel.tab();
		if (tab.classid) {
			_editor = new tab.classid();
			_editor.controller(_instance);
			_editor.panel(_panel);
			_editor.addEventListener("onChanged", onChanged);
			_editor.initialize(tab.init);
			if (_editor.state) {
				_editor.state(_state);
			}
		} else {
			_editor = new XMLPane();
			_editor.reference(_reference);
			_editor.ingest(_ingest);
			_editor.node(tab.key);
			_editor.addEventListener("onChanged", onChanged);
			_editor.parent(_panel.body());
			_editor.initialize();
			_panel.disableOptions("*");
			if (_unsaved==true) {
				_panel.enableOptions("save", "cancel");
			}
			if (_ingest.data._attributes["default"]!="true") {
				_panel.enableOptions("revert");
			}
		}
	}
	function destroyEditor () {
		if (_editor!=null) {
			_editor.removeEventListener("onChanged", onChanged);
			_editor.destroy();
			_editor = null;
		}
	}
	function index () {
		var tab = _panel.tab();
		if (tab.key==_state[0]) {
			var hash = _state.join("/");
		} else {
			var hash = tab.key;
		}
		if (tab) {
			Admin.state(null, hash);
		}
	}
	function option () {
		switch (_panel.key()) {
			case "save" :
			 saveClick()
			 return;
			case "cancel" :
			 cancelClick();
			 return;
			case "revert" :
			 revertClick();
			 return;
		}
		_editor.option(_panel.key());
	}
	function render () {
		_panel = new TabPanel();
		_panel.addEventListener("onIndex", index);
		_panel.addEventListener("onOption", option);
		_panel.parent(_parent);
		_panel.initialize();
		if (_type!="") {
			loadBaseFile();
		} else {
			initApps();
		}
	}
	/* public methods
		*/
	this.tabdata = function () {
		return _panel.tabdata();
	};
	this.ingest = function (obj) {
		if (obj) {
			_ingest = obj;
		}
		return _ingest;
	};
	this.revert_is_delete = function (bool) {
		if (bool===true||bool===false) {
			_revert_is_delete = bool;
		}
		return _revert_is_delete;
	};
	this.parent = function (obj) {
		if (obj) {
			_parent = obj;
		}
		return _parent;
	};
	this.unsaved = function (bool) {
		if (bool===true||bool===false) {
			_unsaved = bool;
		}
		return _unsaved;
	};
	this.suid = function (str) {
		if (str) {
			_suid = str;
		}
		return _suid;
	};
	this.type = function (str) {
		if (str) {
			_type = str;
		}
		return _type;
	};
	this.state = function (str) {
		_state = str.split("/");
		updateView();
	};
	this.reload = function () {
		loadBaseFile();
	};
	this.destroy = function () {
		destroyEditor();
		_panel.removeEventListener("onIndex", index);
		_panel.removeEventListener("onOption", option);
		_panel.destroy();
	};
	this.appendApplication = function (options) {
		_append_apps.push(options);
	};
	this.prependApplication = function (options) {
		_prepend_apps.push(options);
	};
	this.initialize = function () {
		Admin = classes.Admin;
		Dialog = classes.components.Dialog;
		Lang = classes.data.Lang;
		Auth = classes.data.Auth;
		TabPanel = classes.components.TabPanel;
		XMLPane = classes.components.XMLPane;
		Func = classes.helpers.Func;
		render();
	};
};

classes.components.XMLTabs.prototype = new EventDispatcher();