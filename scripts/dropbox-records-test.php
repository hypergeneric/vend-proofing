<?php

// Run only inside the disposable, network-disabled basic-set fixture.
$suid = $argv[1];
define("SA_DIR_AUTH", "vend-proofing-data/auth");
define("SA_DIR_STORAGE", "vend-proofing-data/storage");
define("SA_DIR_DEFAULTS", "vend-proofing-core/defaults");
spl_autoload_register(function ($name) { require "vend-proofing-core/php/classes/simpleadmin/$name.php"; });
function checkDropbox (bool $condition, string $message): void {
	if (!$condition) throw new RuntimeException($message);
}
function rejectsDropbox (callable $work): void {
	try { $work(); } catch (RuntimeException | InvalidArgumentException $error) { return; }
	throw new RuntimeException("Expected Dropbox failure.");
}
function dropboxFile (string $id, string $path, string $rev='abcdef123'): array {
	return array('.tag' => 'file', 'id' => $id, 'name' => basename($path), 'path_lower' => strtolower($path), 'path_display' => $path, 'rev' => $rev, 'size' => 1000);
}

$document = Configuration::getDocument('ordering');
$document->editNode('data.payment_gateway.dropbox_api_key', 'fixture-key');
$document->editNode('data.payment_gateway.dropbox_api_secret', 'fixture-secret');
Configuration::save('ordering', null, DropboxClient::merge($document->toString()));
checkDropbox(str_contains(DropboxClient::authorize(), 'token_access_type=offline'), 'Offline access missing.');
$tokenCalls = 0;
DropboxClient::$transport = function ($url, $body, $headers) use (&$tokenCalls) {
	checkDropbox(str_ends_with($url, '/oauth2/token'), 'Unexpected token endpoint.');
	parse_str($body, $parameters);
	checkDropbox($parameters['client_secret']==='fixture-secret', 'App secret not sent to token endpoint.');
	$tokenCalls++;
	return array(200, json_encode(array('access_token' => 'fixture-access-' . $tokenCalls, 'refresh_token' => 'fixture-refresh', 'expires_in' => 14400)));
};
$document->editNode('data.payment_gateway.dropbox_authorization_code', 'fixture-code');
Configuration::save('ordering', null, DropboxClient::merge($document->toString()));
checkDropbox(DropboxClient::setting('dropbox_authorization_code')==='', 'Code was retained.');
checkDropbox(DropboxClient::accessToken()==='fixture-access-1' && $tokenCalls===1, 'Unexpired token was refreshed.');
$admin = DropboxClient::forAdmin(Configuration::getJson('ordering'));
foreach (array('fixture-secret', 'fixture-access', 'fixture-refresh', 'fixture-code') as $secret) checkDropbox(!str_contains($admin, $secret), 'Admin exposed credentials.');
$posted = new ConfigurationDocument($admin);
$posted->editNode('data.payment_gateway.dropbox_token', 'forged');
$posted->editNode('data.payment_gateway.dropbox_refresh_token', 'forged');
Configuration::save('ordering', null, DropboxClient::merge($posted->toString()));
checkDropbox(DropboxClient::accessToken()==='fixture-access-1', 'Browser replaced tokens.');
$document = Configuration::getDocument('ordering');
$document->editNode('data.payment_gateway.dropbox_expires_at', '1');
Configuration::save('ordering', null, $document->toString());
checkDropbox(DropboxClient::accessToken()==='fixture-access-2' && $tokenCalls===2, 'Expired token not refreshed.');
DropboxClient::$transport = fn () => array(400, 'fixture-secret fixture-code');
$document->editNode('data.payment_gateway.dropbox_authorization_code', 'bad-code');
try { DropboxClient::merge($document->toString()); throw new LogicException('Bad code accepted.'); }
catch (RuntimeException $error) { checkDropbox(!str_contains($error->getMessage(), 'fixture-'), 'Provider body leaked.'); }
checkDropbox(DropboxClient::setting('dropbox_refresh_token')==='fixture-refresh', 'Failed exchange destroyed connection.');

echo "PASS Dropbox offline authorization, token refresh, secret masking and failed exchange\n";

