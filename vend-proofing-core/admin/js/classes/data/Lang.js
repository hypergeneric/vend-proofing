
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.data.Lang = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var Auth;
		var Func;
		/* private properites
			*/
		var _instance = this;
		var _existsAlwaysTrue = true;
		var _code = "en";
		var log = {};
		var data;
		var str_table;
		var set_table;
		/* private methods
			*/
		function load () {
			$.ajax( Auth.basepath() + Auth.corepath() + "/lang/" + _code + ".xml", {
				cache: false,
				dataType: "xml",
				method: "get",
				success: function (str, status, obj) {
					data = Func.xmlToJson(str);
					//console.log(data);
					_instance.dispatch("onLoaded");
				},
				error: function () {
					if (_code!="en") {
						_code = "en";
						load();
					}
				}
			});
		}
		/* public methods
			*/
		this.out = function() {
			for (var prop in log) console.log('<' + prop + ' name="' + log[prop] + '" />');
		};
		this.exists = function(name) {
			if (_existsAlwaysTrue) return true;
			name = name.split(" ").join("_").toLowerCase();
			var str = "";
			var response = false;
			try {
				str = data.data[name]._attributes.name;
				response = true;
			}
			catch(err) {}
			return response;
		};
		this.lookup = function(name) {
			if (name==undefined) return "";
			name = name.split(" ").join("_").toLowerCase();
			var str = "";
			try {
				if (data.data[name].length>0) {
					str = data.data[name][0]._attributes.name;
				} else {
					str = data.data[name]._attributes.name;
				}
			}
			catch(err) {
			//	console.log(["looking up " + name, data]);
				str = name.split("_").join(" ");
				str = str.split(" ");
				for (var i=0; i<str.length; ++i) str[i] = str[i].substring(0,1).toUpperCase() + str[i].substring(1);
				str = str.join(" ");
				if (!log[name]) {
					log[name] = str;
				}
				//str = "{" + str + "}";
			}
			return str;
		};
		this.sets = function(name) {
			var path = name.split(".");
			var node = data.data;
			for (var i=0; i<path.length; ++i) {
				var segment = path[i];
				node = node[path[i]];
			}
			var arr = new Array();
			try {
				for (var i=0; i<node.length; ++i) {
					arr.push({
						label: node[i]._attributes.name,
						data: node[i]._attributes.value
					});
				}
			}
			catch(err) {
				arr.push({
					label: "No Options Available In Lang",
					data: ""
				});
			}
			return arr;
		};
		this.code = function(str) {
			if (str) {
				_code = str;
				load();
			}
			return _code;
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
			Auth = classes.data.Auth;
			Func = classes.helpers.Func;
			/*_existsAlwaysTrue = System.capabilities.playerType=="External" 
			|| _level0._url.substring(0, 23)=="http://dev.wildpoly.com" 
			|| _level0._url.substring(0, 30)=="http://dev.intothedarkroom.com" 
			|| _level0._url.substring(0, 26)=="http://intothedarkroom.com";*/
		};
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());
