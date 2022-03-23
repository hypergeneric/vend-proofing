
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.panels.Sessions = function () {
	
	/* "imported" classes
		*/
		
	var Auth;
	var SetList;
	var Func;
	var Dialog;
	var Lang;
	var Cookie;
	
	/* private properites
		*/
		
	var _instance = 			this;
	var _setlist = 				null;
	var _panel = 				null;
	var _controller = 			null;
	var _suid = 				"";
	var _table = 				null;
	var _obj_button = 			null;
	var _uniquid = 				"FO" + classes.helpers.Func.uniquid();
	var _trigger_change_event = false;
	
	/* private methods
		*/
		
	function action (key, obj) {
		switch (key) {
			case "del" :
				deleteClick(obj);
				break;
			case "assume" :
				assumeClick(obj);
				break;
			case "export" :
				exportClick(obj);
				break;
		}
	}
	
	function exportAll () {
		var output = '"' + Lang.lookup("User Email") + '","' + Lang.lookup("Cart Subtotal") + '","' + Lang.lookup("Cart Items") + '","' + Lang.lookup("Favorites") + '"' + "\n";
		var rows = _setlist.ingest();
		for (var i=0; i<rows.length; ++i) {
			var row = rows[i];
			var total = row["total"]=="" ? "0" : row["total"];
			var items = row["items"]=="" ? "0" : row["items"];
			var favorites = row["favorites"]=="" ? "0" : row["favorites"];
			output += '"' + row["email"] + '","' + total + '","' + items + '","' + favorites + '"' + "\n";
		}
		var sw = StageProxy.width()-2;
		var sh = StageProxy.height()-2;
		var maxheight = sh-40-20-20-40;
		Dialog.create({
			size: "600x"+maxheight,
			title: Lang.lookup("Session Export"),
			content: classes.dialogs.CopyPaste,
			init: {
				text: output
			},
			owner: this,
			options: [{
				label: Lang.lookup("Close")
			}]
		});
	}
	
	function exportClick (obj) {
		_panel.screen(true);
		Auth.send(this, onFavoriteData, {
			action: "set_list",
			puid: _suid,
			name: obj.suid
		});
	}
	function onFavoriteData (success, str) {
		_panel.screen(false);
		var lines = !str || str=="" ? [] : str.split("\n");
		var filenames = [];
		for (var i=0; i<lines.length; ++i) {
			var line = lines[i];
			var values = line.split("\t");
			console.log(values);
			if (values[0].indexOf("-f")==-1) continue;
			var filename = values[3];
			var bits = filename.split(".");
				bits.pop();
				filename = bits.join(".");
			filenames.push(filename);
		}
		filenames.sort();
		var sw = StageProxy.width()-2;
		var sh = StageProxy.height()-2;
		var maxheight = sh-40-20-20-40;
		Dialog.create({
			size: "600x"+maxheight,
			title: Lang.lookup("Favorites Export"),
			content: classes.dialogs.CopyPaste,
			init: {
				csv: false,
				text: filenames.join(", ")
			},
			owner: this,
			options: [{
				label: Lang.lookup("Close")
			}]
		});
	}
	
	function assumeClick (obj) {
		Cookie.set("vend_proofing_session_email_"+_suid, obj.email);
		window.open(Auth.basepath() + Auth.indexpath() + "?" + Lang.lookup("URI Page Identifier") + "/" + _suid + "/");
	}
	
	function deleteClick (obj) {
		Dialog.create({
			size: "420x*",
			title: Lang.lookup("Delete Set Confirmation"),
			content: Lang.lookup("Delete Set Confirmation Description"),
			owner: this,
			options: [{
				label: Lang.lookup("Yes Delete"),
				func: deleteConfirm,
				param: obj
			},{
				label: Lang.lookup("Cancel")
			}]
		});
	}
	function deleteConfirm (obj) {
		_trigger_change_event = true;
		_setlist.deleteSet(obj.suid);
	}

	function onDataLoaded () {
		/* manage the tab panel
			*/
		_panel.screen(false);
		/* clear the table, add new rows, then redraw
			*/
		_table.clear();
		_table.rows.add(_setlist.ingest());
		_table.draw(false);
		/* trigger change event if neccessary
			*/
		if (_trigger_change_event) {
			_trigger_change_event = false;
			_instance.dispatch("onChanged");
		}
	}
	function onStartLoad () {
		_panel.screen(true);
	}
	
	function render () {
		
		var parent = _panel.body();
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="TablePanel">';
			xhtml += 	'<div class="Inner">';
			xhtml += 		'<div class="Options">';
			xhtml += 			'<div class="Button Export"><span class="glyphicon glyphicon-share-alt" aria-hidden="true"></span> ' + Lang.lookup("Export All") + '</div>';
			xhtml += 			'<div class="Clear"></div>';
			xhtml += 		'</div>';
			xhtml += 		'<table class="table table-striped table-bordered" width="100%" cellspacing="0"></table>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
		parent.html(xhtml);
		
		_obj_button = parent.find("#" + _uniquid + " .Button");
		_obj_button.click(exportAll);
		
		/* create the datatable
			*/
		_table = $('#' + _uniquid + " table").DataTable( {
			stateSave: true,
			stateSaveCallback: function(settings,data) {
				localStorage.setItem( _uniquid, JSON.stringify(data) )
			},
			stateLoadCallback: function(settings) {
				return JSON.parse( localStorage.getItem( _uniquid ) )
			},
			language: {
				emptyTable: Lang.lookup("No Sessions Available")
			},
			rowReorder: false,
			searching: true,
			order: [[ 0, "asc" ]],
			paging: true,
			responsive: {
				details: false
			},
			select: false,
			data: [],
			columns: [
				{
					title: Lang.lookup("User Email"),
					data: "email",
					render: function ( data, type, row ) {
						return '<a title="Edit" href="mailto:' + data + '">' + data + '</a>';
					},
					responsivePriority: 1
				},{
					title: '<div style="text-align:center" class="DragIcon"><span class="glyphicon glyphicon-heart" aria-hidden="true"></span></div>',
					data: "favorites",
					type: "num",
					width: 60,
					render: function ( data, type, row ) {
						var value = parseFloat(data);
						if (isNaN(value)) value = 0;
						return value;
					}
				},{
					title: '<div style="text-align:center" class="DragIcon"><span class="glyphicon glyphicon-shopping-cart" aria-hidden="true"></span></div>',
					data: "items",
					type: "num",
					width: 60,
					render: function ( data, type, row ) {
						var value = parseFloat(data);
						if (isNaN(value)) value = 0;
						return value;
					}
				},{
					title: '<div style="text-align:center" class="DragIcon"><span class="glyphicon glyphicon-usd" aria-hidden="true"></span></div>',
					data: "total",
					type: "num",
					width: 60,
					render: function ( data, type, row ) {
						var value = parseFloat(data);
						if (isNaN(value)) value = 0;
						if ( type === 'display' || type === 'filter' ) {
							return Func.toFixed(value, 2);
						}
						return value;
					}
				},{
					title: Lang.lookup("Actions"),
					data: "suid",
					orderable: false,
					render: function ( data, type, row ) {
						var xhtml = '';
							xhtml += '<a data-suid="' + data + '" data-action="assume">Assume</a> / ';
							xhtml += '<a data-suid="' + data + '" data-action="export">Favorites</a> / ';
							xhtml += '<a data-suid="' + data + '" data-action="del">Delete</a>';
						return xhtml;
					},
					responsivePriority: 2
				}
			],
			columnDefs: [{
				targets: -1,
				createdCell: function (td, cellData, rowData, row, col) {
					var html = $(td);
					var obj = html.find("a");
					obj.click(function (e) {
						action($(this).data("action"), rowData);
						e.preventDefault();
						return false;
					});
				}
			}]
		});
		
		/* start up our dataset
			*/
		_setlist = new SetList();
		_setlist.name("session");
		_setlist.puid(_suid);
		_setlist.columms(["email", "items", "total", "favorites"]);
		_setlist.addEventListener("onStartLoad", onStartLoad);
		_setlist.addEventListener("onDataLoaded", onDataLoaded);
		_setlist.initialize();
		
	}
	
	/* public methods
		*/
		
	this.suid = function (str) {
		if (str) {
			_suid = str;
		}
		return _suid;
	};
	this.uniquid = function (str) {
		if (str) {
			_uniquid = str;
		}
		return _uniquid;
	};
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
		$('#' + _uniquid).find("a").off();
		_obj_button.off();
		_table.off('row-reorder');
		_table.destroy(true);
		_setlist.removeEventListener("onStartLoad", onStartLoad);
		_setlist.removeEventListener("onDataLoaded", onDataLoaded);
	};
	this.initialize = function (obj) {
		Auth = classes.data.Auth;
		Cookie = classes.helpers.Cookie;
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

classes.panels.Sessions.prototype = new EventDispatcher();
