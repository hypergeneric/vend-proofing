if (typeof classes == "undefined") classes = new Object();
if (typeof classes.content == "undefined") classes.content = new Object();
if (typeof classes.helpers == "undefined") classes.helpers = new Object();
if (typeof classes.elements == "undefined") classes.elements = new Object();
if (typeof classes.overlay == "undefined") classes.overlay = new Object();

var NAMESPACE = VEND_CONFIG.namespace;
var APP_ROOT = "./";
var APP_ROOT_ABSOLUTE = VEND_CONFIG.baseUrl;
var URI_PAGE_PREFIX = VEND_CONFIG.uri.page;
var URI_SPECIAL_PREFIX = VEND_CONFIG.uri.special;
var URI_SPLASH_LABEL = VEND_CONFIG.uri.splash;
var URI_CONTACT_LABEL = VEND_CONFIG.uri.contact;
var VEND_GRAPHIC_QUALITY = VEND_CONFIG.graphics.quality;
var VEND_GRAPHIC_SHARPEN = VEND_CONFIG.graphics.sharpen;
var VEND_GRAPHIC_IMAGIC = VEND_CONFIG.graphics.imagick;
var VEND_GRAPHIC_WATERMARK = VEND_CONFIG.graphics.watermark;
var VEND_GRAPHIC_WATERMARK_ASSET = VEND_CONFIG.graphics.watermarkAsset;
var VEND_GRAPHIC_WATERMARK_X = VEND_CONFIG.graphics.watermarkX;
var VEND_GRAPHIC_WATERMARK_Y = VEND_CONFIG.graphics.watermarkY;
var VEND_GRAPHIC_WATERMARK_ALPHA = VEND_CONFIG.graphics.watermarkAlpha;
var VEND_GRAPHIC_CROSSHAIRS = VEND_CONFIG.graphics.crosshairs;
var VEND_GRAPHIC_CROSSHAIRS_COLOR = VEND_CONFIG.graphics.crosshairsColor;
var VEND_GRAPHIC_CROSSHAIRS_ALPHA = VEND_CONFIG.graphics.crosshairsAlpha;

function trace(str) {
	if (window.console != undefined) console.log(str);
}
