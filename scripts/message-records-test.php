<?php

// Run only inside the disposable basic-set fixture. No email is sent.
$namespace = "vend-proofing";
$_SERVER["SERVER_NAME"] = "example.invalid";
require "vend-proofing-config.php";

$email = new Email();
$email->logMessage(true);
$email->setSender("photographer@example.invalid", "Photographer");
$email->setRecipient("customer@example.invalid", "Customer");
$email->send();

$rows = Records::getSetTable("messages");
if (count($rows)!==1) exit(1);
$row = reset($rows);
if (count($row)!==9 || $row[2]!=="false") exit(1);
if ($row[3]!=="Photographer" || $row[4]!=="photographer@example.invalid") exit(1);
if ($row[5]!=="Customer" || $row[6]!=="customer@example.invalid") exit(1);
if (base64_decode($row[7])!=="Failed to Load Language Subject Object") exit(1);

$db = Database::connection();
$stored = $db->query("SELECT suid, subject, delivery_status, sender_email FROM messages")->fetch();
if ($stored["subject"]!=="Failed to Load Language Subject Object") exit(1);
if ($stored["delivery_status"]!=="failed" || $stored["sender_email"]!=="photographer@example.invalid") exit(1);

// Adding another message prunes an older log entry in the same transaction.
$db->exec("UPDATE messages SET created_at = 1");
$suid = Records::addMessage(array(
	"status" => "sent",
	"sender_name" => "Photographer",
	"sender_email" => "photographer@example.invalid",
	"recipient_name" => "Customer",
	"recipient_email" => "customer@example.invalid",
	"subject" => "Synthetic subject",
	"body" => "First line\nSecond line"
));
$rows = Records::getSetTable("messages");
if (count($rows)!==1 || !isset($rows[$suid])) exit(1);
if ($rows[$suid][2]!=="true" || base64_decode($rows[$suid][8])!=="First line\nSecond line") exit(1);
if ($db->query("SELECT COUNT(*) FROM messages")->fetchColumn()!=1) exit(1);

file_put_contents("/tmp/message-suid", $suid);
