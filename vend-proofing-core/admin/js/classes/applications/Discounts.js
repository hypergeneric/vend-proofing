
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.applications.Discounts = function () {
	/* "imported" classes
		*/
	var XMLTabs;
	var Lang;
	var Admin;
	var Func;
	var SiteBar;
	/* private properites
		*/
	var _instance = 		this;
	var _panel = 			null;
	var _view = 			"discounts";
	var _state = 			"";
	/* private methods
		*/
	function onTabData () {
		SiteBar.register(_view, _panel.tabdata());
		if (_state=="") {
			Admin.state(null, _panel.tabdata()[0].key);
		}
	}
	function render () {
		_panel = new XMLTabs();
		_panel.addEventListener("onTabData", onTabData);
		_panel.appendApplication({
			classid: classes.panels.Discounts,
			init: {
				uniquid: "global-discount-list",
			},
			label: Lang.lookup("Global Discounts"),
			key: "global",
			options: []
		});
		_panel.parent($('#application'));
		_panel.initialize();
	}
	/* public methods
		*/
	this.state = function (str) {
		_state = str;
		if (_state==""&&_panel.tabdata().length>0) {
			Admin.state(null, _panel.tabdata()[0].key);
			return;
		}
		var xhtml = Lang.lookup(_view);
		if ( _state!="" && _panel.tabdata().length>1 ) {
			for (var i=0; i<_panel.tabdata().length; ++i) {
				if (_panel.tabdata()[i].key==_state) {
					if (xhtml!=_panel.tabdata()[i].label) {
						xhtml += " � " + _panel.tabdata()[i].label;
					}
					break;
				}
			}
		}
		Admin.title(xhtml);
		_panel.state(_state);
	};
	this.unsaved = function () {
		return _panel.unsaved();
	};
	this.destroy = function () {
		_panel.removeEventListener("onTabData", onTabData);
		_panel.destroy();
	};
	this.initialize = function () {
		SiteBar = classes.components.SiteBar;
		Admin = classes.Admin;
		Func = classes.helpers.Func;
		Lang = classes.data.Lang;
		XMLTabs = classes.components.XMLTabs;
		render();
	};
};
