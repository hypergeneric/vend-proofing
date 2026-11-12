<?php

// Run only inside the disposable basic-set fixture.
define("SA_DIR_AUTH", "vend-proofing-data/auth");
require "vend-proofing-core/php/classes/simpleadmin/Database.php";
require "vend-proofing-core/php/classes/simpleadmin/Records.php";

Records::addMedia("asset", "asset", array("synthetic-a.jpg", "First", "20x30", "", "42", "First description"));
Records::addMedia("asset", "asset", array(
	"synthetic-b.jpg", "Second", "40x50", "", "84", "Second description",
	"https://example.invalid/media", "vimeo"
));

$rows = Records::getFileTable("asset");
if (array_keys($rows)!==array("synthetic-a.jpg", "synthetic-b.jpg")) exit(1);
if (count($rows["synthetic-b.jpg"])!==8 || $rows["synthetic-b.jpg"][7]!=="vimeo") exit(1);

Records::updateMedia("asset", "asset", array("synthetic-a.jpg", null, "24x36", null, null, "Edited description"));
$edited = Records::getFileTable("asset")["synthetic-a.jpg"];
if ($edited[1]!=="First" || $edited[2]!=="24x36" || $edited[5]!=="Edited description") exit(1);

// A failed insert must leave the original row and order intact.
try {
	Records::addMedia("asset", "asset", array("synthetic-a.jpg", "Duplicate"));
	exit(1);
} catch (PDOException $error) {
	// The public key is unique.
}
if (count(Records::getFileTable("asset"))!==2) exit(1);
