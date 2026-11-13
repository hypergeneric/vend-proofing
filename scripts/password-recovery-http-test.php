<?php
// Disposable fixture only; no SMTP requests are made by this test.
if (PHP_SAPI !== 'cli' || getcwd() !== '/app/dist') exit(2);
define('SA_DIR_AUTH', '/app/dist/vend-proofing-data/auth');
require '/app/dist/vend-proofing-core/php/classes/simpleadmin/Database.php';
require '/app/dist/vend-proofing-core/php/classes/simpleadmin/AdminAccount.php';
function recoveryHttpCheck (bool $ok, string $message): void {
	if (!$ok) throw new RuntimeException($message);
}
function recoveryHttp (array &$cookies, array $data, string $method = 'POST'): array {
	$headers = 'Cookie: ' . implode('; ', $cookies) . "\r\n";
	$options = ['method' => $method, 'ignore_errors' => true, 'header' => $headers . "Content-Type: application/x-www-form-urlencoded\r\n"];
	$url = 'http://127.0.0.1:8080/vend-proofing-gateway.php';
	if ($method === 'GET') $url .= '?' . http_build_query($data);
	else $options['content'] = http_build_query($data);
	$body = file_get_contents($url, false, stream_context_create(['http' => $options]));
	foreach ($http_response_header as $header) {
		if (preg_match('/^Set-Cookie: (VEND_RECOVERY=[^;]*)/i', $header, $match)) $cookies['recovery'] = $match[1];
	}
	parse_str($body, $response);
	return [$response, $http_response_header];
}
AdminAccount::create('resetfixture', 'reset@example.invalid', 'BeforeResetPassword123!');
$account = AdminAccount::find('resetfixture');
$db = Database::connection();
$token = bin2hex(random_bytes(32));
$db->prepare('INSERT INTO administrator_password_resets VALUES (?, ?, ?, ?, ?)')->execute([$account['id'], hash('sha256', $token), $account['account_version'], time(), time() + 1800]);
$cookies = [];
[$response, $headers] = recoveryHttp($cookies, ['action' => 'recovery_form']);
recoveryHttpCheck(str_contains(implode('\n', $headers), 'Cache-Control: no-store') && str_contains(implode('\n', $headers), 'Referrer-Policy: no-referrer'), 'Recovery privacy headers missing');
recoveryHttpCheck(str_contains(implode('\n', $headers), 'HttpOnly; SameSite=Strict'), 'Recovery cookie attributes missing');
$csrf = $response['r'];
recoveryHttpCheck($response['s'] === 'true' && preg_match('/^[a-f0-9]{64}$/', $csrf), 'Invalid recovery CSRF');
$newPassword = 'After\\ResetPassword123!';
$values = ['action' => 'recovery_reset', 'reset_token' => $token, 'password' => $newPassword, 'confirm_password' => $newPassword];
[$response] = recoveryHttp($cookies, $values);
recoveryHttpCheck($response['s'] === 'false' && $response['r'] === 'Recovery Form Expired', 'Missing CSRF accepted');
[$response] = recoveryHttp($cookies, ['recovery_csrf' => $csrf] + $values, 'GET');
recoveryHttpCheck($response['s'] === 'false', 'GET reset accepted');
recoveryHttpCheck(AdminAccount::verify('resetfixture', 'BeforeResetPassword123!') !== null, 'GET or invalid POST mutated password');
[$response] = recoveryHttp($cookies, ['recovery_csrf' => $csrf, 'confirm_password' => 'mismatch'] + $values);
recoveryHttpCheck($response['r'] === 'Account Password Mismatch', 'Confirmation ignored');
[$response] = recoveryHttp($cookies, ['recovery_csrf' => $csrf, 'password' => 'short'] + $values);
recoveryHttpCheck($response['r'] === 'Account Password Length', 'Short password accepted');
[$response] = recoveryHttp($cookies, ['recovery_csrf' => $csrf] + $values);
recoveryHttpCheck($response['s'] === 'true' && $response['r'] === 'Recovery Complete', 'Valid reset failed');
recoveryHttpCheck(AdminAccount::verify('resetfixture', $newPassword) !== null, 'Password backslashes changed');
[$response] = recoveryHttp($cookies, ['recovery_csrf' => $csrf] + $values);
recoveryHttpCheck($response['s'] === 'false' && $response['r'] === 'Recovery Link Invalid', 'Used link accepted');
[$response] = recoveryHttp($cookies, ['action' => 'recovery_request', 'recovery_csrf' => $csrf, 'username' => 'unknownfixture']);
recoveryHttpCheck($response['s'] === 'true' && $response['r'] === 'Recovery Request Sent', 'Generic request response missing');
$page = file_get_contents('http://127.0.0.1:8080/?/admin/&recover=1');
recoveryHttpCheck(str_contains($page, 'classes.Admin.initialize') && !str_contains($page, 'id="recovery-request"'), 'Recovery did not use admin SPA');
recoveryHttpCheck(str_contains(implode('\n', $http_response_header), 'Referrer-Policy: no-referrer'), 'Admin referrer policy missing');
$db->prepare('DELETE FROM administrators WHERE id = ?')->execute([$account['id']]);
echo "PASS recovery Gateway: CSRF, privacy headers, GET rejection, confirmation/length, password backslashes, reset/replay, generic request, and SPA entry\n";
