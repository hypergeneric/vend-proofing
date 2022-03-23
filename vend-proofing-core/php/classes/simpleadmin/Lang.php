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
			$xmlstr = Filesystem::getFileData(SA_DIR_COREPATH."/lang/$code.xml");
			if ($xmlstr===false) $xmlstr = Filesystem::getFileData(SA_DIR_COREPATH."/lang/en.xml");
			$this->table = new SimpleXML4($xmlstr);
		}

		public function lookup ($name) {
			$name = strtolower($name);
			$name = str_replace(" ", "_", $name);
			$value = $this->table->getAttrVal("data.$name.name");
			if ($value==""||$value==null) {
				$name = str_replace("_", " ", $name);
				$value = ucwords($name);
				$name = str_replace(" ", "_", $name);
				// add it to the lang file, if it dosent exist
				$append = false;
				$path = SA_DIR_COREPATH."/lang/lang.xml";
				$node = "	<$name name=\"$value\" />\n";
				$lines = Filesystem::getFileArray($path);
				$count = count($lines);
				for ($i=0; $i<$count; ++$i) {
					$line = trim($lines[$i]);
					/* skip anything that is empty
						*/
					if (strlen($line)==0) continue;
					/* skip anything that is empty
						*/
					if ($line==trim($node)) {
						$append = false;
						break;
					}
				}
				if ($append) Filesystem::makeFile($path, $node, "a");
			}
			return $value;
		}

	}

?>