<?php

	/** Physical media upload and snapshot operations. Metadata lives in Records. */
	class MediaFiles {

		private static function mediaValue (array $request, string $key, string $default=""): string {
			if (isset($request[$key]) && is_string($request[$key]) && $request[$key]!=="") {
				return $request[$key];
			}
			return $default;
		}

		public static function mediaOrderMoves (array $request): array {
			$moves = array();
			foreach (explode(";", self::mediaValue($request, "indices")) as $pair) {
				if (!preg_match('/^(\d+),(\d+)$/', $pair, $match)) continue;
				$moves[(int) $match[1]] = (int) $match[2];
			}
			return $moves;
		}

		public static function receiveMediaFile (string $type, string $folder, array $request): array|int {
			$uri = self::mediaValue($request, "uri");
			$filename = self::mediaValue($request, "filename");
			if ($uri!=="") {
				if (self::mediaValue($request, "video")==="true") {
					return self::addFileUrl($type, $folder, $uri, $filename ?: null);
				}
				return self::sideloadFile($type, $folder, $uri, $filename ?: null);
			}

			$isSnapshot = self::mediaValue($request, "snapshot")==="true";
			$snapshotId = self::mediaValue($request, "snapshot_id", $filename);
			return self::uploadFile($type, $folder, $isSnapshot ? "true" : "false", $snapshotId ?: null);
		}

		public static function mediaFileError (int $code): string {
			$errors = array(
				-100 => "Cannot Import Uploaded File",
				-200 => "Cannot Copy Local File",
				-300 => "URL Does Not Exist",
				-400 => "Sideloader Class Unavailable",
				-500 => "Invalid File Type",
				-600 => "Image Too Large"
			);
			return $errors[$code] ?? "Cannot Import File";
		}

		public static function mediaSnapshotResult (int $result): string|int {
			if ($result===-200) return "Filename Required";
			if ($result===-300) return "File Data Required";
			if ($result===-100) return "Operation Not Allowed";
			return $result;
		}

		private static function safeKey (string $key): bool {
			return preg_match('/^[A-Za-z0-9._-]+$/', $key)===1;
		}

		public static function delete (string $folder, array $keys): void {
			foreach ($keys as $key) {
				if (!self::safeKey((string) $key)) continue;
				$path = SA_DIR_STORAGE . "/" . $folder . "/" . $key;
				@unlink($path);
				@unlink($path . ".snapshot.jpg");
			}
		}

		private static function isAllowedFile ($filename) {
			if (!is_string($filename) || !str_contains($filename, ".")) return false;
			$filename = strtolower($filename);
			$extension = pathinfo($filename, PATHINFO_EXTENSION);
			$allowed = array(
				"woff", "ttf", "otf", "mview", "txt", "csv", "htm", "html", "xml", "css", "js",
				"doc", "xls", "rtf", "ppt", "pdf", "zip", "swf", "flv", "mp4", "mp3",
				"avi", "wmv", "mov", "jpg", "jpeg", "gif", "png", "ico", "webm", "ogv"
			);
			return in_array($extension, $allowed, true);
		}

		private static function inspectUpload ($fileobject) {
			$imagesize = @getimagesize($fileobject["file"]["tmp"]);
			if ($imagesize) {
				$fileobject["dimensions"] = $imagesize[0] . "x" . $imagesize[1];
			}
			$filesize = @filesize($fileobject["file"]["tmp"]);
			$imagetypes = array("jpg", "jpeg", "gif", "png");
			if ($filesize!==false && in_array($fileobject["file"]["ext"], $imagetypes, true)) {
				$fileobject["size"] = $filesize;
			}
			return $fileobject;
		}

		private static function inspectStoredFile ($fileobject) {
			if (!class_exists("getID3")) return $fileobject;
			$getID3 = new getID3;
			$fileinfo = $getID3->analyze($fileobject["file"]["path"]);
			/* if it's a simple image, just use that
				otherwise, use getid3 for the size info
				*/
			if (!isset($fileobject["dimensions"])) {
				$width = @$fileinfo["video"]["resolution_x"];
				$height = @$fileinfo["video"]["resolution_y"];
				if ($fileobject["file"]["ext"]=="flv") {
					$width = @$fileinfo["meta"]["onMetaData"]["width"];
					$height = @$fileinfo["meta"]["onMetaData"]["height"];
				}
				$fileobject["dimensions"] = $width . "x" . $height;
			}
			if (!isset($fileobject["size"])) {
				$fileobject["size"] = @filesize($fileobject["file"]["path"]);
			}
			$fileobject["duration"] = @$fileinfo['playtime_seconds'];
			return $fileobject;
		}
		
		public static function addSnapshot ($type, $folder=null, $filename=null, $data="") {
			/* do some error checking
				*/
			if ($filename==null || !self::safeKey((string) $filename)) {
				return -200; // filename required
			}
			if ($data=="") {
				return -300; // data required
			}
			$data = str_replace(' ', '+', $data);
			$data = substr($data, strpos($data, ",")+1);
			$data = base64_decode($data);
			/* get the path to the storage location
				*/
			if ($folder==null) $folder = $type;
			$directory = SA_DIR_STORAGE . "/$folder";
			/* make sure the folder exists
				*/
			Filesystem::makeFolder($directory);
			/* create the fileobject
				*/
			$filename = $filename . ".snapshot.jpg";
			$filename = explode(".", $filename);
			$fileext = strtolower(array_pop($filename));
			$filename = implode(".", $filename);
			$filehash = $filename;
			$fileobject = array(
				"file" => array (
					"name" => $filename,
					"ext" => $fileext,
					"final" => $filehash . "." . $fileext,
					"path" => $directory . "/" . $filehash . "." . $fileext
				)
			);
			/* save the data to a file
				*/
			if (!Filesystem::makeFile($fileobject["file"]["path"], $data)) return -100;
			/* success
				*/
			return 100;
		}

		public static function addFileUrl ($type, $folder, $uri, $filename=null) {
			/* get the path to the storage location
				*/
			if ($folder==null) $folder = $type;
			$directory = SA_DIR_STORAGE . "/$folder";
			/* start up the sideloader
				*/
			$proxy = new SideLoad;
			$proxy->metaOnly(true);
			$proxy->setURL($uri);
			/* check to see if it's valid
				*/
			$service = $proxy->getService();
			$services = array("vimeo", "youtube", "sketchfab");
			if (!in_array($service, $services)) {
				return -300;  // Cannot Copy Local File
			}
			/* make sure the folder exists
				*/
			Filesystem::makeFolder($directory);
			/* create a array to stuff our info into
				*/
			if ($filename==null) {
				$filename = $proxy->getBasename();
			}
			$fileext = $proxy->getExtension();
			$filehash = md5($filename) . "-" . Database::allocateSuid();
			$fileobject = array(
				"file" => array (
					"name" => $filename,
					"basename" => $filename,
					"ext" => $fileext,
					"hash" => $filehash,
					"final" => $filehash . "." . $fileext,
					"path" => $directory . "/" . $filehash . "." . $fileext
				)
			);
			/* check for errors
				*/
			if (!$proxy->downloadTo($fileobject["file"]["path"])) {
				return -200;  // Cannot Copy Local File
			}
			/* get the attributes
				*/
			$fileobject = self::inspectStoredFile($fileobject);
			return array($fileobject["file"]["final"], $fileobject["file"]["name"], $fileobject["dimensions"], 0, 0, "", $proxy->getURL(), $service);
		}
		
		public static function sideloadFile ($type, $folder, $uri, $filename=null) {
			/* get the path to the storage location
				*/
			if ($folder==null) $folder = $type;
			$directory = SA_DIR_STORAGE . "/$folder";
			/* start up the sideloader
				*/
			if (!class_exists("SideLoad")) return -400;
			$proxy = new SideLoad;
			$proxy->setURL($uri);
			/* check to see if it's a safe file
				*/
			if (!self::isAllowedFile($proxy->getFilename())) {
				return -500;  // Invalid File Type
			}
			/* make sure the folder exists
				*/
			Filesystem::makeFolder($directory);
			/* create a array to stuff our info into
				*/
			if ($filename==null) {
				$filename = $proxy->getBasename();
			}
			$fileext = $proxy->getExtension();
			$filehash = Func::homogenize($filename) . "-" . Database::allocateSuid();
			$fileobject = array(
				"file" => array (
					"name" => $filename,
					"basename" => $filename,
					"ext" => $fileext,
					"hash" => $filehash,
					"final" => $filehash . "." . $fileext,
					"path" => $directory . "/" . $filehash . "." . $fileext
				)
			);
			/* check for errors
				*/
			if ($proxy->isLocal()) {
				if (!$proxy->copyTo($fileobject["file"]["path"])) {
					return -200;  // Cannot Copy Local File
				}
			} else {
				if (!$proxy->downloadTo($fileobject["file"]["path"])) {
					return -200;  // Cannot Copy Local File
				}
			}
			/* get the attributes
				*/
			$fileobject = self::inspectStoredFile($fileobject);
			return array($fileobject["file"]["final"], $fileobject["file"]["name"], $fileobject["dimensions"], $fileobject["duration"], $fileobject["size"], "");
		}

		public static function uploadFile ($type, $folder=null, $snapshot="false", $snapshot_id=null) {
			/* get the path to the storage location
				*/
			if ($folder==null) $folder = $type;
			$directory = SA_DIR_STORAGE . "/$folder";
			/* check to see if it's a safe file
				*/
			if (!isset($_FILES['Filedata']) || !self::isAllowedFile($_FILES['Filedata']['name'])) {
				return -500;  // Invalid File Type
			}
			if ($snapshot==="true" && ($snapshot_id===null || !self::safeKey((string) $snapshot_id))) {
				return -200; // Filename Required
			}
			/* make sure the folder exists
				*/
			Filesystem::makeFolder($directory);
			/* create a array to stuff our info into
				*/
			$filename = $_FILES['Filedata']['name'];
			$filename = explode(".", $filename);
			$fileext = strtolower(array_pop($filename));
			$filename = implode(".", $filename);
			if ($snapshot=="true") {
				$filename = $snapshot_id . ".snapshot.jpg";
				$filename = explode(".", $filename);
				$fileext = strtolower(array_pop($filename));
				$filename = implode(".", $filename);
				$filehash = $filename;
			} else {
				$filehash = Func::homogenize($filename) . "-" . Database::allocateSuid();
			}
			$fileobject = array(
				"file" => array (
					"tmp" => $_FILES['Filedata']['tmp_name'],
					"name" => $_FILES['Filedata']['name'],
					"basename" => $filename,
					"ext" => $fileext,
					"hash" => $filehash,
					"final" => $filehash . "." . $fileext,
					"path" => $directory . "/" . $filehash . "." . $fileext
				)
			);
			/* check for file size issues
				*/
			$fileobject = self::inspectUpload($fileobject);
			/* check for errors
				*/
			if (!Filesystem::moveUploadedFile($_FILES['Filedata']['tmp_name'], $fileobject["file"]["path"])) {
				return -100;  // Cannot Import Uploaded File
			}
			/* get the attributes
				*/
			$fileobject = self::inspectStoredFile($fileobject);
			return array($fileobject["file"]["final"], $fileobject["file"]["name"], $fileobject["dimensions"], $fileobject["duration"], $fileobject["size"], "");
		}

	}

?>
