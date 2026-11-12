
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.components.Setup = function () {
	/* "imported" classes
		*/
	var XMLTabs;
	var Func;
	var Admin;
	var Lang;
	var SiteBar;
	/* private properites
		*/
	var _instance = 		this;
	var _type = 			"";
	var _state = 			"";
	var _revert_is_delete = false;
	var _panel;
	/* private methods
		*/
	function onTabData () {
		SiteBar.register(_type, _panel.tabdata());
		if (_state=="") {
			Admin.state(null, _panel.tabdata()[0].key);
		}
	}
	function onDataChanged () {
		if ( Admin.config().setup.standalone._value=="false" ) {
			Func.refresh();
		}
	}
	function render () {
		_panel = new XMLTabs();
		_panel.addEventListener("onTabData", onTabData);
		_panel.addEventListener("onDataChanged", onDataChanged);
		_panel.revert_is_delete(_revert_is_delete);
		_panel.type(_type);
		_panel.parent($('#application'));
		_panel.initialize();
	}
	/* public methods
		*/
	this.unsaved = function () {
		return _panel.unsaved();
	};
	this.revert_is_delete = function (bool) {
		_revert_is_delete = bool;
	};
	this.type = function (str) {
		_type = str;
	};
	this.state = function (str) {
		_state = str;
		if (_state==""&&_panel.tabdata().length>0) {
			Admin.state(null, _panel.tabdata()[0].key);
			return;
		}
		var xhtml = Lang.lookup(_type);
		if ( _state!="" && _panel.tabdata().length>1 ) {
			for (var i=0; i<_panel.tabdata().length; ++i) {
				if (_panel.tabdata()[i].key==_state) {
					if (xhtml!=_panel.tabdata()[i].label) {
						xhtml += " » " + _panel.tabdata()[i].label;
					}
					break;
				}
			}
		}
		Admin.title(xhtml);
		_panel.state(_state);
	};
	this.destroy = function () {
		_panel.removeEventListener("onTabData", onTabData);
		_panel.removeEventListener("onDataChanged", onDataChanged);
		_panel.destroy();
	};
	this.initialize = function () {
		Admin = classes.Admin;
		Lang = classes.data.Lang;
		Func = classes.helpers.Func;
		XMLTabs = classes.components.XMLTabs;
		SiteBar = classes.components.SiteBar;
		render();
	};
};
