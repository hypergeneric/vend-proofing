
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.helpers.History = (function () {
	function Constructor () {
		/* private properites
			*/
		var _instance = this;
		var HASH;
		/* private methods
			*/
		function start (hash) {
			var result = location.hash.substring(1);
			if (result=="null"||result==""||result==null||result==undefined) result = hash;
			setState(result);
		}
		function setState (hash) {
			if (HASH!=hash) {
				HASH = hash;
				_instance.dispatch("history", HASH);
				location.hash = HASH;
			}
		}
		function hashchange () {
			setState(location.hash.substring(1));
		}
		/* public methods
			*/
		this.unsubscribe = function(type, func) {
			_instance.removeEventListener(type, func);
		};
		this.subscribe = function(type, func) {
			_instance.addEventListener(type, func);
		};
		this.getHistory = function() {
			if (HASH==undefined) return location.hash;
			else return HASH;
		};
		this.setHistory = function(hash) {
			setState(hash);
		};
		this.initialize = function (hash) {
			$(window).hashchange(hashchange);
			start(hash);
		};
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());
