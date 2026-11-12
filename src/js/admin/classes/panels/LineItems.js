
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.panels.LineItems = function () {
	
	/* "imported" classes
		*/
		
	var Admin;
	var Auth;
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
	var _state = 				[];
	
	var _table = 				null;
	var _obj_create = 			null;
	var _obj_back = 			null;
	var _uniquid = 				"FO" + classes.helpers.Func.uniquid();
	
	/* private methods
		*/
		
	function action (key, obj) {
		switch (key) {
			case "edit" :
				editClick(obj);
				break;
			case "del" :
				deleteClick(obj);
				break;
		}
	}
	
	function backClick () {
		Admin.state(null, _state[0] + "/" + _state[1]);
	}

	function createConfirm () {
		var editor = Dialog.last().classobj;
		_setlist.createObject({
			label: editor.label(),
			quantity: editor.quantity(),
			width: editor.width(),
			height: editor.height()
		});
	}
	function createClick () {
		Dialog.create({
			size: "500x*",
			title: Lang.lookup("Create Line Item"),
			content: classes.dialogs.LineItemEditor,
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
		var editor = Dialog.last().classobj;
		_setlist.updateObject({
			label: editor.label(),
			quantity: editor.quantity(),
			width: editor.width(),
			height: editor.height()
		}, obj.suid);
	}
	function editClick (obj) {
		Dialog.create({
			size: "500x*",
			title: Lang.lookup("Edit Line Item"),
			content: classes.dialogs.LineItemEditor,
			init: {
				label: obj.label,
				quantity: obj.quantity,
				width: obj.width,
				height: obj.height
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
	}
	function onStartLoad () {
		_panel.screen(true);
	}

	function render () {
	}
	
	function draw () {
		
		var parent = _panel.body();
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="TablePanel">';
			xhtml += 	'<div class="Inner">';
			xhtml += 		'<div class="Options">';
			xhtml += 			'<div class="Button Secondary Back"><span class="glyphicon glyphicon-menu-left" aria-hidden="true"></span></div>';
			xhtml += 			'<div class="Button Create"><span class="glyphicon glyphicon-plus" aria-hidden="true"></span> ' + Lang.lookup("Create New Format") + '</div>';
			xhtml += 			'<div class="Clear"></div>';
			xhtml += 		'</div>';
			xhtml += 		'<table class="AssetTableCurated table table-striped table-bordered" width="100%" cellspacing="0"></table>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
		parent.html(xhtml);
		
		_obj_back = parent.find("#" + _uniquid + " .Back");
		_obj_create = parent.find("#" + _uniquid + " .Create");
		_obj_back.click(backClick);
		_obj_create.click(createClick);
		
		/* create the datatable
			*/
		_table = $('#' + _uniquid + " table").DataTable( {
			language: {
				emptyTable: Lang.lookup("No Formats Created")
			},
			rowReorder: {
				update: false,
				dataSrc: 'index'
			},
			searching: false,
			paging: false,
			ordering: false,
			responsive: {
				details: false
			},
			select: false,
			data: [],
			columns: [
				{
					title: '',
					data: "index",
					width: 30,
					render: function ( data, type, row ) {
						return '<div style="text-align:center;cursor:pointer" class="DragIcon"><span class="glyphicon glyphicon-option-horizontal" aria-hidden="true"></span></div>';
					}
				},{
					title: Lang.lookup("Label"),
					data: "label",
					render: function ( data, type, row ) {
						data = data.split(" ").join("&nbsp;");
						if ( data=="" ) {
							data = '<i>' + Lang.lookup("Untitled") + "</i>";
						}
						return '<a title="Edit">' + data + '</a>';
					},
					responsivePriority: 1
				},{
					title: Lang.lookup("Quantity"),
					data: "quantity",
					type: "num",
					width: 60,
					render: function ( data, type, row ) {
						var value = parseFloat(data);
						if (isNaN(value)) value = 0;
						return value;
					}
				},{
					title: Lang.lookup("Size"),
					data: "width",
					width: 60,
					render: function ( data, type, row ) {
						return data + "x" + row.height;
					}
				},{
					title: Lang.lookup("Actions"),
					data: "suid",
					render: function ( data, type, row ) {
						var xhtml = '';
							xhtml += '<a data-suid="' + data + '" data-action="del">Delete</a>';
						return xhtml;
					},
					responsivePriority: 2
				}
			],
			columnDefs: [{
				targets: 1,
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
						action($(this).data("action"), rowData);
						e.preventDefault();
						return false;
					});
				}
			}]
		});
		_table.on( 'row-reorder', function ( e, diff, edit ) {
			var trigger = edit.triggerRow[0][0];
			for (var i=0; i<diff.length; ++i) {
				var obj = diff[i];
				if (trigger==obj.oldPosition) {
					var data = _setlist.ingest()[trigger];
					_setlist.reIndex(obj.oldPosition, obj.newPosition, data.suid);
					break;
				}
			}
		});
		
		/* start up our dataset
			*/
		_setlist = new SetList();
		_setlist.name("lineitem");
		_setlist.puid(_state[3]);
		_setlist.columms(["label", "quantity", "width", "height"]);
		_setlist.addEventListener("onStartLoad", onStartLoad);
		_setlist.addEventListener("onDataLoaded", onDataLoaded);
		_setlist.initialize();

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
	this.state = function (arr) {
		_state = arr;
		draw();
	};
	this.destroy = function () {
		$('#' + _uniquid).find("a").off();
		_obj_back.off();
		_obj_create.off();
		_table.off('row-reorder');
		_table.destroy(true);
		_setlist.removeEventListener("onStartLoad", onStartLoad);
		_setlist.removeEventListener("onDataLoaded", onDataLoaded);
	};
	this.initialize = function (obj) {
		Admin = classes.Admin;
		Auth = classes.data.Auth;
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

classes.panels.LineItems.prototype = new EventDispatcher();
