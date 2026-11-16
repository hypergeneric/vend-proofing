<?php

if (getcwd()!=='/app/dist' || PHP_SAPI!=='cli') exit(2);
define('SA_DIR_STORAGE', '/tmp/local-zip-fixture');
require '/app/dist/vend-proofing-core/php/classes/simpleadmin/LocalDelivery.php';
function checkZip (bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
$root = '/vend-deliveries/abcd-' . str_repeat('a', 24);
$part = $root . '/part-1';
$folder = LocalDelivery::packagePath($part);
$delivery = new LocalDelivery();
if (($argv[1] ?? '')==='fallback') {
	checkZip(!class_exists('ZipArchive', false), 'Fallback test must run without the ZIP extension.');
	mkdir($folder . '/high', 0770, true);
	file_put_contents($folder . '/high/1-photo.jpg', random_bytes(8 * 1024 * 1024));
	file_put_contents($folder . '/high/2-photo.png', random_bytes(1200));
	$delivery->finish($part);
	copy($folder . '.zip', SA_DIR_STORAGE . '/fallback.zip');
	// Repeated finalization must replace an incomplete temporary archive.
	file_put_contents($folder . '.tmp.zip', 'interrupted archive');
	$delivery->finish($part);
	checkZip(!is_file($folder . '.tmp.zip'), 'Temporary archive survived completion.');
	// Classic ZIP cannot represent a single enormous source; use a sparse fixture.
	$large = fopen($folder . '/high/large.jpg', 'wb'); ftruncate($large, 0xffffffff); fclose($large);
	try { $delivery->finish($part); throw new LogicException('ZIP64 limit was ignored.'); }
	catch (RuntimeException $error) { checkZip(str_contains($error->getMessage(), 'format limits'), 'Wrong ZIP64 failure.'); }
	unlink($folder . '/high/large.jpg');
	echo "PASS PclZip creation, retry and classic ZIP size limit without ZipArchive\n";
} else {
	$delivery->finish($part);
	foreach (array(SA_DIR_STORAGE . '/fallback.zip', $folder . '.zip') as $path) {
		$zip = new ZipArchive();
		checkZip($zip->open($path)===true && $zip->numFiles===2, 'Wrong ZIP entry count.');
		foreach (array('high/1-photo.jpg', 'high/2-photo.png') as $name) {
			checkZip($zip->statName($name)['comp_method']===ZipArchive::CM_STORE, 'Image was compressed.');
			checkZip(hash('sha256', $zip->getFromName($name))===hash_file('sha256', $folder . '/' . $name), 'ZIP bytes differ from the source.');
		}
		$zip->close();
	}
	$delivery->delete($root);
	unlink(SA_DIR_STORAGE . '/fallback.zip');
	echo "PASS native and PclZip archives preserve identical paths and source bytes\n";
}
