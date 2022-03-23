
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.panels.SystemInfo = function () {
	/* "imported" classes
		*/
	var Auth;
	var Func;
	var Dialog;
	var Lang;
	var Admin;
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
				var url = Admin.config().setup.standalone._value=="true" ? Auth.basepath() + Auth.indexpath() : Auth.basepath();
				var popup = window.open(url);
				break;
			case "clear_cache" :
				clearServerCache();
				break;
			case "run_update" :
				runUpdate();
				break;
		}
	}
	function runUpdate () {
		if (Admin.config().setup.hub._value=="true") {
			Dialog.create({
				size: "420x*",
				title: Lang.lookup("update_product_confirmation"),
				content: Lang.lookup("update_product_confirmation_description"),
				owner: this,
				options: [{
					label: Lang.lookup("yes update"),
					func: runUpdateConfirm
				},{
					label: Lang.lookup("cancel")
				}]
			});
		} else {
			var update_uri = "https://" + Auth.provideruri() + "/installer/?l=" + (Admin.config().setup.language._value||"") + "&a=upgrade&k=" + (Admin.config().setup.product_key._value||"");
			var popup = window.open(update_uri);
		}
	}
	function runUpdateConfirm () {
		var update_uri = "http://members." + Auth.provideruri() + "/login/" + (Admin.config().setup.install_id._value||"") + "/update.html";
		window.location = update_uri;
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
		/* manage buttons
			*/
		if (Admin.updateRequired()==false) {
			_panel.disableOptions("run_update");
		}
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
		Admin = classes.Admin;
		Auth = classes.data.Auth;
		Lang = classes.data.Lang;
		Dialog = classes.components.Dialog;
		Func = classes.helpers.Func;
		render();
	};
};

classes.panels.SystemInfo.prototype = new EventDispatcher();
