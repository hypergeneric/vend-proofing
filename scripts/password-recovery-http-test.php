<?php
// Disposable fixture only; no SMTP requests are made by this test.
if (PHP_SAPI !== 'cli' || getcwd() !== '/app/dist') exit(2);
define('SA_DIR_AUTH', '/app/dist/vend-proofing-data/auth');
require '/app/dist/vend-proofing-core/php/classes/simpleadmin/Database.php';
require '/app/dist/vend-proofing-core/php/classes/simpleadmin/AdminAccount.php';
function recoveryHttpCheck (bool $ok, string $message): void {
	if (!$ok) throw new RuntimeException($message);
}
function recoveryHttp (array &$cookies, ?array $data = null): array {
	$headers = 'Cookie: ' . implode('; ', $cookies) . "\r\n";
	$options = ['method' => $data === null ? 'GET' : 'POST', 'ignore_errors' => true, 'header' => $headers . "Content-Type: application/x-www-form-urlencoded\r\n"];
	if ($data !== null) $options['content'] = http_build_query($data);
	$html = file_get_contents('http://127.0.0.1:8080/?/admin/&recover=1', false, stream_context_create(['http' => $options]));
	foreach ($http_response_header as $header) {
		if (preg_match('/^Set-Cookie: (VEND_RECOVERY=[^;]*)/i', $header, $match)) $cookies = [$match[1]];
	}
	return [$html, $http_response_header];
}
AdminAccount::create('resetfixture', 'reset@example.invalid', 'BeforeResetPassword123!');
$account = AdminAccount::find('resetfixture');
$db = Database::connection();
$token = bin2hex(random_bytes(32));
$db->prepare('INSERT INTO administrator_password_resets VALUES (?, ?, ?, ?, ?)')->execute([$account['id'], hash('sha256', $token), $account['account_version'], time(), time() + 1800]);
$cookies = [];
[$html, $headers] = recoveryHttp($cookies);
recoveryHttpCheck(str_contains(implode('\n', $headers), 'Cache-Control: no-store') && str_contains(implode('\n', $headers), 'Referrer-Policy: no-referrer'), 'Recovery page lacks privacy headers');
recoveryHttpCheck(str_contains($html, 'Send Reset Link') && !str_contains($html, 'Recovery Request Description'), 'Recovery page failed language lookup');
preg_match('/name="recovery_csrf" value="([a-f0-9]{64})"/', $html, $matches);
$csrf = $matches[1];
$values = ['recovery_action' => 'reset', 'reset_token' => $token, 'password' => 'AfterResetPassword123!', 'confirm_password' => 'AfterResetPassword123!'];
[$html] = recoveryHttp($cookies, $values);
recoveryHttpCheck(str_contains($html, 'This form expired.'), 'Missing CSRF accepted');
recoveryHttpCheck(AdminAccount::verify('resetfixture', 'BeforeResetPassword123!') !== null, 'GET or invalid POST mutated password');
[$html] = recoveryHttp($cookies, ['recovery_csrf' => $csrf, 'confirm_password' => 'mismatch'] + $values);
recoveryHttpCheck(str_contains($html, 'Passwords must match.'), 'Password confirmation ignored');
[$html] = recoveryHttp($cookies, ['recovery_csrf' => $csrf] + $values);
recoveryHttpCheck(str_contains($html, 'Your password has been reset.'), 'Valid form failed');
recoveryHttpCheck(!str_contains($html, $token), 'Completed page retains token');
recoveryHttpCheck(AdminAccount::verify('resetfixture', 'AfterResetPassword123!') !== null, 'New password login failed');
[$html] = recoveryHttp($cookies, ['recovery_csrf' => $csrf] + $values);
recoveryHttpCheck(str_contains($html, 'invalid, expired, or already used'), 'Used link accepted');
[$html] = recoveryHttp($cookies, ['recovery_action' => 'request', 'recovery_csrf' => $csrf, 'username' => 'unknownfixture']);
recoveryHttpCheck(str_contains($html, 'If that username has an account'), 'Generic response missing');
$db->prepare('DELETE FROM administrators WHERE id = ?')->execute([$account['id']]);
echo "PASS recovery HTTP forms, localization, privacy headers, GET safety, CSRF, confirmation, reset, and reuse rejection\n";
