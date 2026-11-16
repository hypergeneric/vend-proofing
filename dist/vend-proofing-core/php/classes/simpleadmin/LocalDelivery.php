<?php

	/** Local image preparation and private ZIP packages. Originals are never decoded. */
	class LocalDelivery {
		public static function snapshot (int $assetId, string $quality): array {
			$query = Database::connection()->prepare("SELECT * FROM media_assets WHERE id = ?");
			$query->execute(array($assetId));
			$asset = $query->fetch();
			if (!$asset || !in_array($quality, array("high", "low"), true)) throw new RuntimeException("The purchased image is unavailable.");
			$path = self::sourcePath($asset["relative_path"]);
			$image = @getimagesize($path);
			if (!$image || !in_array($image[2], array(IMAGETYPE_JPEG, IMAGETYPE_PNG), true)) {
				throw new RuntimeException("Local downloads support JPEG and PNG photographs.");
			}
			$hash = hash_file("sha256", $path);
			if ($hash===false) throw new RuntimeException("The purchased image could not be read.");
			return array("provider" => "local", "path" => $asset["relative_path"], "sha256" => $hash,
				"quality" => $quality, "name" => $asset["original_name"], "size" => filesize($path));
		}

		private static function sourcePath (string $relative): string {
			$base = realpath(SA_DIR_STORAGE);
			$path = realpath(SA_DIR_STORAGE . "/" . $relative);
			if (!$base || !$path || !str_starts_with($path, $base . DIRECTORY_SEPARATOR) || !is_file($path)) {
				throw new RuntimeException("The purchased image is no longer available. Contact the photographer.");
			}
			return $path;
		}

		/** Paths come from a stored manifest, never from a requested filename. */
		public static function packagePath (string $path): string {
			if (!preg_match('#^/vend-deliveries/[a-f0-9]+-[a-f0-9]{24}(?:/[^\\\\\x00]*)?$#D', $path)
				|| in_array("..", explode("/", $path), true)) throw new RuntimeException("Invalid download package.");
			return SA_DIR_STORAGE . $path;
		}

		public function copy (array $source, string $destination): void {
			$original = self::sourcePath($source["path"]);
			if (!hash_equals($source["sha256"], hash_file("sha256", $original))) {
				throw new RuntimeException("The purchased image has changed. Contact the photographer.");
			}
			$destination = self::packagePath($destination);
			$folder = dirname($destination);
			if (!is_dir($folder) && !mkdir($folder, 0770, true) && !is_dir($folder)) throw new RuntimeException("Download storage is not writable.");
			$temp = $destination . ".tmp";
			try {
				if ($source["quality"]==="high") {
					if (!copy($original, $temp)) throw new RuntimeException("The original could not be copied. Check free disk space.");
				} else {
					self::webImage($original, $temp);
				}
				if (!rename($temp, $destination)) throw new RuntimeException("The prepared image could not be saved.");
			} finally {
				if (is_file($temp)) unlink($temp);
			}
		}

		private static function webImage (string $source, string $destination): void {
			try {
				if (extension_loaded("imagick")) {
					$image = new Imagick();
					try {
						$image->readImage($source);
						$image->setIteratorIndex(0);
						$orientation = $image->getImageOrientation();
						if (in_array($orientation, array(2, 5, 7), true)) $image->flopImage();
						if ($orientation===4) $image->flipImage();
						$angle = array(3 => 180, 5 => -90, 6 => 90, 7 => 90, 8 => -90)[$orientation] ?? 0;
						if ($angle) $image->rotateImage("white", $angle);
						$scale = min(1, 1024 / $image->getImageWidth(), 768 / $image->getImageHeight());
						if ($scale<1) $image->thumbnailImage(max(1, (int) round($image->getImageWidth() * $scale)), max(1, (int) round($image->getImageHeight() * $scale)));
						$image->setImageBackgroundColor("white");
						$image->setImageAlphaChannel(Imagick::ALPHACHANNEL_REMOVE);
						$image->setImageOrientation(Imagick::ORIENTATION_TOPLEFT);
						$image->setImageFormat("jpeg");
						$image->setImageCompressionQuality(90);
						if (!$image->writeImage($destination)) throw new RuntimeException("Image write failed.");
					} finally { $image->clear(); }
				} else {
					self::webImageGd($source, $destination);
				}
			} catch (Throwable $error) {
				throw new RuntimeException("This server could not create the web-size image. Check image-processing support, available memory and disk space, then retry.");
			}
		}

		private static function webImageGd (string $source, string $destination): void {
			$type = getimagesize($source)[2];
			$image = $type===IMAGETYPE_JPEG ? imagecreatefromjpeg($source) : imagecreatefrompng($source);
			try {
				if ($type===IMAGETYPE_JPEG && function_exists("exif_read_data")) {
					$orientation = (int) ((@exif_read_data($source))["Orientation"] ?? 1);
					if (in_array($orientation, array(2, 5, 7), true)) imageflip($image, IMG_FLIP_HORIZONTAL);
					if ($orientation===4) imageflip($image, IMG_FLIP_VERTICAL);
					$angle = array(3 => 180, 5 => 90, 6 => -90, 7 => -90, 8 => 90)[$orientation] ?? 0;
					if ($angle) $image = imagerotate($image, $angle, 0);
				}
				$width = imagesx($image); $height = imagesy($image);
				$scale = min(1, 1024 / $width, 768 / $height);
				$output = imagecreatetruecolor(max(1, (int) round($width * $scale)), max(1, (int) round($height * $scale)));
				imagefill($output, 0, 0, imagecolorallocate($output, 255, 255, 255));
				imagecopyresampled($output, $image, 0, 0, 0, 0, imagesx($output), imagesy($output), $width, $height);
				if (!imagejpeg($output, $destination, 90)) throw new RuntimeException("Image write failed.");
			} finally { unset($image, $output); }
		}

		public function finish (string $folder): void {
			$folder = self::packagePath($folder);
			$temp = $folder . ".tmp.zip";
			if (!class_exists("ZipArchive", false)) {
				self::finishPclZip($folder, $temp);
				return;
			}
			$zip = new ZipArchive();
			if ($zip->open($temp, ZipArchive::CREATE | ZipArchive::OVERWRITE)!==true) throw new RuntimeException("The download ZIP could not be created. Check free disk space.");
			try {
				$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($folder, FilesystemIterator::SKIP_DOTS));
				foreach ($files as $file) {
					if (!$file->isFile() || $file->isLink()) throw new RuntimeException("Invalid prepared image.");
					$name = substr($file->getPathname(), strlen($folder) + 1);
					if (!$zip->addFile($file->getPathname(), $name) || !$zip->setCompressionName($name, ZipArchive::CM_STORE)) {
						throw new RuntimeException("An image could not be added to the ZIP.");
					}
				}
				$closed = $zip->close();
				$zip = null;
				if (!$closed || !rename($temp, $folder . ".zip")) throw new RuntimeException("The download ZIP could not be saved. Check free disk space.");
			} finally {
				if ($zip) $zip->close();
				if (is_file($temp)) unlink($temp);
			}
		}

		private static function finishPclZip (string $folder, string $temp): void {
			if (!extension_loaded("zlib")) throw new RuntimeException("Local downloads require PHP ZIP or zlib support.");
			require_once dirname(__DIR__) . "/pclzip/pclzip.lib.php";
			$paths = array(); $size = 22;
			$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($folder, FilesystemIterator::SKIP_DOTS));
			foreach ($files as $file) {
				if (!$file->isFile() || $file->isLink()) throw new RuntimeException("Invalid prepared image.");
				$paths[] = $file->getPathname();
				$size += $file->getSize() + 76 + 2 * strlen(substr($file->getPathname(), strlen($folder) + 1));
			}
			// PclZip writes classic ZIP headers, without ZIP64 support.
			if ($size>=0xffffffff || count($paths)>=65535) throw new RuntimeException("This package requires the PHP ZIP extension because it exceeds the fallback ZIP format limits.");
			try {
				$zip = new PclZip($temp);
				// Its temporary-file mode always compresses; stored entries use one file in memory.
				$result = $zip->create($paths, PCLZIP_OPT_REMOVE_PATH, $folder, PCLZIP_OPT_NO_COMPRESSION, PCLZIP_OPT_TEMP_FILE_OFF);
				if (!is_array($result) || count($result)!==count($paths)) throw new RuntimeException("The download ZIP could not be created. Check free disk space.");
				foreach ($result as $entry) {
					if ($entry["status"]!=="ok") throw new RuntimeException("An image could not be added to the ZIP.");
				}
				if (!rename($temp, $folder . ".zip")) throw new RuntimeException("The download ZIP could not be saved. Check free disk space.");
			} finally {
				if (is_file($temp)) unlink($temp);
			}
		}

		public function link (string $folder, string $order, int $part): string {
			if (!is_file(self::packagePath($folder) . ".zip")) throw new RuntimeException("The prepared ZIP is missing. Contact the photographer.");
			return SA_DIR_INDEXPATH . "?/order/" . rawurlencode($order) . "/file/" . $part . "/";
		}

		public function delete (string $root): void {
			$root = self::packagePath($root);
			if (!is_dir($root)) return;
			$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
			foreach ($files as $file) {
				if ($file->isDir() && !$file->isLink()) $ok = rmdir($file->getPathname());
				else $ok = unlink($file->getPathname());
				if (!$ok) throw new RuntimeException("A prepared download could not be deleted.");
			}
			if (!rmdir($root)) throw new RuntimeException("Download storage could not be removed.");
		}
	}
