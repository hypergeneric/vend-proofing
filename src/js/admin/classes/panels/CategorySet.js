classes.panels.CategorySet = function () {
	
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
	
	var _selected = 			[];
	var category_rows = 		[];
	var category_lookup = 		{};
	var categories_hash = 		null;
	var image_rows = 			[];
	var image_lookup = 			{};
	var _trigger_image_reload = false;
	
	var _obj_right = 			null;
	var _obj_delete = 			null;
	var _category_table = 		null;
	var _editor = 				null;

	/* private methods
		*/
	
	function move (dir, ifrom, ito) {
		_panel.screen(true);
		Auth.send(this, onCategories, {
			name: "category",
			puid: _suid,
			action: "set_reindex",
			from: ifrom,
			to: ito
		});
	}
	
	function deleteAssets () {
		Dialog.create({
			size: "520x*",
			title: Lang.lookup("delete_files_confirmation"),
			content: Lang.lookup("delete_files_confirmation_description"),
			owner: this,
			options: [{
				label: Lang.lookup("yes_delete"),
				func: deleteAssetsConfirm
			},{
				label: Lang.lookup("cancel")
			}]
		});
	}
	function deleteAssetsConfirm () {
		_panel.screen(true);
		var files = [];
		var group = image_lookup[_selected[0].hash];
		if (!group) {
			onDeleteAssets();
			return;
		}
		for (var i=0; i<group.length; ++i) {
			files.push(group[i].filename);
		}
		files = files.join(",");
		Auth.send(this, onDeleteAssets, {
			name: "page",
			suid: _suid,
			action: "image_delete",
			files: files
		});
	}
	function onDeleteAssets (success, data) {
		Auth.send(this, onDeleteCategory, {
			action: "set_delete",
			suid: _selected[0].hash,
			puid: _suid,
			name: "category"
		});
		_selected = [];
	}
	function onDeleteCategory (success, data) {
		_panel.screen(false);
		_editor.reload();
	}
	
	/* --- Datatable Selection / Functions --- */
	function syncSelection () {
		for (var i=0; i<category_rows.length; ++i) {
			var row = _category_table.row(i);
			var node = $(row.node());
			var data = row.data();
			for (var j=0; j<_selected.length; ++j) {
				if ( data.hash == _selected[j].hash ) {
					if (node.hasClass("selected")==false) {
						row.select();
						change();
						break;
					}
				}
			}
		}
	}
	function change () {
		syncSelection();
		_obj_delete.addClass("Disabled").off();
		if (_selected.length>0) {
			_obj_delete.removeClass("Disabled").click(deleteAssets);
		}
		_editor.deselect(false);
		_editor.refilter(true);
	}
	function addByHash (hash) {
		var doadd = true;
		var obj;
		for (var i=0; i<category_rows.length; ++i) {
			if (category_rows[i].hash==hash) {
				obj = category_rows[i];
				break;
			}
		}
		for (var i=0; i<_selected.length; ++i) {
			if (_selected[i].hash==hash) {
				_selected[i] = obj; // update
				doadd = false
				break;
			}
		}
		if (doadd) {
			_selected.push(obj);
			change();
		}
	}
	function removeByHash (hash) {
		for (var i=0; i<_selected.length; ++i) {
			if (_selected[i].hash==hash) {
				_selected.splice(i, 1);
				change();
				break;
			}
		}
	}
	
	function onAssetData () {
		image_lookup = new Object();
		var images = _editor.getIngest(true);
		for (var i=0; i<images.length; ++i) {
			var obj = images[i];
			var hash = obj.media_uri;
			if (image_lookup[hash]==undefined) image_lookup[hash] = new Array();
			image_lookup[hash].push(obj);
		}
		_panel.screen(true);
		Auth.send(this, onCategories, {
			puid: _suid,
			name: "category",
			action: "set_list"
		});
	}
	
	function parseCategories (success, data) {
		/*
			store everything as rows and columns
			*/
		category_rows = new Array();
		/*
			parse it all out
			*/
		if (data) {
			var lines = data=="" ? [] : data.split("\n");
			var column_ids = ["hash", "label"];
			for (var i=0; i<lines.length; ++i) {
				var line = lines[i];
				var values = line.split("\t");
				var obj = new Object();
				obj.index = i;
				for (var j=0; j<values.length; ++j) {
					var value = values[j];
					var column_id = column_ids[j];
					obj[column_id] = value;
				}
				obj.count = image_lookup[obj.hash] ? image_lookup[obj.hash].length : 0;
				category_rows.push(obj);
			}
		}
	}
	
	function onCategories (success, data) {
		/*
			re-populate the grid
			*/
		_panel.screen(false);
		/*
			parse it all out
			*/
		parseCategories(success, data);
		/* clear the table, add new rows, then redraw
			*/
		_category_table.clear();
		_category_table.rows.add(category_rows);
		_category_table.draw(false);
		/*
			setup the selection
			*/
		change();
	}
	
	function filter (obj) {
		if (_selected.length==1) {
			if (obj.media_uri==_selected[0].hash) {
				return obj;
			}
		}
		return false;
	}
	
	function render () {
		
		var parent = _panel.body();
		var xhtml = '';
			xhtml += 	'<div id="' + _uniquid + '" class="StatsPanel SetPanel">';
			xhtml += 		'<div class="Third">';
			xhtml += 			'<div class="TablePanel">';
			xhtml += 				'<div class="Inner">';
			xhtml += 					'<div class="Options">';
			xhtml += 						'<div class="Button Delete Disabled"><span class="glyphicon glyphicon-trash" aria-hidden="true"></span> ' + Lang.lookup("Delete Selected") + '</div>';
			xhtml += 						'<div class="Clear"></div>';
			xhtml += 					'</div>';
			xhtml += 				'</div>';
			xhtml += 				'<table class="table table-striped table-bordered" width="100%" cellspacing="0"></table>';
			xhtml += 			'</div>';
			xhtml += 			'<div class="Clear"></div>';
			xhtml += 		'</div>';
			xhtml += 		'<div class="TwoThirds"></div>';
			xhtml += 		'<div class="Clear"></div>';
			xhtml += 	'</div>';
		parent.html(xhtml);
		
		_obj_delete = parent.find("#" + _uniquid + " .Delete");
		_obj_right = $('#' + _uniquid + " .TwoThirds");
		
		_editor = new classes.panels.AssetLibrary();
		_editor.filter(filter);
		_editor.paging(true);
		_editor.parent(_obj_right);
		_editor.panel(_panel);
		_editor.suid(_suid);
		_editor.name("page");
		_editor.display("category");
		_editor.uniquid("page-image-list-"+_suid);
		_editor.curated(true);
		_editor.addEventListener("onAssetData", onAssetData);
		_editor.key("image");
		_editor.initialize();
		
		/* create the datatable
			*/
		_category_table = $('#' + _uniquid + " .Third table").DataTable( {
			rowReorder: {
				update: false,
				dataSrc: 'index'
			},
			language: {
				emptyTable: Lang.lookup("No Categories Uploaded")
			},
			searching: false,
			ordering: false,
			paging: true,
			info: false,
			responsive: {
				details: false
			},
			select: true,
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
					data: "label",
					render: function ( data, type, row ) {
						var xhtml = '';
						if ( row.count==0 ) {
							xhtml += '<span style="color:#ccc;font-style:italic;text-decoration:line-through;">';
						}
							xhtml += data;
						if ( row.count==0 ) {
							xhtml += '</span>';
						}
						return xhtml;
					}
				},{
					title: Lang.lookup("Images"),
					type: "num",
					data: "count"
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
		_category_table.on( 'select', function ( e, dt, type, indexes ) {
			if ( type === 'row' ) {
				var hash = _category_table.rows( indexes ).data()[0].hash;
				if (hash=="") return;
				addByHash(hash);
			}
		});
		_category_table.on( 'deselect', function ( e, dt, type, indexes ) {
			if ( type === 'row' ) {
				var hash = _category_table.rows( indexes ).data()[0].hash;
				if (hash=="") return;
				removeByHash(hash);
			}
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
		_obj_delete.off();
		_editor.removeEventListener("onAssetData", onAssetData);
		_editor.destroy();
		_category_table.off('row-reorder');
		_category_table.off('select');
		_category_table.off('deselect');
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

classes.panels.CategorySet.prototype = new EventDispatcher();