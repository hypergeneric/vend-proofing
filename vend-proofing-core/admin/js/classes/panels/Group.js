
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.panels.Group = function () {
	
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
	var _name = 				"";
	var _state = 				[];
	
	var _editor = 				null;
	var _table = 				null;
	var _obj_button = 			null;
	var _uniquid = 				"FO" + classes.helpers.Func.uniquid();
	var _trigger_change_event = false;
	
	/* private methods
		*/
		
	function doOption () {
		_editor.option();
	}
		
	function action (key, obj) {
		switch (key) {
			case "edit" :
				editClick(obj);
				break;
			case "del" :
				deleteClick(obj);
				break;
			case "duplicate" :
				duplicateClick(obj);
				break;
		}
	}
	
	function onDuplicate () {
		_setlist.reload();
	}
	function duplicateConfirm (obj) {
		_panel.screen(true);
		_trigger_change_event = true;
		var editor = Dialog.last().classobj;
		Auth.send(this, onDuplicate, {
			action: "duplicate_set",
			name: _name,
			suid: obj.suid,
			data: editor.label()
		});
	}
	function duplicateClick (obj) {
		Dialog.create({
			size: "500x*",
			title: Lang.lookup("Duplicate Group"),
			content: classes.dialogs.GroupEditor,
			init: {
				label: obj.label
			},
			options: [{
				label: Lang.lookup("Save Changes"),
				func: duplicateConfirm,
				param: obj
			},{
				label: Lang.lookup("Cancel")
			}]
		});
	}

	function createConfirm () {
		_trigger_change_event = true;
		var editor = Dialog.last().classobj;
		_setlist.createObject({
			label: editor.label()
		});
	}
	function createClick () {
		Dialog.create({
			size: "500x*",
			title: Lang.lookup("Create Group"),
			content: classes.dialogs.GroupEditor,
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
			label: editor.label()
		}, obj.suid);
	}
	function editClick (obj) {
		Dialog.create({
			size: "500x*",
			title: Lang.lookup("Edit Group"),
			content: classes.dialogs.GroupEditor,
			init: {
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
	}
	function draw () {
		destroyEditor();
		if (_state.length==1) {
			drawRoot();
		} else {
			drawChild();
		}
	}
	function destroyEditor () {
		$('#' + _uniquid).find("a").off();
		if (_obj_button!=null) {
			_obj_button.off();
		}
		if (_table!=null) {
			_table.destroy(true);
		}
		if (_setlist!=null) {
			_setlist.removeEventListener("onStartLoad", onStartLoad);
			_setlist.removeEventListener("onDataLoaded", onDataLoaded);
		}
		if (_editor!=null) {
			_editor.destroy();
		}
		var parent = _panel.body();
		parent.empty();
	}
	function drawRoot () {
		
		var parent = _panel.body();
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="TablePanel">';
			xhtml += 	'<div class="Inner">';
			xhtml += 		'<div class="Options">';
			xhtml += 			'<div class="Button"><span class="glyphicon glyphicon glyphicon-plus" aria-hidden="true"></span> ' + Lang.lookup("Create New " + _state[0] + " Group") + '</div>';
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
		_setlist.name(_state[0]+"set");
		_setlist.columms(["label"]);
		_setlist.addEventListener("onStartLoad", onStartLoad);
		_setlist.addEventListener("onDataLoaded", onDataLoaded);
		_setlist.initialize();
		
		/* create the datatable
			*/
		_table = $('#' + _uniquid + " table").DataTable( {
			searching: true,
			ordering: true,
			paging: true,
			responsive: {
				details: false
			},
			select: false,
			data: [],
			columns: [
				{
					title: Lang.lookup("Title"),
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
					title: Lang.lookup("Actions"),
					data: "suid",
					orderable: false,
					render: function ( data, type, row ) {
						var xhtml = '';
							xhtml += '<a data-suid="' + data + '" data-action="edit">Rename</a> / ';
							xhtml += '<a data-suid="' + data + '" data-action="del">Delete</a> / ';
							xhtml += '<a data-suid="' + data + '" data-action="duplicate">Duplicate</a>';
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
						Admin.state(null, _state[0] + "/" + rowData.suid);
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
	function getContentClass (view) {
		for (var prop in classes.panels) {
			var classname = prop.toLowerCase();
			
			if (classname==view) {
				return classes.panels[prop];
			}
		}
		return classes.panels.Empty;
	}
	function drawChild () {
		
		var classfragment = _state.length==2 ? _state[0] : _state[2];
		var classid = getContentClass(classfragment+"s");
		
		_editor = new classid();
		_editor.panel(_panel);
		_editor.controller(_controller);
		_editor.initialize();
		_editor.state(_state);

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
	this.name = function (str) {
		if (str) {
			_name = str;
		}
		return _name;
	};
	this.state = function (arr) {
		_state = arr;
		draw();
		var xhtml = Lang.lookup("Pricing");
		var hash = "pricing";
		if (_state.length==1) {
			xhtml += " » " + Lang.lookup(_state[0]+"s");
		}
		if (_state.length>1) {
			hash += "/" + _state[0];
			xhtml += " » " + '<a href="javascript:classes.helpers.History.setHistory(\'' + hash + '\');">' + Lang.lookup(_state[0]+"s") + '</a>';
			if (_state.length==2) {
				hash += "/" + _state[1];
				xhtml += " » " + _state[1];
			}
			if (_state.length>2) {
				hash += "/" + _state[1];
				xhtml += " » " + '<a href="javascript:classes.helpers.History.setHistory(\'' + hash + '\');">' + _state[1] + '</a>';
				if (_state.length>=4) {
					hash += "/" + _state[3];
					xhtml += " » " + Lang.lookup("Prints & Formats");
				}
			}
		}
		Admin.title(xhtml);
	};
	this.destroy = function () {
		destroyEditor();
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

classes.panels.Group.prototype = new EventDispatcher();
