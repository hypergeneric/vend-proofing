<?php

	class Flatfile {

		/* ---- XML File System ---- */

		public static function getTrueXmlPath ($type, $suid=null) {
			/* the default
				*/
			$default = SA_DIR_DEFAULTS . "/$type.xml";
			/* pull in the right xml doc, depending if we're looking in a set
				or if we're pulling a global setup file
				*/
			$path = SA_DIR_STORAGE . "/$type.xml";
			if ($suid!=null) $path = SA_DIR_STORAGE . "/$suid/$type.xml";
			/* load the file in as a string
				*/
			return file_exists($path) ? $path : $default;
		}

		public static function createXmlString ($type, $suid=null, $data="") {
			/* pull in the right xml doc, depending if we're looking in a set
				or if we're pulling a global setup file
				*/
			$path = SA_DIR_STORAGE . "/$type.xml";
			if ($suid!=null) $path = SA_DIR_STORAGE . "/$suid/$type.xml";
			return Filesystem::makeFile($path, $data);
		}

		public static function revertXmlString ($type, $suid=null) {
			$path = Flatfile::getTrueXmlPath($type, $suid);
			return Filesystem::deleteFile($path);
		}

		public static function getXmlDefaults ($type) {
			$default = SA_DIR_DEFAULTS . "/$type.xml";
			return @file_get_contents($default);
		}
		
		public static function getXmlString ($type, $suid=null, $required=false) {
			$default = SA_DIR_DEFAULTS . "/$type.xml";
			$path = Flatfile::getTrueXmlPath($type, $suid);
			if ($path==$default&&$required==true) return "";
			return @file_get_contents($path);
		}

		public static function getXmlArray ($type, $suid=null, $required=false) {
			$default = SA_DIR_DEFAULTS . "/$type.xml";
			$path = Flatfile::getTrueXmlPath($type, $suid);
			if ($path==$default&&$required==true) return "";
			$xml_obj = new SimpleXML4();
			$xml_obj->load($path);
			return $xml_obj;
		}

	}

?>
