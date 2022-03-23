
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.components.formobjects.Input = function () {
	/* "imported" classes
		*/
	var Func;
	var Lang;
	var Dialog;
	/* private properites
		*/
	var _instance = 			this;
	var _label = 				"";
	var _puid = 				"";
	var _ingest = 				null;
	var _parent = 				null;
	var _input = 				null;
	var _simplemde = 			null;
	var _uniquid = 				"";
	/* private methods
		*/
	function addLink (e) {
		Dialog.create({
			size: "520x*",
			title: Lang.lookup("Create Link"),
			content: classes.dialogs.LinkChooser,
			init: {
				"label": _simplemde.codemirror.getSelection(),
				"showlabel": true,
				"showassets": true,
				"showtarget": false,
				"ismarkdown": true
			},
			owner: this,
			options: [{
				label: Lang.lookup("Save"),
				func: linkConfirm
			},{
				label: Lang.lookup("Cancel")
			}]
		});
	}
	function addImage (e) {
		Dialog.create({
			size: "520x*",
			title: Lang.lookup("Create Link"),
			content: classes.dialogs.LinkChooser,
			init: {
				"label": _simplemde.codemirror.getSelection(),
				"showlabel": true,
				"showassets": true,
				"showpages": false,
				"showtarget": false,
				"ismarkdown": true
			},
			owner: this,
			options: [{
				label: Lang.lookup("Save"),
				func: assetConfirm
			},{
				label: Lang.lookup("Cancel")
			}]
		});
	}
	function assetConfirm () {
		var MDOBJ = Dialog.last().classobj;
		if (MDOBJ.internal()) {
			_simplemde.codemirror.replaceSelection("![" + MDOBJ.label() + "][" + MDOBJ.uri() + "]");
		} else {
			_simplemde.codemirror.replaceSelection("![" + MDOBJ.label() + "](" + MDOBJ.uri() + ")");
		}
	}
	function linkConfirm () {
		var MDOBJ = Dialog.last().classobj;
		if (MDOBJ.internal()) {
			_simplemde.codemirror.replaceSelection("[" + MDOBJ.label() + "][" + MDOBJ.uri() + "]");
		} else {
			_simplemde.codemirror.replaceSelection("[" + MDOBJ.label() + "](" + MDOBJ.uri() + ")");
		}
	}
	function addTemplateTag (e) {
		if (_simplemde!=null) {
			console.log(_simplemde);
			_simplemde.codemirror.replaceSelection($(this).data("tagname"));
		} else {
			_input.selection('replace', {text: $(this).data("tagname")});
		}
		e.preventDefault();
	}
	function change () {
		var value = _input.val();
		if (_simplemde!=null) {
			value = _simplemde.value();
		}
		if (_ingest._attributes.encoded=="true") {
			value = $.base64.encode(value);
		}
		_ingest._value = value;
		_instance.dispatch("onChanged");
	}
	function render () {
		_uniquid = "FO" + Func.uniquid();
		var lines = parseInt((_ingest._attributes.lines||"1"), 10);
		var type = lines==1 ? "input" : "textarea";
		var value = _ingest._value || "";
		if (_ingest._attributes.encoded=="true") {
			value = $.base64.decode(value);
		}
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="FormObject Input">';
			xhtml += 	'<div class="Label">' + _label + '</div>';
		if (_ingest._attributes.tags) {
			xhtml += 		'<div class="TemplateTags">';
			var tags = _ingest._attributes.tags.split(",");
			for (var i=0; i<tags.length; ++i) {
			xhtml += 			'<button class="TemplateTag" data-tagname="{' + tags[i] + '}">' + Lang.lookup(tags[i]) + '</button>';
			}
			xhtml += 		'</div>';
		}
		if (type=="input") {
			xhtml += 	'<input type="input" value="' + value + '" />';
		} else {
			xhtml += 	'<textarea rows="' + lines + '" cols="50">' + value + '</textarea>';
		}
			xhtml += '</div>';
		_parent.append(xhtml);
		if (type=="input") {
			_input = _parent.find("#" + _uniquid + " input");
		} else {
			_input = _parent.find("#" + _uniquid + " textarea");
		}
		if (_ingest._attributes.restrict) {
			_input.prop("pattern", _ingest._attributes.restrict);
		}
	//	_input.change(change);
		_input.on("input", change);
		if (_ingest._attributes.markdown=="true"&&_ingest._attributes.toolbar=="true") {
			_simplemde = new SimpleMDE({ 
				element: _input[0],
				status: false,
				toolbar: [
					{
						name: "bold",
						action: SimpleMDE.toggleBold,
						className: "fa fa-bold",
						title: "Bold"
					},
					{
						name: "italic",
						action: SimpleMDE.toggleItalic,
						className: "fa fa-italic",
						title: "Italic"
					},
					{
						name: "heading-2",
						action: SimpleMDE.toggleHeading2,
						className: "fa fa-header fa-header-x fa-header-2",
						title: "Medium Heading"
					},
					{
						name: "quote",
						action: SimpleMDE.toggleBlockquote,
						className: "fa fa-quote-left",
						title: "Quote",
						default: true
					},
					{
						name: "unordered-list",
						action: SimpleMDE.toggleUnorderedList,
						className: "fa fa-list-ul",
						title: "Generic List"
					},
					{
						name: "link",
						action: addLink,
						className: "fa fa-link",
						title: "Create Link"
					},
					{
						name: "image",
						action: addImage,
						className: "fa fa-picture-o",
						title: "Insert Image"
					},
					{
						name: "preview",
						action: SimpleMDE.togglePreview,
						className: "fa fa-eye no-disable",
						title: "Toggle Preview"
					},
					{
						name: "side-by-side",
						action: SimpleMDE.toggleSideBySide,
						className: "fa fa-columns no-disable no-mobile",
						title: "Toggle Side by Side"
					},
					{
						name: "fullscreen",
						action: SimpleMDE.toggleFullScreen,
						className: "fa fa-arrows-alt no-disable no-mobile",
						title: "Toggle Fullscreen"
					},
					{
						name: "guide",
						action: "https://simplemde.com/markdown-guide",
						className: "fa fa-question-circle",
						title: "Markdown Guide",
						default: true
					}
				],
				initialValue: value
			});
			_input.off();
			_simplemde.codemirror.on("change", change);
			//_simplemde.codemirror.on("input", change);
		}
		_parent.find("#" + _uniquid + " .TemplateTag").click(addTemplateTag);
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
	this.puid = function (str) {
		if (str) {
			_puid = str;
		}
		return _puid;
	};
	this.destroy = function () {
		_input.off();
		if (_simplemde!=null) {
			_simplemde.toTextArea();
			_simplemde = null;
		}
		if (_parent!=null) {
			_parent.empty();
		}
	};
	this.initialize = function () {
		Dialog = classes.components.Dialog;
		Func = classes.helpers.Func;
		Lang = classes.data.Lang;
		render();
	};
};

classes.components.formobjects.Input.prototype = new EventDispatcher();
