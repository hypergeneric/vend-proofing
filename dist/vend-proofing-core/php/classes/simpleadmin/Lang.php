<?php

	class Lang {

		public $table;
		public $code = "en";

		public function __construct() {
		}
		
		public function getTableArray () {
			return $this->table->toArray();
		}

		public function language ($code) {
			if (strlen($code)==0) $code = "en";
			if (!preg_match('/^[a-z]{2}$/', $code)) $code = "en";
			$json = Filesystem::getFileData(SA_DIR_LANG."/$code.json");
			if ($json===false) {
				$code = "en";
				$json = Filesystem::getFileData(SA_DIR_LANG."/en.json");
			}
			$this->code = $code;
			$this->table = new ConfigurationDocument($json);
		}

		public function lookup ($name) {
			$name = strtolower($name);
			$name = str_replace(" ", "_", $name);
			$value = $this->table->getAttrVal("data.$name.name");
			if ($value==""||$value==null) {
				$name = str_replace("_", " ", $name);
				$value = ucwords($name);
			}
			return $value;
		}

	}

?>
