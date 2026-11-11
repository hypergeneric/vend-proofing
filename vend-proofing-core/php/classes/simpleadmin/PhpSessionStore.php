<?php

/** PHP session state used by the existing order and Dropbox flow. */
class PhpSessionStore implements SessionHandlerInterface {
	public function open (string $path, string $name): bool {
		return Database::installed();
	}

	public function close (): bool {
		return true;
	}

	public function read (string $id): string|false {
		$stmt = Database::connection()->prepare('SELECT session_data FROM php_sessions WHERE id_hash = ? AND expires_at >= ?');
		$stmt->execute([hash('sha256', $id), time()]);
		$data = $stmt->fetchColumn();
		return $data === false ? '' : $data;
	}

	public function write (string $id, string $data): bool {
		$now = time();
		$expires = $now + (int) ini_get('session.gc_maxlifetime');
		$stmt = Database::connection()->prepare(
			'INSERT INTO php_sessions (id_hash, session_data, expires_at, updated_at) VALUES (?, ?, ?, ?) '
			. 'ON CONFLICT(id_hash) DO UPDATE SET session_data = excluded.session_data, expires_at = excluded.expires_at, updated_at = excluded.updated_at'
		);
		return $stmt->execute([hash('sha256', $id), $data, $expires, $now]);
	}

	public function destroy (string $id): bool {
		return Database::connection()->prepare('DELETE FROM php_sessions WHERE id_hash = ?')->execute([hash('sha256', $id)]);
	}

	public function gc (int $max_lifetime): int|false {
		$stmt = Database::connection()->prepare('DELETE FROM php_sessions WHERE expires_at < ?');
		$stmt->execute([time()]);
		return $stmt->rowCount();
	}
}
