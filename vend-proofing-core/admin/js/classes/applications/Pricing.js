
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.applications.Pricing = function () {
	
	/* "imported" classes
		*/
		
	var XMLTabs;
	var Lang;
	var SiteBar;
	var Admin;
	var Auth;
	
	/* private properites
		*/
		
	var _instance = this;
	var _panel;
	var _view = 	"pricing";
	var _state;
	
	/* private methods
		*/
		
	function onTabData () {
		SiteBar.register(_view, _panel.tabdata());
	}
	function render () {
		_panel = new XMLTabs();
		_panel.addEventListener("onTabData", onTabData);
		_panel.appendApplication({
			classid: classes.panels.Group,
			init: {
				name: "packageset"
			},
			label: Lang.lookup("Packages"),
			key: "package",
			options: []
		});
		_panel.appendApplication({
			classid: classes.panels.Group,
			init: {
				name: "productset"
			},
			label: Lang.lookup("Products"),
			key: "product",
			options: []
		});
		_panel.appendApplication({
			classid: classes.panels.Group,
			init: {
				name: "formatset"
			},
			label: Lang.lookup("Formats"),
			key: "format",
			options: []
		});
		_panel.appendApplication({
			classid: classes.panels.Group,
			init: {
				name: "paperset"
			},
			label: Lang.lookup("Papers"),
			key: "paper",
			options: []
		});
		_panel.appendApplication({
			classid: classes.panels.Group,
			init: {
				name: "modifierset"
			},
			label: Lang.lookup("Modifiers"),
			key: "modifier",
			options: []
		});
		_panel.appendApplication({
			classid: classes.panels.Group,
			init: {
				name: "downloadset"
			},
			label: Lang.lookup("Digital Downloads"),
			key: "download",
			options: []
		});
		_panel.parent($('#application'));
		_panel.initialize();
	}
	
	/* public methods
		*/
		
	this.unsaved = function () {
		return _panel.unsaved();
	};
	this.state = function (str) {
		_state = str;
		if (_state=="") {
			Admin.state(null, _panel.tabdata()[0].key);
			return;
		}
		_panel.state(_state);
	};
	this.destroy = function () {
		_panel.removeEventListener("onTabData", onTabData);
		_panel.destroy();
	};
	this.initialize = function () {
		Auth = classes.data.Auth;
		Admin = classes.Admin;
		Lang = classes.data.Lang;
		XMLTabs = classes.components.XMLTabs;
		SiteBar = classes.components.SiteBar;
		render();
	};
	
};
