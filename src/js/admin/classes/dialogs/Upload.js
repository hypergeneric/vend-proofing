
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.dialogs.Upload = function () {
	
	/* "imported" classes
		*/
		
	var StageProxy;
	var Func;
	var Lang;
	var Auth;
	var Cookie;
	var Dialog;
	
	/* private properites
		*/
	
	var _uniquid = 			classes.helpers.Func.uniquid();
	var _instance = 		this;
	var _parent = 			null;
	var _key = 				"asset";
	var _suid = 			"";
	var _name = 			"";
	var _importer = 		{ use:false };
	var _sideload = 		{ use:false };
	var _dironly = 			false;
	
	var _index = 			-1;
	var _uploaded = 		0;
	var _busy = 			false;
	var _maxupload = 		0;
	var _filearray = 		[];
	var _current = 			{};
	var _dnd_available = 	true;
	var _debug = 			true;
	var _over = 			false;
	
	var _item_uid = 				-1;
	var _item_uids = 				[];
	var _item_queue = 				[];
	var _item_current = 			null;
	var _item_current_id = 			null;
	var _item_upload_interval = 	null;
	var _append_queue = 			[];
	var _append_queue_interval = 	null;
	
	var _input_serviceuri = null;
	var _btn_addservice = 	null;
	var _btn_upload = 		null;
	var _btn_cancelall = 	null;
	var _fileselector = 	null;
	var _filelist = 		null;
	
	/* private methods
		*/

	function dragover (e) {
		e.preventDefault();
		_filelist.css("borderColor", "red");
	}
	function dragleave (e) {
		e.preventDefault();
		_filelist.css("borderColor", "#ccc");
	}
	function drop (e) {
		e.preventDefault();
		if (e.dataTransfer && e.dataTransfer.items) {
			parse(e.dataTransfer.items);
			_append_queue_interval = setTimeout(appendBatch, 1000);
		}
		_filelist.css("borderColor", "#ccc");
	}
	
	function append (file) {
		_filearray.push({
			autoimport: _importer.use,
			dropped: true,
			skip: false,
			type: "upload",
			data: file
		});
	}
	function appendBatch () {
		var len = Math.min(_append_queue.length, 500);
		if (len==0) {
			if (_busy==false) startUpload();
			return;
		}
		for (var i=0; i<len; ++i) {
			var file = _append_queue.shift();
			append(file);
		}
		updateRows();
		_append_queue_interval = setTimeout(appendBatch, 100);
	}
	function addItem (file) {
		_append_queue.push(file);
	};
	function readentries(reader) {
		reader.readEntries(function(entries) {
			parse(entries);
			if (entries.length) {
				readentries(reader);
			}
		}, function(err) {
			action("error", err);
		});
	};
	function parse(files) {
		for (var i = 0; i < files.length; i++) {
			var file = files[i];
			var entry, reader;
			if (file.isFile || file.isDirectory) {
				entry = file;
			} else if (file.getAsEntry) {
				entry = file.getAsEntry();
			} else if (file.webkitGetAsEntry) {
				entry = file.webkitGetAsEntry();
			}
			if (entry) {
				if (entry.isFile) {
					addItem(entry);
				} else if (entry.isDirectory) {
					reader = entry.createReader();
					readentries(reader);
				}
			}
		}
	};
	
	function file_addservice () {
		/* clean up the url
			*/
		var uri = _input_serviceuri.val();
			if (uri.substr(0, 7)=="http://") uri = uri.substr(7);
			if (uri.substr(0, 8)=="https://") uri = uri.substr(8);
			uri = uri.split("../").join("");
		_input_serviceuri.val(uri);
		/* append it to the file array
			*/
		_filearray.push({
			dropped: false,
			filename: "",
			skip: false,
			type: "sideload",
			data: uri
		});
		/* redraw
			*/
		updateRows();
		/* call to start the upload process if it's not alreay going
			*/
		if (_busy==false) startUpload();
	}
	function file_autocopy (fragments) {
		/* append it to the file array
			*/
		var uri = Auth.basepathabsolute()
			+ Auth.datapath() 
			+ "/storage/"
			+ (_suid==""?_key:_suid)
			+ "/" + fragments[0];
		if (uri.substr(0, 7)=="http://") uri = uri.substr(7);
		if (uri.substr(0, 8)=="https://") uri = uri.substr(8);
		Auth.send(this, onAutoCopyComplete, {
			filename: fragments[1],
			uri: uri,
			video: "false",
			action: _importer.key + "_sideload"
		});
	}
	function file_selected (e) {
		var files = $(this)[0].files;
		// console.log(["file_selected", files]);
		for (var i=0; i<files.length; ++i) {
			_filearray.push({
				dropped: false,
				autoimport: _importer.use,
				skip: false,
				type: "upload",
				data: files[i]
			});
		}
		updateRows();
		/* call to start the upload process if it's not alreay going
			*/
		if (_busy==false) startUpload();
	}
	function file_open (e) {
		// console.log("file_open");
		_fileselector.click();
	}
	function dropRow () {
		// console.log(["dropRow", $(this)]);
		var index = $(this).data("index");
		dropIndex(index);
	}
	function dropIndex (i, error) {
		// console.log(["dropIndex", i, error]);
		var item = _filearray[i];
		var row = _filelist.find(".Row"+i);
		row.css("opacity", ".5");
		row.find(".Action").addClass("Disabled").off()
		item.skip = true;
		if (error) {
			var label = Lang.lookup(error) + ' - ' + (item.type=="upload" ? item.data.name : item.data);
			row.css("opacity", "1");
			row.find(".Label span").removeClass().addClass("FileError").html(label);
		}
	}
	function cancelUpload () {
		// console.log("cancelUpload");
		Auth.abort();
		dropIndex(_index);
		processNextItem();
	}
	function cancelAllFiles () {
		// console.log("cancelAllFiles");
		Auth.abort();
		for (var i=0; i<_filearray.length; ++i) {
			dropIndex(i);
		}
		processNextItem();
	}
	function startUpload () {
		// console.log("startUpload");
		_busy = true;
		Dialog.disableOptions([0]);
		Auth.send(this, onUploadInfo, {
			action: "upload_info"
		});
	}
	function endUpload () {
		// console.log("endUpload");
		_busy = false;
		Dialog.enableOptions([0]);
	}
	function onUploadInfo (success, response) {
		// console.log(["onUploadInfo", success, response]);
		_maxupload = Math.min(1.5*1024*1024*1024, parseFloat(response));
		processNextItem();
	}
	function onFileEvent (event, data) {
		// console.log(["onFileEvent", event, data]);
		switch (event) {
		 case "start" :
			onOpen();
			break;
		 case "abort" :
			break;
		 case "fail" :
			onError("IO Error");
			break;
		 case "loaded" :
			if (!data.success) {
				onError(data.response);
			} else {
				onUploadComplete(data.response);
			}
			break;
		 case "progress" :
			onProgress(data.loaded, data.total);
			break;
		}
	}
	function onOpen () {
		var item = _filearray[_index];
		var row = _filelist.find(".Row"+_index);
		var label = Lang.lookup("opening_file") + ' - ' + item.data.name;
		row.find(".Label span").removeClass().addClass("Active");
		row.find(".Action").off().empty();
		if (item.type=="upload") {
			row.find(".Label span").html(label);
			row.find(".Action").html('<span class="glyphicon glyphicon-ban-circle"></span>').click(cancelUpload);
		} else {
			row.find(".Label span").html(item.data);
			row.find(".Action").html('<span class="glyphicon glyphicon-time"></span>').addClass("Disabled");
		}
	}
	function onProgress (loaded, total) {
		var item = _filearray[_index];
		var row = _filelist.find(".Row"+_index);
		var ratio = loaded/total;
		var label = Lang.lookup("Uploading") + " " + Math.round((ratio)*100) + "% - " + item.data.name;
		row.find(".Label span").html(label);
		row.find(".Progress").width((ratio*100)+"%").data("ratio", ratio);
	}
	function onError (err) {
		var item = _filearray[_index];
		var row = _filelist.find(".Row"+_index);
		var label = Lang.lookup("ERROR") + ": " + Lang.lookup(err) + " (" + item.data.name + ")";
		row.find(".Label span").removeClass().addClass("FileError").html(label);
		row.find(".Action").html('<span class="glyphicon glyphicon-alert"></span>').off().addClass("Disabled");
		row.find(".Progress").width(0).data("ratio", 0);
		processNextItem();
	}
	function onUploadComplete (data) {
		var item = _filearray[_index];
		var row = _filelist.find(".Row"+_index);
		var fragments = data.split("\t");
		var label = fragments[1];
		row.find(".Label span").removeClass().addClass("Active").html(label);
		row.find(".Action").html('<span class="glyphicon glyphicon-ok"></span>').off().addClass("Disabled");
		if (item.autoimport) {
			file_autocopy(fragments);
		}
		row.find(".Progress").width(0).data("ratio", 0);
		/* keep going
			*/
		++_uploaded;
		processNextItem();
	}
	function onSideloadComplete (success, data) {
		/* update the row visuals
			*/
		var item = _filearray[_index];
		var row = _filelist.find(".Row"+_index);
		row.find(".Label span").removeClass();
		row.find(".Action").off().addClass("Disabled").empty();
		if (success) {
			var label = data.split("\t")[1];
			row.find(".Label span").addClass("Active").html(label);
			row.find(".Action").html('<span class="glyphicon glyphicon-ok"></span>');
		} else {
			var label = Lang.lookup("ERROR") + ": " + Lang.lookup(data) + " (" + item.data + ")";
			row.find(".Label span").addClass("FileError").html(label);
			row.find(".Action").html('<span class="glyphicon glyphicon-alert"></span>');
		}
		row.find(".Progress").width(0).data("ratio", 0);
		/* keep going
			*/
		++_uploaded;
		processNextItem();
	}
	function onAutoCopyComplete (success, data) {
		/* reload
			
		Auth.send(this, "onAssetList", {
			action: _importer.type + "_list"
		});*/
	}
	function processSystemFile (file, path) {
		//console.log(file);
		if ( _maxupload && !isNaN(_maxupload) && _maxupload!=0 ) {
			if (file.size>_maxupload) {
				dropIndex(_index, "File Exceeds Max Upload Size");
				processNextItem();
				return;
			}
		}
		var extension = file.name.split('.').pop().toLowerCase();
		if ( _key=="gallery" || _key=="image" ) {
			if ( ["mview","swf","flv","mp4","avi","wmv","mov","jpg","jpeg","gif","png","ico","webm","ogv"].indexOf(extension) === -1 ) {
				dropIndex(_index, "Invalid File Type");
				processNextItem();
				return;
			}
		} else if ( _key=="track" || _key=="audio" ) {
			if ( extension!="mp3" ) {
				dropIndex(_index, "Invalid File Type");
				processNextItem();
				return;
			}
		}
		Auth.upload(this, onFileEvent, file, {
			path: path,
			name: _name,
			suid: _suid,
			action: _key + "_upload",
		});
	}
	function processNextItem () {
		// console.log("processNextItem");
		++_index;
		/* if there arent any more items left, stop the upload process
			*/
		if (_index==_filearray.length) {
			_index = _filearray.length-1;
			endUpload();
			return;
		}
		if (true /*filelist.rows.clicked==false*/) {
			_filelist.scrollTop((_index*25)-75); 
		}
		/* process the next item
			*/
		var item = _filearray[_index];
		if (item.skip) {
			processNextItem();
			return;
		}
		if (item.type=="upload") {
			if (item.dropped) {
				var fullpath = item.data.fullPath;
				if ( _dironly==true ) {
					var paths = fullpath.split("/");
					if (paths.length<=2) {
						dropIndex(_index, "Only Folders Allowed");
						processNextItem();
						return;
					}
				} else {
					fullpath = "";
					/*dropIndex(_index, "Folders Not Allowed");
					processNextItem();
					return;*/
				}
				item.data.file(function(file) {
					processSystemFile(file, fullpath);
				}, function(err) {
				});
			} else {
				processSystemFile(item.data, "");
			}
		} else if (item.type=="sideload") {
			onOpen();
			Auth.send(this, onSideloadComplete, {
				name: _name,
				suid: _suid,
				filename: item.filename,
				uri: item.data,
				video: (_sideload.type=="service"?"true":"false"),
				action: _key + "_sideload"
			});
		}
	}
	function updateRows () {
		// console.log("updateRows");
		for (var i=0; i<_filearray.length; ++i) {
			var item = _filearray[i];
			var row = _filelist.find(".Row"+i);
			if (!row.length) { // does not exist, create it now
				/* create the movieclip
					*/
				var parity = i%2==0 ? " Even" : " Odd";
				var xhtml = "";
					xhtml += '<div class="UploadFileItem Row' + i + parity + '">';
					xhtml += 	'<div class="Index">' + (i+1) + '</div>';
					xhtml += 	'<div class="Label">';
					xhtml += 		'<div class="Progress" data-ratio="0"></div>';
					xhtml += 		'<span class="Init">' + (item.type=="upload" ? item.data.name : item.data) + '</span>';
					xhtml += 	'</div>';
					xhtml += 	'<div class="Action" data-index="' + i + '"><span class="glyphicon glyphicon-remove"></span></div>';
					xhtml += 	'<div class="Clear"></div>';
					xhtml += '</div>';
				_filelist.append(xhtml);
				row = _filelist.find(".Row"+i);
				row.find(".Action").click(dropRow);
			}
			var sw = row.width();
			row.find(".Label").width(sw-51);
		}
	}
	function updateView () {
		var serviceuri = _parent.find("#" + _uniquid + " .ServiceURI");
		var w = _btn_addservice.outerWidth();
		//console.log(w, _parent.width());
		serviceuri.width(_parent.width()-w-50);
	}
	function render () {
		
		var isChrome21 = jQBrowser.chrome && jQBrowser.versionNumber>=21;
		var isOpera15 = jQBrowser.opr && jQBrowser.versionNumber>=15;
		var isFF50 = jQBrowser.mozilla && jQBrowser.versionNumber>=50;
		var isEdge = jQBrowser.msedge;
		
		_dnd_available = isChrome21 || isOpera15 || isFF50 || isEdge;
		
		var accept = "";
		switch (_key) {
			case "gallery" :
			case "image" :
				accept = 'image/*,video/*';
				break;
			case "track" :
			case "audio" :
				accept = 'audio/*';
				break;
		}
		
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="UploadDialog DialogForm">';
		if (!_dironly) {
			xhtml += 	'<div class="Submit">';
			xhtml += 		'<input type="submit" class="Upload" value="' + Lang.lookup("Add Files From Your Computer") + '" />';
			xhtml += 	'</div>';
		}
			xhtml += 	'<div class="Submit ' + (_dironly?"":"Secondary") + '">';
			xhtml += 		'<input type="submit" class="CancelAll" value="' + Lang.lookup("Cancel All") + '" />';
			xhtml += 	'</div>';
		if (_importer.use) {
			xhtml += 	'<div class="Submit">';
			xhtml += 		'<input type="submit" value="' + Lang.lookup("Add Files From Your Library") + '" />';
			xhtml += 	'</div>';
		}
			xhtml += 	'<div class="Clear"></div>';
		if (_dnd_available) {
		if (_dironly) {
			xhtml += 	'<span>' + Lang.lookup("Drag Folders Below") + '</span>';
		} else {
			xhtml += 	'<span>' + Lang.lookup("Or Drag Files And Folders Below") + '</span>';
		}
		}
			xhtml += 	'<div class="FileList">';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Clear"></div>';
		if (_sideload.use) {
			xhtml += 	'<div class="Group Input ServiceURI">';
			xhtml += 		'<label>' + Lang.lookup(_sideload.type+" Or") + '</label>';
			xhtml += 		'<input type="input" value="" placeholder="' + Lang.lookup(_sideload.type+" Enter The File URL Here") + '" />';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Submit">';
			xhtml += 		'<input type="submit" class="AddService" value="' + Lang.lookup(_sideload.type+" Add URL") + '" />';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Clear"></div>';
		}
			xhtml += 	'<input type="file" class="File" multiple accept="' + accept + '" />';
			xhtml += '</div>';
			
		if ( _dironly && !_dnd_available ) {
			var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="DialogForm">';
			xhtml += 	'<h3>' + Lang.lookup("Browser Not Supported") + '</h3>';
			xhtml += 	'<span>' + Lang.lookup("Browser Not Supported Description") + '</span>';
			xhtml += '</div>';
		}
			
		_parent.html(xhtml);
		
		_btn_upload = _parent.find("#" + _uniquid + " .Upload");
		_btn_cancelall = _parent.find("#" + _uniquid + " .CancelAll");
		_btn_addservice = _parent.find("#" + _uniquid + " .AddService");
		_input_serviceuri = _parent.find("#" + _uniquid + " .ServiceURI input");
		_fileselector = _parent.find("#" + _uniquid + " .File");
		_filelist = _parent.find("#" + _uniquid + " .FileList");
		
		if (_dnd_available) {
			_filelist.get(0).addEventListener('dragover', dragover);
			_filelist.get(0).addEventListener('dragleave', dragleave);
			_filelist.get(0).addEventListener('drop', drop);
		}
		
		_btn_upload.click(file_open);
		_btn_addservice.click(file_addservice);
		_btn_cancelall.click(cancelAllFiles);
		_fileselector.hide().change(file_selected);
		
		_btn_addservice.parent().css("position", "absolute");
		_btn_addservice.parent().css("bottom", 36);
		_btn_addservice.parent().css("right", 20);
		_btn_addservice.parent().css("margin", "0");
		
		updateView();

	}
	
	/* public methods
		*/
		
	this.dironly = function (bool) {
		if (bool!=undefined) {
			_dironly = bool;
		}
		return _dironly;
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
	this.uploaded = function () {
		return _uploaded;
	};
	this.busy = function () {
		return _busy;
	};
	this.parent = function (obj) {
		_parent = obj;
	};
	this.destroy = function () {
		if (_dnd_available) {
			_filelist.get(0).removeEventListener('dragover', dragover);
			_filelist.get(0).removeEventListener('dragleave', dragleave);
			_filelist.get(0).removeEventListener('drop', drop);
		}
		_filelist.find(".Action").off();
		_btn_addservice.off();
		_btn_upload.off();
		_btn_cancelall.off();
		_fileselector.off();
		_parent.empty();
	};
	this.resize = function () {
		updateView();
	};
	this.initialize = function (obj) {
		Dialog = classes.components.Dialog;
		Auth = classes.data.Auth;
		Cookie = classes.helpers.Cookie;
		Func = classes.helpers.Func;
		Lang = classes.data.Lang;
		StageProxy = classes.StageProxy;
		for (var prop in obj) {
			this[prop](obj[prop]);
		}
		render();
	};
	
};
