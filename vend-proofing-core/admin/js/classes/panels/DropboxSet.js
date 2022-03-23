
classes.panels.DropboxSet = function () {
	
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
	var _suid = 				"";
	var _uniquid = 				"FO" + classes.helpers.Func.uniquid();
	
	var _ingest = 				[];
	var _column_ids = 			["hash", "label", "images"];
	var _meta_table = 			null;
	var _category_table = 		null;
	var _obj_sync = 			null;
	var _obj_more = 			null;
	var _obj_directions = 		null;

	/* private methods
		*/
		
	function syncClick () {
		Dialog.create({
			size: "500x*",
			title: Lang.lookup("Dropbox Verify Warning"),
			content: Lang.lookup("Dropbox Verify Warning Description"),
			owner: this,
			options: [{
				label: Lang.lookup("Dropbox Verify Warning Accept"),
				func: syncDropboxAccept
			},{
				label: Lang.lookup("Cancel")
			}]
		});
	}
	function syncDropboxAccept () {

		Auth.send(this, onSyncDropbox, {
			action: "sync_dropbox",
			suid: _suid
		});
	}
	function onSyncDropbox (success, data) {
		if (success==true) {
			var desc = Lang.lookup("Dropbox Now Syncing Description");
			var progress = Math.round(parseFloat(data)*100);
			if (isNaN(progress)) {
				progress = 0;
			}
			desc = desc.split("{PROGRESS}").join(progress);
			Dialog.create({
				size: "500x*",
				title: Lang.lookup["Dropbox Now Syncing"],
				content: desc,
				owner: this,
				options: []
			});
			Auth.send(this, onDropboxChunk, {
				action: "next_dropbox_chunk",
				suid: _suid
			});
		} else {
			Dialog.create({
				size: "500x*",
				title: Lang.lookup("Dropbox Verify Failure"),
				content: data,
				owner: this,
				options: [{
					label: Lang.lookup("ok"),
					func: syncDropboxErrorAccept
				}]
			});
		}
	}
	function onDropboxChunk (success, data) {
		if (success==true) {
			if (data!="1") {
				var desc = Lang.lookup("Dropbox Now Syncing Description");
				var progress = Math.round(parseFloat(data)*100);
				if (isNaN(progress)) {
					progress = 0;
				}
				desc = desc.split("{PROGRESS}").join(progress);
				Dialog.kill();
				Dialog.create({
					size: "500x*",
					title: Lang.lookup("Dropbox Now Syncing"),
					content: desc,
					owner: this,
					options: []
				});
				Auth.send(this, onDropboxChunk, {
					action: "next_dropbox_chunk",
					suid: _suid
				});
			} else {
				Dialog.kill();
				_panel.screen(true);
				Auth.send(this, onMetaLoaded, {
					suid: _suid,
					action: "dropboxset_meta"
				});
			}
		} else {
			Dialog.kill();
			Dialog.create({
				size: "500x*",
				title: Lang.lookup("Dropbox Verify Failure"),
				content: data,
				owner: this,
				options: [{
					label: Lang.lookup["ok"],
					func: syncDropboxErrorAccept
				}]
			});
		}
	}
	function syncDropboxErrorAccept () {
		_panel.screen(false);
	}
	
	function toggleMore () {
		_obj_directions.slideToggle();
	}

	function onMetaLoaded (success, data) {
		_panel.screen(false);
		/* parse through the data
			*/
		var pairs = data.split("&");
		var rows = [];
		for (var i=0; i<pairs.length; ++i) {
			var pair = pairs[i].split("=");
			rows.push({
				prop: Lang.lookup(pair[0]),
				value: pair[1]
			});
		}
		/* clear the table, add new rows, then redraw
			*/
		_meta_table.clear();
		_meta_table.rows.add(rows);
		_meta_table.draw(false);
		/* if success, load up the categories
			*/
		if (success) {
			_panel.screen(true);
			_obj_sync.removeClass("Disabled");
			Auth.send(this, onDataLoaded, {
				puid: _suid,
				action: "set_list",
				name: "category"
			});
		}
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
		}
		/* manage the tab panel
			*/
		_panel.screen(false);
		/* clear the table, add new rows, then redraw
			*/
		_category_table.clear();
		_category_table.rows.add(_ingest);
		_category_table.draw(false);
	}
	
	function move (dir, ifrom, ito) {
		_panel.screen(true);
		Auth.send(this, onDataLoaded, {
			name: "category",
			puid: _suid,
			action: "set_reindex",
			from: ifrom,
			to: ito
		});
	}
	
	function render () {
		
		var parent = _panel.body();
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="StatsPanel SetPanel">';
			xhtml += 	'<div class="Toolbar">';
			xhtml += 		'<div class="Button Sync Disabled"><span class="glyphicon glyphicon-refresh" aria-hidden="true"></span> ' + Lang.lookup("Sync Files") + '</div>';
			xhtml += 		'<div class="Button More Secondary"><span class="glyphicon glyphicon-question-sign" aria-hidden="true"></span> ' + Lang.lookup("Learn More") + '</div>';
			xhtml += 		'<div class="Clear"></div>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Directions">' + Lang.lookup("Dropbox Sync Directions") + '</div>';
			xhtml += 	'<div class="Title">';
			xhtml += 		'<span>' + Lang.lookup("Dropbox Folder Location") + '</span>';
			xhtml += 		'<div>' + Lang.lookup("My Files") + " » " + Lang.lookup("Apps") + " » " + Lang.lookup("Your Vend App Folder") + " » " + _suid + '</div>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += 	'<div class="Left">';
			xhtml += 		'<table class="table table-striped table-bordered" width="100%" cellspacing="0"></table>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Right">';
			xhtml += 		'<table class="table table-striped table-bordered" width="100%" cellspacing="0"></table>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
		parent.html(xhtml);
		
		_obj_sync = parent.find("#" + _uniquid + " .Sync");
		_obj_more = parent.find("#" + _uniquid + " .More");
		_obj_directions = parent.find("#" + _uniquid + " .Directions");
		
		_obj_sync.click(syncClick);
		_obj_more.click(toggleMore);
		
		/* create the datatable
			*/
		_category_table = $('#' + _uniquid + " .Left table").DataTable( {
			rowReorder: {
				update: false,
				dataSrc: 'index'
			},
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
					title: "",
					data: "index",
					width: 30,
					render: function ( data, type, row ) {
						return '<div style="text-align:center;cursor:pointer" class="DragIcon"><span class="glyphicon glyphicon-option-horizontal" aria-hidden="true"></span></div>';
					}
				},{
					title: Lang.lookup("Category"),
					data: "label"	
				},{
					title: Lang.lookup("Images"),
					type: "num",
					data: "images"
				}
			]
		});
		_category_table.on( 'row-reorder', function ( e, diff, edit ) {
			var trigger = edit.triggerRow[0][0];
			for (var i=0; i<diff.length; ++i) {
				var obj = diff[i];
				if (trigger==obj.oldPosition) {
					move(0, obj.oldPosition, obj.newPosition);
					break;
				}
			}
		});
		
		_meta_table = $('#' + _uniquid + " .Right table").DataTable( {
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
					title: Lang.lookup("Meta Property"),
					data: "prop"	
				},{
					title: Lang.lookup("Value"),
					data: "value"
				}
			]
		});
		
		/* start up our dataset
			*/
		_panel.screen(true);
		Auth.send(this, onMetaLoaded, {
			suid: _suid,
			action: "dropboxset_meta"
		});

	}
	
	/* public methods
		*/
		
	this.suid = function (str) {
		if (str) {
			_suid = str;
		}
		return _suid;
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
		_obj_sync.off();
		_obj_more.off();
		_meta_table.destroy(true);
		_category_table.off('row-reorder');
		_category_table.destroy(true);
	};
	this.initialize = function (obj) {
		Admin = classes.Admin;
		Auth = classes.data.Auth;
		Lang = classes.data.Lang;
		Dialog = classes.components.Dialog;
		Func = classes.helpers.Func;
		SetList = classes.components.SetList;
		SiteBar = classes.components.SiteBar;
		for (var prop in obj) {
			this[prop](obj[prop]);
		}
		render();
	};
	
};

classes.panels.DropboxSet.prototype = new EventDispatcher();