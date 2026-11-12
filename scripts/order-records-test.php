<?php

define("SA_DIR_AUTH", "vend-proofing-data/auth");
define("SA_DIR_STORAGE", "vend-proofing-data/storage");
define("SA_DIR_DEFAULTS", "vend-proofing-core/defaults");
require __DIR__ . "/../vend-proofing-core/php/classes/simpleadmin/Filesystem.php";
require __DIR__ . "/../vend-proofing-core/php/classes/simpleadmin/SimpleXML4.php";
require __DIR__ . "/../vend-proofing-core/php/classes/simpleadmin/Flatfile.php";
require __DIR__ . "/../vend-proofing-core/php/classes/simpleadmin/Database.php";
require __DIR__ . "/../vend-proofing-core/php/classes/simpleadmin/Records.php";
require __DIR__ . "/../vend-proofing-core/php/classes/simpleadmin/Proofing.php";
require __DIR__ . "/../vend-proofing-core/php/classes/simpleadmin/OrderRecords.php";

function checkOrder ($condition, $message) {
	if (!$condition) throw new RuntimeException($message);
}

$gallery = $argv[1];
$image = $argv[2];
$email = "buyer@example.invalid";
$session = Proofing::open($gallery, $email);
$favorite = array("buyer-f", $gallery, $image, "Photo.jpg", "640", "480");
$print = array("buyer-print", $gallery, $image, "Photo.jpg", "2", "color", "Eight by Ten",
	"0.8", "10", "1", "portrait", "0", "0", "Matte", "2", "0",
	"Retouch", "1", "0", "13.50", "1.25", "Keep the full frame");
Proofing::save($gallery, $session, "favorites", $favorite);
Proofing::save($gallery, $session, "cart", $print);

$id = Database::allocateSuid();
$now = time() * 1000;
$row = array($id, $gallery, (string) $now, "offline", "", "standard", "",
	"Sample Buyer", $email, "555-0100", "123 Example St", "US", "90000", "CA",
	"27.00", "27.00", "0.00", "0.00", "0.00", "0.00", "7.25",
	"false", "false", "false", "Leave by door");
try {
	$bad = $row;
	$bad[15] = "1.00";
	OrderRecords::create($gallery, $session, $bad, "USD");
	throw new RuntimeException("Mismatched order quote was accepted.");
} catch (InvalidArgumentException $error) {
	checkOrder(OrderRecords::get($id)===null, "Failed order was committed.");
	checkOrder(isset(Proofing::rows($gallery, $session)["buyer-print"]), "Failed order cleared cart.");
}

checkOrder(OrderRecords::create($gallery, $session, $row, "USD"), "Order was not created.");
checkOrder(OrderRecords::get($id)===$row, "Order row projection changed.");
$items = OrderRecords::items($id);
checkOrder($items["buyer-print"]===$print && $items["buyer-f"]===$favorite, "Purchase snapshot changed.");
checkOrder(count(Proofing::rows($gallery, $session))===1, "Order did not clear cart and keep favorites.");
checkOrder((int) Database::connection()->query("SELECT COUNT(*) FROM payments")->fetchColumn()===1, "Payment status not stored.");
checkOrder((int) Database::connection()->query("SELECT COUNT(*) FROM order_items")->fetchColumn()===2, "Order items not stored.");
try {
	Records::deletePage($gallery);
	throw new RuntimeException("Purchased gallery media was deleted.");
} catch (PDOException $error) {
	checkOrder(OrderRecords::get($id)!==null, "Failed gallery deletion damaged the order.");
	checkOrder(isset(Proofing::rows($gallery, $session)["buyer-f"]), "Failed gallery deletion damaged proofing.");
}
checkOrder(OrderRecords::create($gallery, $session, $row, "USD")===false, "Order replay was not recognized.");
checkOrder((int) Database::connection()->query("SELECT COUNT(*) FROM orders")->fetchColumn()===1, "Order replay duplicated the order.");
try {
	OrderRecords::validateBeforePayment($gallery, $session, $row);
	throw new RuntimeException("Existing order reached payment preflight.");
} catch (InvalidArgumentException $error) {
	checkOrder($error->getMessage()==="Order already exists.", "Unexpected replay preflight error.");
}

