<?php

	class Filesystem {

		public static function getFileData ($path) {
			return @file_get_contents($path);
		}

		public static function getFileArray ($path) {
			if (file_exists($path)) {
				return @file($path);
			}
			return array();
		}

		public static function deleteFile ($path, $force=false) {
			if (SA_DEMOMODE&&$force==false) return true;
			$result = @unlink($path);
			if ($result==false) {
				$result = false;
			} else {
				$result = true;
			}
			return $result;
		}

		public static function deleteFolder ($path, $force=false) {
			if (SA_DEMOMODE&&$force==false) return true;
			$result = @rmdir($path);
			if ($result==false) {
				$result = false;
			} else {
				$result = true;
			}
			return $result;
		}

		public static function purgeFolder ($path, $force=false) {
			if (SA_DEMOMODE&&$force==false) return true;
			$result;
			$handle = @opendir($path);
			if (!$handle) {
				$result = false;
			} else {
				while (false !== ( $file = readdir($handle) )) {
					if ($file == '.' || $file == '..' || is_dir("$path/$file")) continue;
					Filesystem::deleteFile("$path/$file");
				}
				closedir($handle);
			}
			$result = true;
			return $result;
		}

		public static function makeFile ($path, $data="", $mode="wb", $force=false) {
			if (SA_DEMOMODE&&$force==false) return true;
			$folder = explode("/", $path);
			array_pop($folder);
			$folder = implode("/", $folder);
			if (strlen($folder)>0) Filesystem::mkdirR($folder . "/");
			$handle = @fopen($path, $mode);
			if (!$handle) return false;
			@flock($handle, 2);
			if (@fwrite($handle, $data)===false) return false;
			@chmod($path, SA_PERMISSION_FILE);
			@flock($handle, 3);
			fclose($handle);
			return true;
		}

		public static function makeFolder ($path, $force=false) {
			if (SA_DEMOMODE&&$force==false) return true;
			if (is_dir($path)) {
				chmod($path, SA_PERMISSION_DIR);
				return true;
			}
			$result = Filesystem::mkdirR($path, SA_PERMISSION_DIR);
			if ($result==false) {
				$result = false;
			} else {
				chmod($path, SA_PERMISSION_DIR);
				$result = true;
			}
			return $result;
		}

		public static function mkdirR ($dir, $mode = SA_PERMISSION_DIR) {
			if (is_dir($dir) || @mkdir($dir, $mode)) return true;
			if (!Filesystem::mkdirR(dirname($dir), $mode)) return false;
			return @mkdir($dir, $mode);
		}

		public static function moveUploadedFile ($from, $to, $force=false) {
			if (SA_DEMOMODE&&$force==false) return true;
			$result = move_uploaded_file($from, $to);
			if ($result) chmod($to, SA_PERMISSION_FILE);
			return $result;
		}

		public static function getDirSize($path) {
			$result = explode("\t", @exec("du -b -s ".$path), 2);
			if (isset($result[1])) {
				if ($result[1]==$path) return $result[0];
			}
			$tally = 0;
			$handle = @opendir($path);
			if ($handle) {
				while (false !== ( $file = readdir($handle) )) {
					if (is_link("$path/$file") || $file == '.' || $file == '..') continue;
					if (is_dir("$path/$file")) {
						$tally += Filesystem::getDirSize("$path/$file");
					} elseif (is_file("$path/$file")) {
						$tally += filesize("$path/$file");
					}
				}
				closedir($handle);
			}
			return $tally;
		}

	}

?>