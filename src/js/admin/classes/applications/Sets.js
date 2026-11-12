
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.applications.Sets = function () {
	/* "imported" classes
		*/
	var VendSets;
	var Lang;
	var SiteBar;
	var Admin;
	var Auth;
	/* private properites
		*/
	var _instance = this;
	var _panel;
	var _view = 	"sets";
	var _state;
	/* private methods
		*/
	function onTabData () {
		if ( _state!="" ) {
			var bits = _state.split("/");
			var obj = [];
			if (bits.length==3) {
				var stateview = bits.pop();
				var suid = bits.pop();
				var type = bits.pop();
				for (var i=0; i<_panel.tabdata().length; ++i) {
					var tab = _panel.tabdata()[i];
					obj.push({
						key: type + "/" + suid + "/" + tab.key,
						label: suid + " » " + tab.label
					});
				}
			}
			SiteBar.register(_view, obj, true);
		}
	}
	function render () {
		_panel = new VendSets();
		_panel.addEventListener("onTabData", onTabData);
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
		_panel.state(_state);
		var xhtml = Lang.lookup(_view);
		if ( _state!="" ) {
			var bits = _state.split("/");
			if (bits.length==3) {
				xhtml = '<a href="javascript:classes.helpers.History.setHistory(\'' + _view + '\');">' + Lang.lookup(_view) + '</a>';
				var stateview = bits.pop();
				var suid = bits.pop();
				var type = bits.pop();
				var uri = Auth.basepath() + Auth.indexpath() + "?/set/" + suid + "/";
				xhtml += " » " + '<a href="' + uri + '" target="_blank">' + Lang.lookup(type) + " " + suid + '</a>';
				for (var i=0; i<_panel.tabdata().length; ++i) {
					if (_panel.tabdata()[i].key==stateview) {
						xhtml += " » " + _panel.tabdata()[i].label;
						break;
					}
				}
			}
		} else {
			SiteBar.register(_view, [], true);
		}
		Admin.title(xhtml);
	};
	this.destroy = function () {
		_panel.removeEventListener("onTabData", onTabData);
		_panel.destroy();
	};
	this.initialize = function () {
		Auth = classes.data.Auth;
		Admin = classes.Admin;
		Lang = classes.data.Lang;
		VendSets = classes.components.VendSets;
		SiteBar = classes.components.SiteBar;
		render();
	};
};