$date = date("Y/n/j");
checkOrder(str_contains(OrderRecords::search($date, $date, array()), $id), "Order search omitted the order.");
checkOrder(str_contains(OrderRecords::stats($date, $date), "27.00"), "Order statistics omitted the order.");
OrderRecords::log($id, "Synthetic payment result\n");
checkOrder(OrderRecords::getLog($id)==="Synthetic payment result\n", "Payment log changed.");
checkOrder(!file_exists("vend-proofing-data/storage/orders"), "Order table files were created.");

OrderRecords::delete($id);
checkOrder(OrderRecords::get($id)===null && OrderRecords::items($id)===array(), "Order deletion failed.");
checkOrder(OrderRecords::getLog($id)===null, "Payment log was not deleted.");

$discountSuid = Database::allocateSuid();
Records::saveSetRow("discount", $discountSuid, $gallery,
	array($gallery, "SAVE10", "10", "percentage", "0", "1", "", "0", "0"));
Proofing::save($gallery, $session, "cart", $print);
$discounted = $row;
$discounted[0] = Database::allocateSuid();
$discounted[6] = "SAVE10";
$discounted[16] = "2.70";
$discounted[14] = "24.30";
checkOrder(OrderRecords::verifyDiscountCode($gallery, "SAVE10", "27.00")===
	array(true, implode("\t", Records::getSetTable("discount", $gallery)[$discountSuid])),
	"Discount verification changed the storefront row.");
checkOrder(OrderRecords::verifyDiscountCode($gallery, "UNKNOWN", "27.00")===
	array(false, "discount_does_not_exist"), "Unknown discount did not return its language key.");
$expiredSuid = Database::allocateSuid();
Records::saveSetRow("discount", $expiredSuid, $gallery,
	array($gallery, "EXPIRED", "10", "percentage", "0", "1", (string) ((time() - 86400) * 1000), "0", "0"));
checkOrder(OrderRecords::verifyDiscountCode($gallery, "EXPIRED", "27.00")===
	array(false, "discount_expired"), "Expired discount did not return its language key.");
try {
	OrderRecords::prequalify($gallery, $session, "", "EXPIRED", "27.00");
	throw new RuntimeException("Expired discount was reserved.");
} catch (InvalidArgumentException $error) {
	checkOrder($error->getMessage()==="discount_expired", "Prequalification used a different expiry rule.");
}
Records::deleteSetRow("discount", $expiredSuid, $gallery);
$localTimeSuid = Database::allocateSuid();
Records::saveSetRow("discount", $localTimeSuid, $gallery,
	array($gallery, "LOCALTIME", "10", "percentage", "0", "1", (string) ((time() - 3600) * 1000), "0", "0"));
checkOrder(OrderRecords::verifyDiscountCode($gallery, "LOCALTIME", "27.00")[0]===true,
	"Discount expiration ignored the photographer's configured timezone.");
Records::deleteSetRow("discount", $localTimeSuid, $gallery);
$minimumSuid = Database::allocateSuid();
Records::saveSetRow("discount", $minimumSuid, $gallery,
	array($gallery, "MINIMUM", "10", "percentage", "0", "1", "", "28.00", "0"));
checkOrder(OrderRecords::verifyDiscountCode($gallery, "MINIMUM", "27.00")===
	array(false, "discount_cart_minimum_not_fulfilled"), "Cart minimum did not return its language key.");
try {
	OrderRecords::prequalify($gallery, $session, "", "MINIMUM", "27.00");
	throw new RuntimeException("Discount below cart minimum was reserved.");
} catch (InvalidArgumentException $error) {
	checkOrder($error->getMessage()==="discount_cart_minimum_not_fulfilled",
		"Prequalification used a different cart minimum rule.");
}
Records::deleteSetRow("discount", $minimumSuid, $gallery);
try {
	OrderRecords::prequalify($gallery, $session, $discounted[0], "SAVE10", "26.00");
	throw new RuntimeException("A false cart subtotal claimed a discount use.");
} catch (InvalidArgumentException $error) {
	checkOrder($error->getMessage()==="Order subtotal differs from cart.", "Unexpected cart quote error.");
	checkOrder((int) Database::connection()->query("SELECT use_count FROM discounts WHERE code = 'SAVE10'")->fetchColumn()===0,
		"Rejected cart quote claimed a discount use.");
}
checkOrder(OrderRecords::prequalify($gallery, $session, $discounted[0], "SAVE10", "27.00")===$discounted[0],
	"Discount reservation changed the order identifier.");
checkOrder((int) Database::connection()->query("SELECT use_count FROM discounts WHERE code = 'SAVE10'")->fetchColumn()===1,
	"Prequalification did not claim a discount use.");
