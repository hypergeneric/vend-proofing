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

$pages = Flatfile::getSetTable('page');
check(count($pages) === 1 && $pages['875c'][2] === 'UploadSet', 'Page table contract');
$gallery = Flatfile::getXmlArray('uploadset', '875c', true);
check($gallery !== false, 'Gallery XML contract');

$table = Flatfile::updateSetTable('smoke', ['a1', 'First', '10']);
Flatfile::saveSetTable($table, 'smoke');
$table = Flatfile::updateSetTable('smoke', ['a1', 'Updated', '10']);
Flatfile::saveSetTable($table, 'smoke');
$table = Flatfile::getSetTable('smoke');
check(count($table) === 1 && $table['a1'][1] === 'Updated', 'Table update contract');
check(Flatfile::getTableString(Flatfile::getTablePath('smoke')) === "a1\tUpdated\t10", 'Table serialization contract');
echo "Storage contract smoke passed\n";
