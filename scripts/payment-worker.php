<?php

if (PHP_SAPI!=='cli' || getcwd()!=='/app') exit(2);
define('SA_DIR_AUTH', '/app/vend-proofing-data/auth');
define('SA_DIR_STORAGE', '/app/vend-proofing-data/storage');
define('SA_DIR_DEFAULTS', '/app/vend-proofing-core/defaults');
spl_autoload_register(function ($name) { require '/app/vend-proofing-core/php/classes/simpleadmin/' . $name . '.php'; });
$args = json_decode(file_get_contents('/tmp/payment-worker.json'), true, 512, JSON_THROW_ON_ERROR);
if ($argv[1]==='submit') OrderRecords::create(...$args);
elseif ($argv[1]==='event') Payments::reconcile(...$args);
else exit(2);
echo "ok\n";
