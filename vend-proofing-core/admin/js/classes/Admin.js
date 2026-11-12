
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
		
		/* private methods
			*/
		
		function onLoaded () {
			Dialog.initialize();
			Auth.subscribe("valid", valid);
			Auth.subscribe("invalid", invalid);
			Auth.start();
		}
		function invalid (eo) {
			Dialog.create({
				size: "420x*",
				title: Lang.lookup("User Authentication"),
				content: classes.dialogs.Login,
				owner: this,
				options: []
			});
			document.title = $("<div>" + _config.setup.product_title._value + " » " + Lang.lookup("User Authentication") + "</div>").text();
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
			Auth.send(this, onLogout, {
				action: "logout"
			});
		}
		function onLogout () {
			Auth.token("");
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
			_config = VEND_ADMIN_CONFIG;
			start();
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
