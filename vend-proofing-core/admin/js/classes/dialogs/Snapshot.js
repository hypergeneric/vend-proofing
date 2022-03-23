
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.dialogs.Snapshot = function () {
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
	var _key = 				"";
	var _name = 			"";
	var _suid = 			"";
	var _filename = 		"";
	var _realpath = 		"";
	var _extension = 		"";
	var video_object = 		null;
	var button_save = 		null;
	var button_upload = 	null;
	var output = 			null;
	var response = 			null;
	var screen = 			null;
	var fileselector = 		null;
	/* private methods
		*/
	function onFileEvent (event, data) {
		var message = "";
		var complete = true;
		response.removeClass("Success");
		response.empty();
		switch (event) {
		 case "fail" :
			message = Lang.lookup("Upload Failed");
			break;
		 case "loaded" :
			if (!data.success) {
				message = Lang.lookup(data);
			} else {
				response.addClass("Success");
				message = Lang.lookup("Upload Complete");
			}
			break;
		 case "progress" :
			complete = false;
			message = Math.round((data.loaded/data.total)*100) + "% " + Lang.lookup("Uploaded");
			response.addClass("Success");
			break;
		}
		response.css("visibility", "visible").html(message);
		/* hide screen, enable dialog close
			*/
		if (complete) {
			screen.hide();
			screen.spin(false);
			Dialog.enableOptions([0]);
		}
	}
	function file_selected (e) {
		/* show screen, diable dialog close
			*/
		screen.show();
		screen.spin('small', '#444');
		Dialog.disableOptions([0]);
		/* save it
			*/
		Auth.upload(this, onFileEvent, $(this)[0].files[0], {
			name: _name,
			suid: _suid,
			filename: _filename,
			action: _key + "_upload",
			snapshot: "true"
		});
	}
	function file_open (e) {
		fileselector.click();
	}
	function onSave (success, data) {
		/* hide screen, enable dialog close
			*/
		screen.hide();
		screen.spin(false);
		Dialog.enableOptions([0]);
		/* display the error
			*/
		response.removeClass("Success");
		response.empty();
		if (!success) {
			response.css("visibility", "visible").html(Lang.lookup(data));
		} else {
			response.addClass("Success");
			response.css("visibility", "visible").html(Lang.lookup("Screenshot Saved!"));
		}
	}
	function save () {
		/* show screen, diable dialog close
			*/
		screen.show();
		screen.spin('small', '#444');
		Dialog.disableOptions([0]);
		/* create a canvas
			*/
		output.html("<canvas></canvas>");
		/* draw the screen capture
			*/
		var v = video_object.get(0);
		var cw = v.clientWidth;
		var ch = v.clientHeight;
		var canvas = output.find("canvas").get(0);
			canvas.width = cw;
			canvas.height = ch;
		var context = canvas.getContext('2d');
			context.drawImage(v,0,0,cw,ch);
		/* purge the canvas
			*/
		output.empty();
		/* save it
			*/
		Auth.send(this, onSave, {
			name: _name,
			suid: _suid,
			filename: _filename,
			action: _key + "_snapshot",
			data: canvas.toDataURL("image/jpeg")
		});
	}
	function render () {
		/* create the realpath to the video/object
			*/
		_realpath = Auth.basepath() + NAMESPACE + "-data/storage/" + (_suid==""?_key:_suid) + "/" + _filename;
		_extension = _filename.split(".").pop().toLowerCase();
		/* draw up our stuff
			*/
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="Snapshot DialogForm">';
			xhtml += 	'<div class="Screen"></div>';
		if ( _extension=="mp4" || _extension=="webm" || _extension=="ogg" ) {
			xhtml += 	'<div class="Group Video">';
			xhtml += 		'<video style="display:block" controls autoload muted preload="metadata">';
			xhtml += 			'<source src="' + _realpath + '" type="video/mp4">';
			xhtml += 		'</video>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Submit">';
			xhtml += 		'<input type="submit" class="Save" value="' + Lang.lookup("Save Snapshot of Current Frame") + '" />';
			xhtml += 	'</div>'
		} else {
			xhtml += 	'<div class="Submit">';
			xhtml += 		'<input type="submit" class="Upload" value="' + Lang.lookup("Upload A Snapshot") + '" />';
			xhtml += 	'</div>';
			xhtml += 	'<input type="file" class="File" accept="image/*" />';
		}
			xhtml += 	'<div class="Response">&nbsp;</div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += 	'<div class="Output"></div>';
			xhtml += '</div>';
		_parent.html(xhtml);
		/* create references to our bits
			*/
		video_object = _parent.find("#" + _uniquid + " video");
		button_save = _parent.find("#" + _uniquid + " .Save");
		button_upload = _parent.find("#" + _uniquid + " .Upload");
		output = _parent.find("#" + _uniquid + " .Output");
		screen = _parent.find("#" + _uniquid + " .Screen");
		response = _parent.find("#" + _uniquid + " .Response");
		fileselector = _parent.find("#" + _uniquid + " .File");
		screen = _parent.find("#" + _uniquid + " .Screen");
		/* attach events
			*/
		button_upload.click(file_open);
		button_save.click(save);
		fileselector.hide().change(file_selected);
		screen.click(Func.stop);
		/* move the error fieldover
			*/
		var ml = 0;
		if ( _extension=="mp4" || _extension=="webm" || _extension=="ogg" ) {
			ml += button_save.outerWidth() + 15;
		} else {
			ml += button_upload.outerWidth() + 15;
		}
		response.css("margin-left", ml);
	}
	/* public methods
		*/
	this.filename = function (str) {
		if (str) {
			_filename = str;
		}
		return _filename;
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
	this.parent = function (obj) {
		_parent = obj;
	};
	this.destroy = function () {
		screen.off();
		fileselector.off();
		button_upload.off();
		button_save.off();
		_parent.empty();
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
