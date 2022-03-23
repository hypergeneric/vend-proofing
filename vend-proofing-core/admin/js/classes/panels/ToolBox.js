
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.panels.ToolBox = function () {
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
	var _uniquid = 					"";
	var _buttons = 					null;
	var username_field = 			null;
	var original_password_field = 	null;
	var new_password_field = 		null;
	var confirm_password_field = 	null;
	var original_username_field = 	null;
	var new_username_field = 		null;
	var password_field = 			null;
	var change_password = 			null;
	var change_username = 			null;
	/* private methods
		*/
	function doOption (key) {
		switch (key) {
			case "change_username" :
				changeUsername();
				break;
			case "change_password" :
				changePassword();
				break;
			case "showPhpInfo" :
				showPhpInfo();
				break;
			case "refreshTemplateFiles" :
				refreshTemplateFiles();
				break;
			case "run_update" :
				runUpdate();
				break;
		}
	}
	function runUpdate () {
		if (Admin.config().setup.hub._value=="true") {
			Dialog.create({
				size: "420x*",
				title: Lang.lookup("update_product_confirmation"),
				content: Lang.lookup("update_product_confirmation_description"),
				owner: this,
				options: [{
					label: Lang.lookup("yes update"),
					func: runUpdateConfirm
				},{
					label: Lang.lookup("cancel")
				}]
			});
		} else {
			var update_uri = "https://" + Auth.provideruri() + "/installer/?l=" + (Admin.config().setup.language._value||"") + "&a=upgrade&k=" + (Admin.config().setup.product_key._value||"");
			var popup = window.open(update_uri);
		}
	}
	function runUpdateConfirm () {
		var update_uri = "http://members." + Auth.provideruri() + "/login/" + (Admin.config().setup.install_id._value||"") + "/update.html";
		window.location = update_uri;
	}
	function change_username_check () {
		if (
			!original_username_field.val()	||
			!new_username_field.val()	||
			!password_field.val()
		) {
			change_username.addClass("Disabled");
			return;
		}
		change_username.removeClass("Disabled");
	}
	function changeUsername () {
		if (change_username.hasClass("Disabled")) return;
		_panel.screen(true);
		Auth.send(this, onResponse, {
			action: "account_changeusername",
			o_username: original_username_field.val(),
			n_username: new_username_field.val(),
			password: sha1(md5(NAMESPACE)+md5(password_field.val()))
		});
	}
	function change_password_check () {
		if (
			!username_field.val()	||
			!original_password_field.val()	||
			!new_password_field.val() ||
			new_password_field.val() != confirm_password_field.val()
		) {
			change_password.addClass("Disabled");
			return;
		}
		change_password.removeClass("Disabled");
	}
	function changePassword () {
		if (change_password.hasClass("Disabled")) return;
		_panel.screen(true);
		Auth.send(this, onResponse, {
			action: "account_changepassword",
			username: username_field.val(),
			o_password: sha1(md5(NAMESPACE)+md5(original_password_field.val())),
			n_password: sha1(md5(NAMESPACE)+md5(new_password_field.val()))
		});
	}
	function onResponse (success, data) {
		_panel.screen(false);
		Dialog.create({
			size: "420x*",
			title: Lang.lookup(data),
			content: Lang.lookup(data + " Description"),
			owner: this,
			options: [{
				label: Lang.lookup("ok")
			}]
		});
		username_field.val("");
		original_password_field.val("");
		confirm_password_field.val("");
		new_password_field.val("");
		original_username_field.val("");
		new_username_field.val("");
		password_field.val("");
	}
	function refreshTemplateFiles () {
		Func.openWindowWithPost(Auth.basepath() + NAMESPACE + "-gateway.php", {
			action: "system_refreshtemplates",
			token: Auth.token()
		});
	}
	function showPhpInfo () {
		Func.openWindowWithPost(Auth.basepath() + NAMESPACE + "-gateway.php", {
			action: "system_phpinfo",
			token: Auth.token()
		});
	}
	function render () {
		_uniquid = "FO" + Func.uniquid();
		var buttons = [{
			label: Lang.lookup("Run Product Update"),
			func: "run_update"
		},{
			label: Lang.lookup("View Php Info Sheet"),
			func: "showPhpInfo"
		},{
			label: Lang.lookup("Refresh Template Files"),
			func: "refreshTemplateFiles"
		}]
		if (Admin.config().setup.hub._value=="true") buttons.splice(1, 1);
		if ( false ) buttons.pop();
		var parent = _panel.body();
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="ToolBox">';
			xhtml += 	'<div class="ToolBoxGroup DialogForm">';
			xhtml += 		'<h2>' + Lang.lookup("Utility Functions") + '</h2>';
		for (var i=0; i<buttons.length; ++i) {
			xhtml += 		'<div data-func="' + buttons[i].func + '" class="Button">' + buttons[i].label + '</div>';
		}
		if (Admin.config().setup.standalone._value=="true") {
			xhtml += 		'<div class="Clear"></div>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="ToolBoxGroup DialogForm">';
			xhtml += 		'<h2>' + Lang.lookup("Change Password") + '</h2>';
			xhtml += 		'<div class="Group Input">';
			xhtml += 			'<label>' + Lang.lookup("Username") + '</label>';
			xhtml += 			'<input id="username_field" type="input" value="" />';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Group Input">';
			xhtml += 			'<label>' + Lang.lookup("Original Password") + '</label>';
			xhtml += 			'<input id="original_password_field" type="password" value="" />';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Group Input">';
			xhtml += 			'<label>' + Lang.lookup("New Password") + '</label>';
			xhtml += 			'<input id="new_password_field" type="password" value="" />';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Group Input">';
			xhtml += 			'<label>' + Lang.lookup("Confirm Password") + '</label>';
			xhtml += 			'<input id="confirm_password_field" type="password" value="" />';
			xhtml += 		'</div>';
			xhtml += 		'<div id="change_password" data-func="change_password" class="Button Disabled">' + Lang.lookup("Save Changes") + '</div>';
			xhtml += 		'<div class="Clear"></div>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="ToolBoxGroup DialogForm">';
			xhtml += 		'<h2>' + Lang.lookup("Change Username") + '</h2>';
			xhtml += 		'<div class="Group Input">';
			xhtml += 			'<label>' + Lang.lookup("Original Username") + '</label>';
			xhtml += 			'<input id="original_username_field" type="input" value="" />';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Group Input">';
			xhtml += 			'<label>' + Lang.lookup("New Username") + '</label>';
			xhtml += 			'<input id="new_username_field" type="password" value="" />';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Group Input">';
			xhtml += 			'<label>' + Lang.lookup("Password") + '</label>';
			xhtml += 			'<input id="password_field" type="password" value="" />';
			xhtml += 		'</div>';
			xhtml += 		'<div id="change_username" data-func="change_username" class="Button Disabled">' + Lang.lookup("Save Changes") + '</div>';
			xhtml += 		'<div class="Clear"></div>';
			xhtml += 	'</div>';
		}
			xhtml += '</div>';
			
		parent.html(xhtml);
		
		username_field = 			parent.find("#username_field");
		original_password_field = 	parent.find("#original_password_field");
		new_password_field = 		parent.find("#new_password_field");
		confirm_password_field = 	parent.find("#confirm_password_field");
		original_username_field = 	parent.find("#original_username_field");
		new_username_field = 		parent.find("#new_username_field");
		password_field = 			parent.find("#password_field");
		change_username = 			parent.find("#change_username");
		change_password = 			parent.find("#change_password");
		
		username_field.change(change_password_check);
		original_password_field.change(change_password_check);
		new_password_field.change(change_password_check);
		confirm_password_field.change(change_password_check);
		original_username_field.change(change_username_check);
		new_username_field.change(change_username_check);
		password_field.change(change_username_check);

		_buttons = parent.find(".Button").click(function () {
			doOption($(this).data("func"));
		});
	}
	/* public methods
		*/
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
		username_field.off();
		original_password_field.off();
		new_password_field.off();
		confirm_password_field.off();
		original_username_field.off();
		new_username_field.off();
		password_field.off();
		_buttons.off();
	};
	this.initialize = function () {
		Cookie = classes.helpers.Cookie;
		Admin = classes.Admin;
		Auth = classes.data.Auth;
		Lang = classes.data.Lang;
		Dialog = classes.components.Dialog;
		Func = classes.helpers.Func;
		render();
	};
};

classes.panels.ToolBox.prototype = new EventDispatcher();
