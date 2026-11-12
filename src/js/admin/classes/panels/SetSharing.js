
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.panels.SetSharing = function () {
	
	/* "imported" classes
		*/
		
	var Auth;
	var Func;
	var Dialog;
	var Cookie;
	var Admin;
	var Lang;
	
	/* private properites
		*/	
		
	var _instance = 				this;
	var _panel = 					null;
	var _controller = 				null;
	var _uniquid = 					classes.helpers.Func.uniquid();
	var _suid = 					"";
	var _seturl = 					"";
	
	var _clipboard = 				null;
	var _buttons = 					null;
	var _input_type = 				null;
	var _input_contactlist = 		null;
	var _input_sessionlist = 		null;
	var _input_emails = 			null;
	var _input_mymessage = 			null;
	var _input_response = 			null;
	
	/* private methods
		*/
		
	function doOption (key) {
		switch (key) {
			case "send_mail" :
				mail();
				break;
			case "share_twitter" :
				twitter();
				break;
			case "share_facebook" :
				facebook();
				break;
		}
	}
	
	function twitter () {
		var update_uri = "https://twitter.com/home?status="+escape(_seturl);
		var popup = window.open(update_uri);
	}
	
	function twitter () {
		var update_uri = "https://twitter.com/home?status="+escape(_seturl);
		var popup = window.open(update_uri);
	}
	
	function facebook () {
		var update_uri = "https://www.facebook.com/sharer.php?u=" + escape(_seturl);
		var popup = window.open(update_uri);
	}
	
	function mail () {
		var useContacts = _input_contactlist.prop("checked");
		var useSession = _input_sessionlist.prop("checked");
		if ( !useContacts && !useSession && _input_emails.val()=="" ) {
			_input_response.empty();
			_input_response.css("visibility", "visible");
			_input_response.html(Lang.lookup("Please Provide Some Recipients"));
			return;
		}
		_panel.screen(true);
		_input_response.removeClass("Success");
		Auth.send(this, onMailComplete, {
			action: "output_bulkmail",
			suid: _suid,
			set_url: _seturl,
			template: _input_type.val(),
			include_contacts: useContacts,
			include_sessions: useSession,
			recipients: _input_emails.val(),
			message: _input_mymessage.val()
		});
	}
	function onMailComplete (success, data) {
		_panel.screen(false);
		if (success) {
			_input_response.addClass("Success");
		}
		_input_response.empty();
		_input_response.css("visibility", "visible");
		_input_response.html(data);
	}
	
	function message_remember () {
		Cookie.set("bulk_mail_message", _input_mymessage.val(), 365);
	}
	
	function render () {
		
		_seturl = Auth.basepathabsolute() + Auth.indexpath() + "?/" + Lang.lookup("URI Page Identifier") + "/" + _suid + "/";
		
		var buttons = [{
			label: Lang.lookup("Share On Twitter"),
			func: "share_twitter"
		},{
			label: Lang.lookup("Share On Facebook"),
			func: "share_facebook"
		}];
		
		var parent = _panel.body();
		
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="ToolBox">';
			
			xhtml += 	'<div class="ToolBoxGroup DialogForm">';
			xhtml += 		'<h2>' + Lang.lookup("Social Media") + '</h2>';
		if (Clipboard.isSupported()) {
			xhtml += 		'<div id="set_tools_copy_url" class="Button CopySet">Copy Set URL</div>';
		}
		for (var i=0; i<buttons.length; ++i) {
			xhtml += 		'<div data-func="' + buttons[i].func + '" class="Button ButtonAction">' + buttons[i].label + '</div>';
		}
			xhtml += 		'<div class="Clear"></div>';
			xhtml += 	'</div>';
			
			xhtml += 	'<div class="ToolBoxGroup DialogForm">';
			xhtml += 		'<h2>' + Lang.lookup("Bulk Email") + '</h2>';
			xhtml += 		'<div class="Group Input Type">';
			xhtml += 			'<label>' + Lang.lookup("Choose a Bulk Message Template") + '</label>';
			xhtml += 			'<select></select>';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Checkbox ContactList">';
			xhtml += 			'<input type="checkbox" />&nbsp;&nbsp;' + Lang.lookup("Include Contact List");
			xhtml += 		'</div>';
			xhtml += 		'<div class="Checkbox SessionList">';
			xhtml += 			'<input type="checkbox" />&nbsp;&nbsp;' + Lang.lookup("Include Session List");
			xhtml += 		'</div>';
			xhtml += 		'<div class="Group Input Emails">';
			xhtml += 			'<label>' + Lang.lookup("Comma Seperated Email Addresses") + '</label>';
			xhtml += 			'<textarea rows="3" cols="50"></textarea>';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Group Input MyMessage">';
			xhtml += 			'<label>' + Lang.lookup("Your Personal Message") + '</label>';
			xhtml += 			'<textarea rows="3" cols="50">' + Cookie.get("bulk_mail_message") + '</textarea>';
			xhtml += 		'</div>';
			xhtml += 		'<div data-func="send_mail" class="Button ButtonAction">' + Lang.lookup("Send Bulk Message") + '</div>';
			xhtml += 		'<div class="Response">&nbsp;</div>';
			xhtml += 		'<div class="Clear"></div>';
			xhtml += 	'</div>';
			xhtml += '</div>';
			
		parent.html(xhtml);
		
		_input_type = parent.find("#" + _uniquid + " .Type select");
		_input_contactlist = parent.find("#" + _uniquid + " .ContactList input");
		_input_sessionlist = parent.find("#" + _uniquid + " .SessionList input");
		_input_emails = parent.find("#" + _uniquid + " .Emails textarea");
		_input_mymessage = parent.find("#" + _uniquid + " .MyMessage textarea");
		_input_response = parent.find("#" + _uniquid + " .Response");
		_buttons = parent.find("#" + _uniquid + " .ButtonAction");
		
		_input_response.css("margin-left", _buttons.eq(2).outerWidth()+15);
		
		_input_mymessage.change(message_remember);
		_buttons.click(function () {
			doOption($(this).data("func"));
		});
		
		_clipboard = new Clipboard("#set_tools_copy_url", {
			text: function(trigger) {
				return _seturl;
			}
		});
		_clipboard.on('success', function(e) {
			Dialog.create({
				size: "420x*",
				title: Lang.lookup("Copy URL"),
				content: "Successfully Copied!",
				owner: this,
				options: [{
					label: Lang.lookup("Close")
				}]
			});
		});
		_clipboard.on('error', function(e) {
			Dialog.create({
				size: "420x*",
				title: Lang.lookup("Copy URL"),
				content: "Copy to clipboard failed. Press Ctrl+C to copy",
				owner: this,
				options: [{
					label: Lang.lookup("Close")
				}]
			});
		});
		
		var provider = [{
				label: Lang.lookup("Output Photocart Ready Notification"),
				data: "output_notify"
			},{
				label: Lang.lookup("Output Expiration Reminder"),
				data: "output_reminder"
			},{
				label: Lang.lookup("Output General Message"),
				data: "output_general"
		}];
		for (var i=0; i<provider.length; ++i) {
			_input_type.append('<option value="' + provider[i].data + '" ' + (i==0?"selected":"") + '>' + provider[i].label + '</option>');
		}
		
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
		_clipboard.destroy();
		_input_type.off();
		_input_contactlist.off();
		_input_sessionlist.off();
		_input_emails.off();
		_input_mymessage.off();
		_buttons.off();
	};
	this.initialize = function (obj) {
		Cookie = classes.helpers.Cookie;
		Admin = classes.Admin;
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

classes.panels.SetSharing.prototype = new EventDispatcher();
