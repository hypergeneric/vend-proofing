<?php

// Run only inside a disposable installation.
if (PHP_SAPI !== 'cli') exit(2);
define('SA_DIR_AUTH', dirname(__DIR__) . '/vend-proofing-data/auth');
define('SA_DIR_DEFAULTS', dirname(__DIR__) . '/vend-proofing-core/defaults');
require dirname(__DIR__) . '/vend-proofing-core/php/classes/simpleadmin/Database.php';
require dirname(__DIR__) . '/vend-proofing-core/php/classes/simpleadmin/ConfigurationDocument.php';
require dirname(__DIR__) . '/vend-proofing-core/php/classes/simpleadmin/Configuration.php';

function check (bool $condition, string $message): void {
	if (!$condition) throw new RuntimeException($message);
}

$database = Database::connection();
$secret = Database::installationSecret();
check(strlen($secret)===64 && ctype_xdigit($secret), 'Installation secret missing');
check(Database::installationSecret()===$secret, 'Installation secret changed');
check(Configuration::getJson('contact', null, true)==='', 'Fresh installation has a saved contact document');

$contact = new ConfigurationDocument(file_get_contents(SA_DIR_DEFAULTS . '/contact.json'));
check($contact->getNodeVal('data.settings.title')==='', 'Empty field changed meaning');
$contact->editNode('data.details.your_email', 'Owner', 'href=owner@example.invalid');
$contact->editNode('data.mailer_settings.sendgrid_api_key', 'synthetic-private-key');
$contactJson = $contact->toString();
check(Configuration::save('contact', null, $contact->toRuntimeString()), 'Contact setting did not save');
$storedContact = $database->query("SELECT json_text FROM configuration_documents WHERE type = 'contact'")->fetchColumn();
check($storedContact===$contactJson, 'Saved settings retained empty runtime fields');
check(Configuration::getJson('contact', null, true)===$contact->toRuntimeString(),
	'Contact setting did not round trip');
$oldPath = dirname(__DIR__) . '/vend-proofing-data/storage/contact.xml';
file_put_contents($oldPath, '<data><details><your_email href="decoy@example.invalid"></your_email></details></data>');
check(Configuration::getJson('contact', null, true)===$contact->toRuntimeString(),
	'Old XML file overrode SQLite');
unlink($oldPath);
$contactObject = Configuration::getDocument('contact', null, true);
check($contactObject instanceof ConfigurationDocument, 'Saved contact JSON did not parse');
check($contactObject->getAttrVal('data.details.your_email.href')==='owner@example.invalid',
	'Saved contact email was lost');

$cron = new ConfigurationDocument(file_get_contents(SA_DIR_DEFAULTS . '/cron.json'));
$cron->editNode('data.settings.cron_enabled_bool', 'true');
$cron->editNode('data.settings.expiring_notify_bool', 'true');
check(Configuration::save('cron', null, $cron->toString()), 'Cron setting did not save');

$gallery = file_get_contents(SA_DIR_DEFAULTS . '/uploadset.json');
check(Configuration::getJson('uploadset', '875c', true)==='', 'Unsaved gallery JSON was present');
check(Configuration::save('uploadset', '875c', $gallery), 'Gallery setting did not save');
$galleryObject = new ConfigurationDocument($gallery);
check(Configuration::getJson('uploadset', '875c', true)===$galleryObject->toRuntimeString(),
	'Gallery setting did not round trip');
check(str_contains($galleryObject->toRuntimeString(), '"_attributes":{}'),
	'Admin runtime fields were not completed');
check(Configuration::getJson('uploadset', '875d', true)==='', 'Gallery scopes crossed');
check(!Configuration::save('uploadset', '875c', '{broken'), 'Malformed JSON was saved');
check(!Configuration::save('../contact', null, $contactJson), 'Unknown setting type was saved');
check(!Configuration::save('admin', null, $gallery), 'Static admin config was saved');
check(Configuration::revert('uploadset', '875c'), 'Gallery revert failed');
check(Configuration::getJson('uploadset', '875c', true)==='', 'Gallery revert left an override');
check(Configuration::getJson('uploadset', '875c')===$galleryObject->toRuntimeString(),
	'Gallery revert lost source default');
check(!str_contains($contactJson, '"_value":""') && !str_contains($contactJson, '"_attributes":{}'),
	'Saved JSON retained empty XML conversion fields');
check((int) $database->query('SELECT COUNT(*) FROM configuration_documents')->fetchColumn()===2,
	'Unexpected configuration rows');
echo "PASS saved JSON in SQLite, defaults, scope, validation, revert, and installation secret\n";
