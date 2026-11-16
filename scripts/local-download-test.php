<?php

// Included at the end of the isolated payment fixture. No local installation data or network.
setting('default_country', 'US');
setting('calculate_and_display_sales_tax_bool', 'false');
setting('handling_flat_fee_num', '0');
setting('international_handling_flat_fee_num', '0');
setting('cart_minimum_count_num', '0');
setting('cart_minimum_value_num', '0');
$profile = Database::allocateSuid();
$downloads = Configuration::getDocument('downloads');
foreach (array('allow_single_downloads_bool', 'allow_web_version_bool', 'allow_download_all_bool', 'download_all_flatfee_bool') as $key) $downloads->editNode('data.settings.' . $key, 'true');
foreach (array('single_download_price', 'web_version_download_price', 'single_download_all_price', 'web_version_download_all_price') as $key) $downloads->editNode('data.settings.' . $key, '0');
Configuration::save('downloads', $profile, $downloads->toString());
$httpOrders = array();
foreach (array('UploadSet', 'CategorySet') as $type) {
	$gallery = Database::allocateSuid();
	Records::savePage($gallery, array('Local delivery fixture', $type, '0'));
	$settings = Configuration::getDocument(strtolower($type), $gallery);
	$settings->editNode('data.settings.download_set', $profile);
	Configuration::save(strtolower($type), $gallery, $settings->toString());
	$directory = SA_DIR_STORAGE . '/' . $gallery;
	mkdir($directory);
	$image = imagecreatetruecolor(1600, 1200);
	imagefill($image, 0, 0, imagecolorallocate($image, 35, 90, 140));
	imagejpeg($image, $directory . '/one.jpg', 85);
	imagepng($image, $directory . '/two.png');
	unset($image);
	// EXIF orientation 6: a landscape file must produce a portrait web JPEG.
	$jpeg = file_get_contents($directory . '/one.jpg');
	$tiff = 'II' . pack('vV', 42, 8) . pack('v', 1) . pack('vvVv', 0x112, 3, 1, 6) . "\0\0" . pack('V', 0);
	$exif = "Exif\0\0" . $tiff;
	$jpeg = substr($jpeg, 0, 2) . "\xff\xe1" . pack('n', strlen($exif) + 2) . $exif . substr($jpeg, 2);
	file_put_contents($directory . '/one.jpg', $jpeg);
	$hash = hash('sha256', $jpeg);
	Records::addImage($gallery, array('one.jpg', 'Photo.jpg', '1600x1200', '', (string) strlen($jpeg)), 'Portraits');
	Records::addImage($gallery, array('two.png', 'Photo.jpg', '1600x1200', '', (string) filesize($directory . '/two.png')), 'Details');
	file_put_contents($directory . '/movie.mp4', 'unsupported synthetic media');
	Records::addImage($gallery, array('movie.mp4', 'Movie.mp4', '640x480', '1', '26'), 'Details');
	checkPayment(count(Downloads::images($gallery))===2, 'Local download eligibility included a video.');
	$session = Proofing::open($gallery, 'local@example.invalid');
	Proofing::addDownloads($gallery, $session, 'cart', 'high', 0, true);
	// Distinct files with identical original names must have distinct cart keys.
	checkPayment(count(Proofing::responseRows($gallery, $session, 'download'))===2, 'Duplicate photo labels collided.');
	checkPayment(CheckoutQuote::cart($gallery, $session)['subtotal']===0.0, 'Local bulk profile not applied.');
	Proofing::save($gallery, $session, 'download', array('unsupported-d', $gallery, 'movie.mp4', 'Movie.mp4', '640x480', 'high', '0', '0'));
	rejectsPayment(fn () => CheckoutQuote::cart($gallery, $session), 'Unsupported media passed a forged checkout.');
	Proofing::deleteItem($gallery, $session, 'download', 'unsupported-d');
	Proofing::save($gallery, $session, 'download', array('web-d', $gallery, 'one.jpg', 'Photo.jpg', '1600x1200', 'low', '0', '0'));
	$id = OrderRecords::prequalify($gallery, $session, '', '', '0');
	$row = array($id, $gallery, '0', 'offline', '', 'local', '', 'Local Buyer', 'local@example.invalid', '', '', 'US', '', '--', '0', '0', '0', '0', '0', '0', '0', 'false', 'false', 'false', '');
	OrderRecords::create($gallery, $session, $row, 'USD');
	checkPayment(Payments::canDownload($id), 'Free local order not entitled.');
	$_SESSION['authorized_order'] = $id;
	Downloads::prepare($id);
	rejectsPayment(fn () => Downloads::open($id, 1), 'Unprepared ZIP was accessible.');
	file_put_contents($directory . '/one.jpg', 'changed source');
	rejectsPayment(fn () => Downloads::next($id), 'Changed source was silently delivered.');
	file_put_contents($directory . '/one.jpg', $jpeg);
	$progress = Downloads::next($id);
	checkPayment($progress>0 && $progress<1, 'Local preparation was not bounded.');
	// Removal should hide gallery assets while retaining purchased source bytes.
	Records::deleteImages($gallery, array('one.jpg'));
	MediaFiles::delete($gallery, array('one.jpg'));
	checkPayment(is_file($directory . '/one.jpg'), 'Purchased image deleted from disk.');
	Records::deletePage($gallery); MediaFiles::deleteGallery($gallery);
	checkPayment(is_file($directory . '/one.jpg') && is_file($directory . '/two.png') && !is_file($directory . '/movie.mp4'), 'Gallery retention kept wrong files.');
	for ($i=0; $i<10 && Downloads::status($id)['progress']<1; $i++) Downloads::next($id);
	checkPayment(Downloads::status($id)['progress']===1.0, 'Local ZIP did not finish after gallery removal.');
	rejectsPayment(fn () => Downloads::open($id, 1), 'ZIP was accessible before link issuance.');
	$links = Downloads::links($id);
	checkPayment(count($links)===1 && str_contains($links[0], '/order/' . $id . '/file/1/'), 'Local download did not use authenticated route.');
	$opened = Downloads::open($id, 1);
	$zipfile = '/tmp/local-package-' . $id . '.zip';
	$output = fopen($zipfile, 'wb'); stream_copy_to_stream($opened['file'], $output); fclose($output); fclose($opened['file']);
	checkPayment(filesize($zipfile)===$opened['size'], 'ZIP streaming length mismatch.');
	$zip = new ZipArchive(); checkPayment($zip->open($zipfile)===true && $zip->numFiles===3, 'Incomplete local ZIP.');
	$originals = 0; $web = 0;
	for ($i=0; $i<$zip->numFiles; $i++) {
		$name = $zip->getNameIndex($i); $bytes = $zip->getFromIndex($i);
		if (str_starts_with($name, 'high/')) { $originals++; checkPayment(in_array(hash('sha256', $bytes), array($hash, hash_file('sha256', $directory . '/two.png')), true), 'Original bytes changed.'); }
		else {
			$web++; $info = getimagesizefromstring($bytes);
			checkPayment($info[2]===IMAGETYPE_JPEG && $info[0]===576 && $info[1]===768, 'Web JPEG dimensions/orientation incorrect.');
			file_put_contents('/tmp/local-web-exif.jpg', $bytes);
			$exif = @exif_read_data('/tmp/local-web-exif.jpg');
			checkPayment((int) ($exif['Orientation'] ?? 1)===1, 'Web JPEG retained an orientation that would rotate it twice.');
			unlink('/tmp/local-web-exif.jpg');
		}
	}
	checkPayment($originals===2 && $web===1, 'Renditions missing.'); $zip->close(); unlink($zipfile);
	$_SESSION['authorized_order'] = 'wrong'; rejectsPayment(fn () => Downloads::open($id, 1), 'Another customer could download the ZIP.');
	$_SESSION['authorized_order'] = $id;
	rejectsPayment(fn () => Downloads::open($id, 0), 'Invalid ZIP part accepted.');
	rejectsPayment(fn () => LocalDelivery::packagePath('/vend-deliveries/' . $id . '-' . str_repeat('a', 24) . '/../outside'), 'Package traversal allowed.');
	Database::connection()->prepare("UPDATE fulfillments SET status = 'revoked' WHERE order_id = (SELECT id FROM orders WHERE suid = ?)")->execute(array($id));
	rejectsPayment(fn () => Downloads::open($id, 1), 'Revoked local delivery link remained usable.');
	Database::connection()->prepare("UPDATE fulfillments SET status = 'ready' WHERE order_id = (SELECT id FROM orders WHERE suid = ?)")->execute(array($id));
	// Keep one order for isolated HTTP verification; remove the other and its retained originals.
	if ($type==='CategorySet') $httpOrders[] = $id;
	else {
		Downloads::delete($id); checkPayment(is_file($directory . '/one.jpg'), 'Package cleanup deleted a retained original.');
		OrderRecords::delete($id); checkPayment(!is_file($directory . '/one.jpg') && !is_file($directory . '/two.png'), 'Deleted final order leaked retained sources.');
	}
}
// Exercise the GD fallback and PNG alpha flattening independently of Imagick availability.
$gd = new ReflectionMethod(LocalDelivery::class, 'webImageGd');
$gd->invoke(null, $directory . '/one.jpg', '/tmp/local-gd-web.jpg');
$info = getimagesize('/tmp/local-gd-web.jpg');
checkPayment($info[0]===576 && $info[1]===768, 'GD EXIF orientation wrong.'); unlink('/tmp/local-gd-web.jpg');
$image = imagecreatetruecolor(10, 8); imagealphablending($image, false); imagesavealpha($image, true);
imagefill($image, 0, 0, imagecolorallocatealpha($image, 0, 0, 0, 127)); imagepng($image, '/tmp/local-alpha.png'); unset($image);
$gd->invoke(null, '/tmp/local-alpha.png', '/tmp/local-gd-web.jpg');
$image = imagecreatefromjpeg('/tmp/local-gd-web.jpg');
checkPayment(imagesx($image)===10 && imagesy($image)===8 && (imagecolorat($image, 0, 0) & 0xffffff)===0xffffff, 'PNG was upscaled or transparency was not white.');
unset($image); unlink('/tmp/local-alpha.png'); unlink('/tmp/local-gd-web.jpg');
file_put_contents('/tmp/local-download-orders.json', json_encode($httpOrders));
echo "PASS local upload/category downloads, duplicate labels, unsupported media, source hashes, retention, JPEG orientation, ZIP bytes, issuance, refund access and cleanup\n";
