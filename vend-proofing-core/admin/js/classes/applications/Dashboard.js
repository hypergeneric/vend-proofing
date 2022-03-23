
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.applications.Dashboard = function () {
	/* "imported" classes
		*/
	var SiteBar;
	var XMLTabs;
	var Lang;
	var Admin;
	/* private properites
		*/
	var _instance = 		this;
	var _panel = 			null;
	var _view = 			"dashboard";
	var _state = 			"";
	/* private methods
		*/
	function onTabData () {
		SiteBar.register(_view, _panel.tabdata());
	}
	function render () {
		_panel = new XMLTabs();
		_panel.addEventListener("onTabData", onTabData);
		_panel.appendApplication({
			classid: classes.panels.SystemInfo,
			label: Lang.lookup("System Info"),
			key: "sys_info",
			options: [
				{
					label: '<span class="glyphicon glyphicon-share-alt" aria-hidden="true"></span>  ' + Lang.lookup("Launch Site"),
					primary: true,
					key: "launch"
				},{
					label: '<span class="glyphicon glyphicon-trash" aria-hidden="true"></span>  ' + Lang.lookup("Clear Server Cache"),
					key: "clear_cache"
				},{
					label: '<span class="glyphicon glyphicon-refresh" aria-hidden="true"></span>  ' + Lang.lookup("Update Now"),
					key: "run_update"
				}
			]
		});
		_panel.appendApplication({
			classid: classes.panels.ToolBox,
			label: Lang.lookup("Toolbox"),
			key: "toolbox",
			options: []
		});
		_panel.appendApplication({
			classid: classes.panels.AssetLibrary,
			label: Lang.lookup("Asset Library"),
			key: "assets",
			init: {
				uniquid: "global-asset-library"
			},
			options: []
		});
		_panel.appendApplication({
			classid: classes.panels.ReleaseNotes,
			label: Lang.lookup("Release Notes"),
			key: "releasenotes",
			options: []
		});
		_panel.parent($('#application'));
		_panel.initialize();
	}
	/* public methods
		*/
	this.state = function (str) {
		_state = str;
		if (_state=="") {
			Admin.state(null, _panel.tabdata()[0].key);
			return;
		}
		var xhtml = Lang.lookup(_view);
		if (_state!="") {
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
	this.unsaved = function () {
		return _panel.unsaved();
	};
	this.destroy = function () {
		_panel.removeEventListener("onTabData", onTabData);
		_panel.destroy();
	};
	this.initialize = function () {
		Admin = classes.Admin;
		Lang = classes.data.Lang;
		XMLTabs = classes.components.XMLTabs;
		SiteBar = classes.components.SiteBar;
		render();
	};
};

//classes.components.Setup.prototype = Object.create(EventDispatcher.prototype);
