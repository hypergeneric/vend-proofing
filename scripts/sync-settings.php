<?php

// CLI only. Refresh saved settings against the current source JSON templates.
if (PHP_SAPI!=='cli') exit(1);
$root = dirname(__DIR__);
$dataDir = $root . '/dist/vend-proofing-data';
$dryRun = false;
$usage = "Usage: php scripts/sync-settings.php [--dry-run] [--data-dir DIR]\n";
for ($index=1; $index<count($argv); $index++) {
	if ($argv[$index]==='--dry-run') $dryRun = true;
	elseif ($argv[$index]==='--data-dir' && isset($argv[$index + 1]) && !str_starts_with($argv[$index + 1], '--')) $dataDir = $argv[++$index];
	elseif ($argv[$index]==='--help') { fwrite(STDOUT, $usage); exit(0); }
	else { fwrite(STDERR, $usage); exit(2); }
}
define('SA_DIR_AUTH', rtrim($dataDir, '/') . '/auth');
define('SA_DIR_DEFAULTS', $root . '/dist/vend-proofing-core/defaults');
require $root . '/dist/vend-proofing-core/php/classes/simpleadmin/Database.php';
require $root . '/dist/vend-proofing-core/php/classes/simpleadmin/Configuration.php';

try {
	$report = Configuration::syncDefaults($dryRun);
	$changed = 0;
	foreach ($report as $item) {
		$scope = $item['scope']==='' ? 'global' : $item['scope'];
		fwrite(STDOUT, $item['status'] . ': ' . $item['type'] . ' [' . $scope . "]\n");
		if (in_array($item['status'], array('updated', 'would update'), true)) $changed++;
	}
	fwrite(STDOUT, ($dryRun ? 'Dry run: ' : 'Done: ') . $changed . ' of ' . count($report) . " saved documents " . ($dryRun ? 'would change.' : 'updated.') . "\n");
} catch (Throwable $error) {
	// JSON/parser errors can include saved text; do not print configuration values.
	fwrite(STDERR, "Settings sync failed; no documents changed. Check the database path and JSON templates/documents.\n");
	exit(1);
}
