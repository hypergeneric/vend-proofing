
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.panels.Orders = function () {
	
	/* "imported" classes
		*/
		
	var Admin;
	var SetList;
	var SiteBar;
	var Func;
	var Dialog;
	var Lang;
	var Auth;
	
	/* private properites
		*/
		
	var _instance = 			this;
	var _panel = 				null;
	var _controller = 			null;
	var _ingest = 				[];
	var _table = 				null;
	var _obj_search = 			null;
	var _obj_export = 			null;
	var _uniquid = 				"global-order-table"; //"FO" + classes.helpers.Func.uniquid();
	var _column_ids = 			["orderid", "setid", "timestamp", "payment_type", "transactionid", "shipping_type", "discount_code", "full_name", "email_address", "phone_number", "shipping_address", "country", "postal_code", "state", "gross", "subtotal", "discount", "shipping", "handling", "tax"];
	var _trigger_change_event = false;
	
	var _search_range = 		{ start:"", end:"" };
	var _search_type = 			"";
	var _search_orderid = 		"";
	var _search_setid = 		"";
	var _search_name = 			"";
	var _search_email = 		"";
	
	/* private methods
		*/
	
	function action (key, obj) {
		switch (key) {
			case "output" :
				outputClick(obj);
				break;
			case "del" :
				deleteClick(obj);
				break;
		}
	}
	
	function outputClick (obj) {
		window.open(Auth.basepath() + Auth.indexpath() + "?/order/" + obj.orderid + "/output/" + md5(obj.email_address) + "/");
	}
		
	function exportClick () {
		var csvtext = "";
		for (var i=0; i<_column_ids.length; ++i) {
			csvtext += '"' + Lang.lookup(_column_ids[i]) + '"';
			if (i<_column_ids.length-1) csvtext += ',';
			else csvtext += '\n';
		}
		for (var i=0; i<_ingest.length; ++i) {
			var row = _ingest[i];
			for (var j=0; j<_column_ids.length; ++j) {
				var value = row[_column_ids[j]];
				if (_column_ids[j]=="shipping_address") value = value.split("<[[BR]]>").join("\r");
				if (_column_ids[j]=="timestamp") {
					value = Number( value );
					var d = new Date( value );
					value = d.toLocaleDateString("en-US");
				}
				value = value.split('"').join("'");
				csvtext += '"' + value + '"';
				if (j<_column_ids.length-1) csvtext += ',';
				else csvtext += '\n';
			}
		}
		var sw = StageProxy.width()-2;
		var sh = StageProxy.height()-2;
		var maxheight = sh-40-20-20-40;
		Dialog.create({
			size: "600x"+maxheight,
			title: Lang.lookup("Order CSV Output"),
			content: classes.dialogs.CopyPaste,
			init: {
				text: csvtext
			},
			owner: this,
			options: [{
				label: Lang.lookup("Close")
			}]
		});
	}
	
	function getLogFile (obj) {
		_panel.screen();
		Auth.send(this, onLogData, {
			action: "get_log_file",
			orderid: obj.orderid
		});
	}
	function onLogData (success, data) {
		_panel.screen(false);
		var sw = StageProxy.width()-2;
		var sh = StageProxy.height()-2;
		var maxheight = sh-40-20-20-40;
		Dialog.create({
			size: "600x"+maxheight,
			title: Lang.lookup("Order Raw Log File"),
			content: classes.dialogs.CopyPaste,
			init: {
				csv: false,
				text: data || Lang.lookup("No Log Data Available")
			},
			owner: this,
			options: [{
				label: Lang.lookup("Close")
			}]
		});
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
		_panel.screen();
		Auth.send(this, onOrderDelete, {
			action: "delete_order",
			timestamp: obj.timestamp,
			orderid: obj.orderid
		});
	}
	function onOrderDelete () {
		loadOrderData();
	}

	function searchClick () {
		Dialog.create({
			size: "600x*",
			title: Lang.lookup("Order Search"),
			content: classes.dialogs.OrderSearch,
			init: {
				range: _search_range,
				type: _search_type,
				orderid: _search_orderid,
				setid: _search_setid,
				name: _search_name,
				email: _search_email
			},
			owner: this,
			options: [{
				label: Lang.lookup("Search"),
				func: performSearch
			},{
				label: Lang.lookup("Cancel")
			}]
		});
	}
	function performSearch () {
		/*var tabdata = _panel.tabdata();
			tabdata[0].label = "Search Results";
		_panel.tabdata(tabdata);
		SiteBar.register(null, _panel.tabdata(), true);
		var xhtml = Lang.lookup("orders") +  " » " + _panel.tabdata()[0].label
		Admin.title(xhtml);*/
		// change tab label here to Lang.lookup["Search Results"]
		var editor = Dialog.last().classobj;
		_search_range = editor.range();
		_search_type = editor.type();
		_search_orderid = editor.orderid();
		_search_setid = editor.setid();
		_search_name = editor.name();
		_search_email = editor.email();
		loadOrderData();
	}
	function loadOrderData () {
		_panel.screen(true);
		//console.log(_search_range, _search_type, _search_orderid, _search_setid, _search_name, _search_email);
		Auth.send(this, onDataLoaded, {
			action: "order_search",
			date_start: _search_range.start,
			date_end: _search_range.end,
			payment_type: _search_type,
			orderid: _search_orderid,
			setid: _search_setid,
			full_name: _search_name,
			email_address: _search_email
		});
	}
	function onDataLoaded (success, data) {
		/*
			store everything as rows and columns
			*/
		_ingest = [];
		/*
			parse it all out
			*/
		if (data) {
			var lines = data=="" ? [] : data.split("\n");
			lines.reverse();
			for (var i=0; i<lines.length; ++i) {
				var line = lines[i];
				var values = line.split("\t");
				var obj = new Object();
				obj.index = i;
				for (var j=0; j<values.length; ++j) {
					var value = values[j];
					var column_id = _column_ids[j];
					obj[column_id] = value || "";
				}
				_ingest.push(obj);
			}
			//_ingest.reverse(); // newest first
		}
		/* manage the tab panel
			*/
		_panel.screen(false);
		/* clear the table, add new rows, then redraw
			*/
		_table.clear();
		_table.rows.add(_ingest);
		_table.draw(false);
		/* trigger change event if neccessary
			*/
		if (_trigger_change_event) {
			_trigger_change_event = false;
			_instance.dispatch("onChanged");
		}
	}
	
	function render () {
		
		var today = new Date();
			var year = today.getFullYear();
			var month = today.getMonth();
			var day = today.getDate();
		var todayclean = new Date(year, month, day+1, 0, 0, 0, 0);
			var year = todayclean.getFullYear();
			var month = todayclean.getMonth();
			var day = todayclean.getDate();
		_search_range.end = year + "/" + (month+1) + "/" + day;
		var monthago = new Date(year, month, day-30, 0, 0, 0, 0);
			var year = monthago.getFullYear();
			var month = monthago.getMonth();
			var day = monthago.getDate();
		_search_range.start = (year) + "/" + (month+1) + "/" + day;
		
		var parent = _panel.body();
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="TablePanel">';
			xhtml += 	'<div class="Inner">';
			xhtml += 		'<div class="Options">';
			xhtml += 			'<div class="Button Search"><span class="glyphicon glyphicon-search" aria-hidden="true"></span> ' + Lang.lookup("Search") + '</div>';
			xhtml += 			'<div class="Button Export Secondary"><span class="glyphicon glyphicon-share-alt" aria-hidden="true"></span> ' + Lang.lookup("Export Data as CSV") + '</div>';
			xhtml += 			'<div class="Clear"></div>';
			xhtml += 		'</div>';
			xhtml += 		'<table class="table table-striped table-bordered" width="100%" cellspacing="0"></table>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
		parent.html(xhtml);
		
		_obj_search = parent.find("#" + _uniquid + " .Search");
		_obj_search.click(searchClick);
		_obj_export = parent.find("#" + _uniquid + " .Export");
		_obj_export.click(exportClick);
		
		/* start up our dataset
			*/
		loadOrderData();
		
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
				emptyTable: Lang.lookup("No Orders Available")
			},
			rowReorder: false,
			searching: true,
			order: [[ 2, "desc" ]],
			paging: true,
			responsive: {
				details: false
			},
			select: false,
			data: [],
			columns: [
				{
					title: Lang.lookup("Order ID"),
					data: "orderid",
					width: 40,
					render: function ( data, type, row ) {
						return '<a title="' + Lang.lookup("View Invoice") + '" href="' + Auth.basepath() + Auth.indexpath() + "?/order/" + data + "/invoice/" + md5(row.email_address) + "/" + '" target="_blank">' + data + '</a>';
					},
					responsivePriority: 1
				},{
					title: Lang.lookup("Set ID"),
					data: "setid",
					width: 40,
					render: function ( data, type, row ) {
						return '<a href="' + Auth.basepath() + Auth.indexpath() + "?/set/" + data + '/" target="_blank" title="' + Lang.lookup("Launch Set") + '">' + data + '</a>';
					}
				},{
					title: Lang.lookup("Date"),
					data: "timestamp",
					type: "num",
					render: function ( data, type, row ) {
						data = Number(data);
						if ( type === 'display' || type === 'filter' ) {
							var d = new Date( data );
							return d.toLocaleDateString("en-US");
						}
						return data;
					}
				},{
					title: '<div style="text-align:center" class="DragIcon"><span class="glyphicon glyphicon-usd" aria-hidden="true"></span></div>',
					data: "payment_type",
					width: 24,
					orderable: false,
					render: function ( data, type, row ) {
						if (data=="offline") {
							return '<div style="text-align:center" class="DragIcon"><span class="glyphicon glyphicon-envelope" aria-hidden="true"></span></div>';
						} else if (data=="paypal") {
							return '<div style="text-align:center" class="DragIcon"><a title="' + Lang.lookup("View Raw Payment Log") + '" class="glyphicon glyphicon-shopping-cart" aria-hidden="true"></a></div>';
						} else if (data=="merchant") {
							return '<div style="text-align:center" class="DragIcon"><a title="' + Lang.lookup("View Raw Payment Log") + '" class="glyphicon glyphicon-credit-card" aria-hidden="true"></a></div>';
						}
					}	
				},{
					title: '<div style="text-align:center" class="DragIcon"><span class="glyphicon glyphicon-send" aria-hidden="true"></span></div>',
					data: "shipping_type",
					width: 24,
					orderable: false,
					render: function ( data, type, row ) {
						if (data=="ship") {
							return '<div style="text-align:center" class="DragIcon"><span class="glyphicon glyphicon-ok" aria-hidden="true"></span></div>';
						} else {
							return '';
						}
					}	
				},{
					title: '<div style="text-align:center" class="DragIcon"><span class="glyphicon glyphicon-globe" aria-hidden="true"></span></div>',
					data: "country",
					width: 40,
					render: function ( data, type, row ) {
						var value = new Array();
						if (data!=""&&data!=undefined) value.push(data);
						if (row.state!=""&&row.state!=undefined) value.push(row.state);
						return value.join("-");
					}	
				},{
					title: Lang.lookup("Gross"),
					data: "gross",
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
					title: Lang.lookup("Net"),
					data: "subtotal",
					type: "num",
					width: 60,
					render: function ( data, type, row ) {
						var subtotal = parseFloat(data);
						if (isNaN(subtotal)) subtotal = 0;
						var discount = parseFloat(row.discount);
							if (!isNaN(discount)) subtotal -= discount;
						if ( type === 'display' || type === 'filter' ) {
							return Func.toFixed(subtotal, 2);
						}
						return subtotal;
					}	
				},{
					title: Lang.lookup("Purchaser"),
					data: "email_address",
					render: function ( data, type, row ) {
						return '<a href="mailto:' + data + '" target="_blank" title="' + Lang.lookup("Email User") + '">' + row.full_name + '</a>';
					}
				},{
					title: Lang.lookup("Phone Number"),
					data: "phone_number"
				},{
					title: Lang.lookup("Actions"),
					data: "orderid",
					orderable: false,
					render: function ( data, type, row ) {
						var xhtml = '';
							xhtml += '<a data-suid="' + data + '" data-action="del">Delete</a> / ';
							xhtml += '<a data-suid="' + data + '" data-action="output">Output</a>';
						return xhtml;
					},
					responsivePriority: 2
				}
			],
			columnDefs: [{
				targets: 3,
				createdCell: function (td, cellData, rowData, row, col) {
					var html = $(td);
					var obj = html.find("a");
					obj.click(function (e) {
						getLogFile(rowData);
						e.preventDefault();
						return false;
					});
				}
			},{
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
		$('#' + _uniquid).find("a").off();
		_obj_search.off();
		_obj_export.off();
		_table.destroy(true);
	};
	this.initialize = function () {
		Admin = classes.Admin;
		Auth = classes.data.Auth;
		Lang = classes.data.Lang;
		Dialog = classes.components.Dialog;
		Func = classes.helpers.Func;
		SetList = classes.components.SetList;
		SiteBar = classes.components.SiteBar;
		render();
	};
	
};

classes.panels.Orders.prototype = new EventDispatcher();
