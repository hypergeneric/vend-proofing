<?php

// Disposable fixture only. Run after scripts/install.php in the PHP 8.4 smoke copy.
if (PHP_SAPI !== 'cli') exit(2);
define('SA_DIR_AUTH', dirname(__DIR__) . '/vend-proofing-data/auth');
require dirname(__DIR__) . '/vend-proofing-core/php/classes/simpleadmin/Database.php';
require dirname(__DIR__) . '/vend-proofing-core/php/classes/simpleadmin/PhpSessionStore.php';

function check (bool $condition, string $message): void {
	if (!$condition) throw new RuntimeException($message);
}

$db = Database::connection();
check((int) $db->query('SELECT COUNT(*) FROM schema_migrations')->fetchColumn() === 12, 'Schema migrations missing');
$retired = $db->query("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('gallery_archives', 'archive_entries')")->fetchColumn();
check((int) $retired === 0, 'Retired ZIP gallery tables are present');
check((int) $db->query('SELECT COUNT(*) FROM administrators')->fetchColumn() === 0, 'Fresh install is not empty');
check((int) $db->query('PRAGMA foreign_keys')->fetchColumn() === 1, 'Foreign keys are disabled');
Database::migrate();
check((int) $db->query('SELECT COUNT(*) FROM schema_migrations')->fetchColumn() === 12, 'Migration ran twice');
try {
	Database::install();
	throw new RuntimeException('Install overwrote an existing database');
} catch (RuntimeException $error) {
	check($error->getMessage() === 'Vend is already installed.', 'Unexpected install failure');
}

$start = (int) $db->query("SELECT next_value FROM id_sequences WHERE name = 'suid'")->fetchColumn();
try {
	Database::transaction(function (PDO $db): void {
		Database::allocateSuid();
		$db->exec("INSERT INTO pricing_groups (suid, kind, name) VALUES ('rollback', 'format', 'Rollback')");
		throw new RuntimeException('rollback marker');
	});
} catch (RuntimeException $error) {
	check($error->getMessage() === 'rollback marker', 'Unexpected transaction error');
}
check((int) $db->query("SELECT next_value FROM id_sequences WHERE name = 'suid'")->fetchColumn() === $start, 'Sequence did not roll back');
check((int) $db->query("SELECT COUNT(*) FROM pricing_groups WHERE suid = 'rollback'")->fetchColumn() === 0, 'Row did not roll back');
Database::transaction(function (PDO $db): void {
	$db->exec("INSERT INTO pricing_groups (suid, kind, name) VALUES ('committed', 'format', 'Committed')");
	try {
		Database::transaction(function (PDO $db): void {
			$db->exec("INSERT INTO pricing_groups (suid, kind, name) VALUES ('nested', 'paper', 'Nested')");
			throw new RuntimeException('nested marker');
		});
	} catch (RuntimeException $error) {
		check($error->getMessage() === 'nested marker', 'Unexpected savepoint error');
	}
});
check((int) $db->query("SELECT COUNT(*) FROM pricing_groups WHERE suid = 'committed'")->fetchColumn() === 1, 'Outer transaction lost');
check((int) $db->query("SELECT COUNT(*) FROM pricing_groups WHERE suid = 'nested'")->fetchColumn() === 0, 'Savepoint did not roll back');
$phpSessions = new PhpSessionStore();
check($phpSessions->open('', 'PHPSESSID'), 'PHP session handler did not open');
check($phpSessions->write('synthetic-session', 'order_object|a:0:{}'), 'PHP session write failed');
check($phpSessions->read('synthetic-session') === 'order_object|a:0:{}', 'PHP session round trip failed');
check($phpSessions->destroy('synthetic-session') && $phpSessions->read('synthetic-session') === '', 'PHP session destroy failed');
check($phpSessions->write('expired-session', 'data'), 'PHP session expiry setup failed');
$db->exec('UPDATE php_sessions SET expires_at = 1');
check($phpSessions->read('expired-session') === '' && $phpSessions->gc(0) === 1, 'PHP session expiry or cleanup failed');
try {
	$db->exec("INSERT INTO formats (group_id, suid, name) VALUES (99999, 'orphan', 'Orphan')");
	throw new RuntimeException('Foreign key accepted orphan');
} catch (PDOException $error) {
	check(str_contains($error->getMessage(), 'FOREIGN KEY'), 'Unexpected constraint failure');
}

$processes = [];
$worker = __DIR__ . '/foundation-worker.php';
$dataDir = dirname(__DIR__) . '/vend-proofing-data';
for ($i = 0; $i < 24; ++$i) {
	$process = proc_open([PHP_BINARY, $worker, $dataDir], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
	check(is_resource($process), 'Could not start identifier worker');
	$processes[] = [$process, $pipes];
}
$ids = [];
foreach ($processes as [$process, $pipes]) {
	$id = trim(stream_get_contents($pipes[1]));
	$error = stream_get_contents($pipes[2]);
	fclose($pipes[1]);
	fclose($pipes[2]);
	check(proc_close($process) === 0, 'Identifier worker failed: ' . $error);
	$ids[] = $id;
}
check(count(array_unique($ids)) === 24, 'Concurrent SUID collision');
check((int) $db->query("SELECT next_value FROM id_sequences WHERE name = 'suid'")->fetchColumn() === $start + 24, 'Concurrent SUID count incorrect');
echo "PASS fresh schema, migration replay, constraints, transactions, rollback, PHP sessions, and 24 concurrent SUID allocations\n";
