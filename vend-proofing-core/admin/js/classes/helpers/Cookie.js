
/*jslint browser: true, continue: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.helpers.Cookie = (function () {
	function Constructor () {
		/* public methods
			*/
		this.set = function(name, value, days, path) {
			if (!path) {
				path = location.pathname.split("/");
				path.pop();
				path = path.join("/") + "/";
			}
			var expires = "";
			if (days) {
				var date = new Date();
				date.setTime(date.getTime()+(days*24*60*60*1000));
				expires = "; expires="+date.toGMTString();
			}
			document.cookie = name+"="+value+expires+"; path=" + path;
		};
		this.get = function(name) {
			var nameEQ = name + "=";
			var ca = document.cookie.split(';');
			var i, c;
			for(i=0; i< ca.length; i++) {
				c = ca[i];
				while (c.charAt(0)==' ') {
					c = c.substring(1, c.length);
				}
				if (c.indexOf(nameEQ) == 0) {
					return c.substring(nameEQ.length, c.length);
				}
			}
			return "";
		};
		this.kill = function(name, path) {
			if (!path) {
				path = location.pathname.split("/");
				path.pop();
				path = path.join("/") + "/";
			}
			this.set(name,"",-1, path);
		};
	}
	return new Constructor();
}());
