
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.panels.MessageLog = function () {
	
	/* "imported" classes
		*/
		
	var SetList;
	var Lang;
	var Dialog;
	var Func;
	
	/* private properites
		*/
		
	var _instance = 			this;
	var _setlist = 				null;
	var _panel = 				null;
	var _controller = 			null;
	var _message = 				null;
	var _table = 				null;
	var _uniquid = 				"message-log-table"; //"FO" + classes.helpers.Func.uniquid();
	
	/* private methods
		*/
		
	function action (key, obj) {
		switch (key) {
			case "reply" :
				replyClick(obj);
				break;
			case "del" :
				deleteClick(obj);
				break;
			case "view" :
				onSelected(obj);
				break;
		}
	}
	
	function replyClick (obj) {
		var popup = window.open("mailto:"+obj.from_email);
		setTimeout($.proxy(function() {
			this.close();
		}, popup), 100);
	}
	
	function deleteClick (obj) {
		Dialog.create({
			size: "420x*",
			title: Lang.lookup("Delete Set Confirmation"),
			content: Lang.lookup("Delete Set Confirmation Description"),
			owner: this,
			options: [{
				label: Lang.lookup("Yes Delete"),
				func: deleteConfirm,
				param: obj
			},{
				label: Lang.lookup("Cancel")
			}]
		});
	}
	function deleteConfirm (obj) {
		_setlist.deleteSet(obj.suid);
	}
	
	function onSelected (selected) {
		if (!IS_MOBILE) {
			selected = _setlist.selected()[0];
		}
		var xhtml = '';
		if (selected) {
			var d = new Date( parseInt(selected.timestamp, 10) );
				xhtml += 		'<table class="table table-striped table-bordered" width="100%" cellspacing="0">';
				xhtml += 		'<tbody>';
				xhtml += 			'<tr>';
				xhtml += 				'<td>' + Lang.lookup("Message From") + '</td>';
				xhtml += 				'<td>' + selected.from_name + ' <a href="mailto:' + selected.from_email + '" target="_blank">&lt;' + selected.from_email + '&gt;</a>' + '</td>';
				xhtml += 			'</tr>';
				xhtml += 			'<tr>';
				xhtml += 				'<td>' + Lang.lookup("Message To Email") + '</td>';
				xhtml += 				'<td>' + selected.to_name + ' <a href="mailto:' + selected.to_email + '" target="_blank">&lt;' + selected.to_email + '&gt;</a>' + '</td>';
				xhtml += 			'</tr>';
				xhtml += 			'<tr>';
				xhtml += 				'<td>' + Lang.lookup("Message Subject") + '</td>';
				xhtml += 				'<td>' + $.base64.decode(selected.subject) + '</td>';
				xhtml += 			'</tr>';
				xhtml += 			'<tr>';
				xhtml += 				'<td class="' + selected.success + '">' + Lang.lookup("Message Sent On") + '</td>';
				xhtml += 				'<td>' + d.toLocaleDateString("en-US") + '</td>';
				xhtml += 			'</tr>';
				xhtml += 			'<tr>';
				xhtml += 				'<td>' +  Lang.lookup("Message Body") + '</td>';
				xhtml += 				'<td>' + $.base64.decode(selected.message).split("\n").join("<br />") + '</td>';
				xhtml += 			'</tr>';
				xhtml += 		'</tbody>';
				xhtml += 		'</table>';
		}
		if (IS_MOBILE) {
			Dialog.create({
				size: "640x*",
				title: Lang.lookup("Message From") + ": " + selected.from_name + " (" + selected.from_email + ")",
				content: xhtml,
				owner: this,
				options: [{
					label: Lang.lookup("Close")
				}]
			});
		} else {
			_message.html(xhtml);
		}
	}
	
	function onDataLoaded () {
		/* manage the tab panel
			*/
		_panel.screen(false);
		/* clear the table, add new rows, then redraw
			*/
		_table.clear();
		_table.rows.add(_setlist.ingest());
		_table.draw(false);
	}
	function onStartLoad () {
		_panel.screen(true);
	}
	
	function render () {
		
		var parent = _panel.body();
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="Navigation">';
			xhtml += 	'<div class="' + (IS_MOBILE?"Inner":"Left") + '">';
			xhtml += 		'<table class="table table-striped table-bordered" width="100%" cellspacing="0"></table>';
			xhtml += 	'</div>';
		if (!IS_MOBILE) {
			xhtml += 	'<div class="Right">';
			xhtml += 		'<div class="Message">';
			xhtml += 		'</div>';
			xhtml += 	'</div>';
		}
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
		parent.html(xhtml);
		
		_message = parent.find("#" + _uniquid + " .Right .Message");
			
		/* start up our dataset
			*/
		_setlist = new SetList();
		_setlist.name("messages");
		_setlist.columms(["timestamp", "success", "from_name", "from_email", "to_name", "to_email", "subject", "message"]);
		_setlist.addEventListener("onStartLoad", onStartLoad);
		_setlist.addEventListener("onDataLoaded", onDataLoaded);
		_setlist.addEventListener("onSelected", onSelected);
		_setlist.initialize();

		/* create the datatable
			*/
		_table = $('#' + _uniquid + " " + (IS_MOBILE?".Inner":".Left") + " table").DataTable( {
			stateSave: true,
			stateSaveCallback: function(settings,data) {
				localStorage.setItem( _uniquid, JSON.stringify(data) )
			},
			stateLoadCallback: function(settings) {
				return JSON.parse( localStorage.getItem( _uniquid ) )
			},
			searching: true,
			ordering: true,
			order: [[ 3, "desc" ]],
			paging: true,
			select: (IS_MOBILE?false:'single'),
			responsive: {
				details: false
			},
			data: [],
			columns: [
				{ 
					title: Lang.lookup("Message Subject"),
					data: "subject",
					render: function ( data, type, row ) {
						data = $.base64.decode(data);
						return data;
					},
					responsivePriority: 1
				},{ 
					title: Lang.lookup("Message From"),
					data: "from_name"
				},{ 
					title: Lang.lookup("Message Sent On"),
					data: "timestamp",
					type: "num",
					render: function ( data, type, row ) {
						data = parseInt(data, 10);
						if ( type === 'display' || type === 'filter' ) {
							var d = new Date( data );
							return d.toLocaleDateString("en-US");
						}
						return data;
					}			
				},{ 
					title: '<div style="text-align:center" class="DragIcon"><span class="glyphicon glyphicon glyphicon glyphicon-envelope" aria-hidden="true"></span></div>',
					data: "success",
					orderable: false,
					render: function ( data, type, row ) {
						var icon = data=="true" ? 'glyphicon-ok' : 'glyphicon-remove'
						return '<div style="text-align:center" class="DragIcon"><span class="glyphicon glyphicon ' + icon + '" aria-hidden="true"></span></div>';
					}
				},{
					title: Lang.lookup("Actions"),
					data: "suid",
					orderable: false,
					render: function ( data, type, row ) {
						var xhtml = '';
						if (IS_MOBILE) {
							xhtml += '<a data-suid="' + data + '" data-action="view">View</a> / ';
						}
							xhtml += '<a data-suid="' + data + '" data-action="reply">Reply</a> / ';
							xhtml += '<a data-suid="' + data + '" data-action="del">Delete</a>';
						return xhtml;
					},
					responsivePriority: 2
				}
			],
			columnDefs: [{
				targets: -1,
				createdCell: function (td, cellData, rowData, row, col) {
					var html = $(td);
					var obj = html.find("a");
					obj.click(function (e) {
						action($(this).data("action"), rowData);
						e.preventDefault();
						return false;
					});
				}
			}]
		} );
		_table.on( 'select', function ( e, dt, type, indexes ) {
			if ( type === 'row' ) {
				var suid = _table.rows( indexes ).data()[0].suid;
				_setlist.addSelected(suid);
			}
		});
		_table.on( 'deselect', function ( e, dt, type, indexes ) {
			if ( type === 'row' ) {
				var suid = _table.rows( indexes ).data()[0].suid;
				_setlist.removeSelected(suid);
			}
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
		_table.off('select');
		_table.off('deselect');
		_table.destroy(true);
		_setlist.removeEventListener("onSelected", onSelected);
		_setlist.removeEventListener("onStartLoad", onStartLoad);
		_setlist.removeEventListener("onDataLoaded", onDataLoaded);
	};
	this.initialize = function () {
		Func = classes.helpers.Func;
		Lang = classes.data.Lang;
		Dialog = classes.components.Dialog;
		SetList = classes.components.SetList;
		render();
	};
	
};

classes.panels.MessageLog.prototype = new EventDispatcher();
