<?php

// Local-only first-admin setup and password recovery. Never expose this script via HTTP.
if (PHP_SAPI !== 'cli') exit(1);

$root = dirname(__DIR__);
$args = $argv;
array_shift($args);
$dataDir = $root . '/vend-proofing-data';
if (count($args) >= 2 && $args[count($args) - 2] === '--data-dir') {
	$dataDir = $args[count($args) - 1];
	array_splice($args, -2);
}
if (($args[0] ?? '') === 'create' && count($args) === 3) {
	$operation = 'create';
} elseif (($args[0] ?? '') === 'reset' && count($args) === 2) {
	$operation = 'reset';
} else {
	fwrite(STDERR, "Usage: php scripts/admin-account.php create USERNAME EMAIL [--data-dir DIR]\n       php scripts/admin-account.php reset USERNAME [--data-dir DIR]\n");
	exit(2);
}

define('SA_DIR_AUTH', rtrim($dataDir, '/') . '/auth');
require $root . '/vend-proofing-core/php/classes/simpleadmin/Database.php';
require $root . '/vend-proofing-core/php/classes/simpleadmin/AdminAccount.php';

try {
	fwrite(STDERR, "Password (at least 12 characters): ");
	$tty = function_exists('stream_isatty') && stream_isatty(STDIN);
	if ($tty) system('stty -echo');
	try {
		$password = rtrim((string) fgets(STDIN), "\r\n");
	} finally {
		if ($tty) {
			system('stty echo');
			fwrite(STDERR, "\n");
		}
	}
	if ($operation === 'create') {
		AdminAccount::create($args[1], $args[2], $password);
	} else {
		AdminAccount::resetPassword($args[1], $password);
	}
	fwrite(STDOUT, $operation === 'create' ? "Administrator account created.\n" : "Administrator password reset.\n");
} catch (Throwable $error) {
	fwrite(STDERR, $error->getMessage() . "\n");
	exit(1);
}
