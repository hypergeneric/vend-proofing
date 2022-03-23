
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.components.TabPanel = function () {
	/* "imported" classes
		*/
	var Func;
	/* private properites
		*/
	var _instance = 			this;
	var _index = 				-1;
	var _key = 					"";
	var _body = 				null;
	var _parent = 				null;
	var _tab_data = 			[];
	var _screen = 				null;
	var _single = 				true;
	var _home_label = 			"";
	var _home_func = 			null;
	var _home_obj = 			null;
	/* private methods
		*/
	function resize () {
		var hw = _parent.find('.Home').width();
		var sw = _parent.find('.Inner').width() - hw;
		var tabwidth = 0;
		_parent.find('.TabView').show();
		_parent.find('.TabView .Button').each(function () {
			tabwidth += $(this).outerWidth();
		});
		if (tabwidth>sw) {
			_parent.find('.TabView').hide();
			_parent.find('.Tabs select').show();
		} else {
			_parent.find('.Tabs select').hide();
		}
	}
	function manageOptions (enable, opts) {
		if (opts.length==1&&opts[0]=="*") {
			_parent.find('.Options div').addClass("Disabled").off();
		} else {
			for (var i=0; i<opts.length; ++i) {
				_parent.find('.Options div[data-key="' + opts[i] + '"]').addClass("Disabled").off();
			}
		}
		if (enable) {
			if (opts.length==1&&opts[0]=="*") {
				_parent.find('.Options div').removeClass("Disabled").click(optionClick);
			} else {
				for (var i=0; i<opts.length; ++i) {
					_parent.find('.Options div[data-key="' + opts[i] + '"]').removeClass("Disabled").click(optionClick);
				}
			}
		}
	}
	function destroyTabs () {
		_parent.find('.TabView div').off();
		_parent.find('.Tabs select').off();
		_parent.find('.Tabs').empty();
	}
	function destroyOptions () {
		_parent.find('.Options div').off();
		_parent.find('.Options').empty();
	}
	function tabClick (eo) {
		var i = $(this).data("index");
		showIndex(i);
	}
	function tabChange (eo) {
		var i = $("option:selected", this).data("index");
		showIndex(i);
	}
	function optionClick (eo) {
		var key = $(this).data("key");
		doOption(key);
	}
	function showIndex (i) {
		if (i!=_index) {
			_parent.find('.Tabs option').prop("disabled", false);
			_parent.find('.TabView div').removeClass("Active").off().click(tabClick);
			_index = i;
			_parent.find('.TabView div[data-index="' + _index + '"]').addClass("Active").off();
			_parent.find('.Tabs option[data-index="' + _index + '"]').prop("disabled", true).prop("selected", true);
			drawOptions();
			_instance.dispatch("onIndex");
		}
		if ( _tab_data.length==1 && _single ) {
			_parent.find('.TabView div').removeClass("Active").off();
		}
	}
	function updateTabs () {
		_parent.find('.Tabs option').prop("disabled", false);
		_parent.find('.TabView div').removeClass("Active").off().click(tabClick);
		_parent.find('.TabView div[data-index="' + _index + '"]').addClass("Active").off();
		_parent.find('.Tabs option[data-index="' + _index + '"]').prop("disabled", true).prop("selected", true);
		if ( _tab_data.length==1 && _single ) {
			_parent.find('.TabView div').removeClass("Active").off();
		}
	}
	function doOption (key) {
		_key = key;
		_instance.dispatch("onOption");
	}
	function drawOptions () {
		/*
			delete existing tabs
			*/
		destroyOptions();
		/*
			create new ones
			*/
		if (_index==-1) {
			return;
		}
		var options = _tab_data[_index].options;
		var xhtml = '';
		for (var i=0; i<options.length; ++i) {
			var data = options[i];
			xhtml += '<div data-key="' + data.key + '" data-index="' + i + '" class="' + (data.primary?"Primary ":"") + 'Button">' + data.label + '</div>';
		}
			xhtml += '<div class="Clear"></div>';
		_parent.find('.Options').html(xhtml);
		_parent.find('.Options div').click(optionClick);
	}
	function drawTabs () {
		destroyTabs();
		var xhtml = '<div class="TabView">';
		for (var i=0; i<_tab_data.length; ++i) {
			var data = _tab_data[i];
			xhtml += 	'<div data-index="' + i + '" class="Button">' + data.label + '</div>';
		}
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
			xhtml += '<select>';
		for (var i=0; i<_tab_data.length; ++i) {
			var data = _tab_data[i];
			xhtml += 	'<option data-index="' + i + '">';
			xhtml += 		data.label;
			xhtml += 	'</option>';
		}
			xhtml += '</select>';
		_parent.find('.Tabs').html(xhtml);
		_parent.find('.TabView div').click(tabClick);
		_parent.find('.Tabs select').change(tabChange);
		updateTabs();
		resize();
	}
	function render () {
		var xhtml = '';
			xhtml += '<div class="TabPanel">';
			xhtml += 	'<div class="Screen"></div>';
			xhtml += 	'<div class="Inner">';
		if ( _home_label!="" || _home_func!=null ) {
			xhtml += 		'<div class="Home">' + _home_label + '</div>';
		}
			xhtml += 		'<div class="Tabs"></div>';
			xhtml += 		'<div class="Body"></div>';
			xhtml += 		'<div class="Options"></div>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
		_parent.html(xhtml);
		_body = _parent.find('.Body');
		_screen = _parent.find('.Screen');
		_home_obj = _parent.find('.Home');
		_home_obj.click(_home_func);
		drawTabs();
		StageProxy.addEventListener("onResize", resize);
	}
	/* public methods
		*/
	this.home = function (str, func) {
		_home_label = str;
		_home_func = func;
	};
	this.single = function (bool) {
		if (bool!=undefined) {
			_single = bool;
		}
		return _single;
	};
	this.parent = function (obj) {
		if (obj) {
			_parent = obj;
		}
		return _parent;
	};
	this.body = function (obj) {
		if (obj) {
			_body = obj;
		}
		return _body;
	};
	this.key = function (str) {
		if (str) {
			_key = str;
		}
		return _key;
	};
	this.tab = function () {
		return _tab_data[_index];
	};
	this.tabdata = function (arr) {
		if (arr) {
			_tab_data = arr;
			drawTabs();
		}
		return _tab_data;
	};
	this.index = function (num) {
		if (typeof num == 'number') {
			showIndex(num);
		}
		return _index;
	};
	this.refreshOptions = function () {
		drawOptions();
	}
	this.enableOptions = function () {
		manageOptions(true, arguments);
	};
	this.disableOptions = function () {
		manageOptions(false, arguments);
	};
	this.screen = function (bool, bool2) {
		if (bool) {
			_screen.show();
			if (bool2===false) {
				_screen.spin(false);
			} else {
				_screen.spin('small', '#444');
			}
		} else {
			_screen.hide();
			_screen.spin(false);
		}
	};
	this.destroy = function () {
		_home_obj.off();
		destroyTabs();
		destroyOptions();
		_parent.empty();
	};
	this.initialize = function () {
		StageProxy = classes.StageProxy;
		Func = classes.helpers.Func;
		render();
		resize();
	};
};

classes.components.TabPanel.prototype = new EventDispatcher();
