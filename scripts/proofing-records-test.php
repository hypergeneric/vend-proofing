<?php

define("SA_DIR_AUTH", "vend-proofing-data/auth");
require __DIR__ . "/../dist/vend-proofing-core/php/classes/simpleadmin/Database.php";
require __DIR__ . "/../dist/vend-proofing-core/php/classes/simpleadmin/Records.php";
require __DIR__ . "/../dist/vend-proofing-core/php/classes/simpleadmin/Proofing.php";

function checkProofing ($condition, $message) {
	if (!$condition) throw new RuntimeException($message);
}

$gallery = $argv[1];
$image = $argv[2];
$email = "customer@example.invalid";
$key = Proofing::open($gallery, $email);
checkProofing($key===md5($email), "Session key changed.");
checkProofing(Proofing::open($gallery, $email)===$key, "Session was duplicated.");

$favorite = array("favorite-f", $gallery, $image, "Photo.jpg", "640", "480");
Proofing::save($gallery, $key, "favorites", $favorite);
checkProofing(Proofing::rows($gallery, $key)["favorite-f"]===$favorite, "Favorite did not round trip.");

$print = array("print-one", $gallery, $image, "Photo.jpg", "2", "color", "Eight by Ten",
	"0.8", "10", "1", "portrait", "0", "0", "Matte", "2", "0",
	"Retouch", "1", "0", "13.50", "1.25", "Keep the full frame");
Proofing::save($gallery, $key, "cart", $print);
$download = array("download-d", $gallery, $image, "Photo.jpg", "640x480", "high", "4.25", "1");
Proofing::save($gallery, $key, "download", $download);
$package = array("package-p", "package", "For Mom", "Print Package", "1", "50", "5",
	"%:Eight%20by%20Ten", "2", "0.8", "80");
Proofing::save($gallery, $key, "package", $package);
$allocation = $print;
$allocation[0] = "print:package";
Proofing::save($gallery, $key, "cart", $allocation);

$rows = Proofing::rows($gallery, $key);
checkProofing($rows["print-one"]===$print, "Print selection changed.");
checkProofing($rows["download-d"]===$download, "Download selection changed.");
checkProofing($rows["package-p"]===$package, "Package selection changed.");
checkProofing($rows["print:package"]===$allocation, "Package allocation changed.");
$summary = Proofing::sessionRows($gallery)[$key];
checkProofing($summary[1]===$email && $summary[2]==="5" && $summary[4]==="1", "Session counts changed.");
checkProofing(abs((float) $summary[3] - 118.25)<0.001, "Session total changed.");

$db = Database::connection();
checkProofing((int) $db->query("SELECT COUNT(*) FROM favorites")->fetchColumn()===1, "Favorite is not relational.");
checkProofing((int) $db->query("SELECT COUNT(*) FROM cart_items")->fetchColumn()===4, "Cart items are not relational.");
checkProofing((int) $db->query("SELECT COUNT(*) FROM cart_items WHERE item_type = 'allocation' AND parent_item_id IS NOT NULL")->fetchColumn()===1, "Package allocation lost its parent.");
checkProofing(!file_exists("vend-proofing-data/storage/$gallery/set.session.table"), "Session table file was created.");
checkProofing(!file_exists("vend-proofing-data/storage/$gallery/set.$key.table"), "Selection table file was created.");

Proofing::deleteItem($gallery, $key, "cart", "print-one");
checkProofing(!isset(Proofing::rows($gallery, $key)["print-one"]), "Print was not deleted.");
Proofing::clear($gallery, $key, "download");
checkProofing(!isset(Proofing::rows($gallery, $key)["download-d"]), "Download was not cleared.");
Proofing::deleteItem($gallery, $key, "package", "package-p");
checkProofing(!isset(Proofing::rows($gallery, $key)["print:package"]), "Package allocation was not deleted with its package.");
Proofing::clear($gallery, $key, "cart");
checkProofing(count(Proofing::rows($gallery, $key))===1, "Cart clear removed favorites or left cart items.");
Proofing::addDownloads($gallery, $key, "favorites", "high", 6.50, false);
$downloadRows = Proofing::responseRows($gallery, $key, "download");
checkProofing(count($downloadRows)===1 && (string) array_values($downloadRows)[0][6]==="6.5", "Favorite bulk download changed.");
try {
	Proofing::save($gallery, $key, "cart", array("bad-image", $gallery, "absent.jpg", "Missing", "1"));
	throw new RuntimeException("Invalid image was accepted.");
} catch (InvalidArgumentException $error) {
	checkProofing(count(Proofing::responseRows($gallery, $key, "download"))===1, "Failed write changed the cart.");
}
Proofing::deleteSession($gallery, $key);
checkProofing(Proofing::sessionRows($gallery)===array(), "Session was not deleted.");

echo "PASS relational proofing favorites, prints, downloads, packages, allocations, totals, and cleanup\n";
