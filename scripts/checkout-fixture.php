<?php

// Helpers for the network-disabled basic-set fixture; never load real installation data.
define('SA_DIR_AUTH', 'vend-proofing-data/auth');
define('SA_DIR_DEFAULTS', 'vend-proofing-core/defaults');
define('SA_DIR_LANG', 'vend-proofing-core/lang');
spl_autoload_register(function ($name) { require 'vend-proofing-core/php/classes/simpleadmin/' . $name . '.php'; });
$gallery = $argv[1];
if (($argv[2] ?? '')==='cleanup') {
	Configuration::revert('uploadset', $gallery);
	$group = file_get_contents('/tmp/checkout-format-group');
	Records::deleteSetRow('formatset', $group, null);
	exit;
}
$group = Database::allocateSuid();
Records::savePricingGroup('formatset', $group, array('Checkout fixture'));
Records::savePricingItem('format', Database::allocateSuid(), $group, array('Eight by Ten', '8', '10', '10', '0'));
$settings = Configuration::getDocument('uploadset', $gallery);
$settings->editNode('data.settings.format_set', $group);
Configuration::save('uploadset', $gallery, $settings->toString());
file_put_contents('/tmp/checkout-format-group', $group);
