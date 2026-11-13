<?php

// CLI only. Create an empty Vend application database; then create the administrator.
if (PHP_SAPI !== 'cli') exit(1);

$root = dirname(__DIR__);
$args = $argv;
array_shift($args);
if (count($args) === 0) {
	$dataDir = $root . '/dist/vend-proofing-data';
} elseif (count($args) === 2 && $args[0] === '--data-dir') {
	$dataDir = $args[1];
} else {
	fwrite(STDERR, "Usage: php scripts/install.php [--data-dir DIR]\n");
	exit(2);
}

define('SA_DIR_AUTH', rtrim($dataDir, '/') . '/auth');
require $root . '/dist/vend-proofing-core/php/classes/simpleadmin/Database.php';

try {
	Database::install();
	fwrite(STDOUT, "Empty Vend database installed. Create the administrator with scripts/admin-account.php.\n");
} catch (Throwable $error) {
	fwrite(STDERR, $error->getMessage() . "\n");
	exit(1);
}
