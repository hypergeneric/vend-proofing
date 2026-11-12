
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.panels.FormBuilder = function () {
	
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
	var _table = 				null;
	var _obj_button = 				null;
	var _uniquid = 				"FO" + classes.helpers.Func.uniquid();
	var _trigger_change_event = false;
	
	/* private methods
		*/

	function createConfirm () {
		_trigger_change_event = true;
		var editor = Dialog.last().classobj;
		_setlist.createObject({
			slug: editor.slug(),
			label: editor.label(),
			type: editor.type(),
			required: editor.required(),
			defaults: editor.defaults(),
			options: editor.options()
		});
	}
	function createClick () {
		Dialog.create({
			size: "500x*",
			title: Lang.lookup("Create Form Object"),
			content: classes.dialogs.FormEditor,
			init: {
				edit: false
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
	
	function toggleRequired (obj) {
		_setlist.updateObject({
			required: (obj.required=="1"?"0":"1")
		}, obj.suid);
	}
	function editConfirm (obj) {
		_trigger_change_event = true;
		var editor = Dialog.last().classobj;
		_setlist.updateObject({
			slug: "null",
			label: editor.label(),
			type: editor.type(),
			required: editor.required(),
			defaults: editor.defaults(),
			options: editor.options()
		}, obj.suid);
	}
	function editClick (obj) {
		Dialog.create({
			size: "500x*",
			title: Lang.lookup("Edit Form Object"),
			content: classes.dialogs.FormEditor,
			init: {
				slug: obj.slug + "_" + obj.suid.toUpperCase(),
				label: obj.label,
				type: obj.type,
				required: obj.required,
				defaults: obj.defaults,
				options: obj.options,
				edit: true
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
			xhtml += 			'<div class="Button"><span class="glyphicon glyphicon glyphicon-plus" aria-hidden="true"></span> ' + Lang.lookup("Create New Form Object") + '</div>';
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
		_setlist.name("formobjects");
		_setlist.columms(["slug", "label", "type", "required", "defaults", "options"]);
		_setlist.addEventListener("onStartLoad", onStartLoad);
		_setlist.addEventListener("onDataLoaded", onDataLoaded);
		_setlist.initialize();
		
		/* create the datatable
			*/
		_table = $('#' + _uniquid + " table").DataTable( {
			rowReorder: {
				update: false,
				dataSrc: 'index'
			},
			searching: false,
			ordering: false,
			paging: false,
			responsive: {
				details: false
			},
			select: false,
			data: [],
			columns: [
				{
					title: "",
					data: "index",
					width: 30,
					render: function ( data, type, row ) {
						return '<div style="text-align:center;cursor:pointer" class="DragIcon"><span class="glyphicon glyphicon-option-horizontal" aria-hidden="true"></span></div>';
					}
				},{
					title: Lang.lookup("Form Label"),
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
					title: Lang.lookup("Form Type"),
					data: "type",
					render: function ( data, type, row ) {
						return Lang.lookup(data);
					}	
				},{
					title: '<div style="text-align:center" class="DragIcon"><span class="glyphicon glyphicon glyphicon-lock" aria-hidden="true"></span></div>',
					data: "required",
					render: function ( data, type, row ) {
						if (data=="0") {
							return '<div style="text-align:center;opacity:.2" class="DragIcon"><a title="Required" class="glyphicon glyphicon-ok" aria-hidden="true"></a></div>';
						} else {
							return '<div style="text-align:center" class="DragIcon"><a class="glyphicon glyphicon-ok" aria-hidden="true"></a></div>';
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
				targets: 3,
				createdCell: function (td, cellData, rowData, row, col) {
					var html = $(td);
					var obj = html.find("a");
					obj.click(function (e) {
						toggleRequired(rowData);
						e.preventDefault();
						return false;
					});
				}
			},{
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
						deleteClick(rowData);
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
		_table.off('row-reorder');
		_table.destroy(true);
		_setlist.removeEventListener("onStartLoad", onStartLoad);
		_setlist.removeEventListener("onDataLoaded", onDataLoaded);
	};
	this.initialize = function () {
		Lang = classes.data.Lang;
		Dialog = classes.components.Dialog;
		Func = classes.helpers.Func;
		SetList = classes.components.SetList;
		render();
	};
	
};

classes.panels.FormBuilder.prototype = new EventDispatcher();
