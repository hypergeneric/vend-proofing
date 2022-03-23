
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.data.Auth = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var Admin;
		var Cookie;
		/* private properites
			*/
		var _instance = 			this;
		var _basepathabsolute = 	"";
		var _basepath = 			"";
		var _token = 				"";
		var _indexpath = 			"";
		var _corepath = 			"";
		var _datapath = 			"";
		var _provideruri = 			"intothedarkroom.com";
		var id = 					"";
		var lookup = 				{};
		var xmlcache = 				{};
		var status = 				"init";
		var _uploader = 			null;
		var _uploader_curent = 		{};
		/* private methods
			*/
		function go () {
			setInterval(authenticate, 10000);
			authenticate();
		}
		function invalid (error) {
			console.log(error);
			if (status!="invalid") {
				status = "invalid";
				_instance.dispatch("invalid", {status:status});
			}
		}
		function valid () {
			if (status!="valid") {
				status = "valid";
				_instance.dispatch("valid", {status:status});
			}
		}
		function authenticate () {
			/* if there is no token yet, skip this whole thing
				*/
			if (_token=="") {
				
				invalid();
				return;
			}
			/* ok continue with further checks
				*/
			var cookie_name = md5(Admin.config().setup.product._value);
			var cookie_value = Cookie.get(cookie_name);
			/* check to see if we have a valid cookie
				*/
			if (cookie_value==""||cookie_value==null||cookie_value=="null"||cookie_value==undefined||cookie_value=="undefined") {
				invalid("invalid cookie: '" + cookie_value + "'");
				return;
			}
			/* ok, cookie exists at least, lets's check it's parts
				*/
			var cookie_fragments = cookie_value.split("-").join("").split(".");
			if (cookie_fragments.length!=2) { // invalid cookie format
				invalid("invalid cookie length: '" + cookie_fragments.length + "' cookie: '" + cookie_value + "'");
				return;
			}
			/* ok, if we're this far, time to check to see if our cookie is legit
				*/
			var cookie_product_hash = cookie_fragments[0];
			var cookie_shared_key_hash = cookie_fragments[1];
			var cookie_product_hash_actual = md5(Admin.config().setup.product_key._value);
			var cookie_shared_key_hash_actual = sha1(_token);
			if (cookie_product_hash!=cookie_product_hash_actual) {
				invalid("invalid product hash: '" + cookie_product_hash + "' actual: '" + cookie_product_hash_actual + "'");
				return;
			}
			if (cookie_shared_key_hash!=cookie_shared_key_hash_actual) {
				invalid("invalid shared key hash: '" + cookie_shared_key_hash + "' actual: '" + cookie_shared_key_hash_actual + "'");
				return;
			}
			/* ok, if we're here, everything has checked out.
				*/
			valid();
			return;
		}
		function rawurldecode(str) {
			try {
				return decodeURIComponent(str);
			}
			catch(err) {
				return unescape(str);
			}
		}
		function unserialize(str) {
			var obj = {};
			var pairs = str.split('&');
			for (var i=0; i<pairs.length; ++i) {
				var pair = pairs[i].split("=");
				var name = pair[0];
				var value = rawurldecode(pair[1]);
				obj[name] = value;
			}
			return obj;
		}
		function doSend (target, method, props) {
			/*
				setup the new call
				*/
			if (props.action) {
				if (props.action=="setup_defaults") {
					if (xmlcache[props.type]!=undefined) {
						method(true, xmlcache[props.type]);
						return;
					}
				}
			}
			props.token = _token;
			++id;
			// console.log( [ "AUTH [" + id + "] OUT", props ]);
			$.ajax( _basepath + NAMESPACE + "-gateway.php", {
				data: props,
				dataType: "text",
				method: "POST",
				context: {
					id: id,
					props: props,
					target: target,
					method: method
				},
				success: function (data, status, obj) {
					var params = unserialize(data);
					// console.log( [ "AUTH [" + this.id + "] IN", this.props, decodeURIComponent(data), params ]);
					if (this.props.action) {
						if (this.props.action=="setup_defaults") {
							xmlcache[this.props.type] = params.r;
						}
					}
					this.method(params.s=="true", params.r);
				},
				error: function () {
					this.method(false, "404");
				}
			});
		}
		function onStart (ev) {
			if (ev.lengthComputable) {
				_uploader_curent.method("start", { loaded:0, total:ev.total });
			} else {
				_uploader_curent.method("start", { loaded:0, total:0 });
			}
		}
		function onAbort (ev) {
			_uploader_curent.method("abort");
		}
		function onFail (ev) {
			_uploader_curent.method("fail", { success:false, response:"404" });
		}
		function onLoaded (ev) {
			var data = _uploader.responseText;
			var params = unserialize(data);
			// console.log( [ "AUTH [" + _uploader_curent.id + "] IN", _uploader_curent.post, decodeURIComponent(data), params ]);
			_uploader_curent.method("loaded", { success:params.s=="true", response:params.r });
		}
		function onProgress (ev) {
			if (ev.lengthComputable) {
				//console.log(ev.loaded + ", " + ev.total + ", " + (ev.loaded / ev.total) );
				_uploader_curent.method("progress", { loaded:ev.loaded, total:ev.total });
			}
		}
		function doUpload (target, method, file, props) {
			/*
				setup the new call
				*/
			props.token = _token;
			++id;
			/*
				create a form object
				*/
			var post = new FormData();
			post.append("Filedata", file);
			for (var prop in props) {
				post.append(prop, props[prop]);
			}
			/*
				save the current context
				*/
			_uploader_curent = {
				id: id,
				file: file,
				props: props,
				method: method,
				target: target
			}
			// console.log( [ "AUTH [" + id + "] OUT", file, props ]);
			/*
				send it out
				*/
			_uploader.open(
				"POST",
				_basepath + NAMESPACE + "-gateway.php",
				true
			);
			_uploader.setRequestHeader("Cache-Control", "no-cache");
			_uploader.send(post);
		}
		/* public methods
			*/
		this.token = function(str) {
			if (str) {
				_token = str;
				Cookie.set("token", _token, 14);
			}
			return _token;
		};
		this.indexpath = function(str) {
			if (str) {
				_indexpath = str;
			}
			return _indexpath;
		};
		this.corepath = function(str) {
			if (str) {
				_corepath = str;
			}
			return _corepath;
		};
		this.datapath = function(str) {
			if (str) {
				_datapath = str;
			}
			return _datapath;
		};
		this.provideruri = function(str) {
			if (str) {
				_provideruri = str;
			}
			return _provideruri;
		};
		this.basepath = function(str) {
			if (str) {
				_basepath = str;
			}
			return _basepath;
		};
		this.basepathabsolute = function(str) {
			if (str) {
				_basepathabsolute = str;
			}
			return _basepathabsolute;
		};
		this.verify = function() {
			authenticate();
		};
		this.start = function() {
			go();
		};
		this.send = function(obj, method, props) {
			doSend(obj, method, props);
		};
		this.upload = function(target, method, progress, file, props) {
			doUpload(target, method, progress, file, props);
		};
		this.abort = function() {
			_uploader.abort();
		};
		this.unsubscribe = function(type, func) {
			_instance.removeEventListener(type, func);
		};
		this.subscribe = function(type, func) {
			_instance.addEventListener(type, func);
		};
		this.deliver = function(obj) {
			_instance.dispatch(obj);
		};
		this.initialize = function () {
			
			Admin = classes.Admin;
			Cookie = classes.helpers.Cookie;
			
			_uploader = new XMLHttpRequest(),
			_uploader.upload.addEventListener("abort", onAbort, false);
			_uploader.upload.addEventListener("loadstart", onStart, false);
			_uploader.upload.addEventListener("progress", onProgress, false);
			_uploader.upload.addEventListener("error", onFail, false);
        	_uploader.addEventListener("load", onLoaded, false);
			
			_basepathabsolute = window.location.protocol;
			_basepathabsolute += "//";
			_basepathabsolute += window.location.hostname;
			var pathname = window.location.pathname;
				pathname = pathname.split("/");
				pathname.pop();
				pathname = pathname.join("/");
			_basepathabsolute += pathname;
			_basepathabsolute += "/";
			
			_token = Cookie.get("token");
			
		};
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());
