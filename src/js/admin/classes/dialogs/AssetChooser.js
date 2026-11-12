
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.dialogs.AssetChooser = function () {
	
	/* "imported" classes
		*/
		
	var StageProxy;
	var Func;
	var Lang;
	var Auth;
	var Cookie;
	var Dialog;
	
	/* private properites
		*/
	
	var _uniquid = 			classes.helpers.Func.uniquid();
	var _instance = 		this;
	var _parent = 			null;
	var _accept = 			"";
	var _key = 				"asset";
	var _suid = 			"";
	var _name = 			"";
	var _filename = 		"";

	var _approved = 		{};
	var _editor = 			"";
	var _inited = 			null;

	
	/* private methods
		*/

	function onSelected () {
		if (Dialog.active()) {
			var selected = _editor.getSelected();
			if (selected.length>0) {
				if (selected[0].filename!=_filename) {
					Dialog.enableOptions([0]);
				} else {
					Dialog.disableOptions([0]);
				}
			} else {
				Dialog.disableOptions([0]);
			}
		}
	}
	
	function filterRow (row) {
		var ext = "." + row.filename.split(".").pop().toLowerCase();
		if (_approved[ext]===true) {
			return row;
		} else {
			return false
		}
	}
	
	function render () {
		
		var extensions = _accept.split(",");
		for (var i=0; i<extensions.length; ++i) {
			_approved[extensions[i]] = true;
		}
		
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="AssetChooser DialogForm">';
			xhtml += '</div>';
		_parent.html(xhtml);
		
		_editor = new classes.panels.AssetLibrary;
		_editor.uniquid("asset-chooser-dialog");
		_editor.editable(false);
		_editor.filter(filterRow);
		_editor.multiselect(false);
		_editor.suid(_suid);
		_editor.key(_key);
		_editor.name(_name);
		_editor.panel(_instance);
		_editor.curated(false);
		_editor.setSelected(_filename);
		_editor.addEventListener("onSelected", onSelected);
		_editor.initialize();
		
		Dialog.disableOptions([0]);

	}
	
	/* public methods
		*/
		
	this.enableOptions = function () {
	}
	this.disableOptions = function () {
	}
	this.screen = function (bool) {
	};
	this.body = function () {
		return $("#" + _uniquid);
	};
	this.getSelected = function () {
		return _editor.getSelected();
	};
	this.accept = function (str) {
		if (str) {
			_accept = str;
		}
		return _accept;
	};	
	this.filename = function (str) {
		if (str) {
			_filename = str;
		}
		return _filename;
	};
	this.key = function (str) {
		if (str) {
			_key = str;
		}
		return _key;
	};
	this.name = function (str) {
		if (str) {
			_name = str;
		}
		return _name;
	};
	this.suid = function (str) {
		if (str) {
			_suid = str;
		}
		return _suid;
	};
	this.parent = function (obj) {
		_parent = obj;
	};
	this.resize = function () {
		if (_inited==null) {
			_inited = setInterval(function () {
				$(window).trigger('resize');
			}, 33);
			setTimeout(function () {
				clearInterval(_inited);
				_inited = true;
			}, 500);
		}
	};
	this.destroy = function () {
		_editor.removeEventListener("onSelected", onSelected);
		_editor.destroy();
		_parent.empty();
	};
	this.initialize = function (obj) {
		Dialog = classes.components.Dialog;
		Auth = classes.data.Auth;
		Cookie = classes.helpers.Cookie;
		Func = classes.helpers.Func;
		Lang = classes.data.Lang;
		StageProxy = classes.StageProxy;
		for (var prop in obj) {
			this[prop](obj[prop]);
		}
		render();
	};
	
};
