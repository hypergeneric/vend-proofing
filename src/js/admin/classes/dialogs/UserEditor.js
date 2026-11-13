classes.dialogs.UserEditor = function () {
	var _parent, _form, _error;
	var Lang = classes.data.Lang;
	this.parent = function (parent) { _parent = parent; };
	this.values = function () {
		var values = {};
		_form.find('[name]').each(function () { values[this.name] = $(this).val(); });
		return values;
	};
	this.valid = function () {
		if (!_form[0].reportValidity()) return false;
		var values = this.values();
		if (values.password !== undefined && values.password !== values.confirm_password) {
			this.error('Account Password Mismatch');
			return false;
		}
		return true;
	};
	this.error = function (message) { _error.text(Lang.lookup(message)); };
	this.destroy = function () { _parent.empty(); };
	this.initialize = function (options) {
		var user = options.user || {};
		_form = $('<form class="DialogForm"></form>').appendTo(_parent);
		_form.on('submit', function (event) { event.preventDefault(); });
		function field (name, label, type, value, required) {
			var group = $('<div class="Group Input"></div>').appendTo(_form);
			var id = 'user-' + classes.helpers.Func.uniquid();
			$('<label></label>').attr('for', id).text(Lang.lookup(label)).appendTo(group);
			return $('<input>').attr({id: id, name: name, type: type, required: required}).val(value || '').appendTo(group);
		}
		if (options.mode !== 'type') {
			field('username', 'Username', 'text', user.username, true).attr({pattern: '[A-Za-z0-9._-]{3,80}', maxlength: 80, title: Lang.lookup('Account Username Help'), autocomplete: 'username'});
			field('email', 'Email', 'email', user.email, true);
			if (user.id) field('current_password', 'Current password', 'password', '', true).attr('autocomplete', 'current-password');
			field('password', user.id ? 'Account Password Optional' : 'Password', 'password', '', !user.id).attr({minlength: 12, maxlength: 4096, autocomplete: 'new-password'});
			field('confirm_password', 'Confirm password', 'password', '', !user.id).attr('autocomplete', 'new-password');
			$('<p></p>').text(Lang.lookup(user.id ? 'Account Save Signout' : 'Account Password Length')).appendTo(_form);
		}
		if (!user.id || options.mode === 'type') {
			var group = $('<div class="Group Input"></div>').appendTo(_form);
			var id = 'user-type-' + classes.helpers.Func.uniquid();
			$('<label></label>').attr('for', id).text(Lang.lookup('User Type')).appendTo(group);
			$('<select name="user_type"><option value="admin"></option><option value="manager"></option></select>').attr('id', id).val(user.user_type || 'admin').appendTo(group).find('option').each(function () { $(this).text(Lang.lookup(this.value)); });
			$('<p></p>').text(Lang.lookup('Account Types Description')).appendTo(_form);
		}
		_error = $('<p role="alert"></p>').appendTo(_form);
	};
};
