
/*jslint browser: true, continue: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.Session = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		var Checkout; // shortcut
		var Overlay; // shortcut
		var Func; // shortcut
		/* private properites
			*/
		var instance = this;
		var hash = "";
		var request_id = -1;
		var requests = {};
		var type_lookup = {
			cart: [],
			cart_chunked: [],
			download: [],
			download_chunked: [],
			favorites: [],
			favorites_chunked: [],
			package: [],
			parsed: []
		};
		var type_hashtable = {
			cart: {},
			download: {},
			favorites: {},
			package: {},
			parsed: {}
		};
		var type_keys = {
			cart: [
				"hash", "puid", "cuid", // 0 1 2
				"filename", "quantity", "toning", // 3 4 5
				"format_label", "format_aspect", "format_price", "format_shipping", // 6 7 8 9
				"orientation", "orientation_x", "orientation_y", // 10 11 12
				"paper_label", "paper_price", "paper_shipping", // 13 14 15
				"modifier_label", "modifier_price", "modifier_shipping", // 16 17 18
				"subtotal", "shipping", // 19 20
				"comments" // 21
				],
			download: [
				"hash", "puid", "cuid", // 0 1 2
				"filename", "dimensions", "quality", // 3 4 5
				"subtotal", "allprice" // 6 7
				],
			favorites: [
				"hash", "puid", "cuid", // 0 1 2
				"filename", "width", "height" // 3 4 5
				],
			package: [
				"hash", "type", "nickname", "title",// 0 1 2 3
				"quantity", "subtotal", "shipping", // 4 5 6
				"format_titles", // 7
				"format_quantities", // 8
				"format_aspects", // 9
				"format_areas" // 10
				]
		};
		/* private methods
			*/
		function chunk (label) {
			var arr = type_lookup[label];
			var page_breakpoint = Overlay.getMaxImageCount();
			var chunks = [];
			if (arr.length<=page_breakpoint) {
				chunks.push(arr);
			} else {
				chunks = Func.array_chunk(arr, page_breakpoint);
			}
			type_lookup[label+"_chunked"] = chunks;
		}
		function parse (result, ruid) {
			if (result=="0") {
				result = "";
			}
			var request = requests[ruid];
			//trace ("type:" + request.type);
			//trace ("result: " + result);
			var types = [];
				if (request.type=="favorites" || request.type=="*") {
					types.push("favorites");
				}
				if (request.type=="download" || request.type=="alacarte" || request.type=="cart" || request.type=="package" || request.type=="*") {
					types.push("package");
					types.push("cart");
					types.push("download");
				}
			// low-level string parsing
			var lines = result=="" ? [] : result.split("\n");
			var rows = [];
			var i, line, values, suid, type;
			for (i=0; i<lines.length; ++i) {
				line = lines[i];
				values = line.split("\t");
				suid = values[0].split("-");
				type = "cart";
				if (suid[1]=="f") {
					type = "favorites";
				}
				if (suid[1]=="p") {
					type = "package";
				}
				if (suid[1]=="d") {
					type = "download";
				}
				rows.push({
					type: type,
					values: values
				});
			}
			// parse out all the bits and pieces
			var k, j, keys, data, table, row, obj, key, value;
			for (k=0; k<types.length; ++k) {
				type = types[k];
				keys = type_keys[type];
				data = [];
				table = {};
				for (i=0; i<rows.length; ++i) {
					row = rows[i];
					if (row.type!=type) {
						continue;
					}
					values = row.values;
					obj = {};
					for (j=0; j<keys.length; ++j) {
						key = keys[j];
						value = values[j];
						if (value==undefined) {
							value = "";
						}
						obj[key] = value;
					}
					data.push(obj);
					table[obj.hash] = obj;
				}
				type_lookup[type] = data;
				type_hashtable[type] = table;
			}
			// do a custom parse for packages
			if (request.type=="cart" || request.type=="package" || request.type=="*") {
				var package_lookup = [];
				var packages = type_lookup["package"];
				type_lookup.parsed = [];
				var pkg, total, formats, lookup, format_percent_encoded, format_titles, format_quantities, format_aspects, format_areas, format_title, format_hash, format_quantity;
				for (i=0; i<packages.length; ++i) {
					pkg = packages[i];
					total = 0;
					formats = [];
					lookup = {};
					format_percent_encoded = false;
					format_titles = pkg.format_titles;
					if (pkg.format_titles.substr(0, 2)=="%:") {
						format_percent_encoded = true;
						format_titles = pkg.format_titles.substr(2);
					}
					format_titles = format_titles=="" ? [] : format_titles.split(",");
					format_quantities = pkg.format_quantities.split(",");
					format_aspects = pkg.format_aspects.split(",");
					format_areas = pkg.format_areas.split(",");
					for (j=0; j<format_titles.length; ++j) {
						format_title = format_percent_encoded ? unescape(format_titles[j]) : $.base64.decode(format_titles[j]);
						format_hash = md5(format_title);
						format_quantity = parseInt(format_quantities[j], 10);
						total += format_quantity;
						lookup[format_hash] = j;
						formats.push({
							title: format_title,
							price: 0,
							shipping: 0,
							aspect: format_aspects[j],
							area: format_areas[j],
							total: format_quantity,
							count: 0
						});
					}
					package_lookup[pkg.hash] = i;
					type_lookup.parsed.push({
						row: pkg,
						formats: formats,
						lookup: lookup,
						total: total,
						count: 0
					});
				}
				var cart = type_lookup.cart;
				var hashbits, package_hash, format, quantity;
				for (i=0; i<cart.length; ++i) {
					row = cart[i];
					if (row.hash.indexOf(":")!=-1) {
						hashbits = row.hash.split(":");
						package_hash = hashbits[1] + "-p";
						format_hash = md5(row.format_label);
						quantity = parseInt(row.quantity, 10);
						pkg = type_lookup.parsed[package_lookup[package_hash]];
						format = pkg.formats[pkg.lookup[format_hash]];
						pkg.count += quantity;
						format.count += quantity;
					}
				}
			}
			if (request.type=="favorites") {
				chunk("favorites");
				instance.dispatch("onSessionFavorites");
			}
			if (request.type=="download" || request.type=="alacarte" || request.type=="cart" || request.type=="package") {
				chunk("cart");
				chunk("download");
				instance.dispatch("onSessionCart");
			}
			if (request.type=="*") {
				chunk("favorites");
				chunk("download");
				chunk("cart");
				instance.dispatch("onSessionLoaded");
			}
			delete requests[ruid];
		}
		function addSessionObject (type, data) {
			if (data.hash==undefined) {
				return;
			}
			// generate new row
			var keys = type_keys[type];
			var postfix = "";
				if (type=="favorites") {
					postfix = "-f";
				}
				if (type=="download") {
					postfix = "-d";
				}
				if (type=="package") {
					postfix = "-p";
				}
			var row = [];
			var i, key, value;
			for (i=0; i<keys.length; ++i) {
				key = keys[i];
				value = data[key];
				if (value==undefined) {
					value = "";
				}
				row.push(value);
			}
			row[0] = row[0] + postfix;
			// add it to the session table
			++request_id;
			var ruid = "r_"+request_id;
			var request = {
				action: 	"update_session_item",
				type: 		type,
				name: 		hash,
				puid: 		Overlay.pageid(),
				data:		row.join("\t")
			};
			requests[ruid] = request;
			$.post( APP_ROOT + "vend-proofing-gateway.php", request, function (str) {
				parse(str, ruid);
			});
		}
		function removeSessionObject (type, suid) {
			var data;
			var found = false;
			var lookup = type_lookup[type];
			var i;
			for (i=0; i<lookup.length; ++i) {
				data = lookup[i];
				if (data.hash.indexOf(suid)!=-1) {
					found = true;
					break;
				}
			}
			if (found==false) {
				return;
			}
			// add it to the session table
			++request_id;
			var ruid = "r_"+request_id;
			var request = {
				action: 	"delete_session_item",
				type: 	type,
				name: 	hash,
				puid: 	Overlay.pageid(),
				suid:		data.hash
			};
			requests[ruid] = request;
			$.post( APP_ROOT + "vend-proofing-gateway.php", request, function (str) {
				parse(str, ruid);
			});
		}
		function updateSessionObject (type, suid, names, values) {
			// get the lineitem we're working with
			var data;
			var found = false;
			var lookup = type_lookup[type];
			var i;
			for (i=0; i<lookup.length; ++i) {
				data = lookup[i];
				if (data.hash.indexOf(suid)!=-1) {
					found = true;
					break;
				}
			}
			if (found==false) {
				return;
			}
			// if not arrays, let's make them arrays
			if (!(names instanceof Array)) {
				names = [names];
				values = [values];
			}
			// update key values for each item we're updating
			var keys = type_keys[type];
			var row = [];
			var postfix = "";
				if (type=="download") {
					postfix = "-d";
				}
				if (type=="favorites") {
					postfix = "-f";
				}
				if (type=="package") {
					postfix = "-p";
				}
			var j, key, value;
			for (i=0; i<keys.length; ++i) {
				key = keys[i];
				value = data[key];
				for (j=0; j<names.length; ++j) {
					if (key==names[j]) {
						value = values[j];
					}
				}
				if (value==undefined) {
					value = "";
				}
				row.push(value);
			}
			row[0] = row[0] + postfix;
			// add it to the session table
			++request_id;
			var ruid = "r_"+request_id;
			var request = {
				action: 	"update_session_item",
				type: 		type,
				name: 		hash,
				puid: 		Overlay.pageid(),
				data:		row.join("\t")
			};
			requests[ruid] = request;
			$.post( APP_ROOT + "vend-proofing-gateway.php", request, function (str) {
				parse(str, ruid);
			});
		}
		function addAllOfType (group, quality) {
			++request_id;
			var ruid = "r_"+request_id;
			var price = group=="cart" ? Checkout.settings().downloads.all[quality] : Checkout.settings().downloads[quality].price;
			var flat = group=="cart" && Checkout.settings().downloads.all.flat ? "true" : "false";
			var request = {
				action: 	"add_all_of_type",
				name: 		hash,
				type: 		"download",
				group: 		group,
				quality: 	quality,
				price: 		price,
				flat: 		flat,
				puid: 		Overlay.pageid()
			};
			requests[ruid] = request;
			$.post( APP_ROOT + "vend-proofing-gateway.php", request, function (str) {
				parse(str, ruid);
			});
		}
		function clearSessionType (type) {
			instance.dispatch("onLoadSession");
			++request_id;
			var ruid = "r_"+request_id;
			var request = {
				action: 	"delete_session_type",
				type: 		type,
				name: 		hash,
				puid: 		Overlay.pageid()
			};
			requests[ruid] = request;
			$.post( APP_ROOT + "vend-proofing-gateway.php", request, function (str) {
				parse(str, ruid);
			});
		}
		function loadSession () {
			++request_id;
			var ruid = "r_"+request_id;
			var request = {
				action: 	"list_session_table",
				type: 		"*",
				name: 		hash,
				puid: 		Overlay.pageid()
			};
			$.post( APP_ROOT + "vend-proofing-gateway.php", request, function (str) {
				parse(str, ruid);
			});
			requests[ruid] = request;
		}
		/* public methods
			*/
		this.addItem = function(type, data) { // type:String, data:Object
			addSessionObject(type, data);
		};
		this.removeItem = function(type, suid) { // type:String, suid:String
			removeSessionObject(type, suid);
		};
		this.updateItem = function(type, suid, names, values) { // type:String, suid:String, names, values
			updateSessionObject(type, suid, names, values);
		};
		this.purge = function(type) { // type:String
			clearSessionType(type);
		};
		
		this.isFavoritesEmpty = function() { // return:Boolean
			return type_lookup.favorites.length==0;
		};
		this.getFavoritesLength = function() { // return:Array
			return type_lookup.favorites.length;
		};
		this.getFavoritesPaged = function(i) { // return:Array
			return i==undefined || i==-1 ? type_lookup.favorites_chunked : type_lookup.favorites_chunked[i];
		};
		this.getFavorites = function() { // return:Array
			return type_lookup.favorites;
		};
		this.getFavoritesTable = function() { // return:Object
			return type_hashtable.favorites;
		};
		this.getFavoriteObject = function(hash) { // return:Object
			return type_hashtable.favorites[hash];
		};
		
		this.isCartEmpty = function() { // return:Boolean
			return type_lookup.cart.length==0;
		};
		this.getCartLength = function() { // return:Number
			return type_lookup.cart.length;
		};
		this.getCartPaged = function(i) { // return:Array
			return i==undefined || i==-1 ? type_lookup.cart_chunked : type_lookup.cart_chunked[i];
		};
		this.getCart = function() { // return:Array
			return type_lookup.cart;
		};
		this.getCartTable = function() { // return:Object
			return type_hashtable.cart;
		};
		this.getCartObject = function(hash) { // return:Object
			return type_hashtable.cart[hash];
		};
		
		this.downloadAll = function(group, quality) { // group:String, quality:Object
			addAllOfType(group, quality);
		};
		this.isDownloadsEmpty = function() { // return:Boolean
			return type_lookup.download.length==0;
		};
		this.getDownloadsLength = function() { // return:Number
			return type_lookup.download.length;
		};
		this.getDownloadsPaged = function(i) { // return:Array
			return i==undefined || i==-1 ? type_lookup.download_chunked : type_lookup.download_chunked[i];
		};
		this.getDownloads = function() { // return:Array
			return type_lookup.download;
		};
		this.getDownloadsTable = function() { // return:Array
			return type_hashtable.download;
		};
		this.getDownloadObject = function(hash) { // return:Object
			return type_hashtable.download[hash];
		};
		
		this.getPackages = function() { // return:Array
			return type_lookup.package;
		};
		this.getPackagesLength = function() { // return:Number
			return type_lookup.package.length;
		};
		this.getPackagesParsed = function() { // return:Array
			return type_lookup.parsed;
		};
		
		this.getHash = function() { // return:String
			return hash;
		};
		this.setHash = function(str) { // str:String
			hash = str;
			loadSession();
		};
		
		this.initialize = function() {
			Checkout = classes.overlay.Checkout;
			Overlay = classes.Overlay;
			Func = classes.helpers.Func;
		};
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());
