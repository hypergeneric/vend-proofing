
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.panels.Downloads = function () {
	
	/* "imported" classes
		*/
		
	var Admin;
	var Auth;
	var SetList;
	var Func;
	var Dialog;
	var Lang;
	var XMLTabs;
	var XMLPane;
	
	/* private properites
		*/
		
	var _instance = 			this;
	var _panel = 				null;
	var _controller = 			null;
	var _state = 				[];
	var _type = 				"";
	var _suid = 				"";
	
	var _table = 				null;
	var _uniquid = 				"FO" + classes.helpers.Func.uniquid();
	var _editor = 				null;
	
	var _loaded = 				false;
	var _inited = 				false;
	var _redraw = 				false;
	var _reference = 			null;
	var _unsaved = 				false;
	var _ingest = 				null;
	
	/* private methods
		*/
		
	function doOption () {
		switch (_panel.key()) {
			case "downloadsave" :
			 saveClick()
			 return;
			case "downloadrevert" :
			 revertClick();
			 return;
			case "downloadback" :
			 backClick();
			 return;
		}
	}
	
	function backClick () {
		Admin.state(null, _state[0]);
	}
	
	function saveClick () {
		_ingest.data._attributes["default"] = "false";
		var xmlstr = Func.JsonToXML(_ingest);
		_panel.screen(true);
		Auth.send(this, saveComplete, {
			action: "setup_save",
			suid: _state[1],
			type: "downloads",
			data: '<?xml version="1.0"?>' + xmlstr
		});
	}
	function saveComplete (success, data) {
		_panel.screen(false);
		_panel.disableOptions("downloadsave");
		_panel.enableOptions("downloadback", "downloadrevert");
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
		_panel.screen(true);
		Auth.send(this, revertComplete, {
			action: "setup_revert",
			suid: _state[1],
			type: "downloads"
		});
	}
	function revertComplete (success, data) {
		loadBaseFile();
	}
	
	function onChanged () {
		_panel.enableOptions("downloadback", "downloadsave");
	}
		
	function dataLoaded (success, response) {
		/*
			setup the tab panel
			*/
		_panel.screen(false);
		/*
			parse the incomming data
			*/
		var xmlobj = $.parseXML(response);
		_ingest = Func.xmlToJson(xmlobj);
		_loaded = true;
		/*
			create the tab data
			*/
		_editor = new XMLPane();
		_editor.reference(_reference);
		_editor.ingest(_ingest);
		_editor.node("settings");
		_editor.addEventListener("onChanged", onChanged);
		_editor.parent(_panel.body());
		_editor.initialize();
		_panel.disableOptions("*");
		if (_ingest.data._attributes["default"]!="true") {
			_panel.enableOptions("downloadback", "downloadrevert");
		}
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
		if (_inited==false) {
			Auth.send(this, referenceLoaded, {
				action: "setup_defaults",
				type: "downloads"
			});
			return;
		}
		Auth.send(this, dataLoaded, {
			action: "setup_load",
			suid: _state[1],
			type: "downloads"
		});
	}

	function render () {
		var tabdata = _panel.tabdata();
		tabdata[5].options = [
			{
				label: '<span class="glyphicon glyphicon-menu-left" aria-hidden="true"></span>',
				key: "downloadback"
			},{
				label: Lang.lookup("Save"),
				primary: true,
				key: "downloadsave"
			},{
				label: Lang.lookup("Revert To Default"),
				key: "downloadrevert"
			}];
		_panel.refreshOptions();
	}
	function draw () {
		loadBaseFile();
	}
	
	/* public methods
		*/
		
	this.option = function (key) {
		doOption(key);
	};
	this.panel = function (obj) {
		_panel = obj;
	};
	this.controller = function (obj) {
		_controller = obj;
	};
	this.state = function (arr) {
		_state = arr;
		draw();
	};
	this.destroy = function () {
		var tabdata = _panel.tabdata();
		tabdata[5].options = [];
		_panel.refreshOptions();
		_editor.removeEventListener("onChanged", onChanged);
		_editor.destroy();
	};
	this.initialize = function (obj) {
		XMLPane = classes.components.XMLPane;
		XMLTabs = classes.components.XMLTabs;
		Admin = classes.Admin;
		Auth = classes.data.Auth;
		Lang = classes.data.Lang;
		Dialog = classes.components.Dialog;
		Func = classes.helpers.Func;
		SetList = classes.components.SetList;
		for (var prop in obj) {
			this[prop](obj[prop]);
		}
		render();
	};
	
};

classes.panels.Downloads.prototype = new EventDispatcher();
