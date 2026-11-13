<?php

// Catalog selection is independent of application data and configuration storage.
$catalogs = sys_get_temp_dir() . '/vend-lang-' . bin2hex(random_bytes(6));
mkdir($catalogs);
define('SA_DIR_LANG', $catalogs);
$core = dirname(__DIR__) . '/dist/vend-proofing-core';
require $core . '/php/classes/simpleadmin/Filesystem.php';
require $core . '/php/classes/simpleadmin/ConfigurationDocument.php';
require $core . '/php/classes/simpleadmin/Lang.php';
try {
	copy($core . '/lang/en.json', $catalogs . '/en.json');
	file_put_contents($catalogs . '/es.json', json_encode(['data' => ['users' => ['_attributes' => ['name' => 'Usuarios']]]]));
	$lang = new Lang();
	$lang->language('es');
	if ($lang->code !== 'es' || $lang->lookup('users') !== 'Usuarios') throw new RuntimeException('Selected catalog failed');
	if ($lang->lookup('create_user') !== 'Create User') throw new RuntimeException('Slug fallback failed');
	foreach (['zz', '../en', ''] as $code) {
		$lang->language($code);
		if ($lang->code !== 'en' || $lang->lookup('forgot_password') !== 'Forgot password?') throw new RuntimeException('English fallback failed');
	}
	echo "PASS PHP language selection, missing catalog, invalid code, and slug fallback\n";
} finally {
	unlink($catalogs . '/en.json');
	unlink($catalogs . '/es.json');
	rmdir($catalogs);
}
