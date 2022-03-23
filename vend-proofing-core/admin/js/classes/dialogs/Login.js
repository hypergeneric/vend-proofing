
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.dialogs.Login = function () {
	/* "imported" classes
		*/
	var StageProxy;
	var Func;
	var Lang;
	var Auth;
	var Cookie;
	/* private properites
		*/
	var _uniquid = 			"";
	var _instance = 		this;
	var _parent = 			null;
	var formobj = 			null;
	var screen = 			null;
	var username_field = 	null;
	var password_field = 	null;
	var remember_check = 	null;
	var error_label = 		null;
	var login = 			null;
	/* private methods
		*/
	function toggle_remember () {
		if (remember_check.prop("checked")) {
			Cookie.set("remember", "yes", 14);
			Cookie.set("username", username_field.val(), 14);
		} else {
			Cookie.kill("remember");
			Cookie.kill("username");
		}
	}
	function do_login (e) {
		screen.show();
		Auth.send(this, onLogin, {
			action: "login",
			username: username_field.val(),
			password: sha1(md5(NAMESPACE)+md5(password_field.val())),
			persist: (remember_check.checked?"yes":"no")
		});
		toggle_remember();
		Func.stop(e);
		return false;
	}
	function onLogin (success, data) {
		screen.hide();
		error_label.empty();
		if (!success) {
			error_label.css("visibility", "visible").html(Lang.lookup(data));
		} else {
			Auth.token(data);
		}
		Auth.verify();
	}
	function render () {
		
		var username_str = Cookie.get("username");
		var remember_str = Cookie.get("remember");
			remember_str = remember_str=="yes";
			
		_uniquid = "DO" + Func.uniquid();
		
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="Login DialogForm">';
			xhtml += 	'<form autocomplete="on">';
			xhtml += 		'<div class="Screen"></div>';
			xhtml += 		'<div class="Group Input Username">';
			xhtml += 			'<label>' + Lang.lookup("Username") + '</label>';
			xhtml += 			'<input type="input" value="' + username_str + '" autofocus required />';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Group Input Password">';
			xhtml += 			'<label>' + Lang.lookup("Password") + '</label>';
			xhtml += 			'<input type="password" value="" required />';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Checkbox">';
			xhtml += 			'<input type="checkbox" ' + (remember_str?"checked":"") + '>&nbsp;&nbsp;' + Lang.lookup("Keep Me Logged In") + '</input>';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Submit">';
			xhtml += 			'<input type="submit" id="login" value="' + Lang.lookup("Login") + '" />';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Response">&nbsp;</div>';
			xhtml += 		'<div class="Clear"></div>';
			xhtml += 	'</form>';
			xhtml += '</div>';
			
		_parent.html(xhtml);
		
		formobj = _parent.find("#" + _uniquid + " form");
		username_field = _parent.find("#" + _uniquid + " .Username input");
		password_field = _parent.find("#" + _uniquid + " .Password input");
		remember_check = _parent.find("#" + _uniquid + " .Checkbox input");
		login = _parent.find("#" + _uniquid + " .Submit input");
		error_label = _parent.find("#" + _uniquid + " .Response");
		screen = _parent.find("#" + _uniquid + " .Screen");
		
		error_label.css("margin-left", login.outerWidth()+15);
		
		formobj.submit(do_login);
		remember_check.change(toggle_remember);
		screen.click(Func.stop);

	}
	/* public methods
		*/
	this.parent = function (obj) {
		_parent = obj;
	};
	this.destroy = function () {
		formobj.off();
		remember_check.off();
		screen.off();
		_parent.empty();
	};
	this.initialize = function () {
		Auth = classes.data.Auth;
		Cookie = classes.helpers.Cookie;
		Func = classes.helpers.Func;
		Lang = classes.data.Lang;
		StageProxy = classes.StageProxy;
		render();
	};
};
