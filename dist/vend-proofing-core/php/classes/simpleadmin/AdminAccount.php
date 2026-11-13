<?php

/** Administrator records in the private application database. */
class AdminAccount {
	public static function exists (): bool {
		if (!Database::installed()) return false;
		return (bool) Database::connection()->query('SELECT 1 FROM administrators LIMIT 1')->fetchColumn();
	}

	public static function create (string $username, string $email, string $password, string $userType = 'admin'): void {
		self::validate($username, $email, $password);
		self::validateType($userType);
		Database::transaction(function (PDO $db) use ($username, $email, $password, $userType): void {
			$now = time();
			$db->prepare('INSERT INTO administrators (username, email, password_hash, created_at, updated_at, user_type) VALUES (?, ?, ?, ?, ?, ?)')
				->execute([$username, strtolower($email), password_hash($password, PASSWORD_DEFAULT), $now, $now, $userType]);
		});
	}

	private static function validate (string $username, string $email, string $password): void {
		if (!preg_match('/^[A-Za-z0-9._-]{3,80}$/', $username) || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 12 || strlen($password) > 4096 || str_contains($password, "\0")) {
			throw new InvalidArgumentException('Account Invalid Fields');
		}
	}

	public static function find (string $username): ?array {
		if (!Database::installed()) return null;
		$query = Database::connection()->prepare('SELECT * FROM administrators WHERE username = ?');
		$query->execute([$username]);
		$row = $query->fetch();
		return $row ?: null;
	}

	public static function verify (string $username, string $password): ?array {
		$row = self::find($username);
		if (!$row || !hash_equals($row['username'], $username) || !password_verify($password, $row['password_hash'])) return null;
		if (password_needs_rehash($row['password_hash'], PASSWORD_DEFAULT)) {
			Database::connection()->prepare('UPDATE administrators SET password_hash = ?, updated_at = ? WHERE id = ?')
				->execute([password_hash($password, PASSWORD_DEFAULT), time(), $row['id']]);
		}
		return $row;
	}

	public static function resetPassword (string $username, string $new): void {
		$row = self::find($username);
		if (!$row || $row['username'] !== $username || strlen($new) < 12 || strlen($new) > 4096 || str_contains($new, "\0")) throw new InvalidArgumentException('Account Reset Invalid');
		Database::connection()->prepare('UPDATE administrators SET password_hash = ?, account_version = account_version + 1, updated_at = ? WHERE id = ?')
			->execute([password_hash($new, PASSWORD_DEFAULT), time(), $row['id']]);
	}

	public static function listing (): array {
		return Database::connection()->query('SELECT id, username, email, user_type FROM administrators ORDER BY username')->fetchAll();
	}

	public static function updateSelf (int $actor, int $id, string $username, string $email, string $password, string $currentPassword): void {
		if ($actor !== $id || $actor < 1) throw new InvalidArgumentException('Account Self Only');
		self::validate($username, $email, $password === '' ? str_repeat('x', 12) : $password);
		Database::transaction(function (PDO $db) use ($id, $username, $email, $password, $currentPassword): void {
			$query = $db->prepare('SELECT password_hash FROM administrators WHERE id = ?');
			$query->execute([$id]);
			$hash = $query->fetchColumn();
			if (!$hash || !password_verify($currentPassword, $hash)) throw new InvalidArgumentException('Account Current Password Invalid');
			$newHash = $password === '' ? $hash : password_hash($password, PASSWORD_DEFAULT);
			$db->prepare('UPDATE administrators SET username = ?, email = ?, password_hash = ?, account_version = account_version + 1, updated_at = ? WHERE id = ?')
				->execute([$username, strtolower($email), $newHash, time(), $id]);
			$db->prepare('DELETE FROM admin_sessions WHERE administrator_id = ?')->execute([$id]);
		});
	}

	private static function validateType (string $userType): void {
		if (!in_array($userType, ['admin', 'manager'], true)) throw new InvalidArgumentException('Account Type Invalid');
	}

	public static function changeType (int $id, string $userType): void {
		self::validateType($userType);
		$query = Database::connection()->prepare('UPDATE administrators SET user_type = ?, updated_at = ? WHERE id = ?');
		$query->execute([$userType, time(), $id]);
		if (!$query->rowCount()) throw new InvalidArgumentException('Account Missing');
	}

	public static function deleteOther (int $actor, int $id): void {
		if ($actor === $id || $actor < 1) throw new InvalidArgumentException('Account Delete Self');
		Database::transaction(function (PDO $db) use ($actor, $id): void {
			$query = $db->prepare('SELECT 1 FROM administrators WHERE id = ?');
			$query->execute([$actor]);
			if (!$query->fetchColumn()) throw new InvalidArgumentException('Account Sign In');
			$db->prepare('DELETE FROM administrators WHERE id = ?')->execute([$id]);
		});
	}
}
