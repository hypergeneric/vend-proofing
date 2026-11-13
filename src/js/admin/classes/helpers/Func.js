
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.helpers.Func = (function () {
	function Constructor () {
		/* private properites
			*/
		var self = this;
		var id = 0;
		var browser_title_pattern = "";
		/* private methods
			*/
		/* public methods
			*/
		this.openWindowWithPost = function (url, data) {
			var form = document.createElement("form");
			form.target = "_blank";
			form.method = "POST";
			form.action = url;
			form.style.display = "none";
			for (var key in data) {
				var input = document.createElement("input");
				input.type = "hidden";
				input.name = key;
				input.value = data[key];
				form.appendChild(input);
			}
			document.body.appendChild(form);
			form.submit();
			document.body.removeChild(form);
		};
		this.authDropbox = function () {
			classes.helpers.Func.openWindowWithPost(classes.data.Auth.basepath() + NAMESPACE + "-gateway.php", {
				action: "authorize_dropbox",
				token: classes.data.Auth.token()
			});
		};
		this.testMail = function () {
			classes.helpers.Func.openWindowWithPost(classes.data.Auth.basepath() + NAMESPACE + "-gateway.php", {
				action: "test_mail_setup",
				token: classes.data.Auth.token()
			});
		};
		this.toFixed = function (value, length) {
			if (length == 0) return (Math.round(value)).toString();
			var m = Math.pow(10, length);
			var result = (Math.round(value * m) / m).toString();
			if (result.indexOf('.') == -1)
				result += '.0';
			var dec;
			while (result.split('.')[1].length < length)
				result += '0';
			return result;
		};
		this.cleanTitleFragment = function(str) {
			str = classes.helpers.Func.remove_accent(str);
			str = classes.helpers.Func.homogenize(str);
			var checkempty = str.split("-").join("");
			if (checkempty=="") return "";
			return str;
		};
		this.homogenize = function(str) {
			str = str.split(" ").join("_");
			str = str.toLowerCase();
			var result = "";
			for (var i=0; i<str.length; i++) {
				var char = str.substr(i, 1);
				var code = char.charCodeAt();
				if ((code>47&&code<58)||(code>96&&code<123)||code==95) result += char;
			}
			return result;
		};
		this.remove_accent = function(str) {
			var a = ['À', 'Á', 'Â', 'Ã', 'Ä', 'Å', 'Æ', 'Ç', 'È', 'É', 'Ê', 'Ë', 'Ì', 'Í', 'Î', 'Ï', 'Ð', 'Ñ', 'Ò', 'Ó', 'Ô', 'Õ', 'Ö', 'Ø', 'Ù', 'Ú', 'Û', 'Ü', 'Ý', 'ß', 'à', 'á', 'â', 'ã', 'ä', 'å', 'æ', 'ç', 'è', 'é', 'ê', 'ë', 'ì', 'í', 'î', 'ï', 'ñ', 'ò', 'ó', 'ô', 'õ', 'ö', 'ø', 'ù', 'ú', 'û', 'ü', 'ý', 'ÿ', 'A', 'a', 'A', 'a', 'A', 'a', 'C', 'c', 'C', 'c', 'C', 'c', 'C', 'c', 'D', 'd', 'Ð', 'd', 'E', 'e', 'E', 'e', 'E', 'e', 'E', 'e', 'E', 'e', 'G', 'g', 'G', 'g', 'G', 'g', 'G', 'g', 'H', 'h', 'H', 'h', 'I', 'i', 'I', 'i', 'I', 'i', 'I', 'i', 'I', 'i', '?', '?', 'J', 'j', 'K', 'k', 'L', 'l', 'L', 'l', 'L', 'l', '?', '?', 'L', 'l', 'N', 'n', 'N', 'n', 'N', 'n', '?', 'O', 'o', 'O', 'o', 'O', 'o', 'Œ', 'œ', 'R', 'r', 'R', 'r', 'R', 'r', 'S', 's', 'S', 's', 'S', 's', 'Š', 'š', 'T', 't', 'T', 't', 'T', 't', 'U', 'u', 'U', 'u', 'U', 'u', 'U', 'u', 'U', 'u', 'U', 'u', 'W', 'w', 'Y', 'y', 'Ÿ', 'Z', 'z', 'Z', 'z', 'Ž', 'ž', '?', 'ƒ', 'O', 'o', 'U', 'u', 'A', 'a', 'I', 'i', 'O', 'o', 'U', 'u', 'U', 'u', 'U', 'u', 'U', 'u', 'U', 'u', '?', '?', '?', '?', '?', '?'];
			var b = ['A', 'A', 'A', 'A', 'A', 'A', 'AE', 'C', 'E', 'E', 'E', 'E', 'I', 'I', 'I', 'I', 'D', 'N', 'O', 'O', 'O', 'O', 'O', 'O', 'U', 'U', 'U', 'U', 'Y', 's', 'a', 'a', 'a', 'a', 'a', 'a', 'ae', 'c', 'e', 'e', 'e', 'e', 'i', 'i', 'i', 'i', 'n', 'o', 'o', 'o', 'o', 'o', 'o', 'u', 'u', 'u', 'u', 'y', 'y', 'A', 'a', 'A', 'a', 'A', 'a', 'C', 'c', 'C', 'c', 'C', 'c', 'C', 'c', 'D', 'd', 'D', 'd', 'E', 'e', 'E', 'e', 'E', 'e', 'E', 'e', 'E', 'e', 'G', 'g', 'G', 'g', 'G', 'g', 'G', 'g', 'H', 'h', 'H', 'h', 'I', 'i', 'I', 'i', 'I', 'i', 'I', 'i', 'I', 'i', 'IJ', 'ij', 'J', 'j', 'K', 'k', 'L', 'l', 'L', 'l', 'L', 'l', 'L', 'l', 'l', 'l', 'N', 'n', 'N', 'n', 'N', 'n', 'n', 'O', 'o', 'O', 'o', 'O', 'o', 'OE', 'oe', 'R', 'r', 'R', 'r', 'R', 'r', 'S', 's', 'S', 's', 'S', 's', 'S', 's', 'T', 't', 'T', 't', 'T', 't', 'U', 'u', 'U', 'u', 'U', 'u', 'U', 'u', 'U', 'u', 'U', 'u', 'W', 'w', 'Y', 'y', 'Y', 'Z', 'z', 'Z', 'z', 'Z', 'z', 's', 'f', 'O', 'o', 'U', 'u', 'A', 'a', 'I', 'i', 'O', 'o', 'U', 'u', 'U', 'u', 'U', 'u', 'U', 'u', 'U', 'u', 'A', 'a', 'AE', 'ae', 'O', 'o'];
			for (var i=0; i<a.length; ++i) {
				str = str.split(a[i]).join(b[i]);
			}
			return str;
		};
		this.uniquid = function() {
			id += 1;
			return md5(id);
		};
		this.array_chunk = function(arr, len) {
			var chunks = [],
				i = 0,
				n = arr.length,
				start, end;
			while (i < n) {
				start = i;
				end = i + len;
				chunks.push(arr.slice(start, end));
				i += len;
			}
			return chunks;
		};
		this.setDocumentTitlePattern = function(str) {
			browser_title_pattern = str;
		};
		this.setDocumentTitle = function(title) {
			if (!title) {
				title = "";
			}
			var browser_title = browser_title_pattern.split("{PAGE_NAME}").join(title);
			document.title = browser_title;
		};
		this.getCheckeredBackgroundSrc = function() {
			return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAGklEQVQYlWM4c+bMf3TMgA0MBYWDzDkUKQQAlHCpV9ycHeMAAAAASUVORK5CYII=";
		};
		this.getEmptyImgSrc = function() {
			return "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
		};
		this.stop = function(event) {
			event.stopPropagation();
			event.preventDefault();
		};
		this.prevent = function(event) {
			event.preventDefault();
		};
		this.empty = function() {
			return null;
		};
		this.imgonload = function() {
			if(this.complete) {
				$(this).load();
			}
		};
		this.touchboundsstart = function(event) {
			this.allowUp = (this.scrollTop > 0);
			this.allowDown = (this.scrollTop < this.scrollHeight - this.clientHeight);
			this.prevTop = null; this.prevBot = null;
			this.lastY = event.pageY;
		};
		this.touchboundsmove = function(event) {
			var up = (event.pageY > this.lastY), down = !up;
			this.lastY = event.pageY;
			if ((up && this.allowUp) || (down && this.allowDown)) event.stopPropagation();
			else event.preventDefault();
		};
		this.secondsToTime = function (secs) {
			var hours = Math.floor(secs / (60 * 60));
			var divisor_for_minutes = secs % (60 * 60);
			var minutes = Math.floor(divisor_for_minutes / 60);
			var divisor_for_seconds = divisor_for_minutes % 60;
			var seconds = Math.ceil(divisor_for_seconds);
			var result = "";
			if (hours>0) {
				if (hours<9) result += "0";
				result += hours + ":";
				if (minutes<9) result += "0";
				result += minutes + ":";
				if (seconds<9) result += "0";
				result += seconds;
			} else {
				if (minutes>0) {
					if (minutes<9) result += "0";
					result += minutes + ":";
					if (seconds<9) result += "0";
					result += seconds;
				} else {
					result += seconds + " s";
				}
			}
			return result;
		};
		this.getByteString = function (str) {
			var bytes = parseInt(str);
			if (bytes>=1048576) {
				var size = bytes/1048576;
				size = Math.round((size)*100)/100;
				size += " MB";
			} else {
				var size = bytes/1024;
				size = Math.round((size)*100)/100;
				size += " KB";
			}
			return size;
		};
		this.htmlspecialchars = function (string, quoteStyle, charset, doubleEncode) {
			//       discuss at: http://locutus.io/php/htmlspecialchars/
			//      original by: Mirek Slugen
			//      improved by: Kevin van Zonneveld (http://kvz.io)
			//      bugfixed by: Nathan
			//      bugfixed by: Arno
			//      bugfixed by: Brett Zamir (http://brett-zamir.me)
			//      bugfixed by: Brett Zamir (http://brett-zamir.me)
			//       revised by: Kevin van Zonneveld (http://kvz.io)
			//         input by: Ratheous
			//         input by: Mailfaker (http://www.weedem.fr/)
			//         input by: felix
			// reimplemented by: Brett Zamir (http://brett-zamir.me)
			//           note 1: charset argument not supported
			//        example 1: htmlspecialchars("<a href='test'>Test</a>", 'ENT_QUOTES')
			//        returns 1: '&lt;a href=&#039;test&#039;&gt;Test&lt;/a&gt;'
			//        example 2: htmlspecialchars("ab\"c'd", ['ENT_NOQUOTES', 'ENT_QUOTES'])
			//        returns 2: 'ab"c&#039;d'
			//        example 3: htmlspecialchars('my "&entity;" is still here', null, null, false)
			//        returns 3: 'my &quot;&entity;&quot; is still here'
			var optTemp = 0
			var i = 0
			var noquotes = false
			if (typeof quoteStyle === 'undefined' || quoteStyle === null) {
				quoteStyle = 2
			}
			string = string || ''
			string = string.toString()
			if (doubleEncode !== false) {
				// Put this first to avoid double-encoding
				string = string.replace(/&/g, '&amp;')
			}
			string = string
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
			var OPTS = {
				'ENT_NOQUOTES': 0,
				'ENT_HTML_QUOTE_SINGLE': 1,
				'ENT_HTML_QUOTE_DOUBLE': 2,
				'ENT_COMPAT': 2,
				'ENT_QUOTES': 3,
				'ENT_IGNORE': 4
			}
			if (quoteStyle === 0) {
				noquotes = true
			}
			if (typeof quoteStyle !== 'number') {
				// Allow for a single string or an array of string flags
				quoteStyle = [].concat(quoteStyle)
				for (i = 0; i < quoteStyle.length; i++) {
					// Resolve string input to bitwise e.g. 'ENT_IGNORE' becomes 4
					if (OPTS[quoteStyle[i]] === 0) {
						noquotes = true
					} else if (OPTS[quoteStyle[i]]) {
						optTemp = optTemp | OPTS[quoteStyle[i]]
					}
				}
				quoteStyle = optTemp
			}
			if (quoteStyle & OPTS.ENT_HTML_QUOTE_SINGLE) {
				string = string.replace(/'/g, '&#039;')
			}
			if (!noquotes) {
				string = string.replace(/"/g, '&quot;')
			}
			return string;
		};

	}
	return new Constructor();
}());
