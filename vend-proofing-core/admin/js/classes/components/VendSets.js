
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.components.VendSets = function () {
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
	var _type = 				"";
	var _suid = 				"";
	var _state = 				"";
	var _loaded = 				false;
	var _unsaved = 				false;
	var _inited = 				false;
	var _redraw = 				false;
	var _reference = 			null;
	var _revert_is_delete = 	false;
	var _ingest = 				null;
	var _parent = 				null;
	var _panel = 				null;
	var _editor = 				null;
	var _tabdata = 				[];
	var _pages_selected = 		[];
	var _tabindex = 			0;
	/* private methods
		*/
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
	function dataLoaded (success, response) {
		/*
			parse the incomming data
			*/
		var xmlobj = $.parseXML(response);
		_ingest = Func.xmlToJson(xmlobj);
		_loaded = true;
		/* see what the big man has to day
			*/
		var content_settings;
		for (var i=0; i<Admin.config().setup.content.type.length; ++i) {
			var content_type = Admin.config().setup.content.type[i];
			if (content_type._attributes.key.toLowerCase()==_type) {
				content_settings = content_type._attributes;
				break;
			}
		}
		var image_list = {
			classid: classes.panels.AssetLibrary,
			init: {
				display: "simple",
				uniquid: "page-image-list-"+_suid,
				name: "page",
				curated: true,
				key: "image",
				sideload: {
					use: false
				}
			},
			label: Lang.lookup("Images"),
			key: "image",
			options: []
		}
		var audio_list = {
			classid: classes.panels.AssetLibrary,
			init: {
				uniquid: "page-track-list-"+_suid,
				name: "page",
				paging: false,
				curated: true,
				key: "track",
				importer: {
					use: false,
					key: "track",
					suid: ""
				}
			},
			label: Lang.lookup("Tracks"),
			key: "track",
			options: []
		}
		var session_list = {
			classid: classes.panels.Sessions,
			init: {
				uniquid: "session-list-"+_suid,
			},
			label: Lang.lookup("Sessions"),
			key: "sessions",
			options: []
		}
		var discount_list = {
			classid: classes.panels.Discounts,
			init: {
				uniquid: "discount-list-"+_suid,
			},
			label: Lang.lookup("Discounts"),
			key: "discounts",
			options: []
		}
		/*
			create the tab data
			*/
		_tabdata = []; // save the first app
		if (content_settings.tabs=="true") {
			for (var prop in _reference.data) {
				if (prop=="_attributes") continue;
				if (prop=="_value") continue;
				if (prop=="__proto__") continue;
				if (prop=="#text") continue;
				if (prop=="#cdata-section") continue;
				if (prop=="child"&&content_settings.children=="true") continue;
				_tabdata.push({
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
						label: Lang.lookup("Revert To Default"),
						key: "revert"
					}
				]});
			}
		}
		if ( content_settings.key=="UploadSet" ) {
			_tabdata.push(image_list);
		} else if ( content_settings.key=="CategorySet" ) {
			_tabdata.push({
				classid: classes.panels.CategorySet,
				init: {
				},
				label: Lang.lookup("Images"),
				key: "image",
				options: []
			});
		} else if ( content_settings.key=="DropboxSet" ) {
			_tabdata.push({
				classid: classes.panels.DropboxSet,
				init: {
				},
				label: Lang.lookup("Dropbox"),
				key: "dropbox",
				options: []
			});
		} else if (content_settings.key=="ZipFile") {
			if (Admin.config().setup.hub._value!="true") {
				_tabdata.push({
					classid: classes.panels.ZipFile,
					init: {
					},
					label: Lang.lookup("Zip File"),
					key: "zipfile",
					options: []
				});
			}
		}
		_tabdata.push(audio_list);
		_tabdata.push(discount_list);
		_tabdata.push(session_list);
		_tabdata.push({
			classid: classes.panels.SetSharing,
			init: {
			},
			label: Lang.lookup("Sharing"),
			key: "share",
			options: []
		});
		/*
			setup the tab panel
			*/
		_panel.screen(false);
		_panel.tabdata(_tabdata);
		updateTabs();
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
		_unsaved = true;
		_panel.enableOptions("save", "cancel");
		_instance.dispatch("onChanged");
	}
	function updateTabs () {
		if (_loaded) {
			_tabindex = 0;
			var tabdata = _panel.tabdata();
			for (var i=0; i<tabdata.length; ++i) {
				if (_state[2]==tabdata[i].key) {
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
			drawTabEditor();
		}
	}
	function index () {
		var tab = _panel.tab();
		if (_state.length==3) {
			_state.pop();
		}
		if (tab) {
			Admin.state(null, _state.join("/") + "/" + tab.key);
		}
	}
	function drawTabEditor () {
		if (_panel.index()==-1) return;
		var tab = _panel.tab();
		if (tab.classid) {
			_editor = new tab.classid();
			if (_editor.reference) {
				tab.init.reference = _reference;
			}
			if (_editor.ingest) {
				tab.init.ingest = _ingest;
			}
			if (_editor.suid) {
				tab.init.suid = _suid;
			}
			if (_editor.type) {
				tab.init.type = _type;
			}
			_editor.panel(_panel);
			_editor.initialize(tab.init);
		} else {
			_editor = new XMLPane();
			_editor.suid(_suid);
			_editor.name("page");
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
	function homeClick () {
		Admin.state(null, "");
	}
	function drawEditor () {
		if (_state.length==1) {
			destroyPanel();
			_editor = new classes.panels.Sets();
			_editor.addEventListener("onChanged", onChanged);
			_editor.parent(_parent);
			_editor.initialize();
		} else {
			if (_panel==null) {
				_panel = new TabPanel();
				_panel.addEventListener("onIndex", index);
				_panel.addEventListener("onOption", option);
				_panel.home('<span class="glyphicon glyphicon-chevron-left" aria-hidden="true"></span> ' + Lang.lookup("Back To Pages"), homeClick);
				_panel.single(false);
				_panel.parent(_parent);
				_panel.initialize();
				_type = _state[0];
				_suid = _state[1];
				_inited = false;
				loadBaseFile();
			}
			updateTabs();
		}
	}
	function destroyEditor () {
		if (_editor!=null) {
			_editor.removeEventListener("onChanged", onChanged);
			_editor.destroy();
			_editor = null;
		}
	}
	function destroyPanel () {
		if (_panel!=null) {
			_panel.removeEventListener("onIndex", index);
			_panel.removeEventListener("onOption", option);
			_panel.destroy();
			_panel = null;
		}
	}

	function updateView () {
		destroyEditor();
		drawEditor();
	}
	function render () {
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
	this.destroy = function () {
		destroyEditor();
		destroyPanel();
	};
	this.initialize = function () {
		Admin = classes.Admin;
		Dialog = classes.components.Dialog;
		Lang = classes.data.Lang;
		Auth = classes.data.Auth;
		TabPanel = classes.components.TabPanel;
		XMLPane = classes.components.XMLPane;
		Func = classes.helpers.Func;
	};
	
};

classes.components.VendSets.prototype = new EventDispatcher();