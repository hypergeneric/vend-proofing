<?php

/** Server-side administrator session, stored in Vend's application database. */
class Auth {
	private const COOKIE_NAME = 'VEND_ADMIN';
	private const NORMAL_LIFETIME = 12 * 3600;
	private const REMEMBER_LIFETIME = 14 * 86400;

	private function session (): ?array {
		$id = $_COOKIE[self::COOKIE_NAME] ?? null;
		if (!is_string($id) || !preg_match('/^[a-f0-9]{64}$/', $id) || !Database::installed()) return null;
		$stmt = Database::connection()->prepare(
			'SELECT s.*, a.account_version AS current_version FROM admin_sessions s JOIN administrators a ON a.id = s.administrator_id WHERE s.id_hash = ?'
		);
		$stmt->execute([hash('sha256', $id)]);
		$row = $stmt->fetch();
		if (!$row || (int) $row['expires_at'] < time() || (int) $row['account_version'] !== (int) $row['current_version']) return null;
		return $row;
	}

	private function cookieOptions (int $expires = 0): array {
		$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
			|| (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
		return [
			'expires' => $expires,
			'path' => '/',
			'secure' => $secure,
			'httponly' => true,
			'samesite' => 'Lax',
		];
	}

	public function sessionAuthenticated (): bool {
		return $this->session() !== null;
	}

	public function token (): string {
		return $this->session()['request_token'] ?? '';
	}

	public function authenticate (): array {
		$token = $_POST['token'] ?? '';
		$session = $this->session();
		$valid = $session && is_string($token) && $token !== '' && hash_equals($session['request_token'], $token);
		return ['authenticated' => (bool) $valid, 'admin' => (bool) $valid];
	}

	public function login (string $username, string $password, bool $remember = false): string {
		$account = AdminAccount::verify($username, $password);
		if (!$account) return '';
		$old = $_COOKIE[self::COOKIE_NAME] ?? null;
		$id = bin2hex(random_bytes(32));
		$token = bin2hex(random_bytes(32));
		$now = time();
		$expires = $now + ($remember ? self::REMEMBER_LIFETIME : self::NORMAL_LIFETIME);
		Database::transaction(function (PDO $db) use ($old, $id, $token, $account, $now, $expires): void {
			if (is_string($old)) $db->prepare('DELETE FROM admin_sessions WHERE id_hash = ?')->execute([hash('sha256', $old)]);
			$db->prepare('INSERT INTO admin_sessions (id_hash, administrator_id, account_version, request_token, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
				->execute([hash('sha256', $id), $account['id'], $account['account_version'], $token, $expires, $now, $now]);
		});
		setcookie(self::COOKIE_NAME, $id, $this->cookieOptions($remember ? $expires : 0));
		$_COOKIE[self::COOKIE_NAME] = $id;
		return $token;
	}

	public function invalidate (): void {
		$id = $_COOKIE[self::COOKIE_NAME] ?? null;
		if (is_string($id) && Database::installed()) {
			Database::connection()->prepare('DELETE FROM admin_sessions WHERE id_hash = ?')->execute([hash('sha256', $id)]);
		}
		unset($_COOKIE[self::COOKIE_NAME]);
		setcookie(self::COOKIE_NAME, '', $this->cookieOptions(time() - 3600));
	}
}
