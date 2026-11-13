<?php
// Isolated account recovery contracts; no application database or outbound network.
if (PHP_SAPI !== 'cli') exit(2);
define('SA_DIR_AUTH', $argv[1] ?? sys_get_temp_dir() . '/vend-recovery-' . bin2hex(random_bytes(8)));
define('SA_DIR_LANG', dirname(__DIR__) . '/dist/vend-proofing-core/lang');
define('SA_DIR_DEFAULTS', dirname(__DIR__) . '/dist/vend-proofing-core/defaults');
define('SA_DIR_INDEXPATH', '');
define('SA_BASE_URL', 'https://trusted.example.invalid/subfolder');
spl_autoload_register(function ($class) {
	$file = dirname(__DIR__) . '/dist/vend-proofing-core/php/classes/simpleadmin/' . $class . '.php';
	if (is_file($file)) require $file;
});
if (isset($argv[2])) {
	echo PasswordRecovery::reset($argv[2], 'ConcurrentPassword123!') ? '1' : '0';
	exit;
}
function recoveryCheck (bool $ok, string $message): void {
	if (!$ok) throw new RuntimeException($message);
}
// Exercise the real Email composition while replacing only the network transport.
class PHPMailer extends stdClass {
	public static array $sent = [];
	public function isSMTP () {}
	public function IsHTML ($value) {}
	public function AddAddress ($email, $name = '') { $this->recipient = $email; }
	public function AddReplyTo ($email, $name = '') {}
	public function Send () { self::$sent[] = clone $this; return true; }
}
require dirname(__DIR__) . '/dist/vend-proofing-core/php/vendor/autoload.php';
$_SERVER['SERVER_NAME'] = 'attacker.invalid';
$LANG = new Lang();
$LANG->language('en');
try {
	Database::install();
	$db = Database::connection();
	AdminAccount::create('recoveryuser', 'recovery@example.invalid', 'OriginalPassword123!');
	AdminAccount::create('otheruser', 'other@example.invalid', 'OtherPassword123!');
	$auth = new Auth();
	$auth->login('recoveryuser', 'OriginalPassword123!');
	$accountCookie = $_COOKIE['VEND_ADMIN'];
	$auth->login('otheruser', 'OtherPassword123!');
	// Start another independent session for the account being reset.
	unset($_COOKIE['VEND_ADMIN']);
	$auth->login('recoveryuser', 'OriginalPassword123!');
	$captured = [];
	$delivery = static function ($account, $token) use (&$captured): bool { $captured[] = [$account, $token]; return true; };
	PasswordRecovery::request('unknown', '127.0.0.1', $delivery);
	recoveryCheck(count($captured) === 0, 'Unknown account received email');
	PasswordRecovery::request('recoveryuser', '127.0.0.1', $delivery);
	$token = $captured[0][1];
	$row = $db->query('SELECT * FROM administrator_password_resets')->fetch();
	recoveryCheck($row['token_hash'] === hash('sha256', $token) && !str_contains(json_encode($row), $token), 'Raw reset token persisted');
	recoveryCheck(abs($row['expires_at'] - time() - 1800) <= 2, 'Wrong expiry');
	recoveryCheck(!PasswordRecovery::reset($token, 'short'), 'Short password accepted');
	recoveryCheck(!PasswordRecovery::reset(str_repeat('0', 64), 'ReplacementPassword123!'), 'Forged token accepted');
	$db->exec('UPDATE administrator_password_resets SET expires_at = 1');
	recoveryCheck(!PasswordRecovery::reset($token, 'ReplacementPassword123!'), 'Expired token accepted');
	PasswordRecovery::request('recoveryuser', '127.0.0.1', $delivery);
	$staleToken = end($captured)[1];
	AdminAccount::resetPassword('recoveryuser', 'OriginalPassword123!');
	recoveryCheck(!PasswordRecovery::reset($staleToken, 'ReplacementPassword123!'), 'CLI reset did not invalidate link');
	PasswordRecovery::request('recoveryuser', '127.0.0.1', $delivery);
	$token = end($captured)[1];
	PasswordRecovery::request('recoveryuser', '127.0.0.2', $delivery);
	recoveryCheck(count($captured) === 3, 'Account request limit failed across IPs');
	$auth->login('recoveryuser', 'OriginalPassword123!');
	recoveryCheck(PasswordRecovery::reset($token, 'Replacement\\Password123!'), 'Valid token rejected');
	recoveryCheck(!$auth->sessionAuthenticated(), 'Reset retained session');
	recoveryCheck(!PasswordRecovery::reset($token, 'AnotherPassword123!'), 'Token reused');
	recoveryCheck(AdminAccount::verify('recoveryuser', 'Replacement\\Password123!') !== null, 'New password failed');
	recoveryCheck(AdminAccount::verify('recoveryuser', 'OriginalPassword123!') === null, 'Old password retained');
	$db->exec('DELETE FROM administrator_recovery_limits');
	PasswordRecovery::request('otheruser', '127.0.0.1', $delivery);
	$old = end($captured)[1];
	PasswordRecovery::request('otheruser', '127.0.0.1', $delivery);
	$token = end($captured)[1];
	recoveryCheck(!PasswordRecovery::reset($old, 'ReplacementPassword123!'), 'Replaced token retained');
	$workers = [];
	for ($i = 0; $i < 2; ++$i) {
		$process = proc_open([PHP_BINARY, __FILE__, SA_DIR_AUTH, $token], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
		$workers[] = [$process, $pipes];
	}
	$wins = 0;
	foreach ($workers as [$process, $pipes]) {
		$wins += (int) stream_get_contents($pipes[1]);
		$error = stream_get_contents($pipes[2]);
		fclose($pipes[1]); fclose($pipes[2]);
		recoveryCheck(proc_close($process) === 0, 'Concurrent reset worker failed: ' . $error);
	}
	recoveryCheck($wins === 1, 'Concurrent token redemption was not single-use');
	$db->exec('DELETE FROM administrator_recovery_limits');
	PasswordRecovery::request('recoveryuser', '127.0.0.1', static function (): bool { return false; });
	recoveryCheck((int) $db->query('SELECT COUNT(*) FROM administrator_password_resets')->fetchColumn() === 0, 'Failed delivery retained token');
	$db->exec('DELETE FROM administrator_recovery_limits');
	for ($i = 0; $i < 10; ++$i) PasswordRecovery::request('missing' . $i, '127.0.0.1', $delivery);
	$count = count($captured);
	PasswordRecovery::request('recoveryuser', '127.0.0.1', $delivery);
	recoveryCheck(count($captured) === $count, 'IP limit bypassed with different usernames');
	$db->exec('DELETE FROM administrator_recovery_limits');
	PasswordRecovery::request('recoveryuser', '127.0.0.1', $delivery);
	$beforeEdit = end($captured)[1];
	AdminAccount::updateSelf(1, 1, 'recoveryuser', 'recovery@example.invalid', '', 'Replacement\\Password123!');
	recoveryCheck(!PasswordRecovery::reset($beforeEdit, 'StaleLinkPassword123!'), 'Account edit did not invalidate recovery link');
	AdminAccount::create('deleteduser', 'deleted@example.invalid', 'DeletedPassword123!');
	PasswordRecovery::request('deleteduser', '127.0.0.1', $delivery);
	$beforeDelete = end($captured)[1];
	AdminAccount::deleteOther(1, (int) AdminAccount::find('deleteduser')['id']);
	recoveryCheck(!PasswordRecovery::reset($beforeDelete, 'DeletedPassword456!'), 'Deleted account recovery survived');
	$db->exec('DELETE FROM administrator_recovery_limits');
	$contact = Configuration::getDocument('contact');
	$contact->editNode('data.details.your_email', 'Fixture', 'href=sender@example.invalid');
	$contact->editNode('data.mailer_settings.mail_provider', 'smtp');
	$contact->editNode('data.mailer_settings.log_all_messages_bool', 'true');
	Configuration::save('contact', null, $contact->toString());
	PasswordRecovery::request('recoveryuser', '127.0.0.1');
	recoveryCheck(count(PHPMailer::$sent) === 1, 'Existing SMTP mailer was not used');
	$mail = PHPMailer::$sent[0];
	recoveryCheck($mail->recipient === 'recovery@example.invalid', 'Wrong email recipient');
	recoveryCheck($mail->Subject === $LANG->lookup('Recovery Email Subject'), 'Email subject not localized');
	recoveryCheck(str_contains($mail->Body, '<a href=') && !str_contains($mail->AltBody, '{MESSAGE}') && !str_contains($mail->AltBody, '{USERNAME}'), 'Recovery template tags or Markdown were not expanded');
	recoveryCheck(str_contains($mail->AltBody, 'https://trusted.example.invalid/subfolder/?/admin/&recover=1#token=') && !str_contains($mail->AltBody, 'attacker.invalid'), 'Reset link trusted request Host');
	recoveryCheck((int) $db->query('SELECT COUNT(*) FROM messages')->fetchColumn() === 0, 'Reset link leaked to message log');
	preg_match('/#token=([a-f0-9]{64})/', $mail->AltBody, $matches);
	recoveryCheck(PasswordRecovery::reset($matches[1], 'EmailedPassword123!'), 'Composed email token unusable');
	echo "PASS recovery: expiry, hashed tokens, reuse, concurrency, throttling, session invalidation, CLI reset, failure cleanup, trusted mail URL, localization, and no message-log leak\n";
} finally {
	foreach (glob(SA_DIR_AUTH . '/*') as $file) unlink($file);
	if (is_dir(SA_DIR_AUTH)) rmdir(SA_DIR_AUTH);
}