checkOrder(OrderRecords::prequalify($gallery, $session, $discounted[0], "SAVE10", "27.00")===$discounted[0],
	"Identical retry changed the order identifier.");
checkOrder((int) Database::connection()->query("SELECT use_count FROM discounts WHERE code = 'SAVE10'")->fetchColumn()===1,
	"Identical retry claimed another discount use.");
try {
	OrderRecords::prequalify($gallery, $session, Database::allocateSuid(), "SAVE10", "27.00");
	throw new RuntimeException("An already claimed discount funded another order.");
} catch (InvalidArgumentException $error) {
	checkOrder($error->getMessage()==="discount_maximum_uses_filled", "Unexpected discount limit error.");
}
checkOrder(OrderRecords::verifyDiscountCode($gallery, "SAVE10", "27.00")===
	array(false, "discount_maximum_uses_filled"), "Discount limit did not return its language key.");
OrderRecords::validateBeforePayment($gallery, $session, $discounted);
$invalidDiscount = $discounted;
$invalidDiscount[16] = "3.00";
$invalidDiscount[14] = "24.00";
try {
	OrderRecords::validateBeforePayment($gallery, $session, $invalidDiscount);
	throw new RuntimeException("Wrong discount amount was accepted.");
} catch (InvalidArgumentException $error) {
	checkOrder((int) Database::connection()->query("SELECT use_count FROM discounts WHERE code = 'SAVE10'")->fetchColumn()===1,
		"Invalid payment quote released the reserved discount.");
}
OrderRecords::create($gallery, $session, $discounted, "USD");
checkOrder((int) Database::connection()->query("SELECT use_count FROM discounts WHERE code = 'SAVE10'")->fetchColumn()===1,
	"Completed order counted its discount twice.");
checkOrder((int) Database::connection()->query("SELECT COUNT(*) FROM discount_redemptions")->fetchColumn()===1,
	"Discount redemption is missing.");
checkOrder((int) Database::connection()->query("SELECT COUNT(*) FROM discount_reservations")->fetchColumn()===0,
	"Completed order kept its reservation.");
OrderRecords::delete($discounted[0]);
checkOrder((int) Database::connection()->query("SELECT use_count FROM discounts WHERE code = 'SAVE10'")->fetchColumn()===0,
	"Order deletion did not release the discount use.");
Proofing::save($gallery, $session, "cart", $print);
$abandonedId = OrderRecords::prequalify($gallery, $session, "", "SAVE10", "27.00");
checkOrder($abandonedId!==$discounted[0], "Abandoned checkout reused a completed order identifier.");
checkOrder((int) Database::connection()->query("SELECT use_count FROM discounts WHERE code = 'SAVE10'")->fetchColumn()===1,
	"Abandoned checkout did not retain its claim.");
Records::deleteSetRow("discount", $discountSuid, $gallery);
checkOrder((int) Database::connection()->query("SELECT COUNT(*) FROM discount_reservations")->fetchColumn()===0,
	"Deleting an unused discount left its reservation behind.");
Proofing::clear($gallery, $session, "cart");

$package = array("buyer-package-p", "package", "For Mom", "Print Package", "1", "50", "0",
	"%:Eight%20by%20Ten", "2", "0.8", "80");
$allocation = $print;
$allocation[0] = "buyer-print:buyer-package";
Proofing::save($gallery, $session, "package", $package);
Proofing::save($gallery, $session, "cart", $allocation);
$packageOrder = $row;
$packageOrder[0] = Database::allocateSuid();
$packageOrder[14] = "79.50";
$packageOrder[15] = "77.00";
$packageOrder[17] = "2.50";
OrderRecords::create($gallery, $session, $packageOrder, "USD");
$packageItems = OrderRecords::items($packageOrder[0]);
checkOrder($packageItems["buyer-package-p"]===$package, "Package purchase snapshot changed.");
checkOrder($packageItems["buyer-print:buyer-package"]===$allocation, "Allocation purchase snapshot changed.");
checkOrder((int) Database::connection()->query("SELECT COUNT(*) FROM order_items WHERE item_type = 'allocation' AND parent_item_id IS NOT NULL")->fetchColumn()===1,
	"Order allocation lost its package relationship.");
OrderRecords::delete($packageOrder[0]);
Proofing::deleteSession($gallery, $session);
echo "PASS relational order snapshot, quote check, search, statistics, payment log, and cleanup\n";
