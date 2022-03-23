
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.dialogs.CopyPaste = function () {
	
	/* "imported" classes
		*/
		
	var StageProxy;
	var Func;
	var Lang;
	
	/* private properites
		*/
		
	var _instance = 		this;
	var _uniquid = 			classes.helpers.Func.uniquid();
	var _parent = 			null;
	
	var _csv = 				true;
	var _text = 			"";
	
	var _input_text = 		null;
	var _input_response = 	null;
	var _btn_copy = 		null;
	var _btn_csv = 			null;
	var _clipboard = 		null;
	var _inited = 			null;
	
	/* private methods
		*/
		
	function download () {
		var link = document.createElement('a');
		link.href = 'data:text/csv;charset=utf-8,' + encodeURI(_text);
		link.target = '_blank';
		link.download = "export.csv";
		link.click();
	}
	
	function render () {
		
		_uniquid = "DO" + Func.uniquid();
		
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="DialogForm">';
			xhtml += 	'<div class="Group Input Text">';
			xhtml += 		'<textarea rows="3" cols="50" readonly>' + _text + '</textarea>';
			xhtml += 	'</div>';
		if (Clipboard.isSupported()) {
			xhtml += 	'<div class="Submit">';
			xhtml += 		'<input type="submit" class="Copy" value="' + Lang.lookup("Copy To Clipboard") + '" />';
			xhtml += 	'</div>';
		}
		if (_csv) {
			xhtml += 	'<div class="Submit">';
			xhtml += 		'<input type="submit" class="CSV" value="' + Lang.lookup("Download CSV") + '" />';
			xhtml += 	'</div>';
		}
			xhtml += 	'<div class="Response">&nbsp;</div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
			
		_parent.html(xhtml);
		
		_input_text = _parent.find("#" + _uniquid + " .Text textarea");
		_input_response = _parent.find("#" + _uniquid + " .Response");
		_btn_copy = _parent.find("#" + _uniquid + " .Copy");
		_btn_csv = _parent.find("#" + _uniquid + " .CSV");
		
		_btn_csv.click(download);
		
		_clipboard = new Clipboard("#" + _uniquid + " .Copy", {
			text: function(trigger) {
				return _text;
			}
		});
		_clipboard.on('success', function(e) {
			_input_response.css("visibility", "visible")
			_input_response.removeClass("Success");
			_input_response.addClass("Success");
			_input_response.html(Lang.lookup("Copied!"));
		});
		_clipboard.on('error', function(e) {
			_input_response.css("visibility", "visible")
			_input_response.removeClass("Success");
			_input_response.html("Press Ctrl+C to copy");
		});
		
		var ml = 0;
		if (Clipboard.isSupported()) {
			ml += _btn_copy.outerWidth()+15;
		}
		if (_csv) {
			ml += _btn_csv.outerWidth()+15;
		}
		_input_response.css("margin-left", ml);

	}
	/* public methods
		*/
	this.csv = function (bool) {
		if (bool===true||bool===false) {
			_csv = bool;
		}
		return _csv;
	};
	this.text = function (str) {
		if (str) {
			_text = str;
		}
		return _text;
	};
	this.parent = function (obj) {
		_parent = obj;
	};
	this.destroy = function () {
		_clipboard.destroy();
		_btn_csv.off();
		_parent.empty();
	};
	this.resize = function () {
		if (_inited==null) {
			_inited = setInterval(classes.StageProxy.trigger, 33);
			setTimeout(function () {
				clearInterval(_inited);
				_inited = true;
			}, 500);
		}
		var _innerheight = _parent.height() - 80 - 60;
		_input_text.height(_innerheight);
	};
	this.initialize = function (obj) {
		Func = classes.helpers.Func;
		Lang = classes.data.Lang;
		for (var prop in obj) {
			this[prop](obj[prop]);
		}
		render();
	};
};
