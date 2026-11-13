<?php

	require_once __DIR__ . "/ConfigurationDocument.php";

	/** Saved configuration lives in SQLite; source defaults live beside admin.json. */
	class Configuration {

		private static function defaultPath (string $type): ?string {
			if (!preg_match('/^[a-z]+$/', $type) || $type==="admin") return null;
			$path = SA_DIR_DEFAULTS . "/$type.json";
			return is_file($path) ? $path : null;
		}

		private static function scopeId ($suid): ?string {
			if ($suid===null || $suid==="") return "";
			if (!is_string($suid) || !preg_match('/^[a-f0-9]{1,16}$/i', $suid)) return null;
			return strtolower($suid);
		}

		public static function getDefaults (string $type): string|false {
			$path = self::defaultPath($type);
			if ($path===null) return false;
			return (new ConfigurationDocument(file_get_contents($path)))->toRuntimeString();
		}

		public static function getJson (string $type, $suid=null, bool $required=false): string|false {
			$path = self::defaultPath($type);
			$scopeId = self::scopeId($suid);
			if ($path===null || $scopeId===null) return false;

			if (Database::installed()) {
				$query = Database::connection()->prepare(
					'SELECT json_text FROM configuration_documents WHERE type = ? AND scope_id = ?'
				);
				$query->execute(array($type, $scopeId));
				$saved = $query->fetchColumn();
				if ($saved!==false) return (new ConfigurationDocument($saved))->toRuntimeString();
			}

			if ($required) return "";
			return (new ConfigurationDocument(file_get_contents($path)))->toRuntimeString();
		}

		public static function getDocument (string $type, $suid=null, bool $required=false): ConfigurationDocument|string|false {
			$json = self::getJson($type, $suid, $required);
			if ($json===false || $json==="") return $json;
			return new ConfigurationDocument($json);
		}

		public static function save (string $type, $suid=null, string $data=""): bool {
			$scopeId = self::scopeId($suid);
			if (self::defaultPath($type)===null || $scopeId===null || !Database::installed()) return false;

			try {
				$document = new ConfigurationDocument($data);
			} catch (JsonException $error) {
				return false;
			}
			$data = $document->toString();

			Database::connection()->prepare(
				'INSERT INTO configuration_documents (type, scope_id, json_text, updated_at) VALUES (?, ?, ?, ?)
				 ON CONFLICT (type, scope_id) DO UPDATE SET json_text = excluded.json_text, updated_at = excluded.updated_at'
			)->execute(array($type, $scopeId, $data, time()));
			return true;
		}

		public static function revert (string $type, $suid=null): bool {
			$scopeId = self::scopeId($suid);
			if (self::defaultPath($type)===null || $scopeId===null || !Database::installed()) return false;
			Database::connection()->prepare(
				'DELETE FROM configuration_documents WHERE type = ? AND scope_id = ?'
			)->execute(array($type, $scopeId));
			return true;
		}
	}
