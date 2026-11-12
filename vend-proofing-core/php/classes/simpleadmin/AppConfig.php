<?php

	/** Public application identity and administration layout. */
	class AppConfig {
		private static ?array $settings = null;

		public static function adminConfig (): array {
			if (self::$settings===null) {
				$path = SA_DIR_DEFAULTS . "/admin.json";
				self::$settings = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
			}
			return self::$settings;
		}

		public function getNodeVal (string $path): ?string {
			$node = self::adminConfig();
			foreach (explode(".", $path) as $part) {
				if (!isset($node[$part])) return null;
				$node = $node[$part];
			}
			if (isset($node["_value"])) return (string) $node["_value"];
			return is_array($node) ? "" : null;
		}
	}
