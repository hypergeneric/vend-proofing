
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.panels.AssetLibrary = function () {
	
	/* "imported" classes
		*/
		
	var Auth;
	var Func;
	var Dialog;
	var Lang;
	
	/* private properites
		*/
		
	var _instance = 			this;
	var _panel = 				null;
	var _parent = 				null;
	var _controller = 			null;
	var _uniquid = 				"FO" + classes.helpers.Func.uniquid();
	var _table = 				null;
	var _ingest = 				[];
	var _all = 					[];
	var _suid = 				"";
	var _name = 				"";
	var _key = 					"asset";
	var _init_filename = 		null;
	var _multiselect = 			true;
	var _filter = 				null;
	var _importer = 			{ use:false };
	var _sideload = 			{ use:false };
	var _selected = 			[];
	var _page = 				0;
	var _display = 				"normal";
	var _curated = 				false;
	var _paging = 				true;
	var _editable = 			true;
	var _image_list = 			[];
	var _image_loader = 		null;
	var _image_loader_index = 	-1;
	var _image_loader_loading = false;
	var _trigger_change_event = false;
	var _trigger_load_event = 	false;
	
	var _obj_upload = 			null;
	var _obj_delete = 			null;
	var _obj_sort = 			null;
	
	/* private methods
		*/
		
	function action (key, obj) {
		switch (key) {
			case "preview" :
				launchAsset(obj);
				break;
			case "del" :
				deleteAsset(obj);
				break;
			case "edit" :
				editAsset(obj);
				break;
		}
	}
	
	/* --- Sorting --- */
	function sortClick () {
		var provider = new Array();
		for (var i=0; i<_ingest.length; ++i) {
			provider.push({
				filename: _ingest[i].filename,
				index: _ingest[i].index
			});
		}
		var sw = StageProxy.width()-2;
		var sh = StageProxy.height()-2;
		var toolheight = 75;
		var gutter = 30;
		if (sw<768) {
			gutter = 0;
			toolheight += 75;
		}
		var maxwidth = sw-20-20-gutter-gutter;
		var maxheight = sh-40-20-20-40-gutter-gutter-toolheight;
		var colwidth = 110;
		var total = provider.length;
		var cols = Math.floor(maxwidth/colwidth);
		var rows = Math.ceil(total/cols);
		if (rows==1) cols = total;
		var dw = (cols*colwidth)+20;
		if (dw<680) {
			dw = 680;
		}
		var dh = (rows*colwidth);
		if (dh>maxheight) {
			dh = maxheight;
		}
		dw += 20+20;
		dh += 20+20+toolheight;
		Dialog.create({
			size: dw+"x"+dh,
			title: Lang.lookup("Sort Images"),
			content: classes.dialogs.ImageSort,
			init: {
				key: _key,
				suid: _suid,
				provider: provider
			},
			owner: this,
			options: [{
				label: Lang.lookup("Save"),
				func: saveImageIndices
			},{
				label: Lang.lookup("Cancel")
			}]
		});
	}
	function saveImageIndices (sorted) {
		_panel.screen(true);
		var indices = [];
		for (var i=0; i<_all.length; ++i) {
			indices[i] = i+","+i;
		}
		if (!sorted) {
			var editor = Dialog.last().classobj;
			var sorted = editor.indices();
		}
		for (var i=0; i<sorted.length; ++i) {
			var obj = sorted[i];
			indices[obj[0]] = obj.join(",");
		}
		indices = indices.join(";");
		Auth.send(this, onAssetData, {
			name: _name,
			suid: _suid,
			action: _key + "_reindex",
			indices: indices
		});
	}
	
	/* --- Uploads --- */
	function uploadClick () {
		Dialog.create({
			size: "600x*",
			title: Lang.lookup("Upload"),
			content: classes.dialogs.Upload,
			init: {
				dironly: _display=="category",
				key: _key,
				suid: _suid,
				name: _name,
				importer: _importer,
				sideload: _sideload
			},
			owner: this,
			options: [{
				label: Lang.lookup("Done"),
				func: uploadClose
			}]
		});
	}
	function uploadClose () {
		var editor = Dialog.last().classobj;
		if (editor.busy()==true) return;
		if (editor.uploaded()==0) return;
		_trigger_change_event = true;
		loadAssetData();
	}
	
	/* --- Image Lazy Loading Stuff --- */
	function cancelLazyLoading () {
		var obj = _image_list[_image_loader_index];
		if (obj) {
			var img = obj.find("img");
			img.off();
			clearInterval(_image_loader);
		}
	}
	function lazyError () {
		var obj = _image_list[_image_loader_index];
		var img = obj.find("img");
		img.attr("src", Func.getEmptyImgSrc());
	}
	function lazyLoaded () {
		var obj = _image_list[_image_loader_index];
		var img = obj.find("img");
		img.data("loaded", true);
		clearInterval(_image_loader);
		_image_loader = setTimeout(lazyLoadNext, 33);
	}
	function lazyLoadNext () {
		_image_loader_index = _image_loader_index + 1;
		if (_image_loader_index==_image_list.length) {
			_image_loader_index = _image_loader_index - 1
			_image_loader_loading = false;
			return;
		}
		_image_loader_loading = true;
		var obj = _image_list[_image_loader_index];
		var img = obj.find("img");
		img
			.attr("src", img.data("src"))
			.one('error', lazyError)
			.one('load', lazyLoaded)
			.each(Func.imgonload);
	}
	function lazyLoad (obj) {
		var img = obj.find("img");
		if (img.data("loaded")==false) {
			_image_list.push(obj);
			if (_image_loader_loading==false) {
				lazyLoadNext();
			}
		}
	}
	
	/* --- Video Snapshot Stuff --- */
	function checkForSnapshot(obj, row) {
		if (!_editable) {
			return;
		}
		var button = obj.find("button");
		button.click(function () {
			var sw = StageProxy.width()-2;
			var sh = StageProxy.height()-2;
			var toolheight = 75;
			var gutter = 30;
			if (sw<768) {
				gutter = 0;
				toolheight += 75;
			}
			var dims = row.dimensions.split("x");
			var asset_width = parseInt(dims[0], 10);
			var asset_height = parseInt(dims[1], 10);
			if ( isNaN(asset_width) || isNaN(asset_height) ) { // either no video info, no image info, so it will be a stage
				var asset_width = 480;
				var asset_height = 200;
			}
			var aspect = asset_width/asset_height;
			var maxwidth = sw-20-20-gutter-gutter;
			var maxheight = sh-40-20-20-40-gutter-gutter-toolheight;
			var dw = maxwidth;
			var dh = maxwidth/aspect;
			if (dh>maxheight) {
				dh = maxheight;
				dw = maxheight*aspect;
			}
			dw += 20+20;
			dh += 20+20+toolheight;
			Dialog.create({
				size: dw+"x"+dh,
				title: Lang.lookup("Capture Video Screenshot"),
				content: classes.dialogs.Snapshot,
				init: {
					suid: _suid,
					key: _key,
					name: _name,
					filename: row.filename
				},
				owner: this,
				options: [{
					label: Lang.lookup("Close"),
					func: updateSnapshot,
					param: obj
				}]
			});
		});
	}
	function updateSnapshot(obj) {
		var img = obj.find("img");
		img
			.off()
			.attr("src", Func.getEmptyImgSrc())
			.attr("src", img.data("src") + "&d" + new Date().getTime())
			.one('error', lazyError)
			.each(Func.imgonload);
	}
	
	/* --- Datatable Selection / Functions --- */
	function syncSelection () {
		for (var i=0; i<_ingest.length; ++i) {
			var row = _table.row(i);
			var node = $(row.node());
			var data = row.data();
			for (var j=0; j<_selected.length; ++j) {
				if ( data.filename == _selected[j].filename ) {
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
		if (_selected.length>1) {
			_obj_delete.removeClass("Disabled").click(deleteAssets);
		}
		_instance.dispatch("onSelected");
	}
	function removeAll (redraw) {
		if (redraw==undefined) redraw = true;
		_selected = [];
		if (redraw) {
			change();
		}
	}
	function addByFilename (filename) {
		var doadd = true;
		var obj;
		for (var i=0; i<_ingest.length; ++i) {
			if (_ingest[i].filename==filename) {
				obj = _ingest[i];
				break;
			}
		}
		for (var i=0; i<_selected.length; ++i) {
			if (_selected[i].filename==filename) {
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
	function removeByFilename (filename) {
		for (var i=0; i<_selected.length; ++i) {
			if (_selected[i].filename==filename) {
				_selected.splice(i, 1);
				change();
				break;
			}
		}
	}
	
	/* --- Asset Item Management --- */
	function launchAsset (obj) {
		var uri = Auth.basepath() + NAMESPACE + "-data/storage/" + (_suid==""?_key:_suid) + "/" + obj.filename;
			if (obj.service!=undefined) {
				uri ="http://" + obj.media_uri;
			}
		window.open(uri);
	}
	function editAsset (obj) {
		Dialog.create({
			size: "520x*",
			title: Lang.lookup("Edit File"),
			content: classes.dialogs.FileEditor,
			init: {
				label: obj.label,
				description: obj.description
			},
			owner: this,
			options: [{
				label: Lang.lookup("Save Changes"),
				func: editConfirm,
				param: obj
			},{
				label: Lang.lookup("Cancel")
			}]
		});
	}
	function editConfirm (obj) {
		var editor = Dialog.last().classobj;
		_trigger_change_event = true;
		_trigger_load_event = false;
		Auth.send(this, onAssetData, {
			name: _name,
			suid: _suid,
			action: _key + "_update",
			data: ([obj.filename, editor.label(), "null", "null", "null", editor.description()]).join("\t")
		});
	}
	function deleteAsset (obj) {
		Dialog.create({
			size: "520x*",
			title: Lang.lookup("delete_files_confirmation"),
			content: Lang.lookup("delete_files_confirmation_description"),
			owner: this,
			options: [{
				label: Lang.lookup("yes_delete"),
				func: deleteAssetConfirm,
				param: obj
			},{
				label: Lang.lookup("cancel")
			}]
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
	function deleteAssetConfirm (obj) {
		_panel.screen(true);
		_trigger_load_event = true;
		_trigger_change_event = true;
		Auth.send(this, onAssetData, {
			name: _name,
			suid: _suid,
			action: _key + "_delete",
			files: obj.filename
		});
	}
	function deleteAssetsConfirm () {
		_panel.screen(true);
		var files = [];
		for (var i=0; i<_selected.length; ++i) {
			files.push(_selected[i].filename);
		}
		files = files.join(",");
		_selected = [];
		_trigger_change_event = true;
		_trigger_load_event = true;
		Auth.send(this, onAssetData, {
			name: _name,
			suid: _suid,
			action: _key + "_delete",
			files: files
		});
	}
	
	/* --- Datatable Creation/Update --- */
	function filterIngest (redraw) {
		if (redraw==undefined) redraw = false;
		_ingest = [];
		for (var i=0; i<_all.length; ++i) {
			var obj = _all[i];
			if (_filter) {
				obj = _filter(obj);
				if (obj==false) continue;
			}
			_ingest.push(obj);
		}
		/* manbage sort
			*/
		_obj_sort.addClass("Disabled").off();
		if (_ingest.length>0) {
			_obj_sort.removeClass("Disabled").click(sortClick);
		}
		/*
			re-populate the grid
			*/
		if (_table!=null) {
			_table.clear();
			_table.rows.add(_ingest);
			_table.draw(redraw);
		}
		/*
			auto-select to start
			*/
		if ( _init_filename!=null && _init_filename!="" ) {
			addByFilename(_init_filename);
			_init_filename = null;
		}
		/*
			setup the selection
			*/
		change();
	}
	function onAssetData (success, data) {
		/*
			re-populate the grid
			*/
		_panel.screen(false);
		/*
			parse it all out
			*/
		_all = [];
		if (data) {
			var lines = data=="" ? [] : data.split("\n");
			var column_ids = ["filename", "label", "dimensions", "duration", "bytes", "description", "media_uri", "service"];
			for (var i=0; i<lines.length; ++i) {
				var line = lines[i];
				var values = line.split("\t");
				var obj = new Object();
				obj.index = i;
				for (var j=0; j<values.length; ++j) {
					var value = values[j];
					var column_id = column_ids[j];
					obj[column_id] = value || "";
				}
				_all.push(obj);
			}
		}
		/* broadcast loaded
			*/
		if (_trigger_load_event) {
			_trigger_load_event = false;
			_instance.dispatch("onAssetData");
		}
		/* filter the results
			*/
		filterIngest();
		/*
			trigger events
			*/
		if (_trigger_change_event) {
			_trigger_change_event = false;
			_instance.dispatch("onChanged");
		}
	}
	function loadAssetData () {
		_panel.screen(true);
		_trigger_load_event = true;
		Auth.send(this, onAssetData, {
			name: _name,
			suid: _suid,
			action: _key + "_list"
		});
	}
	function destroyCells () {
		$('#' + _uniquid).find("button").off();
	}
	function render () {
		
		/* add some html to start
			*/
		var parent = _parent || _panel.body();
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="TablePanel">';
			xhtml += 	'<div class="Inner">';
		if (_editable) {
			xhtml += 		'<div class="Options">';
			xhtml += 			'<div class="Button Upload"><span class="glyphicon glyphicon-plus" aria-hidden="true"></span> ' + Lang.lookup("Add Media") + '</div>';
			xhtml += 			'<div class="Button Delete Secondary Disabled"><span class="glyphicon glyphicon-trash" aria-hidden="true"></span> ' + Lang.lookup("Delete") + '</div>';
		if ( _curated && !IS_MOBILE && !IS_TABLET && _key!="audio" && _key!="track" ) {
			xhtml += 			'<div class="Button Sort Secondary Disabled"><span class="glyphicon glyphicon-sort" aria-hidden="true"></span> ' + Lang.lookup("Sort") + '</div>';
		}
			xhtml += 			'<div class="Clear"></div>';
			xhtml += 		'</div>';
		}
			xhtml += 		'<table class="AssetTable' + (_curated?"Curated":"") + ' table table-striped table-bordered" width="100%" cellspacing="0"></table>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
		parent.html(xhtml);
		
		_obj_upload = parent.find("#" + _uniquid + " .Upload");
		_obj_delete = parent.find("#" + _uniquid + " .Delete");
		_obj_sort = parent.find("#" + _uniquid + " .Sort");
		
		_obj_upload.click(uploadClick);
		_obj_sort.click(sortClick);
		
		var cols = [
			{
				title: '',
				data: "index",
				width: 30,
				render: function ( data, type, row ) {
					return '<div style="text-align:center;cursor:pointer" class="DragIcon"><span class="glyphicon glyphicon-option-horizontal" aria-hidden="true"></span></div>';
				}
			},{
				title: "Preview",
				data: "filename",
				orderable: false,
				width: 100,
				render: function ( data, type, row ) {
					var ext = data.split(".").pop().toLowerCase();
					var xhtml = '<div style="text-align:center">';
					if (ext=="jpg"||ext=="jpeg"||ext=="jpe"||ext=="gif"||ext=="png") {
						var URI = Auth.basepath() + NAMESPACE + "-resample.php?q=";
						var query = "";
							query += (_suid==""?_key:_suid) + ":" + data + ":"; // the folder:file combo
							query += 100 + ":"; // the width
							query += 100 + ":"; // the height
							query += 1 + ":::1"; // the thumbnail it
						xhtml += '<div id="file-' + md5(data) + '" class="ImageObject">';
						xhtml += 	'<img src="' + Func.getEmptyImgSrc() + '" data-loaded="false" data-src="' + URI + query + '" width="100" height="100" />';
						xhtml += '</div>';
					} else if (ext=="mp3") {
						var uri = Auth.basepath() + NAMESPACE + "-data/storage/" + (_suid==""?_key:_suid) + "/" + row.filename;
						xhtml += '<div id="file-' + md5(data) + '" class="AudioObject" >';
						xhtml += 	'<div>';
						xhtml += 	'<audio class="listen" controls preload="none" src="' + uri + '"></audio>';
						xhtml += 	'</div>';
						xhtml += '</div>';
					} else if (ext=="mp4"||ext=="ogg"||ext=="webm"||ext=="mview") {
						var URI = Auth.basepath() + NAMESPACE + "-resample.php?q=";
						var query = "";
							query += (_suid==""?_key:_suid) + ":" + data + ".snapshot.jpg:"; // the folder:file combo
							query += 100 + ":"; // the width
							query += 100 + ":"; // the height
							query += 1 + ":::0"; // the thumbnail it
						xhtml += '<div id="file-' + md5(data) + '" class="ImageObject">';
						xhtml += 	'<button type="button" class="btn btn-default btn-sm">'
						xhtml += 		'<span style="font-size:1.5em;" class="glyphicon glyphicon-picture" aria-hidden="true"></span>';
						xhtml += 	'</button>';
						xhtml += 	'<img src="' + Func.getEmptyImgSrc() + '" data-loaded="false" data-src="' + URI + query + '" width="100" height="100" />';
						xhtml += '</div>';
					} else {
						xhtml += '<div id="file-' + md5(data) + '" class="FileObject">';
						xhtml += 	'<div style="margin: 0 auto;" class="file-icon file-icon-lg" data-type="' + ext + '"></div>';
						xhtml += '</div>';
					}
						xhtml += '</div>';
					return xhtml;
				}
			},{
				title: (_display=="normal"?"Label":"Filename"),
				data: "label",
				render: function ( data, type, row ) {
					if ( type === 'display' || type === 'filter' ) {
						data = data.split(" ").join("&nbsp;");
						if ( data=="" ) {
							data = '<i>' + Lang.lookup("Untitled") + "</i>";
						}
						var xhtml = '';
						if ( _editable && _display=="normal" ) {
							xhtml += 	'<a title="Edit">' + data + '</a>';
						} else {
							xhtml += 	'<span title="Edit">' + data + '</span>';
						}
						if ( row.description!=undefined && row.description!="" ) {
							xhtml += 	'<div class="AssetLabelDesc">';
							xhtml += 	row.description;
							xhtml += 	'</div>';
						}
						return xhtml;
					}
					return data;
				},
				responsivePriority: 1
			},{
				title: "Dimensions",
				data: "dimensions",
				type: "num",
				render: function ( data, type, row ) {
					var dims = data.split("x");
					if ( type === 'display' || type === 'filter' ) {
						return data=="x" ? "N/A" : data;
					}
					return parseInt(dims[0], 10) + parseInt(dims[1], 10);
				}
			},{
				title: "Duration",
				data: "duration",
				type: "num",
				render: function ( data, type, row ) {
					var duration = parseFloat(data);
					var kbps = ((parseFloat(row.bytes)*8)/duration)/1000;
					var timestamp = Func.secondsToTime(duration);
					if ( type === 'display' || type === 'filter' ) {
						return !isNaN(duration)&&duration>0 ? timestamp + " @ ~" + Math.round(kbps) + " kbps" : "N/A";
					}
					return duration;
				}
			},{
				title: "Size",
				data: "bytes",
				type: "num",
				render: function ( data, type, row ) {
					if ( type === 'display' || type === 'filter' ) {
						return Func.getByteString(data);
					}
					return parseFloat(data);
				}
			},{
				title: Lang.lookup("Actions"),
				data: "filename",
				orderable: false,
				render: function ( data, type, row ) {
					var xhtml = '';
					if ( _display=="normal" ) {
						xhtml += '<a data-suid="' + data + '" data-action="edit">Edit</a> / ';
					}
						xhtml += '<a data-suid="' + data + '" data-action="del">Delete</a>';
					if ( _display=="normal" ) {
						if (_key!="audio"&&_key!="track") {
							xhtml += ' / ';
							xhtml += '<a data-suid="' + data + '" data-action="preview">Preview</a>';
						}
					}
					return xhtml;
				},
				responsivePriority: 2
			}
		];
		var defs = [{
			targets: (_curated?1:0),
			createdCell: function (td, cellData, rowData, row, col) {
				var html = $(td);
				var id = "file-" + md5(cellData);
				var obj = html.find("#"+id);
				if (obj.hasClass("ImageObject")) {
					lazyLoad(obj);
					checkForSnapshot(obj, rowData);
				}
			}
		},{
			targets: (_curated?2:1),
			createdCell: function (td, cellData, rowData, row, col) {
				var html = $(td);
				var obj = html.find("a");
				obj.click(function (e) {
					editAsset(rowData);
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
		}];
		var reorder = {
			update: false,
			dataSrc: 'index'
		};
		if (!_curated) {
			reorder = false;
			cols.shift();
		}
		if ( _display=="simple" ) {
			if (_key=="gallery"||_key=="image") {
				cols.splice(-3, 1);
			}
		} else if ( _display=="category" ) {
			if (_key=="gallery"||_key=="image") {
				cols.splice(-3, 1);
			}
		} else {
			if (_key=="audio"||_key=="track") {
				cols.splice(-4, 1);
			}
		}
		if (!_editable) {
			cols.pop();
			defs.pop();
			defs.pop();
		}
		var emptyTable = Lang.lookup("No Files Uploaded");
		if ( _display=="category" ) {
			emptyTable = Lang.lookup("No Files Uploaded Or Category Not Selected");
		}
		_table = $('#' + _uniquid + " table").DataTable( {
			stateSave: true,
			stateSaveCallback: function(settings,data) {
				localStorage.setItem( _uniquid, JSON.stringify(data) )
			},
			stateLoadCallback: function(settings) {
				return JSON.parse( localStorage.getItem( _uniquid ) )
			},
			language: {
				emptyTable: emptyTable
			},
			deferRender: true,
			preDrawCallback: destroyCells,
			rowReorder: reorder,
			info: _paging,
			searching: _curated==false,
			ordering: _curated==false,
			paging: _paging,
			order: ( _curated ? undefined : [[ 1, "asc" ]] ),
			responsive: {
				details: false
			},
			select: (_multiselect?'multi':'single'),
			data: [],
			columns: cols,
			columnDefs: defs
		});
		_table.on( 'row-reorder', function ( e, diff, edit ) {
			var indices = [];
			for (var i=0; i<diff.length; ++i) {
				var obj = diff[i];
				indices.push([obj.oldData, obj.newData]);
			}
			saveImageIndices(indices);
		});
		_table.on( 'page.dt', function () {
			var info = _table.page.info();
			_page = info.page;
		});
		_table.on( 'length.dt', function ( e, settings, len ) {
			var info = _table.page.info();
			_page = info.page;
		});
		_table.on( 'select', function ( e, dt, type, indexes ) {
			if ( type === 'row' ) {
				var filename = _table.rows( indexes ).data()[0].filename;
				if (filename=="") return;
				addByFilename(filename);
			}
		});
		_table.on( 'deselect', function ( e, dt, type, indexes ) {
			if ( type === 'row' ) {
				var filename = _table.rows( indexes ).data()[0].filename;
				if (filename=="") return;
				removeByFilename(filename);
			}
		});
		
		loadAssetData();
		
	}
	
	/* public methods
		*/
		
	this.option = function (key) {
		doOption(key);
	};
	this.uniquid = function (str) {
		if (str) {
			_uniquid = str;
		}
		return _uniquid;
	};
	this.importer = function (obj) {
		if (obj!=undefined) {
			_importer = obj;
		}
		return _importer;
	};
	this.sideload = function (obj) {
		if (obj!=undefined) {
			_sideload = obj;
		}
		return _sideload;
	};
	this.display = function (str) {
		if (str) {
			_display = str;
		}
		return _display;
	};
	this.editable = function (bool) {
		if (bool!=undefined) {
			_editable = bool;
		}
		return _editable;
	};
	this.curated = function (bool) {
		if (bool!=undefined) {
			_curated = bool;
		}
		return _curated;
	};
	this.paging = function (bool) {
		if (bool!=undefined) {
			_paging = bool;
		}
		return _paging;
	};
	this.key = function (str) {
		if (str) {
			_key = str;
		}
		return _key;
	};
	this.name = function (str) {
		if (str) {
			_name = str;
		}
		return _name;
	};
	this.suid = function (str) {
		if (str) {
			_suid = str;
		}
		return _suid;
	};
	this.multiselect = function (bool) {
		if (bool!==undefined) {
			_multiselect = bool;
		}
		return _multiselect;
	};
	this.filter = function (func) {
		_filter = func;
	};
	this.reload = function () {
		loadAssetData();
	};
	this.deselect = function (redraw) {
		removeAll(redraw);
	};
	this.refilter = function (redraw) {
		filterIngest(redraw);
	};
	this.getIngest = function (all) {
		return all===true ? _all : _ingest;
	};
	this.getSelected = function () {
		return _selected;
	};
	this.setSelected = function (str) {
		_init_filename = str;
	};
	this.controller = function (obj) {
		_controller = obj;
	};
	this.panel = function (obj) {
		_panel = obj;
	};
	this.parent = function (obj) {
		_parent = obj;
	};
	this.destroy = function () {
		cancelLazyLoading();
		destroyCells();
		_obj_delete.off();
		_obj_upload.off();
		_obj_sort.off();
		_table.off('length.dt');
		_table.off('page.dt');
		_table.off('row-reorder');
		_table.off('select');
		_table.off('deselect');
		_table.destroy(true);
	};
	this.initialize = function (obj) {
		Auth = classes.data.Auth;
		Lang = classes.data.Lang;
		Dialog = classes.components.Dialog;
		Func = classes.helpers.Func;
		for (var prop in obj) {
			this[prop](obj[prop]);
		}
		render();
	};
	
};

classes.panels.AssetLibrary.prototype = new EventDispatcher();
