
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.dialogs.FormEditor = function () {
	/* "imported" classes
		*/
	var Auth;
	var Dialog;
	var Lang;
	var Func;
	/* private properites
		*/
	var _instance = 	this;
	var _uniquid = 		"";
	var _dialogid = 	"";
	var _parent = 		null;
	var _label = 		"";
	var _defaults = 	"";
	var _required = 	"";
	var _options = 		"";
	var _type = 		"";
	var _slug = 		"";
	var _edit = 		false;
	var _input_label = 			null;
	var _input_slug = 			null;
	var _input_type = 			null;
	var _input_required = 		null;
	var _input_placeholder = 	null;
	var _input_dateholder = 	null;
	var _input_inputtype = 		null;
	var _input_options = 		null;
	var _datatable = 			null;
	var _provider = 			[];
	var _selected = 			-1;
	/* private methods
		*/
	function actionclick () {
		var key = $(this).data("key");
		switch (key) {
			case "create" :
				Dialog.create({
					size: "500x*",
					title: Lang.lookup("Create Select Item"),
					content: classes.dialogs.FormOption,
					owner: this,
					options: [{
						label: Lang.lookup("Save"),
						func: addFormItem
					},{
						label: Lang.lookup("Cancel")
					}]
				});
				break;
			case "edit" :
				Dialog.create({
					size: "500x*",
					title: Lang.lookup("Edit Select Item"),
					content: classes.dialogs.FormOption,
					init: {
						label: _provider[_selected].label,
						selected: _provider[_selected].selected
					},
					owner: this,
					options: [{
						label: Lang.lookup("Save"),
						func: editFormItem
					},{
						label: Lang.lookup("Cancel")
					}]
				});
				break;
			case "del" :
				deleteFormItem();
				break;
			case "up" :
				moveFormItemUp();
				break;
			case "down" :
				moveFormItemDown();
				break;
		}
	}
	function addFormItem () {
		var editor = Dialog.last().classobj;
		if ( ( _type=="dropdown" || _type=="radio" ) && editor.selected()=="1" ) {
			for (var i=0; i<_provider.length; ++i) {
				_provider[i].selected = "0";
			}
		}
		_provider.push({
			selected: editor.selected(),
			label: editor.label()
		});
		_datatable.clear();
		_datatable.rows.add(_provider);
		_datatable.draw();
		_selected = _provider.length-1;
		updateSelects();
	}
	function editFormItem () {
		var editor = Dialog.last().classobj;
		if ( ( _type=="dropdown" || _type=="radio" ) && editor.selected()=="1" ) {
			for (var i=0; i<_provider.length; ++i) {
				_provider[i].selected = "0";
			}
		}
		_provider[_selected] = {
			selected: editor.selected(),
			label: editor.label()
		};
		_datatable.clear();
		_datatable.rows.add(_provider);
		_datatable.draw();
		updateSelects();
	}
	function deleteFormItem () {
		_provider.splice(_selected, 1);
		_datatable.clear();
		_datatable.rows.add(_provider);
		_datatable.draw();
		_selected = -1;
		updateSelects();
	}
	function moveFormItemDown () {
		var ifrom = _selected;
		var ito = ifrom + 1;
		var temp = _provider[ito];
		_provider[ito] = _provider[ifrom];
		_provider[ifrom] = temp;
		_datatable.clear();
		_datatable.rows.add(_provider);
		_datatable.draw();
		_selected = ito;
		updateSelects();
	}
	function moveFormItemUp () {
		var ifrom = _selected;
		var ito = ifrom - 1;
		var temp = _provider[ito];
		_provider[ito] = _provider[ifrom];
		_provider[ifrom] = temp;
		_datatable.clear();
		_datatable.rows.add(_provider);
		_datatable.draw();
		_selected = ito;
		updateSelects();
	}
	function updateSelects () {
		for (var i=0; i<_provider.length; ++i) {
			var row = _datatable.row(i);
			var node = $(row.node());
			if ( i==_selected && node.hasClass("selected")==false ) {
				row.select();
				onSelected();
				break;
			}
		}
		var arr = [];
		for (var i=0; i<_provider.length; ++i) {
			arr.push(_provider[i].selected + "," + _provider[i].label.split("\t").join(" "));
		}
		var value = arr.join("<[[BR]]>");
		if (_options!=value) {
			Dialog.enableOptions([0], _dialogid);
		}
		_options = value;
	}
	function onSelected () {
		updateSelects();
		_input_actions.prop("disabled", true);
		_input_actions.eq(0).prop("disabled", false);
		if (_selected!=-1) {
			_input_actions.eq(1).prop("disabled", false);
			_input_actions.eq(2).prop("disabled", false);
			if ( _selected>0 ) _input_actions.eq(3).prop("disabled", false);
			if ( _selected<_provider.length-1 ) _input_actions.eq(4).prop("disabled", false);
		}
	}
	function titlechange () {
		var value = _input_label.val();
		if (_label!=value) {
			Dialog.enableOptions([0], _dialogid);
		}
		if (_edit==false) {
			_slug = Func.homogenize(value).toUpperCase().substr(0, 16) || "";
			_input_slug.val( _slug + "_XXXX" );
		}
		_label = value;
	}
	function typechange () {
		var selected = $("option:selected", this);
		var value = selected.val();
		if (_type!=value) {
			_defaults = "";
			_options = "";
			Dialog.enableOptions([0], _dialogid);
		}
		dotypechange(value);
	}
	function dotypechange (value) {
		if ( value=="input" ) {
			_input_options.hide();
			_input_placeholder.parent().show();
			_input_dateholder.parent().hide();
			_input_inputtype.parent().show();
			_input_placeholder.val(_defaults);
			if ( _edit==false && _options=="" ) {
				_options = "input";
			}
			_input_inputtype.val(_options);
		} else if ( value=="area" ) {
			_input_options.hide();
			_input_placeholder.parent().show();
			_input_dateholder.parent().hide();
			_input_inputtype.parent().hide();
			_input_placeholder.val(_defaults);
		} else if ( value=="date" ) {
			_input_options.hide();
			_input_placeholder.parent().hide();
			_input_dateholder.parent().show();
			_input_inputtype.parent().hide();
			if (_defaults!=""&&_defaults!="0") {
				var d = new Date(parseInt(_defaults, 10));
				_input_dateholder.datepicker( "setDate",  d);
			}
		} else if ( value=="dropdown" || value=="checkbox" || value=="radio" ) {
			_input_options.show();
			_input_placeholder.parent().hide();
			_input_dateholder.parent().hide();
			_input_inputtype.parent().hide();
			_provider = [];
			_selected = -1;
			if (_options.length>0) {
				var lines = _options.split("<[[BR]]>");
				for (var i=0; i<lines.length; ++i) {
					var line = lines[i].split(",");
					var selected = line.shift();
					if ( _edit==false && (_type=="dropdown"||_type=="radio") ) {
						selected = "0";
					}
					var label = line.join(",");
					_provider.push({
						label: label,
						selected: selected
					});
				}
			}
			_datatable.clear();
			_datatable.rows.add(_provider);
			_datatable.draw();
			onSelected();
		}
		_type = value;
	}
	function requiredchange () {
		var value = this.checked ? "1" : "0";
		if (_required!=value) {
			Dialog.enableOptions([0], _dialogid);
		}
		_required = value;
	}
	function placeholderchange () {
		var value = _input_placeholder.val();
		if (_defaults!=value) {
			Dialog.enableOptions([0], _dialogid);
		}
		_defaults = value;
	}
	function dateholderchange () {
		var value = _input_dateholder.datepicker( "getDate" );
		if (value==null) {
			value = "0";
		} else {
			value = value.getTime().toString();
		}
		if (_defaults!=value) {
			Dialog.enableOptions([0], _dialogid);
		}
		_defaults = value;	
	}
	function inputtypechange () {
		var selected = $("option:selected", this);
		var value = selected.val();
		if (_options!=value) {
			Dialog.enableOptions([0], _dialogid);
		}
		_options = value;
	}
	function render () {
		
		_dialogid = Dialog.last().id;
		_uniquid = "DO" + Func.uniquid();
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="FormEditor DialogForm">';
			xhtml += 	'<div class="Group Input Label">';
			xhtml += 		'<label>' + Lang.lookup("Form Title") + '</label>';
			xhtml += 		'<input type="input" value="' + _label + '" />';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Group Input Slug">';
			xhtml += 		'<label>' + Lang.lookup("Form Unique Slug") + '</label>';
			xhtml += 		'<input type="input" value="' + _slug + '" readonly />';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Group Input Type">';
			xhtml += 		'<label>' + Lang.lookup("Form Type") + '</label>';
			xhtml += 		'<select></select>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Checkbox Required">';
			xhtml += 		'<input type="checkbox" ' + (_required=="1"?"checked":"") + '>&nbsp;&nbsp;' + Lang.lookup("Form Is Required") + '</input>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Defaults">';
			xhtml += 		'<div style="display:none" class="Group Input Placeholder">';
			xhtml += 			'<label>' + Lang.lookup("Placeholder Text") + '</label>';
			xhtml += 			'<input type="input" value="" />';
			xhtml += 		'</div>';
			xhtml += 		'<div style="display:none" class="Group Input Date">';
			xhtml += 			'<label>' + Lang.lookup("Set A Default Date") + '</label>';
			xhtml += 			'<input type="text" value="" />';
			xhtml += 		'</div>';
			xhtml += 		'<div style="display:none" class="Group Input InputType">';
			xhtml += 			'<label>' + Lang.lookup("Input Type") + '</label>';
			xhtml += 			'<select></select>';
			xhtml += 		'</div>';
			xhtml += 		'<div style="display:none" class="Options">';
			xhtml += 			'<table class="table table-striped table-bordered" width="100%" cellspacing="0"></table>';
			xhtml += 			'<div class="Controls">';
			xhtml += 				'<button class="Action" data-key="create">' + Lang.lookup("New") + '</button>';
			xhtml += 				'<button disabled class="Action" data-key="edit">' + Lang.lookup("Edit") + '</button>';
			xhtml += 				'<button disabled class="Action" data-key="del">' + Lang.lookup("Delete") + '</button>';
			xhtml += 				'<button disabled class="Action" data-key="up">' + Lang.lookup("Move Up") + '</button>';
			xhtml += 				'<button disabled class="Action" data-key="down">' + Lang.lookup("Move Down") + '</button>';
			xhtml += 			'</div>';
			xhtml += 		'<div>';
			xhtml += 	'<div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
			
		_parent.html(xhtml);
		
		_input_label = 				_parent.find("#" + _uniquid + " .Label input");
		_input_slug = 				_parent.find("#" + _uniquid + " .Slug input");
		_input_type = 				_parent.find("#" + _uniquid + " .Type select");
		_input_required = 			_parent.find("#" + _uniquid + " .Required input");
		_input_dateholder = 		_parent.find("#" + _uniquid + " .Date input");
		_input_placeholder = 		_parent.find("#" + _uniquid + " .Placeholder input");
		_input_inputtype = 			_parent.find("#" + _uniquid + " .InputType select");
		_input_options = 			_parent.find("#" + _uniquid + " .Options");
		_input_actions = 			_parent.find("#" + _uniquid + " .Options .Action");
		
		_input_label.on("input", titlechange);
		//_input_label.change(titlechange);
		_input_dateholder.change(dateholderchange);
		_input_dateholder.datepicker({
			dateFormat: 'yy-mm-dd'
		});
		_input_placeholder.on("input", placeholderchange);
		//_input_placeholder.change(placeholderchange);
		_input_required.change(requiredchange);
		_input_actions.click(actionclick);
		
		var provider = [{
				label: Lang.lookup("Choose A Form Type"),
				data: ""
			},{
				label: Lang.lookup("Text Single Line"),
				data: "input"
			},{
				label: Lang.lookup("Text Multi Line"),
				data: "area"
			},{
				label: Lang.lookup("Dropdown Selection"),
				data: "dropdown"
			},{
				label: Lang.lookup("Checkbox Selection"),
				data: "checkbox"
			},{
				label: Lang.lookup("Radio Selection"),
				data: "radio"
			},{
				label: Lang.lookup("Date Selection"),
				data: "date"
		}];
		for (var i=0; i<provider.length; ++i) {
			var selected = provider[i].data==_type;
			_input_type.append('<option value="' + provider[i].data + '" ' + (selected?"selected":"") + '>' + provider[i].label + '</option>');
		}
		_input_type.change(typechange);
		_input_type.toggle(_edit==false);
		
		var provider = [{
				label: Lang.lookup("Plain Text"),
				data: "input"
			},{
				label: Lang.lookup("Email Address"),
				data: "email"
			},{
				label: Lang.lookup("Telephone Number"),
				data: "tel"
			},{
				label: Lang.lookup("Website URL"),
				data: "url"
			},{
				label: Lang.lookup("Number"),
				data: "number"
		}];
		for (var i=0; i<provider.length; ++i) {
			_input_inputtype.append('<option value="' + provider[i].data + '">' + provider[i].label + '</option>');
		}
		_input_inputtype.change(inputtypechange);
		
		_datatable = _input_options.find("table").DataTable( {
			info: false,
			searching: false,
			ordering: false,
			paging: false,
			responsive: {
				details: false
			},
			select: 'single',
			data: [],
			columns: [
				{
					title: '<div style="width:30px;text-align:center" class="DragIcon"><span class="glyphicon glyphicon glyphicon-lock" aria-hidden="true"></span></div>',
					data: "selected",
					width: 30,
					render: function ( data, type, row ) {
						if (data=="0") {
							return "";
						} else if (data=="1") {
							return '<div style="width:30px;text-align:center" class="DragIcon"><span class="glyphicon glyphicon glyphicon-ok" aria-hidden="true"></span></div>';
						}
					}	
				},{
					title: Lang.lookup("Label"),
					data: "label"	
				}
			]
		});
		_datatable.on( 'select', function ( e, dt, type, indexes ) {
			if ( type === 'row' ) {
				_selected = indexes[0];
				onSelected();
			}
		});
		_datatable.on( 'deselect', function ( e, dt, type, indexes ) {
			if ( type === 'row' ) {
				_selected = -1;
				onSelected();
			}
		});
		
		Dialog.disableOptions([0], _dialogid);
		
		dotypechange(_type);

	}
	/* public methods
		*/
	this.options = function (str) {
		if (str) {
			_options = str;
		}
		return _options;
	};
	this.defaults = function (str) {
		if (str) {
			_defaults = str;
		}
		return _defaults;
	};
	this.required = function (str) {
		if (str) {
			_required = str;
		}
		return _required;
	};
	this.type = function (str) {
		if (str) {
			_type = str;
		}
		return _type;
	};
	this.label = function (str) {
		if (str) {
			_label = str;
		}
		return _label;
	};
	this.slug = function (str) {
		if (str) {
			_slug = str;
		}
		return _slug;
	};
	this.edit = function (bool) {
		if (bool===true||bool===false) {
			_edit = bool;
		}
		return _edit;
	};
	this.parent = function (obj) {
		_parent = obj;
	};
	this.destroy = function () {
		_input_actions.off();
		_input_dateholder.off();
		_input_dateholder.datepicker( "destroy" );
		_input_inputtype.off();
		_input_type.off();
		_input_dateholder.off();
		_input_placeholder.off();
		_input_required.off();
		_input_label.off();
		_datatable.off('select');
		_datatable.off('deselect');
		_datatable.destroy(true);
		_parent.empty();
	};
	this.initialize = function (obj) {
		Dialog = classes.components.Dialog;
		Auth = classes.data.Auth;
		Lang = classes.data.Lang;
		Func = classes.helpers.Func;
		for (var prop in obj) {
			this[prop](obj[prop]);
		}
		render();
	};
};
