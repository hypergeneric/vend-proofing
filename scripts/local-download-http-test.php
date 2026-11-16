<?php

if (getcwd()!=='/app/dist' || PHP_SAPI!=='cli') exit(2);
define('SA_DIR_AUTH', '/app/dist/vend-proofing-data/auth');
define('SA_DIR_STORAGE', '/app/dist/vend-proofing-data/storage');
define('SA_DIR_DEFAULTS', '/app/dist/vend-proofing-core/defaults');
spl_autoload_register(function ($name) { require '/app/dist/vend-proofing-core/php/classes/simpleadmin/' . $name . '.php'; });
function checkHttpDownload (bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
function downloadHttp (string $path, string $cookie='', bool $post=false): array {
	$context = stream_context_create(array('http' => array('method' => $post ? 'POST' : 'GET',
		'header' => 'Cookie: ' . $cookie . "\r\n", 'ignore_errors' => true, 'follow_location' => 0)));
	$body = file_get_contents('http://127.0.0.1:8080/' . $path, false, $context);
	return array($body, $http_response_header);
}
AdminAccount::create('downloadtest', 'owner@example.invalid', 'DownloadFixturePassword123!');
$contact = json_decode(file_get_contents(SA_DIR_DEFAULTS . '/contact.json'), true);
$contact['data']['details']['your_email']['_attributes']['href'] = 'owner@example.invalid';
Configuration::save('contact', null, json_encode($contact));
// Public gallery URLs must remain previews even with a missing or inflated size request.
$gallery = Database::allocateSuid();
Records::savePage($gallery, array('Public preview fixture', 'UploadSet', '0'));
mkdir(SA_DIR_STORAGE . '/' . $gallery);
$image = imagecreatetruecolor(2400, 1600);
imagefill($image, 0, 0, imagecolorallocate($image, 60, 110, 150));
$source = SA_DIR_STORAGE . '/' . $gallery . '/public.jpg';
imagejpeg($image, $source, 85); unset($image);
Records::addImage($gallery, array('public.jpg', 'Public.jpg', '2400x1600', '', (string) filesize($source)));
$setup = Configuration::getDocument('setup');
foreach (array(2048, 960, 1200) as $limit) {
	$setup->editNode('data.settings.max_image_dimension_num', (string) $limit);
	Configuration::save('setup', null, $setup->toString());
	foreach (array($gallery . ':public.jpg', $gallery . ':public.jpg:9000:6000:1:jpg:90:1:0:::::::3') as $query) {
		[$body, $headers] = downloadHttp('vend-proofing-resample.php?q=' . rawurlencode($query));
		$size = @getimagesizefromstring($body);
		checkHttpDownload(str_contains($headers[0], '200') && $size && $size[0]===$limit && $size[1]===(int) round($limit * 2 / 3), 'Image bypassed configured dimensions or reused stale cached dimensions.');
		checkHttpDownload(hash('sha256', $body)!==hash_file('sha256', $source), 'Oversized image returned original bytes.');
	}
}
[$body] = downloadHttp('vend-proofing-resample.php?q=' . rawurlencode($gallery . ':public.jpg:600:0'));
$size = getimagesizefromstring($body);
checkHttpDownload($size[0]===600 && $size[1]===400, 'Maximum dimension enlarged a smaller requested image.');
[$body, $headers] = downloadHttp('?/set/' . $gallery . '/public-preview-fixture/');
checkHttpDownload(str_contains($body, '</html>') && preg_match('/keys:\s*\[\s*"public\.jpg"/', $body), 'Local gallery did not render eligible downloads: ' . $headers[0] . ' ' . substr($body, -900));
checkHttpDownload(str_contains($body, '"maxDimension":1200'), 'Storefront did not receive the configured image limit.');
Records::deletePage($gallery); MediaFiles::deleteGallery($gallery);
$id = json_decode(file_get_contents('/tmp/local-download-orders.json'), true)[0];
$fileUrl = '?/order/' . $id . '/file/1/';
[$body, $headers] = downloadHttp($fileUrl);
checkHttpDownload(str_contains($headers[0], '403'), 'Anonymous local ZIP request succeeded.');
[$body, $headers] = downloadHttp('?/order/' . $id . '/invoice/' . md5('local@example.invalid') . '/');
checkHttpDownload(str_contains($headers[0], '200') && str_contains($body, 'id="download-button"') && str_contains($body, '</html>'), 'Local download invoice did not render completely.');
$cookie = '';
foreach ($headers as $header) if (preg_match('/^Set-Cookie: ([^;]+)/i', $header, $match)) $cookie = $match[1];
checkHttpDownload($cookie!=='', 'Invoice did not authorize a customer session.');
[$body, $headers] = downloadHttp($fileUrl, $cookie);
checkHttpDownload(str_contains($headers[0], '200') && str_starts_with($body, "PK\x03\x04"), 'Authenticated ZIP response failed.');
checkHttpDownload(in_array('Content-Type: application/zip', $headers, true), 'ZIP MIME type wrong.');
checkHttpDownload(in_array('Content-Length: ' . strlen($body), $headers, true), 'ZIP response size wrong.');
$disposition = array_filter($headers, fn ($header) => str_starts_with($header, 'Content-Disposition: attachment;'));
checkHttpDownload(count($disposition)===1, 'ZIP response not an attachment.');
[$body, $headers] = downloadHttp('?/order/' . $id . '/file/999/', $cookie);
checkHttpDownload(str_contains($headers[0], '403'), 'Invalid part number succeeded.');
[$body, $headers] = downloadHttp('?/order/' . $id . '/file/../', $cookie);
checkHttpDownload(str_contains($headers[0], '403'), 'Invalid part path succeeded.');
// Raw storage never provides another path around the invoice gate.
$stateQuery = Database::connection()->prepare('SELECT state_json FROM download_jobs WHERE order_suid = ?');
$stateQuery->execute(array($id)); $state = json_decode($stateQuery->fetchColumn(), true); $stateQuery->closeCursor();
[$body, $headers] = downloadHttp('vend-proofing-data/storage' . $state['root'] . '/part-1.zip', $cookie);
checkHttpDownload(str_contains($headers[0], '403'), 'Direct private ZIP storage was exposed.');
Database::connection()->prepare("UPDATE fulfillments SET status = 'revoked' WHERE order_id = (SELECT id FROM orders WHERE suid = ?)")->execute(array($id));
[$body, $headers] = downloadHttp($fileUrl, $cookie);
checkHttpDownload(str_contains($headers[0], '403'), 'Previously issued ZIP bypassed revoked entitlement.');
Database::connection()->prepare('UPDATE download_jobs SET updated_at = 1 WHERE order_suid = ?')->execute(array($id));
$result = Downloads::purge(86400);
checkHttpDownload($result[0]['deleted'] && !is_dir(SA_DIR_STORAGE . $state['root']), 'Expired local ZIP files survived cleanup.');
echo "PASS local invoice HTTP rendering, authorized ZIP streaming, headers, invalid parts, private storage, revoked access and expiry\n";
