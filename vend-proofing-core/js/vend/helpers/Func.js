
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.helpers.Func = (function () {
	function Constructor () {
		/* private properites
			*/
		var browser_title_pattern = "";
		var filtersepia = {
			r: [0.211836996078431,0.712355450980392,0.0718859843137255],
			g: [0.198492933333333,0.667482666666667,0.0673577333333333],
			b: [0.190986898039216,0.642241725490196,0.0648105921568627]
		};
		var filtermono = {
			r: [0.212671,0.71516,0.072169],
			g: [0.212671,0.71516,0.072169],
			b: [0.212671,0.71516,0.072169]
		};
		/* private methods
			*/
		function filterexec (img, tone) {
			if ( img.width==0 || img.height==0 ) {
				return;
			}
			var canvas = document.createElement('canvas');
			var context = canvas.getContext('2d');
			canvas.width = img.width;
			canvas.height = img.height;
			context.drawImage(img, 0, 0);
			var imgdata = context.getImageData(0, 0, canvas.width, canvas.height);
			var matrix = tone=="sepia" ? filtersepia : filtermono;
			var pixels = imgdata.data;
			var i, n, shift_r, shift_g, shift_b;
			for (i = 0, n = pixels.length; i < n; i += 4) {
				shift_r = pixels[i] * matrix.r[0] + pixels[i+1] * matrix.r[1] + pixels[i+2] * matrix.r[2];
				shift_g = pixels[i] * matrix.g[0] + pixels[i+1] * matrix.g[1] + pixels[i+2] * matrix.g[2];
				shift_b = pixels[i] * matrix.b[0] + pixels[i+1] * matrix.b[1] + pixels[i+2] * matrix.b[2];
				pixels[i] = shift_r;
				pixels[i+1] = shift_g;
				pixels[i+2] = shift_b;
			}
			context.putImageData(imgdata, 0, 0);
			return canvas.toDataURL();
		}
		/* public methods
			*/
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
		this.getEmptyImgSrc = function() {
			return "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
		};
		this.addSalesTax = function(taxable_amount) {
			var default_country = classes.overlay.Checkout.settings().country;
			var taxes = classes.overlay.Checkout.getTaxRate();
			var tax_value;
			if (default_country=="US") {
				tax_value = taxable_amount*(taxes[0]/100);
				return taxable_amount + tax_value;
			}
			if (default_country=="CA") {
				var hst_value = taxable_amount*(taxes[0]/100);
				var gst_value = taxable_amount*(taxes[1]/100);
					if (taxes[3]==true) {
						taxable_amount += gst_value;
					}
				var pst_value = taxable_amount*(taxes[2]/100);
				return taxable_amount + hst_value + gst_value + pst_value;
			}
			tax_value = taxable_amount*(taxes[0]/100);
			return taxable_amount + tax_value;
		};
		this.getFormattedPrice = function(value) {
			var isNegative = value<0;
			value = Math.abs(value);
			var digitsAfterDecimal = classes.helpers.L10N.get("localization", "currency_digits_after_decimal_num");
			var displayLeadingZeros = classes.helpers.L10N.get("localization", "currency_display_leading_zeros_bool");
			var leadingZeroDigits = classes.helpers.L10N.get("localization", "currency_leading_zero_digits_num");
			var digitsPerGroup = classes.helpers.L10N.get("localization", "currency_digits_per_group_num");
			var groupingSymbol = classes.helpers.L10N.get("localization", "currency_grouping_symbol");
			var decimalSymbol = classes.helpers.L10N.get("localization", "currency_decimal_symbol");
			var negativePattern = classes.helpers.L10N.get("localization", "currency_negative_pattern");
			var currencyPattern = classes.helpers.L10N.get("localization", "currency_currency_pattern");
			var vstr = value.toFixed(digitsAfterDecimal);
			var sides = vstr.split(".");
			var digits;
			var length;
			var i;
			digits = sides[0].split("");
			if (displayLeadingZeros) {
				length = leadingZeroDigits-digits.length;
				if (length>0) {
					for (i=0; i<length; ++i) {
						digits.unshift("0");
					}
				}
			}
			var groups = [];
			var chunk = digits.splice(-3).reverse().join("");
			groups.push(chunk);
			length = digitsPerGroup;
			chunk = "";
			var empty = digits.length==0;
			while (!empty) {
				if (digits.length<length) {
					length = digits.length;
				}
				for (i=0; i<length; ++i) {
					if (i>=0) {
						chunk += digits.pop();
					}
				}
				if (chunk.length==length) {
					groups.push(chunk);
					chunk = "";
				}
				empty = digits.length==0;
			}
			groups = groups.join(groupingSymbol);
			groups = groups.split("");
			groups.reverse();
			sides[0] = groups.join("");
			var result = sides.join(decimalSymbol);
			if (isNegative) {
				result = negativePattern.split("#").join(result);
			}
			result = currencyPattern.split("#").join(result);
			return result;
		};
		this.filter = function(obj, tone) {
			if (tone=="") {
				if (obj.data("original-src")) {
					obj.attr("src", obj.data("original-src"));
					obj.removeAttr("original-src");
				}
				return;
			}
			var imgsrc = obj.data("original-src") || obj.attr("src");
			var img = new Image();
			img.src = imgsrc;
			if (img.width==0||img.height==0) {
				img.onload = function () {
					obj.data("original-src", this.src);
					obj.attr("src", filterexec(this, tone));
				};
			} else {
				obj.data("original-src", imgsrc);
				obj.attr("src", filterexec(img, tone));
			}
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
	}
	return new Constructor();
}());
