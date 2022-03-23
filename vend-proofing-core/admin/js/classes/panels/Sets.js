
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.panels.Sets = function () {
	
	/* "imported" classes
		*/
	var SetList;
	var Func;
	var Dialog;
	var Lang;
	var Auth;
	var Admin;
	
	/* private properites
		*/
	var _instance = 			this;
	var _setlist = 				null;
	var _parent = 				null;

	var _uniquid = 				"global-vend-sets"; //"FO" + classes.helpers.Func.uniquid();
	var _table = 				null;
	var _obj_screen = 			null;
	var _obj_button = 			null;
	
	/* private methods
		*/
	
	function screen (bool, bool2) {
		if (bool) {
			_obj_screen.show();
			if (bool2===false) {
				_obj_screen.spin(false);
			} else {
				_obj_screen.spin('small', '#444');
			}
		} else {
			_obj_screen.hide();
			_obj_screen.spin(false);
		}
	};
	
	function action (key, obj) {
		switch (key) {
			case "launch" :
				launchClick(obj);
				break;
			case "del" :
				deleteClick(obj);
				break;
			case "edit" :
				editClick(obj);
				break;
		}
	}
	
	function launchClick (obj) {
		var selected = _setlist.selected()[0];
		window.open(Auth.basepath() + Auth.indexpath() + "?/set/" + obj.suid + "/" + Func.cleanTitleFragment(obj.label));
	}
	
	function editConfirm (obj) {
		var editor = Dialog.last().classobj;
		_setlist.updateObject({
			label: editor.label()
		}, obj.suid);
	}
	function editClick (obj) {
		Dialog.create({
			size: "500x*",
			title: Lang.lookup("Edit Set"),
			content: classes.dialogs.SetEditor,
			init: {
				edit: true,
				label: obj.label
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
	
	function deleteConfirm (obj) {
		_setlist.deleteSet(obj.suid);
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
	
	function createConfirm () {
		var editor = Dialog.last().classobj;
		_setlist.createObject({
			label: editor.label(),
			type: editor.type(),
			children: "0"
		});
	}
	function createClick () {
		Dialog.create({
			size: "500x*",
			title: Lang.lookup("Create New Set"),
			content: classes.dialogs.SetEditor,
			owner: this,
			options: [{
				label: Lang.lookup("Create Set"),
				func: createConfirm
			},{
				label: Lang.lookup("Cancel")
			}]
		});
	}
	
	function onDataLoaded () {
		/* manage the tab panel
			*/
		screen(false);
		/* clear the table, add new rows, then redraw
			*/
		_table.clear();
		_table.rows.add(_setlist.ingest());
		_table.draw(false);
	}
	function onStartLoad () {
		screen(true);
	}
	
	function render () {
		
		/* add some html to start
			*/
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="Content TablePanel">';
			xhtml += 	'<div class="Screen"></div>';
			xhtml += 	'<div class="Inner">';
			xhtml += 		'<div class="Options">';
			xhtml += 			'<div class="Button"><span class="glyphicon glyphicon glyphicon-plus" aria-hidden="true"></span> ' + Lang.lookup("Create New Set") + '</div>';
			xhtml += 			'<div class="Clear"></div>';
			xhtml += 		'</div>';
			xhtml += 		'<table class="table table-striped table-bordered" width="100%" cellspacing="0"></table>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
		_parent.html(xhtml);
		
		_obj_screen = _parent.find("#" + _uniquid + " .Screen");
		_obj_button = _parent.find("#" + _uniquid + " .Button");
		
		_obj_screen.click(Func.stop);
		_obj_button.click(createClick);
		
		/* start up our dataset
			*/
		_setlist = new SetList();
		_setlist.name("page");
		_setlist.columms(["label", "type", "children"]);
		_setlist.addEventListener("onStartLoad", onStartLoad);
		_setlist.addEventListener("onDataLoaded", onDataLoaded);
		_setlist.initialize();
		
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
			searching: true,
			ordering: true,
			paging: true,
			order: [[ 1, "asc" ]],
			responsive: {
				details: false
			},
			select: false,
			data: [],
			columns: [
				{
					title: Lang.lookup("Set ID"),
					data: "suid",
					responsivePriority: 3
				},{
					title: Lang.lookup("Set Name"),
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
					title: Lang.lookup("Render Type"),
					data: "type",
					render: function ( data, type, row ) {
						return Lang.lookup(data);
					}	
				},{
					title: '<div style="text-align:center" class="DragIcon"><span class="glyphicon glyphicon glyphicon-list-alt" aria-hidden="true"></span></div>',
					data: "children",
					type: "num",
					width: 30,
					render: function ( data, type, row ) {
						return parseInt(data);
					}
				},{
					title: Lang.lookup("Actions"),
					data: "suid",
					orderable: false,
					render: function ( data, type, row ) {
						var xhtml = '';
							xhtml += '<a data-suid="' + data + '" data-action="edit">Rename</a> / ';
							xhtml += '<a data-suid="' + data + '" data-action="del">Delete</a> / ';
							xhtml += '<a data-suid="' + data + '" data-action="launch">Preview</a>';
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
						Admin.state(null, rowData.type.toLowerCase() + "/" + rowData.suid);
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
	this.parent = function (obj) {
		_parent = obj;
	};
	this.destroy = function () {
		$('#' + _uniquid).find("a").off();
		_obj_button.off();
		_obj_screen.off();
		_table.destroy(true);
		_setlist.removeEventListener("onStartLoad", onStartLoad);
		_setlist.removeEventListener("onDataLoaded", onDataLoaded);
	};
	this.initialize = function () {
		Admin = classes.Admin;
		Auth = classes.data.Auth;
		Lang = classes.data.Lang;
		Dialog = classes.components.Dialog;
		Func = classes.helpers.Func;
		SetList = classes.components.SetList;
		render();
	};
};

classes.panels.Sets.prototype = new EventDispatcher();
