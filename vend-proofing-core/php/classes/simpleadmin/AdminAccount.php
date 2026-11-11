<?php

/** The single administrator for a fresh Vend installation. */
class AdminAccount {
	public static function exists (): bool {
		if (!Database::installed()) return false;
		return (bool) Database::connection()->query('SELECT 1 FROM administrators WHERE id = 1')->fetchColumn();
	}

	public static function create (string $username, string $email, string $password): void {
		self::validate($username, $email, $password);
		Database::transaction(function (PDO $db) use ($username, $email, $password): void {
			if ($db->query('SELECT 1 FROM administrators WHERE id = 1')->fetchColumn()) {
				throw new RuntimeException('The administrator already exists.');
			}
			$now = time();
			$db->prepare('INSERT INTO administrators (id, username, email, password_hash, created_at, updated_at) VALUES (1, ?, ?, ?, ?, ?)')
				->execute([$username, strtolower($email), password_hash($password, PASSWORD_DEFAULT), $now, $now]);
		});
	}

	private static function validate (string $username, string $email, string $password): void {
		if (!preg_match('/^[A-Za-z0-9._-]{3,80}$/', $username) || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 12) {
			throw new InvalidArgumentException('Use a username of 3–80 letters, numbers, dots, underscores or dashes; a valid email; and a password of at least 12 characters.');
		}
	}

	public static function find (): ?array {
		if (!Database::installed()) return null;
		$row = Database::connection()->query('SELECT * FROM administrators WHERE id = 1')->fetch();
		return $row ?: null;
	}

	public static function verify (string $username, string $password): ?array {
		$row = self::find();
		if (!$row || !hash_equals($row['username'], $username) || !password_verify($password, $row['password_hash'])) return null;
		if (password_needs_rehash($row['password_hash'], PASSWORD_DEFAULT)) {
			Database::connection()->prepare('UPDATE administrators SET password_hash = ?, updated_at = ? WHERE id = 1')
				->execute([password_hash($password, PASSWORD_DEFAULT), time()]);
		}
		return $row;
	}

	public static function changePassword (string $username, string $old, string $new): bool {
		if (strlen($new) < 12 || !self::verify($username, $old)) return false;
		Database::connection()->prepare('UPDATE administrators SET password_hash = ?, account_version = account_version + 1, updated_at = ? WHERE id = 1')
			->execute([password_hash($new, PASSWORD_DEFAULT), time()]);
		return true;
	}

	public static function resetPassword (string $username, string $new): void {
		$row = self::find();
		if (!$row || $row['username'] !== $username || strlen($new) < 12) throw new InvalidArgumentException('Unknown administrator or password shorter than 12 characters.');
		Database::connection()->prepare('UPDATE administrators SET password_hash = ?, account_version = account_version + 1, updated_at = ? WHERE id = 1')
			->execute([password_hash($new, PASSWORD_DEFAULT), time()]);
	}

	public static function changeUsername (string $old, string $new, string $password): bool {
		if (!preg_match('/^[A-Za-z0-9._-]{3,80}$/', $new) || !self::verify($old, $password)) return false;
		Database::connection()->prepare('UPDATE administrators SET username = ?, account_version = account_version + 1, updated_at = ? WHERE id = 1')
			->execute([$new, time()]);
		return true;
	}
}
