<?php

// Run only inside the disposable basic-set fixture.
$suid = $argv[1];
define("SA_DIR_AUTH", "vend-proofing-data/auth");
require "vend-proofing-core/php/classes/simpleadmin/Database.php";
require "vend-proofing-core/php/classes/simpleadmin/Records.php";

$categoryKey = md5("Ceremony");
$remotePath = "/$suid/Ceremony/a.jpg";
$image = array("ceremony-a.jpg", $remotePath, "0x0", "", "0", "", $categoryKey, $remotePath);
Records::replaceDropboxImages($suid, array($categoryKey => "Ceremony"), array($image));

$rows = Records::getFileTable("image", $suid);
if (count($rows)!==1 || count($rows["ceremony-a.jpg"])!==8) exit(1);
if ($rows["ceremony-a.jpg"][6]!==$categoryKey || $rows["ceremony-a.jpg"][7]!==$remotePath) exit(1);

Records::updateDropboxThumbnail($suid, "ceremony-a.jpg", "a.jpg", 640, 480, 12345);
$row = Records::getFileTable("image", $suid)["ceremony-a.jpg"];
if ($row[1]!=="a.jpg" || $row[2]!=="640x480" || $row[4]!=="12345") exit(1);

$categories = Records::getSetTable("category", $suid);
if ($categories[$categoryKey][2]!=="1") exit(1);

// A failed replacement must leave the preceding index intact.
$duplicate = array("duplicate.jpg", "/$suid/a.jpg", "0x0", "", "0", "", "", "/$suid/a.jpg");
$second = $duplicate;
$second[1] = "/$suid/b.jpg";
try {
	Records::replaceDropboxImages($suid, array(), array($duplicate, $second));
	exit(1);
} catch (PDOException $error) {
	// The duplicate public key violates the unique constraint.
}

if (count(Records::getFileTable("image", $suid))!==1) exit(1);
if (count(Records::getSetTable("category", $suid))!==1) exit(1);
