
classes.Admin = (function () {
	function Constructor () {
		
		/* "imported" classes
			*/
			
		var Func;
		var Auth;
		var Lang;
		var Dialog;
		var Cookie;
		var History;
		var SiteBar;
		
		/* private properites
			*/
			
		var _instance = 		this;
		var _inited = 			false;
		var _application = 		null;
		var _view = 			null;
		var _state = 			null;
		var _config = 			null;
		var _productinfo = 		null;
		var _update_required = 	false;
		
		/* private methods
			*/
		
		function onLoaded () {
			Dialog.initialize();
			if ( _config.setup.hub._value=="true" || _config.setup.standalone._value=="false" ) {
				Auth.send(this, onTouch, {
					action: "touch"
				});
			} else {
				Auth.subscribe("valid", valid);
				Auth.subscribe("invalid", invalid);
				Auth.start();
			}
		}
		function onTouch (success, data) {
			Auth.token(data);
			Auth.subscribe("valid", valid);
			Auth.subscribe("invalid", invalid);
			Auth.start();
		}
		function invalid (eo) {
			/* if the Auth reports invalid, it can be one of a couple things:
				- if it's standalone, they may not have logged in yet
				- if it's standalone, the user clicked "Logout"
				- if it's embedded, the user logged out of the parent application
				- if it's embedded, the authentication mechanism is reporting false
				- the authentication cookie somehow gets cleared in the browser
				*/
			if ( _config.setup.standalone._value=="true" && _config.setup.hub._value!="true" ) {
				/*  if we're in standalone mode, we need to require logins
					and we'll be using our own user authentication mechanism
					*/
				Dialog.create({
					size: "420x*",
					title: Lang.lookup("User Authentication"),
					content: classes.dialogs.Login,
					owner: this,
					options: [{
						close: false,
						label: Lang.lookup("Forgot Login"),
						func: openForgotLogin
					}]
				});
				/* and since it's standalone, since the is technically not a "page", set the page title to
					reflect that we're requesting credentials
					*/
				document.title = $("<div>" + _config.setup.product_title._value + " » " + Lang.lookup("User Authentication") + "</div>").text();
			} else {
				/* if it's not standalone, we're leaving authentication up to the system
					our job is just to notify.
					*/
				Dialog.create({
					size: "420x*",
					title: Lang.lookup("Authentication Error"),
					content: Lang.lookup("Authentication Error Description"),
					owner: this,
					options: []
				});
			}
		}
		function openForgotLogin (eo) {
			Dialog.create({
				size: "600x*",
				title: Lang.lookup("Request New Credentials"),
				content: classes.dialogs.ForgotLogin,
				owner: this,
				options: [{
					label: Lang.lookup("Close")
				}]
			});
		}
		function valid (eo) {
			/* a successfull login after not being logged in
				kill any dialog screens if they exist
				*/
			Dialog.kill();
			/* we really only want to draw this once
				even if they have been logged in before
				*/
			if (_inited) return;
			_inited = true;
			/*
				start the nav
				*/
			SiteBar.initialize();
			/*
				add the application space
				*/
			var xhtml = '';
				xhtml += '<div id="title">Title</div>';
				xhtml += '<div id="application">';
				xhtml += '</div>';
			$('#container').append(xhtml);
			/* so, i figured, they probably want to start up where they left off
				this cookie just keeps track of the last page they saw, and then loads that up
				in case no direct link has been given.
				i mean, whats the point in always dragging them through the dashboard if all they really
				want to do is manage content?
				*/
			var lastpage = Cookie.get("lastpage");
			if (lastpage=="") {
				lastpage = "/dashboard/";
			}
			if ( _config.setup.standalone._value=="false" ) {
				history(lastpage);
			} else {
				History.subscribe("history", history);
				History.initialize(lastpage);
			}
			/* last but not least, let's check to see if there are any updates
				*/
			Auth.send(this, onProductInfo, {
				action: "get_product_info"
			});
		}
		function onProductInfo (success, data) {
			// parse the xml data
			var xmlobj = $.parseXML(data);
			_productinfo = Func.xmlToJson(xmlobj);
			// check if we need to update
			var current_str = _productinfo.data.product.Version._value;
				if (current_str=='') return;
			var current = current_str.split(".");
			for (var i=0; i<current.length; ++i) {
				current[i] = parseInt(current[i], 10);
			}
			var installed_str = _config.setup.product_version._value;
				if (installed_str=='') return;
			var installed = installed_str.split(".");
			for (var i=0; i<installed.length; ++i) {
				installed[i] = parseInt(installed[i], 10);
			}
			var type = "none";
			_update_required = false;
			if (current[0]>installed[0]) {
				_update_required = true;
				type = "version";
			} else if (current[0]==installed[0]) {
				if (current[1]>installed[1]) {
					_update_required = true;
					type = "major";
				} else if (current[1]==installed[1]) {
					if (current[2]>installed[2]) {
						_update_required = true;
						type = "minor";
					}
				}
			}
			if (_update_required) {
				callForUpdate(type, current_str, installed_str);
			}
		}
		function callForUpdate (type, current, installed) {
			var checkForUpdates = Cookie.get("checkForUpdates");
			var updateTimeStamp = Cookie.get("updateTimeStamp");
			if (checkForUpdates=="") {
				checkForUpdates = true;
			} else {
				checkForUpdates = checkForUpdates=="true";
			}
			if (updateTimeStamp=="") {
				updateTimeStamp = 0;
			} else {
				updateTimeStamp = parseInt(updateTimeStamp, 10);
			}
			if (checkForUpdates==false) {
				var now = new Date().getTime();
				if ( updateTimeStamp==0 || updateTimeStamp <= now ) checkForUpdates = true;
			}
			if (checkForUpdates) {
				var description = Lang.lookup("Update Available Description");
					description = description.split("{CURRENT}").join(current);
					description = description.split("{INSTALLED}").join(installed);
				Dialog.create({
					size: "500x*",
					title: Lang.lookup("Update Available"),
					content: classes.dialogs.Update,
					init: {
						description: description
					},
					owner: this,
					options: [{
						label: Lang.lookup("Update Now"),
						func: runUpdate,
						param: true
					},{
						label: Lang.lookup("Update Later")
					},{
						label: Lang.lookup("Update Forget"),
						func: runUpdate,
						param: false
					}]
				});
			}
			return checkForUpdates;
		}
		function runUpdate (action) {
			if (action==true) {
				if (_config.setup.hub._value=="true") {
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
					var update_uri = "https://intothedarkroom.com/installer/?l=" + (_config.setup.language._value) + "&a=upgrade&k=" + (_config.setup.product_key._value);
					document.location = update_uri;
				}
				Cookie.set("checkForUpdates", "true");
				Cookie.set("updateTimeStamp", 0);
			} else {
				Cookie.set("checkForUpdates", "false");
				Cookie.set("updateTimeStamp", new Date().getTime() + 1209600000);
			}
		}
		function runUpdateConfirm () {
			document.location = "http://members.intothedarkroom.com/login/" + (_config.setup.install_id._value) + "/update.html";
		}
		function click (hash) {
			/* we're gonna try and catch any user-error stuff by checking to see
				if there is any unsaved data in the current application.
				if the application is reporting unsaved, notify them of this
				scenario.
				otherwise, just proceed as normal.
				*/
			if (_application.unsaved()===true) {
				Dialog.create({
					size: "420x*",
					title: Lang.lookup("Unsaved Changes"),
					content: Lang.lookup("Unsaved Changes Description"),
					owner: this,
					options: [{
						label: Lang.lookup("Continue"),
						func: proceed,
						param: hash
					},{
						label: Lang.lookup("Cancel")
					}]
				});
			} else {
				proceed(hash);
			}
		}
		function proceed (hash) {
			if ( _config.setup.standalone._value=="false" ) {
				history(hash);
			} else {
				History.setHistory(hash);
			};
		}
		function getContentClass (view) {
			for (var prop in classes.applications) {
				if (prop=="Setup") continue;
				var classname = prop.toLowerCase();
				if (classname==view) {
					return classes.applications[prop];
				}
			}
			return false;
		}
		function history (hash) {
			if (hash.charAt(0)!="/") {
				hash = "/" + hash + "/";
				proceed(hash);
				return;
			}
			hash = hash.split("/");
				hash.shift();
				hash.pop();
			var lastview = _view;
			_view = hash.shift();
			_state = hash.join("/");
			/*
				spit out the lang stuff
				*/
			if (_view=="trace_lang_log") {
				Lang.out();
				 return; // do not pass go
			}
			/*
				log out
				*/
			if (_view=="logout") {
				logout();
				 return; // do not pass go
			}
			var classid = getContentClass(_view);
			var options = {};
			if (!classid) {
				classid = classes.components.Setup;
				options.revert_is_delete = _view=="splash" || _view=="contact";
				options.type = _view;
			}
			/* update the navigation bar
				*/
			SiteBar.active(_view, _state);
			/*
				see the comment above in init, but we're basically saving
				the last page view.
				also, set the page title here.
				*/
			Cookie.set("lastpage", _view);
			/* destroy the old, create the new
				*/
			if (lastview!=_view) {
				try {
					_application.destroy();
				} catch(err) {
				}
				_application = new classid();
				for (var prop in options) {
					_application[prop](options[prop]);
				}
				_application.initialize();
			}
			_application.state(_state);
		}
		function logout () {
			Dialog.create({
				size: "420x*",
				title: Lang.lookup("Logging Out"),
				content: Lang.lookup("Logging Out Description"),
				owner: this,
				options: []
			});
			Auth.token("");
			Auth.send(this, onLogout, {
				action: "logout"
			});
		}
		function onLogout () {
			document.location = Auth.basepath() + Auth.indexpath() + "?/admin/";
		}
		function start () {
			Auth.initialize();
			Auth.basepath( _config.setup.basepath._value );
			Auth.corepath( NAMESPACE + "-core" );
			Auth.datapath( NAMESPACE + "-data");
			Auth.indexpath( _config.setup.indexpath._value || "" );
			/* the Lang class converts all our translation stuff.
				it should have been called L10n, but because we started using it tooo late ...
				*/
			Lang.initialize();
			Lang.subscribe("onLoaded", onLoaded);
			Lang.code( _config.setup.language._value );
		}
		function render () {
			$('html,body,#container').css("height", "auto");
			$('#container').css("background", "none");
			// load up our base data
			$.ajax( NAMESPACE + "-config.xml", {
				cache: false,
				dataType: "xml",
				method: "get",
				success: function (data, status, obj) {
					_config = Func.xmlToJson(data);
					start();
				}
			});
		}
		
		/* public methods
			*/
			
		this.title = function (str) {
			$("#title").html(str);
			document.title = $("<div>" + _config.setup.product_title._value + " » " + str + "</div>").text();
		}
		this.state = function (view, state) {
			var hash = "/";
			hash += view || _view;
			hash += "/";
			if (state) {
				hash += state || _state;
				hash += "/";
			}
			if ( view==null || view==_view ) {
				proceed(hash);
			} else {
				click(hash);
			}
		}
		this.config = function () {
			return _config;
		}
		this.updateRequired = function () {
			return _update_required;
		}
		this.productinfo = function () {
			return _productinfo;
		}
		this.initialize = function () {
			History = classes.helpers.History;
			Cookie = classes.helpers.Cookie;
			Auth = classes.data.Auth;
			Lang = classes.data.Lang;
			Func = classes.helpers.Func;
			Dialog = classes.components.Dialog;
			SiteBar = classes.components.SiteBar;
			render();
		};
	}
	
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
	
}());
