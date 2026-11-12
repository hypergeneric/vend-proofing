
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.dialogs.LinkChooser = function () {
	/* "imported" classes
		*/
	var Admin;
	var Auth;
	var Dialog;
	var Lang;
	var Func;
	/* private properites
		*/
	var _instance = 	this;
	var _uniquid = 		"";
	var _parent = 		null;
	var _label = 		"";
	var _showlabel = 	true;
	var _target = 		"_self";
	var _showtarget = 	true;
	var _uri = 			"";
	var _ismarkdown = 	false;
	var _internal = 	false;
	var _showpages = 	true;
	var _showassets = 	true;
	var _input_title = 	null;
	var _input_pages = 	null;
	var _input_assets = null;
	var _input_target = null;
	var _input_uri = 	null;
	/* private methods
		*/
	function titlechange () {
		var value = _input_title.val();
		if (_label!=value) {
			Dialog.enableOptions([0]);
		}
		_label = value;
	}
	function targetchange () {
		var selected = $("option:selected", this);
		var value = selected.attr("data-value");
		if (_target!=value) {
			Dialog.enableOptions([0]);
		}
		_target = value;
	}
	function urichange () {
		_input_pages.find('option[data-value=""]').prop('selected', true);
		_input_assets.find('option[data-value=""]').prop('selected', true);
		_internal = false;
		var value = _input_uri.val();
		if (_uri!=value) {
			Dialog.enableOptions([0]);
		}
		_uri = value;
	}
	function selectpage () {
		_input_assets.find('option[data-value=""]').prop('selected', true);
		var selected = $("option:selected", this);
		_internal = true;
		var label = selected.val();
		var suid = selected.attr("data-value");
		var prefixes = ["special:", Lang.lookup("URI Special Identifier")+":"];
		var is_special = false;
		var page_type;
		var page_suid;
		var page_label;
		for (var i=0; i<prefixes.length; ++i) {
			var prefix = prefixes[i];
			if (suid.substr(0, prefix.length)==prefix) {
				is_special = true;
				break;
			}
		}
		if (is_special) {
			page_type = Lang.lookup("URI Special Identifier");
			page_suid = suid.substr(prefix.length);
			page_label = "";
		} else {
			page_type = Lang.lookup("URI Page Identifier");
			page_suid = suid;
			page_label = "/" + Func.cleanTitleFragment(label);
		}
		if (_ismarkdown) {
			var uri = page_type + "-" + page_suid;
			_input_uri.val(uri);
		} else {
			var uri = "?/" + page_type + "/" + page_suid + page_label + "/";
			_input_uri.val(uri);
		}
		var value = _input_uri.val();
		if (_uri!=value) {
			Dialog.enableOptions([0]);
		}
		_uri = value;
	}
	function selectasset () {
		_input_pages.find('option[data-value=""]').prop('selected', true);
		var selected = $("option:selected", this);
		_internal = true;
		if (_ismarkdown) {
			var uri = "asset-" + selected.attr("data-value");
			_input_uri.val(uri);
		} else {
			var uri = Auth.datapath() + "/storage/asset/" + selected.attr("data-value");
			_input_uri.val(uri);
		}
		var value = _input_uri.val();
		if (_uri!=value) {
			Dialog.enableOptions([0]);
		}
		_uri = value;
	}
	function onPageData (success, str) {
		var dataset = new Array();
		/*
			parse it all out
			*/
		var value = ""; //_ingest._value;
		var lines = str=="" || !str ? [] : str.split("\n");
		for (var i=0; i<lines.length; ++i) {
			var row = lines[i].split("\t");
			dataset.push({
				label: row[1],
				data: row[0]
			});
		}
		dataset.sort(function(a, b){
			var nameA=a.label, nameB=b.label;
			if (nameA < nameB) return -1;
			if (nameA > nameB) return 1;
			return 0 //default return value (no sorting)
		});
		dataset.unshift({
			label: Lang.lookup("Please Choose"),
			data: ""
		});
		dataset.push({
			label: Lang.lookup("Splash Page"),
			data: Lang.lookup("URI Special Identifier") + ":" + Lang.lookup("URI Splash Identifier")
		});
		dataset.push({
			label: Lang.lookup("Contact Page"),
			data: Lang.lookup("URI Special Identifier") + ":" + Lang.lookup("URI Contact Identifier")
		});
		console.log(dataset);
		_input_pages.prop("disabled", false);
		_input_pages.empty();
		for (var i=0; i<dataset.length; ++i) {
			var selected = dataset[i].data==value;
			_input_pages.append('<option data-value="' + dataset[i].data + '" ' + (selected?"selected":"") + '>' + dataset[i].label + '</option>');
		}
		_input_pages.change(selectpage);
	}
	function onAssetData (success, str) {
		var dataset = new Array();
		/*
			parse it all out
			*/
		var value = ""; //_ingest._value;
		var lines = str=="" || !str ? [] : str.split("\n");
		for (var i=0; i<lines.length; ++i) {
			var row = lines[i].split("\t");
			dataset.push({
				label: row[1],
				data: row[0]
			});
		}
		dataset.sort(function(a, b){
			var nameA=a.label, nameB=b.label;
			if (nameA < nameB) return -1;
			if (nameA > nameB) return 1;
			return 0 //default return value (no sorting)
		});
		if (dataset.length==0) {
			dataset.unshift({
				label: Lang.lookup("No Assets Available"),
				data: ""
			});
		} else {
			dataset.unshift({
				label: Lang.lookup("Please Choose"),
				data: ""
			});
			_input_assets.prop("disabled", false);
		}
		_input_assets.empty();
		for (var i=0; i<dataset.length; ++i) {
			var selected = dataset[i].data==value;
			_input_assets.append('<option data-value="' + dataset[i].data + '" ' + (selected?"selected":"") + '>' + dataset[i].label + '</option>');
		}
		_input_assets.change(selectasset);
	}
	function render () {
		
		_uniquid = "DO" + Func.uniquid();
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="DialogForm">';
		if ( _showlabel ) {
			xhtml += 	'<div class="Group Input Title">';
			xhtml += 		'<label>' + Lang.lookup("Navigation Title") + '</label>';
			xhtml += 		'<input type="input" value="' + _label + '" />';
			xhtml += 	'</div>';
		}
		if (_showpages) {
			xhtml += 	'<div class="Group Input Pages">';
			xhtml += 		'<label>' + Lang.lookup("Link to a Page You Created") + '</label>';
			xhtml += 		'<select><option>' + Lang.lookup("Loading Data Set") + '</option></select>';
			xhtml += 	'</div>';
		}
		if (_showassets) {
			xhtml += 	'<div class="Group Input Assets">';
			xhtml += 		'<label>' + Lang.lookup("Link to an Asset You Uploaded") + '</label>';
			xhtml += 		'<select><option>' + Lang.lookup("Loading Data Set") + '</option></select>';
			xhtml += 	'</div>';
		}
			xhtml += 	'<div class="Group Input URI">';
			xhtml += 		'<label>' + Lang.lookup("Enter URL") + '</label>';
			xhtml += 		'<input type="input" placeholder="http:// or https:// or /some-link-here/" value="' + _uri + '" />';
			xhtml += 	'</div>';
		if (_showtarget) {
			xhtml += 	'<div class="Group Input Target">';
			xhtml += 		'<label>' + Lang.lookup("Select Link Action") + '</label>';
			xhtml += 		'<select></select>';
			xhtml += 	'</div>';
		}
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
			
		_parent.html(xhtml);
		_input_title = 	_parent.find("#" + _uniquid + " .Title input");
		_input_pages = 	_parent.find("#" + _uniquid + " .Pages select");
		_input_assets = _parent.find("#" + _uniquid + " .Assets select");
		_input_uri = 	_parent.find("#" + _uniquid + " .URI input");
		_input_target = _parent.find("#" + _uniquid + " .Target select");
		
	//	_input_title.change(titlechange);
		_input_title.on("input", titlechange);
	//	_input_uri.change(urichange);
		_input_uri.on("input", urichange);
		
		if (_showpages) {
			_input_pages.prop("disabled", true);
			Auth.send(this, onPageData, {
				action: "set_list",
				name: "page",
				suid: ""
			});
		}
		
		if (_showassets) {
			_input_assets.prop("disabled", true);
			Auth.send(this, onAssetData, {
				action: "asset_list"
			});
		}
		
		if (_showtarget) {
			var dataset = Lang.sets("uri_target.target");
			for (var i=0; i<dataset.length; ++i) {
				var selected = dataset[i].data==_target;
				_input_target.append('<option data-value="' + dataset[i].data + '" ' + (selected?"selected":"") + '>' + dataset[i].label + '</option>');
			}
			_input_target.change(targetchange);
		}
		
		Dialog.disableOptions([0]);

	}
	/* public methods
		*/
	this.uri = function (str) {
		if (str) {
			_uri = str;
		}
		return _uri;
	};
	this.label = function (str) {
		if (str) {
			_label = str;
		}
		return _label;
	};
	this.target = function (str) {
		if (str) {
			_target = str;
		}
		return _target;
	};
	this.showlabel = function (bool) {
		if (bool===true||bool===false) {
			_showlabel = bool;
		}
		return _showlabel;
	};
	this.showtarget = function (bool) {
		if (bool===true||bool===false) {
			_showtarget = bool;
		}
		return _showtarget;
	};
	this.ismarkdown = function (bool) {
		if (bool===true||bool===false) {
			_ismarkdown = bool;
		}
		return _ismarkdown;
	};
	this.internal = function (bool) {
		if (bool===true||bool===false) {
			_internal = bool;
		}
		return _internal;
	};
	this.showassets = function (bool) {
		if (bool===true||bool===false) {
			_showassets = bool;
		}
		return _showassets;
	};
	this.showpages = function (bool) {
		if (bool===true||bool===false) {
			_showpages = bool;
		}
		return _showpages;
	};
	this.parent = function (obj) {
		_parent = obj;
	};
	this.destroy = function () {
		_input_title.off();
		_input_uri.off();
		_input_pages.off();
		_input_assets.off();
		_input_target.off();
		_parent.empty();
	};
	this.initialize = function (obj) {
		Dialog = classes.components.Dialog;
		Auth = classes.data.Auth;
		Lang = classes.data.Lang;
		Func = classes.helpers.Func;
		Admin = classes.Admin;
		for (var prop in obj) {
			this[prop](obj[prop]);
		}
		if (Admin.config().setup.standalone._value=="false") {
			_showpages = false;
			_ismarkdown = false;
		}
		render();
	};
};