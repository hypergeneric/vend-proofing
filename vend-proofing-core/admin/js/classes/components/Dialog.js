
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.components.Dialog = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var StageProxy;
		var Func;
		/* private properites
			*/
		var _instance = this;
		var _active = false;
		var screen;
		var stack = [];
		var trash = [];
		var setup = {};
		var duid = 0;
		/* private methods
			*/
		function manageButtons (enabled, arr, id) {
			if (stack.length==0) return;
			var setup;
			/* assume the last dialog in the stack
				but if there is an id, specifically look for that one instead
				*/
			var index = stack.length-1;
			if (id) {
				var found = false;
				for (var i=0; i<stack.length; ++i) {
					var obj = stack[i];
					if (obj.id==id) {
						found = true;
						index = i;
						break;
					}
				}
				if (!found) return; // if we're trying to delete something that doesnt exist, forget about it
			}
			/* pull the right data set
				*/
			setup = stack[index];
			/* loop through and manage
				*/
			if (arr.length==1&&arr[0]=="*") {
				for (var i=0; i<setup.options.length; ++i) {
					var button = $('#b-' + setup.id + '-' + i);
					if (enabled) {
						button.removeClass("Disabled");
						button.addClass("Enabled");
					} else {
						button.removeClass("Enabled");
						button.addClass("Disabled");
					}
				}
			} else {
				for (var i=0; i<arr.length; ++i) {
					var button = $('#b-' + setup.id + '-' + arr[i]);
					if (enabled) {
						button.removeClass("Disabled");
						button.addClass("Enabled");
					} else {
						button.removeClass("Enabled");
						button.addClass("Disabled");
					}
				}
			}
		}
		function destroyDialog (duid) {
			if (stack.length==0) return;
			var setup;
			/* assume the last dialog in the stack
				but if there is an id, specifically look for that one instead
				*/
			var index = stack.length-1;
			if (duid) {
				var found = false;
				for (var i=0; i<stack.length; ++i) {
					var obj = stack[i];
					if (obj.id==duid) {
						found = true;
						index = i;
						break;
					}
				}
				if (!found) return; // if we're trying to delete something that doesnt exist, forget about it
			}
			/* instead of killing the class and content immediately
				we're gonna just make it invisible
				since the information in the closed dialog might
				be needed still
				*/
			setup = stack.splice(index, 1);
			setup = setup[0];
			//trace ("trashing: " + setup.dialog);
			setup.dialog.hide();
			trash.push(setup);
			/* check to see if there are any other dialogs in the stack
				if so, turn the last one in the stack back on
				*/
			if (stack.length>0) {
				setup = stack[stack.length-1];
				setup.dialog.css("z-index", duid+1000);
				setup.dialog.show();
				_active = true;
				$('#dialog').show();
			} else {
				_active = false;
				$('#dialog').hide();
			}
		}
		function drawDialog () {
			/* obviously, if there is nothing in the stack, there is nothing to show
				*/
			if (stack.length==0) {
				_active = false;
				$('#dialog').hide();
				return;
			}
			/* make sure it's visible
				*/
			_active = true;
			$('#dialog').show();
			/* run through garbage collection
				*/
			for (var i=0; i<trash.length; ++i) {
				var setup = trash[i];
				setup.classobj.destroy();
				setup.content.remove();
				setup.dialog.remove();
			}
			trash = new Array();
			/* first turn off any existing dialogs
				*/
			for (var i=0; i<stack.length-1; ++i) {
				var setup = stack[i];
				setup.dialog.hide();
			}
			setup = stack[stack.length-1];
			/* darw the window chrome
				*/
			var xhtml = '';
				xhtml += '<div id="dialog-' + setup.id + '" class="Dialog">';
				xhtml += 	'<div class="Header">' + setup.title + '</div>';
				xhtml += 	'<div class="Content"></div>';
				xhtml += 	'<div class="Footer">';
			if (IS_MOBILE) {
				xhtml += 		'<div class="MobileFooter"></div>';
			}
			for (var i=0; i<setup.options.length; ++i) {
				xhtml += 		'<div id="b-' + setup.id + '-' + i + '" class="Button">' + setup.options[i].label + '</div>';
			}
				xhtml += 	'</div>';
				xhtml += '</div>';
			$('#container .Stack').append(xhtml);
			var dialog = $('#dialog-' + setup.id);
			/* draw up the navigation
				*/
			for (var i=0; i<setup.options.length; ++i) {
				var button = $('#b-' + setup.id + '-' + i);
				button.data("data", setup.options[i]);
				button.data("id", setup.id);
				button.data("owner", setup.owner);
				button.data("dialog", dialog);
				button.click(function () {
					if ($(this).hasClass("Disabled")) {
						return;
					}
					var data = $(this).data("data");
					var id = $(this).data("id");
					var owner = $(this).data("owner");
					var dialog = $(this).data("dialog");
					if (data.func) {
						data.func(data.param);
					}
					if (data.close==undefined||data.close===true) {
						destroyDialog(id);
					}
					if (data.key) {
						//dialog.content.doOption(data.key);
					}
				});
			}
			/* draw up the content
				*/
			var content = $('#dialog-' + setup.id + ' .Content');
			var classobj = {
				"destroy": function () {}
			};
			if ( typeof setup.content === 'string' || setup.content instanceof String ) {
				content.html('<div class="DialogInfo">' + setup.content + '</div')
			} else {
				classobj = new setup.content();
				classobj.parent(content);
				classobj.initialize(setup.init);
			}
			/* size up the dialog according to the size
				*/
			var dim = setup.size.split("x");
			var width = dim[0]=="*" ? 320 : parseFloat(dim[0]);
			content.width(width);
			dialog.width(width);
			dialog.data("width", width);
			var height = dim[1]=="*" ? content.height() : parseFloat(dim[1]);
			content.height(height);
			dialog.height(height+80);
			dialog.data("height", height+80);
			/* save a reference to the dialog with the setup object
				*/
			stack[stack.length-1].classobj = classobj;
			stack[stack.length-1].content = content;
			stack[stack.length-1].dialog = dialog;
			/* resize event just for kicks
				*/
			resize();
		}
		function resize () {
			$('#dialog').show();
			var sw = StageProxy.width();
			var sh = StageProxy.height();
			if (IS_MOBILE) {
				for (var i=0; i<stack.length; ++i) {
					var setup = stack[i];
					setup.dialog.css({
						width: sw,
						height: sh
					});
					setup.content.css({
						width: sw,
						height: sh-80
					});
				}
			} else {
				for (var i=0; i<stack.length; ++i) {
					var setup = stack[i];
					var dw = setup.dialog.data("width");
					var dh = setup.dialog.data("height");
					setup.dialog.css({
						top: (sh-dh)/2,
						left: (sw-dw)/2,
						width: dw,
						height: dh,
					});
					setup.content.css({
						width: dw-2,
						height: dh-80
					});
					if (dh>sh) {
						setup.dialog.css({
							top: 0,
							height: sh
						});
						setup.content.css({
							height: sh-80
						});
					}
					if (dw>sw) {
						setup.dialog.css({
							left: 0,
							width: sw
						});
						setup.content.css({
							width: sw
						});
					}
				}
			}
			if (setup) {
				if (setup.classobj.resize) {
					setup.classobj.resize();
				}
			}
			if (!_active) {
				$('#dialog').hide();
			}
		}
		function render () {
			$('#container').html('<div id="dialog"><div class="Screen"></div><div class="Stack"></div></div>');
			$('#container .Screen').click(function (event) {
				Func.stop(event);
				return false;
			});
			StageProxy.addEventListener("onResize", resize);
		}
		/* public methods
			*/
		this.enableOptions = function(arr, id) {
			if (id==undefined) {
				id = stack[stack.length-1].id
			}
			manageButtons(true, arr, id);
		};
		this.disableOptions = function(arr, id) {
			if (id==undefined) {
				id = stack[stack.length-1].id
			}
			manageButtons(false, arr, id);
		};
		this.last = function() {
			return stack[stack.length-1];
		};
		this.active = function() {
			return _active;
		};
		this.kill = function(id) {
			destroyDialog(id);
		};
		this.create = function(obj) {
			++duid;
			obj.id = duid;
			stack.push(obj);
			drawDialog();
			return obj.id;
		};
		this.initialize = function () {
			Func = classes.helpers.Func;
			StageProxy = classes.StageProxy;
			render();
		};
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());
