<?php
// Bootstrap URL configuration in isolated processes so each case has its own constants.
if (PHP_SAPI !== 'cli' || getcwd() !== '/app/dist') exit(2);
if (($argv[1] ?? '') === 'case') {
	$_SERVER['HTTP_HOST'] = 'attacker.invalid';
	$_SERVER['HTTP_X_FORWARDED_HOST'] = 'forwarded-attacker.invalid';
	$_SERVER['SCRIPT_NAME'] = '/proofs/vend-proofing-gateway.php';
	$namespace = 'vend-proofing';
	require dirname(__DIR__) . '/dist/vend-proofing-config.php';
	try { $required = Func::getPublicBaseUrl(); } catch (InvalidArgumentException $error) { $required = null; }
	echo json_encode([SA_BASE_URL, $required, Func::getPublicBaseUrl(false)]);
	exit;
}
$cases = [
	'https://example.invalid' => 'https://example.invalid',
	' https://example.invalid/proofs/// ' => 'https://example.invalid/proofs',
	'https://example.invalid:8443/proofs' => 'https://example.invalid:8443/proofs',
	'' => null,
	'http://example.invalid' => null,
	'/proofs' => null,
	'https://user:password@example.invalid' => null,
	'https://user@example.invalid' => null,
	'https://example.invalid?query=1' => null,
	'https://example.invalid#fragment' => null,
	'https://example.invalid?' => null,
	'https://example.invalid#' => null,
];
$db = new PDO('sqlite:' . dirname(__DIR__) . '/dist/vend-proofing-data/auth/vend.sqlite');
$original = $db->query("SELECT json_text FROM configuration_documents WHERE type = 'installation' AND scope_id = ''")->fetchColumn();
$save = $db->prepare("UPDATE configuration_documents SET json_text = ? WHERE type = 'installation' AND scope_id = ''");
$config = json_decode($original, true, 512, JSON_THROW_ON_ERROR);
try {
	foreach ($cases as $input => $expected) {
		$config['data']['setup']['baseurl']['_value'] = $input;
		$save->execute([json_encode($config, JSON_THROW_ON_ERROR)]);
		$process = proc_open([PHP_BINARY, '-d', 'error_reporting=24575', __FILE__, 'case'], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, dirname(__DIR__) . '/dist');
		$output = stream_get_contents($pipes[1]);
		$error = stream_get_contents($pipes[2]);
		fclose($pipes[1]); fclose($pipes[2]);
		if (proc_close($process) !== 0) throw new RuntimeException('Bootstrap failed: ' . $error);
		$result = json_decode($output, true, 512, JSON_THROW_ON_ERROR);
		if ($result !== [rtrim(trim($input), '/'), $expected, $expected ?? '/proofs']) {
			throw new RuntimeException('Canonical URL validation/fallback failed for ' . $input);
		}
	}
} finally {
	$save->execute([$original]);
}
echo "PASS shared bootstrap URL: SQLite installation settings, normalization, subdirectory, port, missing/invalid URLs, and Host-header isolation\n";
