<?php

if (PHP_SAPI!=='cli' || getcwd()!=='/app/dist') exit(2);
define('SA_DIR_AUTH', '/app/dist/vend-proofing-data/auth');
define('SA_BASE_URL', 'https://vend.example.invalid');
define('SA_DIR_STORAGE', '/app/dist/vend-proofing-data/storage');
define('SA_DIR_DEFAULTS', '/app/dist/vend-proofing-core/defaults');
define('SA_DIR_LANG', '/app/dist/vend-proofing-core/lang');
spl_autoload_register(function ($name) { require '/app/dist/vend-proofing-core/php/classes/simpleadmin/' . $name . '.php'; });
$args = json_decode(file_get_contents('/tmp/payment-worker.json'), true, 512, JSON_THROW_ON_ERROR);
if ($argv[1]==='submit') OrderRecords::create(...$args);
elseif ($argv[1]==='event') Payments::reconcile(...$args);
else exit(2);
echo "ok\n";
