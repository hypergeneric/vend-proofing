<?php

$_SERVER['SERVER_PORT'] = '80';
$_SERVER['HTTP_HOST'] = 'localhost';
$namespace = 'vend-proofing';
include __DIR__ . '/vend-proofing-config.php';

function check($condition, $message) {
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$gallery = Flatfile::getXmlArray('uploadset', '875c', true);
check($gallery !== false, 'Gallery XML contract');
echo "XML configuration smoke passed\n";
