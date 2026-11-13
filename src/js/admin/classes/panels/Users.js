classes.panels.Users = function () {
	var _panel, _table, _root, _currentId, _destroyed = false;
	var Auth = classes.data.Auth;
	var Lang = classes.data.Lang;
	var Dialog = classes.components.Dialog;
	function tableText (key) {
		// Keep Vend placeholders in the catalog; DataTables requires underscore tokens.
		return Lang.lookup(key).replace(/\{(START|END|TOTAL|MAX|MENU)\}/g, '_$1_');
	}
	function notice (message) {
		_root.find('[role="alert"]').text(Lang.lookup(message === '404' ? 'Account Save Failed' : message));
	}
	function load () {
		_panel.screen(true);
		Auth.send(null, function (success, data) {
			if (_destroyed) return;
			_panel.screen(false);
			if (!success) { notice('Account Load Failed'); return; }
			var result = JSON.parse(data);
			_currentId = Number(result.current_id);
			_table.clear().rows.add(result.users).draw(false);
		}, {action: 'users_list'});
	}
	function edit (user, mode) {
		var dialogId = Dialog.create({
			size: '500x*', title: mode === 'type' ? Lang.lookup('Change User Type') : (user ? Lang.lookup('Edit My Account') : Lang.lookup('Create User')),
			content: classes.dialogs.UserEditor, init: {user: user, mode: mode},
			options: [{label: Lang.lookup('Save'), close: false, func: function () {
				var editor = Dialog.last().classobj;
				if (!editor.valid()) return;
				var values = editor.values();
				values.action = 'users_' + (mode === 'type' ? 'type' : (user ? 'update' : 'create'));
				if (user) values.id = user.id;
				Dialog.disableOptions([0, 1], dialogId);
				Auth.send(null, function (success, data) {
					if (!success) {
						editor.error(data === '404' ? 'Account Save Failed' : data);
						Dialog.enableOptions([0, 1], dialogId);
						return;
					}
					Dialog.kill(dialogId);
					if (user && mode !== 'type') { window.location.reload(); return; }
					if (!_destroyed) load();
				}, values);
			}}, {label: Lang.lookup('Cancel')}]
		});
	}
	function remove (user) {
		Dialog.create({size: '420x*', title: Lang.lookup('Delete User'), content: Lang.lookup('Account Delete Confirmation'), options: [
			{label: Lang.lookup('Delete'), func: function () {
				Auth.send(null, function (success, data) {
					if (_destroyed) return;
					if (success) load(); else notice(data);
				}, {action: 'users_delete', id: user.id});
			}}, {label: Lang.lookup('Cancel')}
		]});
	}
	this.panel = function (panel) { _panel = panel; };
	this.controller = function () {};
	this.initialize = function () {
		_root = $('<div class="TablePanel"><div class="Inner"><div class="Options"><button type="button" class="Button"></button><div class="Clear"></div></div><p role="alert"></p><table class="table table-striped table-bordered" width="100%"></table></div></div>');
		_panel.body().empty().append(_root);
		_root.find('.Button').text(Lang.lookup('Create User')).on('click', function () { edit(null, 'create'); });
		_table = _root.find('table').DataTable({
			language: {
				emptyTable: Lang.lookup('Users Table Empty'), info: tableText('Users Table Info'),
				infoEmpty: Lang.lookup('Users Table Info Empty'), infoFiltered: tableText('Users Table Filtered'),
				lengthMenu: tableText('Users Table Length'), loadingRecords: Lang.lookup('Users Table Loading'),
				processing: Lang.lookup('Users Table Processing'), search: Lang.lookup('Users Table Search'),
				zeroRecords: Lang.lookup('Users Table No Match'),
				paginate: {first: Lang.lookup('First'), last: Lang.lookup('Last'), next: Lang.lookup('Next'), previous: Lang.lookup('Previous')},
				aria: {sortAscending: Lang.lookup('Users Sort Ascending'), sortDescending: Lang.lookup('Users Sort Descending')}
			},
			data: [], order: [[0, 'asc']], columns: [
				{title: Lang.lookup('Username'), data: 'username', render: $.fn.dataTable.render.text()},
				{title: Lang.lookup('Email'), data: 'email', render: $.fn.dataTable.render.text()},
				{title: Lang.lookup('Type'), data: 'user_type', render: function (value) { return $('<span>').text(Lang.lookup(value)).html(); }},
				{title: Lang.lookup('Actions'), data: null, orderable: false, render: function (data, type, user) {
					return (Number(user.id) === _currentId ? '<a data-action="edit">' + Lang.lookup('Edit My Account') + '</a>' : '<a data-action="delete">' + Lang.lookup('Delete') + '</a>') + ' · <a data-action="type">' + Lang.lookup('Change Type') + '</a>';
				}}
			]
		});
		_root.on('click', 'a[data-action]', function (event) {
			event.preventDefault();
			var user = _table.row($(this).closest('tr')).data();
			var action = $(this).data('action');
			if (action === 'delete') remove(user); else edit(user, action);
		});
		load();
	};
	this.destroy = function () {
		_destroyed = true;
		_root.off().find('.Button').off();
		_table.destroy();
	};
};
classes.panels.Users.prototype = new EventDispatcher();
