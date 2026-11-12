
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.panels.Discounts = function () {
	
	/* "imported" classes
		*/
		
	var SetList;
	var Func;
	var Dialog;
	var Lang;
	
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

	function createConfirm () {
		_trigger_change_event = true;
		var editor = Dialog.last().classobj;
		_setlist.createObject({
			setid: _suid,
			code: editor.code(),
			amount: editor.amount(),
			type: editor.type(),
			uses: "0",
			maxuses: editor.maxuses(),
			expires: editor.expires(),
			cartmin: editor.cartmin(),
			freeshipping: editor.freeshipping()
		});
	}
	function createClick () {
		Dialog.create({
			size: "500x*",
			title: Lang.lookup("Create Discount"),
			content: classes.dialogs.DiscountEditor,
			init: {
			},
			owner: this,
			options: [{
				label: Lang.lookup("Save"),
				func: createConfirm
			},{
				label: Lang.lookup("Cancel")
			}]
		});
	}
	
	function editConfirm (obj) {
		_trigger_change_event = true;
		var editor = Dialog.last().classobj;
		_setlist.updateObject({
			code: editor.code(),
			amount: editor.amount(),
			type: editor.type(),
			maxuses: editor.maxuses(),
			expires: editor.expires(),
			cartmin: editor.cartmin(),
			freeshipping: editor.freeshipping()
		}, obj.suid);
	}
	function editClick (obj) {
		Dialog.create({
			size: "500x*",
			title: Lang.lookup("Edit Discount"),
			content: classes.dialogs.DiscountEditor,
			init: {
				code: obj.code,
				amount: obj.amount,
				type: obj.type,
				maxuses: obj.maxuses,
				expires: obj.expires,
				cartmin: obj.cartmin,
				freeshipping: obj.freeshipping
			},
			options: [{
				label: Lang.lookup("Save Changes"),
				func: editConfirm,
				param: obj
			},{
				label: Lang.lookup("Cancel")
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
			xhtml += 			'<div class="Button"><span class="glyphicon glyphicon glyphicon-plus" aria-hidden="true"></span> ' + Lang.lookup("Create New Discount") + '</div>';
			xhtml += 			'<div class="Clear"></div>';
			xhtml += 		'</div>';
			xhtml += 		'<table class="table table-striped table-bordered" width="100%" cellspacing="0"></table>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
		parent.html(xhtml);
		
		_obj_button = parent.find("#" + _uniquid + " .Button");
		_obj_button.click(createClick);
		
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
				emptyTable: Lang.lookup("No Discounts Available")
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
					title: Lang.lookup("Code"),
					data: "code",
					render: function ( data, type, row ) {
						data = data.split(" ").join("&nbsp;");
						if ( data=="" ) {
							data = '<i>' + Lang.lookup("Untitled") + "</i>";
						}
						return '<a title="Edit">' + data + '</a>';
					},
					responsivePriority: 1
				},{
					title: Lang.lookup("Expires"),
					data: "expires",
					type: "num",
					render: function ( data, type, row ) {
						data = Number(data);
						if ( data==0 ) return Lang.lookup("Never");
						if ( type === 'display' || type === 'filter' ) {
							var d = new Date( data );
							return d.toLocaleDateString("en-US");
						}
						return data;
					}
				},{
					title: Lang.lookup("Type"),
					data: "type",
					render: function ( data, type, row ) {
						return Lang.lookup(data);
					},
					responsivePriority: 1
				},{
					title: Lang.lookup("Minimum"),
					data: "cartmin",
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
					title: Lang.lookup("Amount"),
					data: "amount",
					type: "num",
					width: 60
				},{
					title: Lang.lookup("Uses"),
					data: "uses",
					type: "num",
					width: 60
				},{
					title: Lang.lookup("Max Uses"),
					data: "maxuses",
					type: "num",
					width: 60
				},{
					title: '<div style="text-align:center" class="DragIcon"><span class="glyphicon glyphicon glyphicon-send" aria-hidden="true"></span></div>',
					data: "freeshipping",
					orderable: false,
					width: 40,
					render: function ( data, type, row ) {
						if (data=="1") {
							return '<div style="text-align:center" class="DragIcon"><span class="glyphicon glyphicon-ok" aria-hidden="true"></span></div>';
						} else {
							return "";
						}
					}	
				},{
					title: Lang.lookup("Actions"),
					data: "suid",
					orderable: false,
					render: function ( data, type, row ) {
						var xhtml = '';
							xhtml += '<a data-suid="' + data + '" data-action="del">Delete</a>';
						return xhtml;
					},
					responsivePriority: 2
				}
			],
			columnDefs: [{
				targets: 0,
				createdCell: function (td, cellData, rowData, row, col) {
					var html = $(td);
					var obj = html.find("a");
					obj.click(function (e) {
						editClick(rowData);
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
						deleteClick(rowData);
						e.preventDefault();
						return false;
					});
				}
			}]
		});
		
		/* start up our dataset
			*/
		_setlist = new SetList();
		_setlist.name("discount");
		_setlist.puid(_suid);
		_setlist.columms(["setid", "code", "amount", "type", "uses", "maxuses", "expires", "cartmin", "freeshipping"]);
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

classes.panels.Discounts.prototype = new EventDispatcher();
