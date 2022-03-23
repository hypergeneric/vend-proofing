
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.components.SiteBar = (function () {
	function Constructor () {
		
		/* "imported" classes
			*/
			
		var StageProxy;
		var Func;
		var XMLPane;
		var TabPanel;
		var Auth;
		var Lang;
		var Dialog;
		var Admin;
		
		/* private properites
			*/
			
		var _instance = 			this;
		var _view;
		var _state;
		
		/* private methods
			*/
			
		function resize (eo) {
			var sw = StageProxy.width();
			$('#navigation select').show();
			var lw = $('#logo').outerWidth();
			var selh = $('#navigation select').outerHeight();
			$('#navigation select').css("top", (51-selh)/2);
			$('#navigation select').css("left", lw+15);
			$('#navigation select').css("width", sw-lw-30);
			if (sw>800) {
				$('#navigation select').hide();
			} else {
			}
		}
		
		function render () {
			
			/*
				add the nav
				*/
			var xhtml = '';
				xhtml += '<div id="navigation">';
				
				// logo
				xhtml += 	'<div id="logo">';
				xhtml += 		'<img src="' + NAMESPACE + '-core/admin/graphics/' + Admin.config().setup.product_badge._value + '" width="' + Admin.config().setup.product_badge._attributes.width + '" height="' + Admin.config().setup.product_badge._attributes.height + '" />';
				xhtml += 		'<div class="Clear"></div>';
				xhtml += 	'</div>';
				xhtml += 	'<div class="Clear"></div>';
				// sidebar nav
				xhtml += 	'<ul id="nav">';
			for (var i=0; i<Admin.config().setup.sitebar.tab.length; ++i) {
				var tab = Admin.config().setup.sitebar.tab[i];
				xhtml += 		'<li data-key="/' + tab._attributes.key + '/">';
				xhtml += 			'<a>' + '<span class="glyphicon glyphicon-' + tab._attributes.icon + '"></span>&nbsp;&nbsp;' + Lang.lookup(tab._attributes.key) + '</a>';
				if (tab.tab) {
					var tabs = tab.tab;
				xhtml += 			'<ul>';
					for (var j=0; j<tabs.length; ++j) {
						var tab = tabs[j];
				xhtml += 				'<li data-key="/' + tab._attributes.key + '/">';
				xhtml += 					'<a class="HardSub">' + Lang.lookup(tab._attributes.key) + '</a>';
				xhtml += 				'</li>';
					}
				xhtml += 			'</ul>';
				}
				xhtml += 		'</li>';
			}
			if ( Admin.config().setup.standalone._value=="true" && Admin.config().setup.hub._value!="true" ) {
				// logout
				xhtml += 		'<li data-key="/logout/">';
				xhtml += 			'<a>' + '<span class="glyphicon glyphicon-off"></span>&nbsp;&nbsp;' + Lang.lookup("Logout") + '</a>';
				xhtml += 		'</li>';
			}
			/*if (  is dev  true ) {
				// lang out
				xhtml += 		'<li data-key="trace_lang_log">';
				xhtml += 			Lang.lookup("Trace Lang Log");
				xhtml += 		'</li>';
			}*/
				xhtml += 	'</ul>';
				// dropdown
				xhtml += 	'<select>';
			for (var i=0; i<Admin.config().setup.sitebar.tab.length; ++i) {
				var tab = Admin.config().setup.sitebar.tab[i];
				xhtml += 		'<option data-key="/' + tab._attributes.key + '/">';
				xhtml += 			Lang.lookup(tab._attributes.key);
				xhtml += 		'</option>';
				if (tab.tab) {
					var tabs = tab.tab;
					for (var j=0; j<tabs.length; ++j) {
						var tab = tabs[j];
				xhtml += 		'<option data-key="/' + tab._attributes.key + '/">';
				xhtml += 			" -- " + Lang.lookup(tab._attributes.key);
				xhtml += 		'</option>';
					}
				}
			}
			if ( Admin.config().setup.standalone._value=="true" && Admin.config().setup.hub._value!="true" ) {
				// logout
				xhtml += 		'<option data-key="/logout/">';
				xhtml += 			Lang.lookup("Logout");
				xhtml += 		'</option>';
			}
				xhtml += 	'</select>';
				xhtml += 	'<div class="Clear"></div>';
				// dropdown
				xhtml += 	'<span id="copyright">Intothedarkroom © 2017 - <a href="?/eula/" target="_blank">EULA</a></span>';
				xhtml += '</div>';
				
			$('#container').append(xhtml);
			
			if ( Admin.config().setup.standalone._value=="false" ) {
				$('#logo').css("cursor", "pointer").click(function () {
					Func.back();
				});
			}
			
			$('#navigation ul li a').click(function (event) {
				var key = $(this).parent().data("key");
				key = key.split("/");
				Admin.state(key[1], key[2]);
				Func.stop(event);
				return false;
			});
			
			$('#navigation select').change(function (event) {
				var key = $("option:selected", this).data("key");
				key = key.split("/");
				key = key[1];
				Admin.state(key);
				Func.stop(event);
				return false;
			});
			
			/*
				re organize
				*/
			StageProxy.addEventListener("onResize", resize);
			resize();
			
		}
		
		/* public methods
			*/
			
		this.register = function (_key, obj, overwrite) {
			if (!_key) {
				_key = _view;
			}
			//console.log("register", _key);
			var addee = $('#navigation ul').find('[data-key="/' + _key + '/"]');
			var childblock = addee.find("ul");
			if ( childblock.length==0 || (childblock.length==1&&overwrite==true) ) {
				addee.find("ul").remove();
					var xhtml = 	'<ul>';
				for (var j=0; j<obj.length; ++j) {
					var tab = obj[j];
					xhtml += 			'<li data-key="/' + _key + "/" + tab.key + '/">';
					xhtml += 				'<a>' + Lang.lookup(tab.label) + '</a>';
					xhtml += 			'</li>';
				}
					xhtml += 		'</ul>';
				addee.append(xhtml);
				$('#navigation ul li a').off().click(function (event) {
					var key = $(this).parent().data("key");
					key = key.split("/");
					var view = key[1];
					var state = key[2];
					if (key[3]) {
						state += "/" + key[3];
					}
					if (key[4]) {
						state += "/" + key[4];
					}
					Admin.state(view, state);
					Func.stop(event);
					return false;
				});
				this.active(_view, _state);
			}
		}
		this.active = function (view, state) {
			
			_view = view;
			_state = state;
			
			$('#navigation li a').removeClass("Active");
			var clicked = $('#navigation ul').find('[data-key="/' + _view + '/"] > a').eq(0);
			if (clicked.hasClass("HardSub")) {
				var main = clicked.parent().parent().parent().find("a").eq(0);
				var sub = clicked;
			} else {
				var main = $('#navigation ul').find('[data-key="/' + _view + '/"] > a');
				var sub = $('#navigation ul').find('[data-key="/' + _view + '/' + _state + '/"] > a');
			}
			
			
			
			
			//console.log('[data-key="/' + _view + '/' + _state + '/"] > a');
			
			main.addClass("Active");
			sub.addClass("Active");
			$("#nav li ul").stop().slideUp(350);
			main.next("ul").stop().slideDown(350);
			
			$('#navigation option').prop("selected", false);
			$('#navigation select').find('[data-key="/' + _view + '/"]').prop("selected", true);
			
		};
		this.destroy = function () {
		};
		this.initialize = function () {
			Admin = classes.Admin;
			Dialog = classes.components.Dialog;
			Lang = classes.data.Lang;
			Auth = classes.data.Auth;
			TabPanel = classes.components.TabPanel;
			XMLPane = classes.components.XMLPane;
			Func = classes.helpers.Func;
			StageProxy = classes.StageProxy;
			render();
		};
		
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());