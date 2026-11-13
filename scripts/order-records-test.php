<?php

// Order snapshots now require real configured prices rather than arbitrary posted quotes.
define('SA_DIR_AUTH', 'vend-proofing-data/auth');
define('SA_DIR_STORAGE', 'vend-proofing-data/storage');
define('SA_DIR_DEFAULTS', 'vend-proofing-core/defaults');
define('SA_DIR_LANG', 'vend-proofing-core/lang');
spl_autoload_register(function ($name) { require 'vend-proofing-core/php/classes/simpleadmin/' . $name . '.php'; });
function checkOrder ($condition, $message) { if (!$condition) throw new RuntimeException($message); }
$gallery = $argv[1]; $image = $argv[2];
$before = Configuration::getJson('uploadset', $gallery);
$group = Database::allocateSuid();
Records::savePricingGroup('formatset', $group, array('Order fixture'));
Records::savePricingItem('format', Database::allocateSuid(), $group, array('Eight by Ten', '8', '10', '13.50', '0'));
$config = Configuration::getDocument('uploadset', $gallery);
$config->editNode('data.settings.format_set', $group);
Configuration::save('uploadset', $gallery, $config->toString());
$email = 'buyer@example.invalid'; $session = Proofing::open($gallery, $email);
$favorite = array('buyer-f', $gallery, $image, 'Photo.jpg', '640', '480');
$print = array('buyer-print', $gallery, $image, 'Photo.jpg', '2', 'color', 'Eight by Ten', '.8', '13.50', '0', 'portrait', '0', '0', '', '0', '0', '', '0', '0', '13.50', '0', 'Keep full frame');
Proofing::save($gallery, $session, 'favorites', $favorite);
Proofing::save($gallery, $session, 'cart', $print);
$id = OrderRecords::prequalify($gallery, $session, '', '', '27');
$row = array($id, $gallery, '0', 'offline', '', 'ship', '', 'Buyer', $email, '555-0100', '123 Example St', 'US', '90000', 'CA',
	'27.00', '27.00', '0.00', '0.00', '0.00', '0.00', '0', 'false', 'false', 'false', 'Leave by door');
$bad = $row; $bad[15] = '1';
try { OrderRecords::create($gallery, $session, $bad, 'USD'); throw new RuntimeException('False subtotal accepted.'); }
catch (InvalidArgumentException $error) {
	checkOrder(OrderRecords::get($id)===null && isset(Proofing::rows($gallery, $session)['buyer-print']), 'Rejected order damaged records.');
}
checkOrder(OrderRecords::create($gallery, $session, $row, 'USD'), 'Order not created.');
$stored = OrderRecords::get($id); $row[2] = $stored[2];
checkOrder($stored===$row, 'Order projection changed.');
$items = OrderRecords::items($id);
checkOrder($items['buyer-print']===$print && $items['buyer-f']===$favorite, 'Selection snapshots changed.');
checkOrder(count(Proofing::rows($gallery, $session))===1, 'Purchased cart was not cleared while favorites stayed.');
checkOrder(!OrderRecords::create($gallery, $session, $row, 'USD'), 'Replay created another order.');
checkOrder(Payments::get($id)['status']==='pending', 'Offline order incorrectly paid.');
checkOrder(str_contains(OrderRecords::search(date('Y/n/j'), date('Y/n/j'), array()), $id), 'Order search failed.');
checkOrder(str_contains(OrderRecords::stats(date('Y/n/j'), date('Y/n/j')), '27.00'), 'Order statistics failed.');
OrderRecords::log($id, "Synthetic result\n");
checkOrder(OrderRecords::getLog($id)==="Synthetic result\n", 'Log changed.');
try { Records::deletePage($gallery); throw new RuntimeException('Purchased gallery deleted.'); }
catch (PDOException $error) { checkOrder(OrderRecords::get($id)!==null, 'Failed deletion damaged order.'); }
OrderRecords::delete($id);
checkOrder(OrderRecords::get($id)===null && OrderRecords::items($id)===array() && OrderRecords::getLog($id)===null, 'Order cleanup failed.');
Proofing::deleteSession($gallery, $session);
Records::deleteSetRow('formatset', $group, null);
Configuration::save('uploadset', $gallery, $before);
checkOrder(!file_exists('vend-proofing-data/storage/orders'), 'Order table files were written.');
echo "PASS configured order quote, immutable snapshot, retries, search, statistics, log and cleanup\n";