$file = dropboxFile('id:photo-a', "/$suid/Ceremony/a.jpg");
$second = dropboxFile('id:photo-b', "/$suid/Party/b.png");
$listCalls = 0;
DropboxClient::$transport = function ($url, $body, $headers) use ($file, $second, &$listCalls) {
	$listCalls++;
	checkDropbox(in_array('Authorization: Bearer fixture-access-2', $headers, true), 'Missing bearer token.');
	if (str_ends_with($url, '/list_folder')) return array(200, json_encode(array('entries' => array($file), 'has_more' => true, 'cursor' => 'cursor1')));
	checkDropbox(json_decode($body, true)['cursor']==='cursor1', 'Pagination cursor missing.');
	return array(200, json_encode(array('entries' => array($second), 'has_more' => false)));
};
$sync = new DropboxSync();
$sync->sync($suid);
$rows = Records::getFileTable('image', $suid);
checkDropbox(count($rows)===2 && $listCalls===2, 'Pagination lost images.');
$key = array_key_first($rows);
$session = Proofing::open($suid, 'dropbox@example.invalid');
Proofing::save($suid, $session, 'favorites', array('selection-f', $suid, $key, 'a.jpg', '0x0'));
$selections = Proofing::rows($suid, $session);
$before = Records::dropboxImages($suid);
DropboxClient::$transport = function ($url) use ($file) {
	if (str_ends_with($url, '/list_folder')) return array(200, json_encode(array('entries' => array($file), 'has_more' => true, 'cursor' => 'cursor1')));
	return array(500, 'provider failure');
};
rejectsDropbox(fn () => $sync->sync($suid));
checkDropbox(Records::dropboxImages($suid)===$before, 'Partial listing changed the gallery.');
rejectsDropbox(fn () => Records::syncDropboxImages($suid, array($file, $file)));
checkDropbox(Records::dropboxImages($suid)===$before, 'Invalid listing was not rolled back.');

$renamed = dropboxFile('id:photo-a', "/$suid/Other/Ceremony/renamed.jpg");
$third = dropboxFile('id:photo-c', "/$suid/Another/Ceremony/c.jpg");
Records::syncDropboxImages($suid, array($renamed, $third));
checkDropbox(isset(Records::imageRows($suid)[$key]), 'Rename changed the public key.');
checkDropbox(Proofing::rows($suid, $session)===$selections, 'Sync erased selections.');
checkDropbox(count(Records::categoryRows($suid))===2, 'Nested category names collided.');
$images = Records::dropboxImages($suid);
checkDropbox(count($images)===3 && count(array_filter($images, fn ($image) => $image['image_status']==='missing'))===1, 'Removed file history was deleted.');
Records::syncDropboxImages($suid, array($file));
checkDropbox(isset(Records::imageRows($suid)[$key]), 'Restored file lost its key.');

// Synthetic JPEG: no original downloaded, decoded or transformed by sync.
$jpeg = imagecreatetruecolor(640, 480);
ob_start(); imagejpeg($jpeg); $bytes = ob_get_clean();
$previewCalls = 0;
DropboxClient::$transport = function ($url, $body, $headers) use ($bytes, &$previewCalls) {
	checkDropbox(str_ends_with($url, '/get_thumbnail_v2'), 'Unexpected preview endpoint.');
	$arguments = json_decode(substr($headers[2], strlen('Dropbox-API-Arg: ')), true);
	checkDropbox($arguments['resource']['path']==='rev:abcdef123' && $arguments['size']==='w1024h768', 'Preview not pinned to revision.');
	$previewCalls++;
	return array(200, $bytes);
};
checkDropbox($sync->next($suid)===1.0 && $sync->next($suid)===1.0 && $previewCalls===1, 'Preview was not reused.');
$path = SA_DIR_STORAGE . "/$suid/$key";
$oldTime = filemtime($path);
$changed = $file; $changed['rev'] = 'abcdef456';
Records::syncDropboxImages($suid, array($changed));
DropboxClient::$transport = fn () => array(200, 'not an image');
rejectsDropbox(fn () => $sync->next($suid));
checkDropbox(file_get_contents($path)===$bytes && Records::dropboxImages($suid)[0]['metadata']['preview_rev']==='abcdef123', 'Failed thumbnail damaged the saved preview.');
DropboxClient::$transport = fn () => array(200, $bytes);
checkDropbox($sync->next($suid)===1.0 && filemtime($path)>$oldTime, 'Changed revision did not invalidate derivatives.');
$large = $changed; $large['size'] = 50 * 1024 * 1024; $large['rev'] = 'abcdef789';
Records::syncDropboxImages($suid, array($large));
rejectsDropbox(fn () => $sync->next($suid));
Records::syncDropboxImages($suid, array());
checkDropbox(Records::imageRows($suid)===array() && $sync->next($suid)===1.0, 'Empty folder failed.');
checkDropbox(Proofing::rows($suid, $session)===$selections, 'Empty sync erased proofing.');
// Leave one active image for the shell HTTP checks.
Records::syncDropboxImages($suid, array($changed));
file_put_contents('/tmp/dropbox-key', $key);
echo "PASS Dropbox pagination, failure rollback, stable identity, selections, missing files, categories and preview revisions\n";
