<?php

	/** Installation settings use the same SQLite configuration store as the site. */
	class AppConfig {
		private ConfigurationDocument $settings;

		public function __construct () {
			$this->settings = Configuration::getDocument("installation");
		}

		public function getNodeVal (string $path): ?string {
			return $this->settings->getNodeVal("data." . $path);
		}
	}
