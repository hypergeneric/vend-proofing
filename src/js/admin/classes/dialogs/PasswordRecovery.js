/*jslint browser: true, sloppy: true, vars: true, white: true */

classes.dialogs.PasswordRecovery = function () {
	var Auth;
	var Lang;
	var _parent;
	var _token = "";
	var _csrf = "";
	var _destroyed = false;
	var _busy = false;
	var form;
	var response;
	var submit;

	function message (key, success) {
		response.text(Lang.lookup(key === "404" || !key ? "Recovery Unavailable" : key));
		response.toggleClass("Success", success).css("visibility", "visible");
	}
	function send (values) {
		values.recovery_csrf = _csrf;
		Auth.send(null, function (success, key) {
			if (_destroyed) return;
			_busy = false;
			submit.prop("disabled", false);
			message(key, success);
			if (key === "Recovery Form Expired") _csrf = "";
			if (success) {
				_token = "";
				form.find('input[type="password"]').val("");
				form.find(".Fields, .Submit").hide();
			}
		}, values);
	}
	function onSubmit (event) {
		event.preventDefault();
		if (_busy) return;
		var values = _token ? {
			action: "recovery_reset",
			reset_token: _token,
			password: form.find('[name="password"]').val(),
			confirm_password: form.find('[name="confirm_password"]').val()
		} : {
			action: "recovery_request",
			username: form.find('[name="username"]').val()
		};
		if (_token && values.password !== values.confirm_password) {
			message("Account Password Mismatch", false);
			return;
		}
		_busy = true;
		submit.prop("disabled", true);
		if (_csrf) { send(values); return; }
		Auth.send(null, function (success, token) {
			if (_destroyed) return;
			if (!success || !/^[a-f0-9]{64}$/.test(token)) {
				_busy = false;
				submit.prop("disabled", false);
				message("Recovery Unavailable", false);
				return;
			}
			_csrf = token;
			send(values);
		}, {action: "recovery_form"});
	}
	this.parent = function (parent) { _parent = parent; };
	this.initialize = function (options) {
		Auth = classes.data.Auth;
		Lang = classes.data.Lang;
		_token = options.resetToken || "";
		delete options.resetToken;
		var root = $('<div class="PasswordRecovery DialogForm"></div>').appendTo(_parent);
		$('<p class="Text"></p>').text(Lang.lookup(_token ? "Account Password Length" : "Recovery Request Description")).appendTo(root);
		form = $('<form></form>').appendTo(root);
		var fields = $('<div class="Fields"></div>').appendTo(form);
		var definitions = _token ? [
			{name: "password", label: "New Password", type: "password"},
			{name: "confirm_password", label: "Confirm Password", type: "password"}
		] : [{name: "username", label: "Username", type: "text"}];
		for (var i = 0; i < definitions.length; i++) {
			var field = definitions[i];
			var group = $('<div class="Group Input"></div>').appendTo(fields);
			$('<label></label>').attr("for", "recovery-" + field.name).text(Lang.lookup(field.label)).appendTo(group);
			$('<input required>').attr({id: "recovery-" + field.name, name: field.name, type: field.type,
				autocomplete: field.type === "password" ? "new-password" : "username",
				maxlength: field.type === "password" ? 4096 : 80
			}).prop("minLength", field.type === "password" ? 12 : 1).appendTo(group);
		}
		submit = $('<input type="submit">').val(Lang.lookup(_token ? "Reset Password" : "Send Reset Link"))
			.appendTo($('<div class="Submit"></div>').appendTo(form));
		$('<div class="Clear"></div>').appendTo(form);
		response = $('<p class="Response" role="status"></p>').appendTo(form);
		$('<p></p>').append($('<a></a>').attr("href", Auth.basepath() + Auth.indexpath() + "?/admin/")
			.text(Lang.lookup("Back To Login"))).appendTo(root);
		form.on("submit", onSubmit);
	};
	this.destroy = function () {
		_destroyed = true;
		_token = "";
		_csrf = "";
		form.off();
		_parent.empty();
	};
};
