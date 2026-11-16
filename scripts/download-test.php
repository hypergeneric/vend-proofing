<?php

// Included by payment-test.php with a paid synthetic Dropbox order ($id).
$db = Database::connection();
$itemQuery = $db->prepare("SELECT items.* FROM order_items AS items JOIN orders ON orders.id = items.order_id WHERE orders.suid = ? AND items.item_type = 'download'");
$itemQuery->execute(array($id));
$purchased = $itemQuery->fetch();
$itemQuery->closeCursor();
$source = json_decode($purchased['formula_snapshot_json'], true)['download_source'];
checkPayment($source['id']==='id:digital-a' && $source['rev']==='abcdef123', 'Purchase did not freeze the source.');
// Add a web rendition to this synthetic order to exercise both delivery paths.
$low = $source; $low['quality'] = 'low'; $low['name'] = 'a.png';
$db->prepare("INSERT INTO order_items (order_id, item_type, description, quantity, unit_minor, shipping_minor, selection_snapshot_json, formula_snapshot_json, position, public_key)
	VALUES (?, 'download', 'Web fixture', 1, 0, 0, '{}', ?, 1, 'web-fixture-d')")
	->execute(array($purchased['order_id'], json_encode(array('download_source' => $low))));
$ordering = Configuration::getDocument('ordering');
$ordering->editNode('data.payment_gateway.dropbox_refresh_token', 'test-refresh');
$ordering->editNode('data.payment_gateway.dropbox_token', 'test-access');
$ordering->editNode('data.payment_gateway.dropbox_expires_at', (string) (time() + 3600));
Configuration::save('ordering', null, $ordering->toString());
$image = imagecreatetruecolor(8, 6); ob_start(); imagejpeg($image); $jpeg = ob_get_clean();
$remote = array(); $calls = array(); $failCopy = true; $failLow = true; $shared = array();
DropboxClient::$transport = function ($url, $body, $headers) use (&$remote, &$calls, &$failCopy, &$failLow, &$shared, $source, $jpeg) {
	$route = substr($url, strpos($url, '/2/') + 3);
	$calls[] = $route;
	$args = json_decode($body, true);
	foreach ($headers as $header) if (str_starts_with($header, 'Dropbox-API-Arg: ')) $args = json_decode(substr($header, 17), true);
	switch ($route) {
		case 'files/copy_reference/get':
			checkPayment($args['path']==='rev:abcdef123', 'Delivery used a current path instead of the purchased revision.');
			return array(200, json_encode(array('copy_reference' => 'frozen-copy', 'metadata' => array('id' => $source['id'], 'rev' => $source['rev'], 'content_hash' => 'original-hash'))));
		case 'files/get_metadata':
			return isset($remote[$args['path']]) ? array(200, json_encode($remote[$args['path']])) : array(409, '{"error":{".tag":"path","path":{".tag":"not_found"}}}');
		case 'files/copy_reference/save':
			checkPayment($args['copy_reference']==='frozen-copy', 'Wrong copy reference.');
			$remote[$args['path']] = array('content_hash' => 'original-hash');
			if ($failCopy) { $failCopy = false; return array(503, 'lost response'); }
			return array(200, json_encode(array('metadata' => $remote[$args['path']])));
		case 'files/get_thumbnail_v2':
			checkPayment($args['resource']['path']==='rev:abcdef123', 'Web image was not revision-specific.');
			if ($failLow) return array(409, '{"error":{".tag":"path","path":{".tag":"not_found"}}}');
			return array(200, $jpeg);
		case 'files/upload':
			checkPayment($body===$jpeg && str_ends_with($args['path'], '.jpg') && $args['mode']==='overwrite', 'Web-size content/extension changed.');
			$remote[$args['path']] = array('size' => strlen($body));
			return array(200, json_encode($remote[$args['path']]));
		case 'sharing/list_shared_links': return array(200, json_encode(array('links' => isset($shared[$args['path']]) ? array(array('url' => $shared[$args['path']])) : array())));
		case 'sharing/create_shared_link_with_settings':
			$shared[$args['path']] = 'https://www.dropbox.com/scl/fo/example?rlkey=keep-me&dl=0';
			return array(200, json_encode(array('url' => $shared[$args['path']])));
		case 'files/delete_v2':
			checkPayment(str_starts_with($args['path'], '/vend-deliveries/'), 'Cleanup touched the old archive.');
			foreach (array_keys($remote) as $path) if (str_starts_with($path, $args['path'] . '/')) unset($remote[$path]);
			return array(200, '{}');
	}
	throw new RuntimeException('Unexpected Dropbox route: ' . $route);
};
$_SESSION['authorized_order'] = 'wrong';
rejectsPayment(fn () => Downloads::prepare($id), 'Wrong session started delivery.');
checkPayment(Downloads::status($id)['started']===false && !$calls, 'Status contacted Dropbox.');
$_SESSION['authorized_order'] = $id;
Downloads::prepare($id); Downloads::prepare($id);
checkPayment(countPayment('download_jobs')===1 && !$calls, 'Preparation was not idempotent/local.');
rejectsPayment(fn () => Downloads::links($id), 'Incomplete package was shared.');
$lock = fopen(SA_DIR_AUTH . '/download-' . hash('sha256', $id) . '.lock', 'c'); flock($lock, LOCK_EX);
rejectsPayment(fn () => Downloads::next($id), 'Concurrent preparation was accepted.');
flock($lock, LOCK_UN); fclose($lock);
// Gallery changes cannot rewrite an already purchased source.
Records::syncDropboxImages($digitalGallery, array(
	array('id' => 'id:digital-a', 'name' => 'renamed.jpg', 'path_lower' => '/b1/renamed.jpg', 'path_display' => '/b1/renamed.jpg', 'rev' => 'abcdef456', 'size' => 2)
));
rejectsPayment(fn () => Downloads::next($id), 'Lost copy response was ignored.');
checkPayment(Downloads::status($id)['progress']===0.0, 'Lost response marked file complete.');
rejectsPayment(fn () => Downloads::next($id), 'Missing preview was skipped.');
checkPayment(Downloads::status($id)['progress']===0.5 && count($remote)===1, 'Retry did not retain completed original.');
rejectsPayment(fn () => Downloads::links($id), 'Partial package was shared.');
$failLow = false;
checkPayment(Downloads::next($id)===1.0 && count($remote)===2, 'Retry did not finish all images.');
$before = count($calls); checkPayment(Downloads::next($id)===1.0 && count($calls)===$before, 'Completed files copied again.');
for ($n=0; $n<3; $n++) {
	$links = Downloads::links($id);
	checkPayment(count($links)===1 && str_contains($links[0], 'rlkey=keep-me') && str_contains($links[0], 'dl=1'), 'Download URL lost Dropbox parameters.');
}
checkPayment(Downloads::links($id)===array(), 'Server did not enforce issuance limit.');
Downloads::reset($id); checkPayment(Downloads::status($id)['count']===0, 'Owner reset failed.');
checkPayment(Downloads::purge(86400)===array(), 'Fresh package purged.');
$db->exec('UPDATE download_jobs SET updated_at = 1');
checkPayment(Downloads::purge(86400)[0]['deleted'] && !$remote && !Downloads::status($id)['started'], 'Expired tracked package not deleted.');
// Two 600 MB originals must occupy two nonempty parts (the old code lost the boundary size).
$large = $source; $large['size'] = 600000000;
$db->prepare("UPDATE order_items SET formula_snapshot_json = ? WHERE order_id = ? AND item_type = 'download'")
	->execute(array(json_encode(array('download_source' => $large)), $purchased['order_id']));
Downloads::prepare($id);
$jobQuery = $db->prepare('SELECT state_json FROM download_jobs WHERE order_suid = ?');
$jobQuery->execute(array($id)); $job = json_decode($jobQuery->fetchColumn(), true); $jobQuery->closeCursor();
checkPayment($job['parts']===2 && str_starts_with($job['items'][0]['path'], '/part-1/') && str_starts_with($job['items'][1]['path'], '/part-2/'), 'Part boundary lost or created an empty part.');
Downloads::delete($id);
Downloads::delete('old-archive-order');
DropboxClient::$transport = null;
echo "PASS download snapshots, session access, local status, interrupted copies, missing images, retries, JPEG delivery, link limits and owned cleanup\n";
