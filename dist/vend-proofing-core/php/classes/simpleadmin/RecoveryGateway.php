<?php

/** Public recovery actions use a separate CSRF cookie, independent of admin login. */
class RecoveryGateway {
	public static function handle (string $action): array {
		header('Cache-Control: no-store');
		header('Referrer-Policy: no-referrer');
		$field = static fn (string $key): string => isset($_POST[$key]) && is_string($_POST[$key]) ? $_POST[$key] : '';
		if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') return ['success' => false, 'data' => 'Recovery Form Expired'];
		$csrf = $_COOKIE['VEND_RECOVERY'] ?? '';
		if ($action === 'recovery_form') {
			if (!is_string($csrf) || !preg_match('/^[a-f0-9]{64}$/', $csrf)) {
				$csrf = bin2hex(random_bytes(32));
				setcookie('VEND_RECOVERY', $csrf, ['path' => '/', 'httponly' => true, 'samesite' => 'Strict',
					'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https']);
			}
			return ['success' => true, 'data' => $csrf];
		}
		if (!is_string($csrf) || !preg_match('/^[a-f0-9]{64}$/', $csrf) || !hash_equals($csrf, $field('recovery_csrf'))) {
			return ['success' => false, 'data' => 'Recovery Form Expired'];
		}
		if ($action === 'recovery_request') {
			try {
				PasswordRecovery::request($field('email'), $_SERVER['REMOTE_ADDR'] ?? 'unknown');
			} catch (Throwable $error) {
				error_log('Vend administrator recovery unavailable; check database and mail configuration.');
			}
			return ['success' => true, 'data' => 'Recovery Request Sent'];
		}
		$password = $field('password');
		if (strlen($password) < 12 || strlen($password) > 4096 || str_contains($password, "\0")) {
			return ['success' => false, 'data' => 'Account Password Length'];
		}
		if ($password !== $field('confirm_password')) return ['success' => false, 'data' => 'Account Password Mismatch'];
		$success = PasswordRecovery::reset($field('reset_token'), $password);
		return ['success' => $success, 'data' => $success ? 'Recovery Complete' : 'Recovery Link Invalid'];
	}
}
