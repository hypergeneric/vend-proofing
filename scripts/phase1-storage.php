<?php

$_SERVER['SERVER_PORT'] = '80';
$_SERVER['HTTP_HOST'] = 'localhost';
$namespace = 'vend-proofing';
include __DIR__ . '/../dist/vend-proofing-config.php';

function check($condition, $message) {
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$gallery = Configuration::getDocument('uploadset', '875c');
check($gallery instanceof ConfigurationDocument, 'Source JSON default did not load');
check(Configuration::getDocument('uploadset', '875c', true) === '', 'Required saved JSON did not report absence');
echo "Source JSON defaults passed\n";
