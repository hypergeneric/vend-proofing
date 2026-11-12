
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.panels.TaxSetup = function () {
	
	/* "imported" classes
		*/
		
	var SetList;
	var Func;
	var Dialog;
	var Lang;
	
	/* private properites
		*/
		
	var _instance = 			this;
	var _panel = 				null;
	var _controller = 			null;
	var _setlist = 				null;
	var _table = 				null;
	var _uniquid = 				"FO" + classes.helpers.Func.uniquid();
	var _country = 				"";
	var _name = 				"vattaxchart";
	var _column_ids = 			["name", "percent"];
	var _obj_button = 			null;
	var _trigger_change_event = false;
	
	/* private methods
		*/

	function createConfirm () {
		_trigger_change_event = true;
		var editor = Dialog.last().classobj;
		_setlist.createObject({
			name: editor.name(),
			percent: editor.percent(),
			hst: editor.hst(),
			gst: editor.gst(),
			pst: editor.pst()
		}, editor.code());
	}
	function createClick () {
		Dialog.create({
			size: "500x*",
			title: Lang.lookup("Add Tax Nexus"),
			content: classes.dialogs.TaxEditor,
			init: {
				edit: false,
				country: _country
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
			name: editor.name(),
			percent: editor.percent(),
			hst: editor.hst(),
			gst: editor.gst(),
			pst: editor.pst()
		}, obj.suid);
	}
	function editClick (obj) {
		Dialog.create({
			size: "500x*",
			title: Lang.lookup("Edit Tax Nexus"),
			content: classes.dialogs.TaxEditor,
			init: {
				edit: true,
				country: _country,
				code: obj.suid,
				name: obj.name,
				percent: obj.percent,
				hst: obj.hst,
				gst: obj.gst,
				pst: obj.pst
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
		
		_country = _controller.ingest().data.ordering.default_country._value;
		
		var cols = [
			{
				title: Lang.lookup("Country"),
				data: "name",
				render: function ( data, type, row ) {
					return '<a title="Edit">' + data + '</a>';
				},
				responsivePriority: 1
			},{
				title: Lang.lookup("Percent"),
				data: "percent",
				type: "num",
				render: function ( data, type, row ) {
					return parseFloat(data);
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
		];
		
		if ( _country=="US" ) {
			_name = "ustaxchart";
			_column_ids = ["name", "unused", "percent"];
			cols = [
				{
					title: Lang.lookup("State"),
					data: "name",
					render: function ( data, type, row ) {
						return '<a title="Edit">' + data + '</a>';
					},
					responsivePriority: 1
				},{
					title: Lang.lookup("Percent"),
					data: "percent",
					type: "num",
					render: function ( data, type, row ) {
						return parseFloat(data);
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
			];
		} else if ( _country=="CA" ) {
			_name = "cataxchart";
			_column_ids = ["name", "hst", "gst", "pst"];
			cols = [
				{
					title: Lang.lookup("Province"),
					data: "name",
					render: function ( data, type, row ) {
						return '<a title="Edit">' + data + '</a>';
					},
					responsivePriority: 1
				},{
					title: Lang.lookup("HST Percent"),
					data: "hst",
					type: "num",
					render: function ( data, type, row ) {
						return parseFloat(data);
					}
				},{
					title: Lang.lookup("GST Percent"),
					data: "gst",
					type: "num",
					render: function ( data, type, row ) {
						return parseFloat(data);
					}
				},{
					title: Lang.lookup("PST Percent"),
					data: "pst",
					type: "num",
					render: function ( data, type, row ) {
						return parseFloat(data);
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
			];
		}
		
		var parent = _panel.body();
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="TablePanel">';
			xhtml += 	'<div class="Inner">';
			xhtml += 		'<div class="Options">';
			xhtml += 			'<div class="Button"><span class="glyphicon glyphicon glyphicon-plus" aria-hidden="true"></span> ' + Lang.lookup("Add Nexus") + '</div>';
			xhtml += 			'<div class="Clear"></div>';
			xhtml += 		'</div>';
			xhtml += 		'<table class="table table-striped table-bordered" width="100%" cellspacing="0"></table>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
		parent.html(xhtml);
		
		_obj_button = parent.find("#" + _uniquid + " .Button");
		_obj_button.click(createClick);
		
		/* start up our dataset
			*/
		_setlist = new SetList();
		_setlist.name(_name);
		_setlist.columms(_column_ids);
		_setlist.addEventListener("onStartLoad", onStartLoad);
		_setlist.addEventListener("onDataLoaded", onDataLoaded);
		_setlist.initialize();

		/* create the datatable
			*/
		_table = $('#' + _uniquid + " table").DataTable( {
			rowReorder: false,
			searching: true,
			ordering: true,
			paging: true,
			responsive: {
				details: false
			},
			select: false,
			data: [],
			columns: cols,
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
		_obj_button.off();
		_table.destroy(true);
		_setlist.removeEventListener("onStartLoad", onStartLoad);
		_setlist.removeEventListener("onDataLoaded", onDataLoaded);
	};
	this.initialize = function () {
		SetList = classes.components.SetList;
		Lang = classes.data.Lang;
		Dialog = classes.components.Dialog;
		Func = classes.helpers.Func;
		render();
	};
	
};

classes.panels.TaxSetup.prototype = new EventDispatcher();
