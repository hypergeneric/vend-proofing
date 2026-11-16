<?php

// Isolated database inside the foundation smoke container; never use application data.
if (PHP_SAPI!=='cli' || getcwd()!=='/app/dist') exit(2);
$fixture = sys_get_temp_dir() . '/vend-settings-sync-' . bin2hex(random_bytes(6));
define('SA_DIR_AUTH', $fixture . '/auth');
define('SA_DIR_DEFAULTS', dirname(__DIR__) . '/dist/vend-proofing-core/defaults');
require dirname(__DIR__) . '/dist/vend-proofing-core/php/classes/simpleadmin/Database.php';
require dirname(__DIR__) . '/dist/vend-proofing-core/php/classes/simpleadmin/Configuration.php';
function checkSync (bool $condition, string $message): void {
	if (!$condition) throw new RuntimeException($message);
}
Database::install();
$db = Database::connection();
$ordering = new ConfigurationDocument('{"data":{"_attributes":{"default":"false"},"payment_gateway":{"dropbox_api_key":{"_value":"my-key","_attributes":{"encoded":"true"}},"dropbox_api_secret":{"_value":"synthetic-secret"},"dropbox_token":{"_value":"synthetic-token","_attributes":{"hash":"retired"}},"retired":{"_value":"gone"}},"ordering":{"default_country":{},"offline_order_inbox_email":{"_value":"Owner","_attributes":{"href":"owner@example.invalid"}},"shipping_flat_fee_num":{"_value":"12.50","_attributes":{"max":"1","obsolete":"yes"}}}}}');
Configuration::save('ordering', null, $ordering->toString());
$gallery = new ConfigurationDocument('{"data":{"settings":{"password":{"_value":"synthetic-password"},"expires_on_date":{"_value":"2030-01-01","_attributes":{"timezone":"UTC","offset":"0"}},"set_cover_image_asset":{"_value":"cover.jpg","_attributes":{"width":"1200","height":"800"}},"retired":{}}}}');
Configuration::save('dropboxset', 'abcd', $gallery->toString());
$db->prepare('INSERT INTO configuration_documents(type, scope_id, json_text, updated_at) VALUES (?, ?, ?, ?)')->execute(array('retiredtype', '', '{"data":{}}', 1));
$before = $db->query('SELECT * FROM configuration_documents ORDER BY type, scope_id')->fetchAll();
Configuration::syncDefaults(true);
checkSync($before===$db->query('SELECT * FROM configuration_documents ORDER BY type, scope_id')->fetchAll(), 'Dry run changed records.');
// A malformed document after valid rows must roll back the whole operation.
$db->prepare('INSERT INTO configuration_documents(type, scope_id, json_text, updated_at) VALUES (?, ?, ?, ?)')->execute(array('setup', '', '{"wrong":{}}', 1));
try { Configuration::syncDefaults(); throw new RuntimeException('Malformed document accepted.'); }
catch (JsonException $error) {}
$db->exec("DELETE FROM configuration_documents WHERE type = 'setup'");
checkSync($before===$db->query('SELECT * FROM configuration_documents ORDER BY type, scope_id')->fetchAll(), 'Failed sync left partial changes.');

$command = PHP_BINARY . ' ' . escapeshellarg(__DIR__ . '/sync-settings.php') . ' --data-dir ' . escapeshellarg($fixture);
exec($command . ' --dry-run', $preview, $exit);
checkSync($exit===0 && str_contains(implode("\n", $preview), 'would update: ordering [global]'), 'CLI dry run failed.');
checkSync($before===$db->query('SELECT * FROM configuration_documents ORDER BY type, scope_id')->fetchAll(), 'CLI dry run wrote records.');
exec($command, $output, $exit);
checkSync($exit===0 && str_contains(implode("\n", $output), 'updated: dropboxset [abcd]'), 'CLI sync failed.');
checkSync(!str_contains(implode("\n", $output), 'synthetic-'), 'CLI printed a secret.');
$ordering = Configuration::getDocument('ordering');
checkSync($ordering->getNodeVal('data.payment_gateway.dropbox_api_secret')==='synthetic-secret', 'Secret was overwritten.');
checkSync($ordering->getNodeVal('data.payment_gateway.dropbox_token')==='synthetic-token', 'Hidden value was overwritten.');
checkSync($ordering->getNodeVal('data.ordering.default_country')==='', 'Intentional empty value was defaulted.');
checkSync($ordering->getNodeVal('data.payment_gateway.dropbox_refresh_token')==='', 'New field was not added.');
checkSync($ordering->getNodeVal('data.payment_gateway.retired')===null, 'Retired field survived.');
checkSync($ordering->getAttrVal('data.payment_gateway.dropbox_api_key.encoded')===null, 'Retired attribute survived.');
checkSync($ordering->getAttrVal('data.payment_gateway.dropbox_api_secret.secret')==='true', 'New control metadata missing.');
checkSync($ordering->getAttrVal('data.payment_gateway.dropbox_token.hash')===null, 'Retired token metadata survived.');
checkSync($ordering->getAttrVal('data.ordering.shipping_flat_fee_num.max')==='9999', 'Control constraint did not update.');
checkSync($ordering->getNodeVal('data.ordering.shipping_flat_fee_num')==='12.50', 'Saved number changed.');
checkSync($ordering->getAttrVal('data.ordering.offline_order_inbox_email.href')==='owner@example.invalid', 'Email attribute changed.');
checkSync($ordering->getAttrVal('data.default')==='false', 'Saved-document flag changed.');
$gallery = Configuration::getDocument('dropboxset', 'abcd');
checkSync($gallery->getAttrVal('data.settings.set_cover_image_asset.width')==='1200', 'Image dimensions lost.');
checkSync($gallery->getAttrVal('data.settings.expires_on_date.timezone')==='UTC', 'Timezone lost.');
checkSync($gallery->getNodeVal('data.settings.retired')===null, 'Scoped retired field survived.');
checkSync(Configuration::getJson('dropboxset', 'abce', true)==='', 'Sync created an unsaved scope.');
$after = $db->query('SELECT * FROM configuration_documents ORDER BY type, scope_id')->fetchAll();
Configuration::syncDefaults();
checkSync($after===$db->query('SELECT * FROM configuration_documents ORDER BY type, scope_id')->fetchAll(), 'Second sync changed records/timestamps.');
checkSync(count($after)===count($before), 'Sync created/deleted whole documents.');
echo "PASS settings CLI: dry run, global/scoped fields, saved/empty/secret values, editable attributes, template metadata, rollback and idempotence\n";
