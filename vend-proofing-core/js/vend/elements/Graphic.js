
/*jslint browser: true, bitwise: true, continue: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.elements.Graphic = function () {
	/* private properites
		*/
	var flag_encode = true;
	var flag_resample = "auto";
	var flag_width = 0;
	var flag_height = 0;
	var flag_fitstyle = "noBorder";
	var flag_watermark = false;
	var flag_source = {};
	/* private methods
		*/
	function isVideo () {
		return (flag_source.type=="FLV"||flag_source.type=="MP4");
	}
	function toHex (num) {
		var result = '';
		var digitArray = ['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'];
		var start = true;
		var i=32, digit;
		while(i>0) {
			i-=4;
			digit = (num>>i) & 0xf;
			if (!start||digit!=0){
				start = false;
				result += digitArray[digit];
			}
		}
		return (result==''?'0':result);
	}
	function pad (str, len, chr) {
		var result = str;
		var i;
		for (i=str.length; i<len; i++){
			result = chr + result;
		}
		return result;
	}
	function encodeHex (str) {
		var result = "";
		var i;
		for (i=0; i<str.length; i++){
			result += pad(toHex(str.charCodeAt(i)&0xff), 2, '0');
		}
		return result;
	}
	/* public methods
		*/
	this.encode = function(bool) {
		flag_encode = bool;
	};
	this.resample = function(type) {
		flag_resample = type;
	};
	this.watermark = function(bool) {
		flag_watermark = bool;
	};
	this.letterbox = function(bool) {
		flag_fitstyle = bool ? "letterBox" : "noBorder";
	};
	this.setSize = function(width, height) {
		if (width) {
			flag_width = width;
		}
		if (height) {
			flag_height = height;
		}
	};
	this.provider = function(obj) {
		var localpath = obj.src;
		if ( !localpath && obj.parent && obj.child) {
			localpath = "vend-proofing-data/storage/" + obj.parent + "/" + obj.child;
		}
		if ( obj.parent.indexOf("zip")!=-1 ) {
			obj.type = "JPG";
		}
		if ( !obj.type || obj.type=="" ) {
			obj.type = localpath.substring(localpath.lastIndexOf(".")+1).toUpperCase();
		}
		flag_source = obj;
	};
	this.source = function() {
		var src_path = APP_ROOT + "vend-proofing-data/storage/" + flag_source.parent + "/" + flag_source.child + (isVideo()?".snapshot.jpg":"");
		var src_type = isVideo() ? "JPG" : flag_source.type;
		/* if the resample mechanism is on, reconstruct the url
			*/
		if (	flag_resample!="none"	&&
			(src_type=="PNG"||src_type=="GIF"||src_type=="JPEG"||src_type=="JPG")
		) {
			/* {PARENT_NAME}:{CHILD_NAME}:{WIDTH}:{HEIGHT}:{EXACT}:{FORMAT}:{QUALITY}:{CACHE}:{WATERMARK}:{WATERMARK_NAME}:{WATERMARK_X%}:{WATERMARK_Y%}:{WATERMARK_ALPHA}:{CROSSHAIRS}:{CROSSHAIRS_COLOR}:{CROSSHAIRS_ALPHA}
				*/
			var path = APP_ROOT + "vend-proofing-resample.php";
			var query = "";
			/* decide on base query
				*/
			query += flag_source.parent + ":" + flag_source.child + (isVideo()?".snapshot.jpg":"");
			if (flag_resample=="postal") {
				/* round to the nearest 50 pixel increment
					*/
				var image_width = (Math.ceil(flag_width/50)*50);
				var image_height = (Math.ceil(flag_height/50)*50);
				switch (flag_fitstyle) {
					case "letterBox" :
						query += ":" + image_width + ":" + image_height + ":0";
						break;
					case "noBorder" :
						if (image_width>image_height) {
							query += ":" + image_width + ":" + ":1";
						} else {
							query += ":" + ":" + image_height + ":1";
						}
						break;
				}
			} else if (flag_resample=="auto") {
				switch (flag_fitstyle) {
					case "letterBox" :
						query += ":" + flag_width + ":" + flag_height + ":0";
						break;
					case "noBorder" :
						query += ":" + flag_width + ":" + flag_height + ":1";
						break;
				}
			}
			/* add the type
				*/
			query += "," + (flag_source.xoffset||50) + "," + (flag_source.yoffset||50);
			/* add the type
				*/
			query += ":" + src_type.toLowerCase();
			/* add the quality
				*/
			query += ":" + VEND_GRAPHIC_QUALITY + "," + (VEND_GRAPHIC_SHARPEN?"1":"0") + "," + (VEND_GRAPHIC_IMAGIC?"1":"0");
			/* add the cache flag
				*/
			query += ":1";
			/* add the watermarking
				*/
			query += ":" + (flag_watermark&&VEND_GRAPHIC_WATERMARK?"1":"0") + ":" + VEND_GRAPHIC_WATERMARK_ASSET + ":" + VEND_GRAPHIC_WATERMARK_X + ":" + VEND_GRAPHIC_WATERMARK_Y + ":" + VEND_GRAPHIC_WATERMARK_ALPHA;
			query += ":" + (flag_watermark&&VEND_GRAPHIC_CROSSHAIRS?"1":"0") + ":" + VEND_GRAPHIC_CROSSHAIRS_COLOR + ":" + VEND_GRAPHIC_CROSSHAIRS_ALPHA;
			/* set our final path
				*/
			if (flag_encode) {
				path += "?hash=" + encodeHex(query);
			} else {
				path += "?q=" + escape(query);
			}
			src_path = path;
		}
		return src_path;
	};
};
