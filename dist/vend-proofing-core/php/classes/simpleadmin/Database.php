<?php

/** Vend's single durable application database. Created by the installer or CLI. */
class Database {
	private static ?PDO $connection = null;
	private static int $savepoint = 0;

	public static function path (): string {
		return SA_DIR_AUTH . '/vend.sqlite';
	}

	public static function installed (): bool {
		return is_file(self::path());
	}

	public static function connection (): PDO {
		if (self::$connection) return self::$connection;
		if (!self::installed()) throw new RuntimeException('Install Vend with scripts/install.php first.');
		self::$connection = self::open(self::path());
		return self::$connection;
	}

	private static function open (string $path): PDO {
		$db = new PDO('sqlite:' . $path, null, null, [
			PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
			PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
		]);
		$db->exec('PRAGMA foreign_keys = ON');
		$db->exec('PRAGMA busy_timeout = 5000');
		$db->exec('PRAGMA journal_mode = WAL');
		return $db;
	}

	public static function install (): void {
		if (self::installed()) throw new RuntimeException('Vend is already installed.');
		if (!is_dir(SA_DIR_AUTH) && !mkdir(SA_DIR_AUTH, 0770, true) && !is_dir(SA_DIR_AUTH)) {
			throw new RuntimeException('Cannot create the private auth directory.');
		}
		$path = self::path();
		$db = self::open($path);
		if (!chmod($path, 0660)) throw new RuntimeException('Cannot restrict database permissions.');
		self::$connection = $db;
		self::migrate();
		$defaults = file_get_contents(dirname(__DIR__, 3) . '/defaults/installation.json');
		$db->prepare('INSERT INTO configuration_documents (type, scope_id, json_text, updated_at) VALUES (?, ?, ?, ?)')
			->execute(['installation', '', $defaults, time()]);
	}

	public static function migrate (): void {
		$db = self::connection();
		$db->exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)');
		$files = glob(dirname(__DIR__, 2) . '/migrations/[0-9]*.sql');
		sort($files, SORT_STRING);
		foreach ($files as $file) {
			$version = (int) strtok(basename($file), '_');
			$existing = $db->prepare('SELECT 1 FROM schema_migrations WHERE version = ?');
			$existing->execute([$version]);
			if ($existing->fetchColumn()) continue;
			self::transaction(function (PDO $db) use ($file, $version): void {
				$db->exec(file_get_contents($file));
				$db->prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')->execute([$version, time()]);
			});
		}
		self::installationSecret();
	}

	public static function installationSecret (): string {
		$query = self::connection()->prepare('SELECT secret FROM installation_secrets WHERE name = ?');
		$query->execute(['gallery_access']);
		$secret = $query->fetchColumn();
		if ($secret !== false) return $secret;

		return self::transaction(function (PDO $db): string {
			$query = $db->prepare('SELECT secret FROM installation_secrets WHERE name = ?');
			$query->execute(['gallery_access']);
			$secret = $query->fetchColumn();
			if ($secret !== false) return $secret;

			$secret = bin2hex(random_bytes(32));
			$db->prepare('INSERT INTO installation_secrets (name, secret) VALUES (?, ?)')
				->execute(['gallery_access', $secret]);
			return $secret;
		});
	}

	public static function transaction (callable $work): mixed {
		$db = self::connection();
		$nested = $db->inTransaction();
		$name = 'vend_' . ++self::$savepoint;
		$db->exec($nested ? "SAVEPOINT $name" : 'BEGIN IMMEDIATE');
		try {
			$result = $work($db);
			$db->exec($nested ? "RELEASE SAVEPOINT $name" : 'COMMIT');
			return $result;
		} catch (Throwable $error) {
			$db->exec($nested ? "ROLLBACK TO SAVEPOINT $name" : 'ROLLBACK');
			if ($nested) $db->exec("RELEASE SAVEPOINT $name");
			throw $error;
		}
	}

	/** Public identifiers are hexadecimal, independent of physical file paths. */
	public static function allocateSuid (): string {
		return self::transaction(function (PDO $db): string {
			$db->exec("UPDATE id_sequences SET next_value = next_value + 1 WHERE name = 'suid'");
			$value = $db->query("SELECT next_value - 1 FROM id_sequences WHERE name = 'suid'")->fetchColumn();
			if ($value === false) throw new RuntimeException('SUID sequence is missing.');
			return dechex((int) $value);
		});
	}
}
