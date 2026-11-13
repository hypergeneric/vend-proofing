
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.panels.SystemInfo = function () {
	/* "imported" classes
		*/
	var Auth;
	var Lang;
	/* private properites
		*/
	var _instance = 			this;
	var _panel = 				null;
	var _controller = 			null;
	var _uniquid = 				"FO" + classes.helpers.Func.uniquid();
	var _table = 				null;
	/* private methods
		*/
	function doOption (key) {
		switch (key) {
			case "launch" :
				var url = Auth.basepath() + Auth.indexpath();
				var popup = window.open(url);
				break;
			case "clear_cache" :
				clearServerCache();
				break;
		}
	}
	function clearServerCache () {
		_panel.screen(true);
		Auth.send(this, onSystemInfo, {
			action: "system_clearcache"
		});
	}
	function onSystemInfo (success, response) {
		/* manage the tab panel
			*/
		_panel.screen(false);
		/* parse through the data
			*/
		var pairs = response.split("&");
		var rows = new Array();
		for (var i=0; i<pairs.length; ++i) {
			var pair = pairs[i].split("=");
			rows.push({
				prop: Lang.lookup(pair[0]),
				value: pair[1]
			});
		}
		/* clear the table, add new rows, then redraw
			*/
		_table.clear();
		_table.rows.add(rows);
		_table.draw();
	}
	function render () {
		/* add some html to start
			*/
		var parent = _panel.body();
		parent.html('<div class="SystemInfo"><table id="' + _uniquid + '" class="table table-striped table-bordered" width="100%" cellspacing="0"></table></div>');
		/* create the datatable
			*/
		_table = $('#' + _uniquid).DataTable( {
			searching: false,
			ordering: false,
			paging: false,
			info: false,
			responsive: {
				details: false
			},
			data: [],
			columns: [
				{
					title: Lang.lookup("System Property"),
					data: "prop"	
				},{
					title: Lang.lookup("Property Value"),
					data: "value"	
				}
			]
		});
		/* load up the data
			*/
		_panel.screen(true);
		Auth.send(this, onSystemInfo, {
			action: "system_getinfo"
		});
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
	this.destroy = function () {
	};
	this.initialize = function () {
		Auth = classes.data.Auth;
		Lang = classes.data.Lang;
		render();
	};
};

classes.panels.SystemInfo.prototype = new EventDispatcher();
