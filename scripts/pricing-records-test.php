<?php

// Run only inside the disposable basic-set fixture.
define("SA_DIR_AUTH", "vend-proofing-data/auth");
require "vend-proofing-core/php/classes/simpleadmin/Database.php";
require "vend-proofing-core/php/classes/simpleadmin/Records.php";

$db = Database::connection();
foreach (array("package", "product") as $kind) {
	$group = $db->prepare("SELECT suid FROM pricing_groups WHERE kind = ?");
	$group->execute(array($kind));
	$groupSuid = $group->fetchColumn();
	if (!$groupSuid) exit(1);

	$imageKey = "synthetic-$kind-cover.jpg";
	Records::addMedia($kind, $kind, array($imageKey, "Cover", "20x30", "", "100", ""));
	$itemSuid = Database::allocateSuid();
	Records::saveSetRow($kind, $itemSuid, $groupSuid, array(
		"Test $kind", $imageKey, "base_price * 1.25", "quantity + 2", "Markdown description"
	));
	$rows = Records::getSetTable($kind, $groupSuid);
	if (count($rows)!==1 || $rows[$itemSuid][2]!==$imageKey) exit(1);
	if ($rows[$itemSuid][3]!=="base_price * 1.25" || $rows[$itemSuid][5]!=="Markdown description") exit(1);

	$first = Database::allocateSuid();
	$second = Database::allocateSuid();
	Records::saveSetRow("lineitem", $first, $itemSuid, array("Eight by Ten", "2", "8", "10"));
	Records::saveSetRow("lineitem", $second, $itemSuid, array("Five by Seven", "1", "5", "7"));
	Records::reorderSetRows("lineitem", $itemSuid, 0, 1);
	$lines = Records::getSetTable("lineitem", $itemSuid);
	if (array_keys($lines)!==array($second, $first)) exit(1);
	Records::saveSetRow("lineitem", $first, $itemSuid, array(null, "3", null, null));
	$lines = Records::getSetTable("lineitem", $itemSuid);
	if ($lines[$first]!==array($first, "Eight by Ten", "3", "8", "10")) exit(1);
	Records::deleteSetRow("lineitem", $second, $itemSuid);
	if (count(Records::getSetTable("lineitem", $itemSuid))!==1) exit(1);

	$copy = Records::duplicateSet($kind . "set", $groupSuid, "Copied $kind");
	$copiedItems = Records::getSetTable($kind, $copy);
	if (count($copiedItems)!==1) exit(1);
	$copiedItem = reset($copiedItems);
	if ($copiedItem[2]!==$imageKey || $copiedItem[3]!=="base_price * 1.25") exit(1);
	if (count(Records::getSetTable("lineitem", $copiedItem[0]))!==1) exit(1);
	Records::deleteSetRow($kind . "set", $copy, null);
}
