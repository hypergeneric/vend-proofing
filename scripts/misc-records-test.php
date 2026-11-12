<?php

// Run only inside the disposable basic-set fixture.
define("SA_DIR_AUTH", "vend-proofing-data/auth");
require "vend-proofing-core/php/classes/simpleadmin/Database.php";
require "vend-proofing-core/php/classes/simpleadmin/Records.php";

$db = Database::connection();
$gallery = $db->query("SELECT suid FROM pages WHERE title = 'Basic Gallery'")->fetchColumn();
if (!$gallery) exit(1);

$download = Database::allocateSuid();
Records::saveSetRow("downloadset", $download, null, array("Web delivery"));
if (Records::getSetTable("downloadset")[$download]!==array($download, "Web delivery")) exit(1);

$global = Database::allocateSuid();
$local = Database::allocateSuid();
Records::saveSetRow("discount", $global, null, array("", "SAVE10", "10", "percentage", "0", "5", "", "25.50", "1"));
Records::saveSetRow("discount", $local, $gallery, array($gallery, "SAVE10", "5", "exact", "0", "", "", "10", "0"));
if (Records::getSetTable("discount")[$global][8]!=="25.50") exit(1);
if (Records::getSetTable("discount", $gallery)[$local][1]!==$gallery) exit(1);
if (Records::getSetTable("discount", $gallery)[$local][5]!=="0") exit(1);
if (Records::getSetTable("discount")[$global][5]!=="0") exit(1);

Records::saveSetRow("ustaxchart", "CA", null, array("California", "", "7.25"));
Records::saveSetRow("cataxchart", "ON", null, array("Ontario", "13", "0", "0"));
Records::saveSetRow("vattaxchart", "GB", null, array("United Kingdom", "20"));
if (Records::getSetTable("ustaxchart")["CA"]!==array("CA", "California", "", "7.25")) exit(1);
if (Records::getSetTable("cataxchart")["ON"]!==array("ON", "Ontario", "13", "0", "0")) exit(1);
if (Records::getSetTable("vattaxchart")["GB"]!==array("GB", "United Kingdom", "20")) exit(1);

$field = Database::allocateSuid();
Records::saveSetRow("formobjects", $field, null, array("phone", "Phone", "input", "1", "", "1,Home;2,Work"));
Records::saveSetRow("formobjects", $field, null, array(null, "Phone number", null, null, null, null));
if (Records::getSetTable("formobjects")[$field]!==array($field, "phone", "Phone number", "input", "1", "", "1,Home;2,Work")) exit(1);

Records::subscribeContact("customer@example.invalid", "Customer Name");
Records::subscribeContact("customer@example.invalid", "Updated Name");
if ($db->query("SELECT name FROM mailing_contacts")->fetchColumn()!=="Updated Name") exit(1);

Records::deleteSetRow("discount", $local, $gallery);
Records::deleteSetRow("discount", $global, null);
Records::deleteSetRow("downloadset", $download, null);
Records::deleteSetRow("ustaxchart", "CA", null);
Records::deleteSetRow("cataxchart", "ON", null);
Records::deleteSetRow("vattaxchart", "GB", null);
Records::deleteSetRow("formobjects", $field, null);
if (count(Records::getSetTable("discount", $gallery))!==0 || count(Records::getSetTable("formobjects"))!==0) exit(1);
