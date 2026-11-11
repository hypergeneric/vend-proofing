<?php

if (PHP_SAPI !== 'cli' || count($argv) !== 2) exit(2);
define('SA_DIR_AUTH', rtrim($argv[1], '/') . '/auth');
require dirname(__DIR__) . '/vend-proofing-core/php/classes/simpleadmin/Database.php';
echo Database::allocateSuid() . "\n";
