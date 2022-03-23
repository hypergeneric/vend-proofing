<?php

	/* disable direct access
		*/
	if (count(get_included_files())==1) exit();

	/* some compile-time stuff
		*/
	error_reporting(0);

	if (!defined('SA_BASEPATH')) define("SA_BASEPATH", "");
	define("SA_NAMESPACE", $namespace);
	define("SA_DIR_COREPATH", SA_BASEPATH.$corepath);
	define("SA_DIR_DATAPATH", SA_BASEPATH.$datapath);
	define("SA_DIR_TEMP", SA_DIR_DATAPATH."/temp");
	define("SA_DIR_AUTH", SA_DIR_DATAPATH."/auth");
	define("SA_DIR_CACHE", SA_DIR_DATAPATH."/cache");
	define("SA_DIR_STORAGE", SA_DIR_DATAPATH."/storage");
	define("SA_DIR_DEFAULTS", SA_DIR_COREPATH."/defaults");
	define("SA_PERMISSION_FILE", (strpos(PHP_SAPI, "apache")!==false?0666:0644));
	define("SA_PERMISSION_DIR", (strpos(PHP_SAPI, "apache")!==false?0777:0755));
	define("SA_DEMOMODE", false);

	/* bring in any necessary classes
		*/
	require_once(SA_DIR_COREPATH."/php/classes/getid3/getid3/getid3.php");
	require_once(SA_DIR_COREPATH."/php/classes/pclzip/pclzip.lib.php");
	require_once(SA_DIR_COREPATH."/php/classes/campaignmonitor/createsend-php/csrest_subscribers.php");
	require_once(SA_DIR_COREPATH."/php/classes/gradient.php");
	require_once(SA_DIR_COREPATH."/php/vendor/autoload.php");
	spl_autoload_register(function ($class) {
		include SA_DIR_COREPATH."/php/classes/simpleadmin/$class.php";
	});

	/* parse the config doc in case we need it for anything
		*/
	$CONFIG = new SimpleXML4();
	$CONFIG->load(SA_BASEPATH.SA_NAMESPACE."-config.xml");
	$LANG = new Lang();
	$LANG->language($CONFIG->getNodeVal("setup.language"));

	/* we'll need this pretty regularly too
		*/
	define("SA_DIR_INDEXPATH", $CONFIG->getNodeVal("setup.indexpath"));
	define("SA_PRODUCT_VERSION", $CONFIG->getNodeVal("setup.product_version"));

	/* start this baby up
		*/
	Func::init(false);

?>