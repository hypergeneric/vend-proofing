
	classes.helpers.ResampledImageQueue = new function () {
		var _multiplier = 			Math.min(3, Math.ceil(window.devicePixelRatio ? window.devicePixelRatio : 1)) + "x";
		var _use_srcset = 			false;
		var _image_list = 			[];
		var _image_loader = 		null;
		var _image_loader_index = 	-1;
		var _image_loader_loading = false;
		var _image_offset = 		null;
		var _image_offset_timer = 	0;
		function cancelLazyLoading () {
			var img = _image_list[_image_loader_index];
			if (img) {
				img.off();
				clearInterval(_image_loader);
			}
		}
		function lazyError () {
			var img = _image_list[_image_loader_index];
			img.attr("src", img.data("blank"));
		}
		function lazyLoaded () {
			clearInterval(_image_loader);
			_image_loader = setTimeout(lazyLoadNext, 1);
		}
		function offsetLoaded () {
			_image_offset_timer += 1;
			clearInterval(_image_offset);
			_image_offset = setTimeout(lazyLoadNext, _image_offset_timer);
		}
		function lazyComplete () {
			if( this.complete ) {
				$(this).load();
			}
		}
		function getProbableSrc (img) {
			if (_use_srcset) {
				var lookup = [];
				var srcs = img.attr("data-srcset").split(", ");
				for (var i=0; i<srcs.length; ++i) {
					var set = srcs[i].split(" ");
					lookup[set[1]] = set[0];
				}
				return lookup[_multiplier];
			} else {
				return img.attr("data-src");
			}
		}
		function lazyLoadNext () {
			_image_loader_index = _image_loader_index + 1;
			if (_image_loader_index==_image_list.length) {
				_image_loader_index = _image_loader_index - 1
				_image_loader_loading = false;
				return;
			}
			_image_loader_loading = true;
			var img = _image_list[_image_loader_index];
			var blank = img.attr("src");
			var srcset = img.attr("data-srcset");
			var src = getProbableSrc(img);
			var lazyload = src.indexOf("resample.php")!=-1;
			img
				.removeProp("src")
				.data("blank", blank)
				.one('error', lazyError);
			if (lazyload) {
				if (_use_srcset) {
					img
						.attr("srcset", srcset)
						.one('load', lazyLoaded)
						.each(lazyComplete);
				} else {
					img
						.attr("src", src)
						.one('load', lazyLoaded)
						.each(lazyComplete);
				}
			} else {
				if (_use_srcset) {
					img.attr("srcset", srcset);
				} else {
					img.attr("src", src);
				}
				offsetLoaded();
			}
		}
		function lazyLoad (img) {
			if ( img.attr("data-src")!=undefined ) {
				_image_list.push(img);
				if (_image_loader_loading==false) {
					lazyLoadNext();
				}
			}
		}
		this.addObject = function (obj) {
			obj.each(function () {
				lazyLoad($(this));
			});
		};
		this.start = function () {
			var img = new Image();
			_use_srcset = 'srcset' in img;
		};
	};
	