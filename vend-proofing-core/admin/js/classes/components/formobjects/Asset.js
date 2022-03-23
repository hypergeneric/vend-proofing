
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.components.formobjects.Asset = function () {
	
	/* "imported" classes
		*/
		
	var Func;
	var Lang;
	var Auth;
	var Dialog;
	
	/* private properites
		*/
		
	var _instance = 			this;
	var _label = 				"";
	var _suid = 				"";
	var _name = 				"";
	var _ingest = 				null;
	var _parent = 				null;
	var _key = 					"asset";
	
	var _uniquid = 				classes.helpers.Func.uniquid();
	var _type = 				"";
	var _accept = 				"";
	var _screen = 				null;
	var _preview = 				null;
	var _fileinfo = 			null;
	var _btn_existing = 		null;
	var _btn_open = 			null;
	var _btn_reset = 			null;
	var _fileselector = 		null;
	
	/* private methods
		*/
		
	function screen (bool) {
		if (bool) {
			_screen.show();
			_screen.spin('small', '#444');
		} else {
			_screen.hide();
			_screen.spin(false);
		}
	}
	
	function openLibary (e) {
		var sw = StageProxy.width()-2;
		var sh = StageProxy.height()-2;
		var toolheight = 0;
		var gutter = 30;
		var maxwidth = sw-20-20-gutter-gutter;
		var maxheight = sh-40-20-20-40-gutter-gutter-toolheight;
		var pathbits = _ingest._value.split("/");
		var filename = pathbits.length>0 ? pathbits.pop() : "";
		Dialog.create({
			size: maxwidth + "x" + maxheight,	
			title: Lang.lookup("Library"),
			content: classes.dialogs.AssetChooser,
			init: {
				filename: filename,
				accept: _accept,
				key: _key,
				suid: _suid,
				name: _name
			},
			owner: this,
			options: [{
				label: Lang.lookup("Select"),
				func: onSelect
			},{
				label: Lang.lookup("Close")
			}]
		});
	}
	function onSelect () {
		var editor = Dialog.last().classobj;
		var selected = editor.getSelected()[0];
		var dims = selected.dimensions.split("x");
		_ingest._attributes.width = dims[0];
		_ingest._attributes.height = dims[1];
		_ingest._value = selected.filename.indexOf("/")!=-1 ? selected.filename : Auth.datapath() + "/storage/" + (_suid==""?_key:_suid) + "/" + selected.filename;
		loadPath();
		_instance.dispatch("onChanged");
	}
	
	function file_selected (e) {
		screen(true);
		_btn_open.prop("disabled", true);
		Auth.upload(this, onFileEvent, $(this)[0].files[0], {
			name: _name,
			suid: _suid,
			action: _key + "_upload",
		});
	}
	function file_open (e) {
		_fileselector.click();
	}
	function onFileEvent (event, data) {
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
		clearPath();
		var label = Lang.lookup("opening_file");
	}
	function onProgress (loaded, total) {
		var label = Math.round((loaded/total)*100) + "% " + Lang.lookup("Uploaded");
		_fileinfo.removeClass("Error").addClass("Inactive").html(label);
	}
	function onError (err) {
		screen(false);
		_btn_open.prop("disabled", false);
		Dialog.create({
			size: "420x*",
			title: Lang.lookup("Upload Error"),
			content: Lang.lookup("Upload Error Description").split("{ERROR}").join(Lang.lookup(err)),
			owner: this,
			options: [,{
				label: Lang.lookup("close")
			}]
		});
	}
	function onUploadComplete (data) {
		screen(false);
		_btn_open.prop("disabled", false);
		var row = data.split("\t");
		var dims = row[2].split("x");
		_ingest._attributes.width = dims[0];
		_ingest._attributes.height = dims[1];
		_ingest._value = Auth.datapath() + "/storage/" + (_suid==""?_key:_suid) + "/" + row[0];
		loadPath();
		_instance.dispatch("onChanged");
	}
	
	function clearPath () {
		_ingest._attributes.width = "";
		_ingest._attributes.height = "";
		_ingest._value = "";
		loadPath();
		_instance.dispatch("onChanged");
	}
	function loadPath () {
		draw_nothing();
		if ( _ingest._value=="" || _ingest._value==undefined ) {
			_btn_reset.prop("disabled", true);
		} else {
			_btn_reset.prop("disabled", false);
			var ext = _ingest._value.split(".").pop().toLowerCase();
			if (ext=="jpg"||ext=="jpeg"||ext=="jpe"||ext=="gif"||ext=="png") {
				_type = "image";
				draw_image();
			} else if (ext=="mp4"||ext=="ogg"||ext=="webm") {
				_type = "video";
				draw_image();
			} else {
				draw_file(ext);
			}
		}
	}
	function previewAsset () {
		var popup = window.open(_ingest._value);
	}
	function draw_nothing (){
		_type = "";
		_preview.find("img").off();
		_preview.empty();
		_fileinfo.removeClass("Error").addClass("Inactive").html(Lang.lookup("File Not Selected"));
	}
	function draw_file (ext){
		var pathbits = _ingest._value.split("/");
		var filename = pathbits.pop();
		var puid = pathbits.pop();
		if (_ingest._attributes.font=="true") {
			var uri = NAMESPACE + "-index.php?/html/font/" + puid + "/" + filename + "/";
			console.log(uri);
			var xhtml = '';
				xhtml += '<iframe src="' + uri + '"></iframe>';
			_preview.html(xhtml);
		} else {
			_preview.empty();
		}
		_fileinfo.removeClass("Inactive").removeClass("Error").html(filename);
	}
	function imageError () {
		screen(false);
		var img = _preview.find("img");
		img.attr("src", Func.getEmptyImgSrc());
		if (_type=="video") {
			img.attr("width", 267);
			img.attr("height", 150);
		} else {
			_preview.empty();
			_fileinfo.removeClass("Inactive").addClass("Error").html(Lang.lookup("File Not Found"));
		}
	}
	function imageLoaded () {
		screen(false);
		var img = _preview.find("img");
		img.addClass("Loaded").click(previewAsset);
		var ow = img.parent().width();
		var oh = img.parent().height();
		var iw = img.width();
		var ih = img.height();
		if (iw==1&&ih==1) {
			setTimeout(imageLoaded, 33);
			return;
		}
		//console.log([ow, oh, iw, ih]);
		img.css("left", (ow-iw)/2);
		img.css("top", (oh-ih)/2);
	}
	function updateSnapshot() {
		var img = _preview.find("img");
		img
			.off()
			.attr("src", Func.getEmptyImgSrc())
			.attr("src", img.data("src") + "&d=" + new Date().getTime())
			.one('error', imageError)
			.each(Func.imgonload);
	}
	function draw_image () {
		screen(true);
		var URI = Auth.basepath() + NAMESPACE + "-resample.php?q=";
		var pathbits = _ingest._value.split("/");
		var filename = pathbits.pop();
		var puid = pathbits.pop();
		var query = "";
			query += puid + ":" + filename + (_type=="video"?".snapshot.jpg":"") + ":"; // the folder:file combo
			query += 600 + ":"; // the width
			query += 150 + ":"; // the height
			query += 0 + ":::0"; // the thumbnail it
		var xhtml = '';
			xhtml += '<div class="ImageObject">';
		if (_type=="video") {
			xhtml += 	'<button type="button" class="btn btn-default btn-sm">'
			xhtml += 		'<span style="font-size:1.5em;" class="glyphicon glyphicon-picture" aria-hidden="true"></span>';
			xhtml += 	'</button>';
		}
			xhtml += 	'<img src="' + Func.getEmptyImgSrc() + '" data-src="' + URI + query + '" />';
			xhtml += '</div>';
			xhtml += '<div class="Clear"></div>';
		_preview.html(xhtml);
		_fileinfo.removeClass("Inactive").removeClass("Error").html(filename);
		var img = _preview.find("img");
		img
			.attr("src", img.data("src") + "&d=" + new Date().getTime())
			.one('error', imageError)
			.one('load', imageLoaded)
			.each(Func.imgonload);
		var button = _preview.find("button");
		button.click(function () {
			var sw = StageProxy.width()-2;
			var sh = StageProxy.height()-2;
			var toolheight = 75;
			var gutter = 30;
			if (sw<768) {
				gutter = 0;
				toolheight += 75;
			}
			var asset_width = parseInt(_ingest._attributes.width, 10);
			var asset_height = parseInt(_ingest._attributes.height, 10);
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
					filename: filename
				},
				owner: this,
				options: [{
					label: Lang.lookup("Close"),
					func: updateSnapshot
				}]
			});
		});
	}
	
	function render () {
		
		_accept = "";
		if (_ingest._attributes.extensions) {
			if (_ingest._attributes.extensions!="*") {
				var extensions = _ingest._attributes.extensions.split(",").join(",.");
				extensions = "." + extensions;
				_accept = extensions;
			}
		} else {
			_accept = ".jpg,.jpeg,.jpe,.png";
		}
		
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="FormObject Asset">';
			xhtml += 	'<div class="Screen"></div>';
			xhtml += 	'<div class="Label">' + _label + '</div>';
			xhtml += 	'<div class="Preview"></div>';
			xhtml += 	'<div class="Fileinfo"></div>';
			xhtml += 	'<div class="Actions">';
			xhtml += 		'<input type="submit" class="Existing" value="' + Lang.lookup("Open Library") + '" />';
			xhtml += 		'<input type="submit" class="Open" value="' + Lang.lookup("Upload New") + '" />';
			xhtml += 		'<input type="submit" class="Reset" value="' + Lang.lookup("Clear Selection") + '" />';
			xhtml += 		'<div class="Clear"></div>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += 	'<input type="file" class="File" accept="' + _accept + '" />';
			xhtml += '</div>';
		_parent.append(xhtml);
		
		_screen = _parent.find("#" + _uniquid + " .Screen");
		_preview = _parent.find("#" + _uniquid + " .Preview");
		_fileinfo = _parent.find("#" + _uniquid + " .Fileinfo");
		_btn_existing = _parent.find("#" + _uniquid + " .Existing");
		_btn_open = _parent.find("#" + _uniquid + " .Open");
		_btn_reset = _parent.find("#" + _uniquid + " .Reset");
		_fileselector = _parent.find("#" + _uniquid + " .File");
		
		_screen.click(Func.stop);
		_btn_open.click(file_open);
		_btn_reset.click(clearPath);
		_btn_existing.click(openLibary);
		_fileselector.hide().change(file_selected);
		
		loadPath();
		
	}
	
	/* public methods
		*/
		
	this.label = function (str) {
		if (str) {
			_label = str;
		}
		return _label;
	};
	this.parent = function (obj) {
		if (obj) {
			_parent = obj;
		}
		return _parent;
	};
	this.ingest = function (obj) {
		if (obj) {
			_ingest = obj;
		}
		return _ingest;
	};
	this.key = function (str) {
		if (str) {
			_key = str;
		}
		return _key;
	};
	this.suid = function (str) {
		if (str) {
			_suid = str;
		}
		return _suid;
	};
	this.name = function (str) {
		if (str) {
			_name = str;
		}
		return _name;
	};
	this.destroy = function () {
		_preview.find("img").off();
		_preview.find("button").off();
		_screen.off();
		_btn_open.off();
		_btn_existing.off();
		_btn_reset.off();
		_fileselector.off();
		if (_parent!=null) {
			_parent.empty();
		}
	};
	this.initialize = function () {
		Auth = classes.data.Auth;
		Dialog = classes.components.Dialog;
		Func = classes.helpers.Func;
		Lang = classes.data.Lang;
		StageProxy = classes.StageProxy;
		render();
	};
	
};

classes.components.formobjects.Asset.prototype = new EventDispatcher();
