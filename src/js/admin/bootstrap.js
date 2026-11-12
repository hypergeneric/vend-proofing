var NAMESPACE = VEND_CONFIG.namespace;
var VEND_ADMIN_CONFIG = VEND_CONFIG.adminConfig;

var md = new MobileDetect(window.navigator.userAgent);
var IS_MOBILE = md.phone()!=null;
var IS_TABLET = md.tablet()!=null;

$("html").addClass($.browser.name+"Browser");
$("html").addClass($.browser.platform+"Platform");

if (typeof classes == "undefined") classes = new Object();
if (typeof classes.data == "undefined") classes.data = new Object();
if (typeof classes.helpers == "undefined") classes.helpers = new Object();
if (typeof classes.components == "undefined") classes.components = new Object();
if (typeof classes.components.formobjects == "undefined") classes.components.formobjects = new Object();
if (typeof classes.dialogs == "undefined") classes.dialogs = new Object();
if (typeof classes.applications == "undefined") classes.applications = new Object();
if (typeof classes.panels == "undefined") classes.panels = new Object();
