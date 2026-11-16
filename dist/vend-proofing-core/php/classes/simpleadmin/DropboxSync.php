<?php

	/** Manual gallery sync. Originals remain in Dropbox; only previews are downloaded. */
	class DropboxSync {
		public function __construct (private DropboxClient $client = new DropboxClient()) {}

		public function sync (string $suid): void {
			if (Records::pageType($suid)!=="DropboxSet") throw new InvalidArgumentException("Dropbox set required.");
			$files = $this->client->listImages("/" . $suid);
			$root = false;
			$folders = false;
			foreach ($files as $file) {
				if (dirname($file["path_lower"])==="/" . strtolower($suid)) $root = true;
				else $folders = true;
			}
			if ($root && $folders) throw new RuntimeException("Use either images or folders of images in this set, not both.");
			Records::syncDropboxImages($suid, $files);
		}

		public function next (string $suid): float {
			$images = array_values(array_filter(Records::dropboxImages($suid), fn ($image) => $image["image_status"]==="ready"));
			if (!$images) return 1;
			$folder = SA_DIR_STORAGE . "/" . $suid;
			if (!is_dir($folder) && !mkdir($folder, 0770, true)) throw new RuntimeException("Cannot create the preview folder.");
			$complete = 0;
			$start = microtime(true);
			foreach ($images as $image) {
				$path = $folder . "/" . $image["public_key"];
				$metadata = $image["metadata"];
				if ($metadata["preview_rev"]===$metadata["dropbox_rev"] && is_file($path)) {
					$complete++;
					continue;
				}
				if (microtime(true) - $start >= 10) continue;
				if ($metadata["original_size"] > 20 * 1024 * 1024) throw new RuntimeException("Dropbox previews support originals up to 20 MB. Use a smaller source image for this gallery.");
				$content = $this->client->thumbnail($metadata["dropbox_rev"]);
				$size = @getimagesizefromstring($content);
				if (!$size || $size[2]!==IMAGETYPE_JPEG) throw new RuntimeException("Dropbox did not return a JPEG preview.");
				$modified = is_file($path) ? (int) filemtime($path) : 0;
				$temp = tempnam($folder, ".preview-");
				try {
					if (file_put_contents($temp, $content)!==strlen($content) || !rename($temp, $path)) throw new RuntimeException("Cannot save the Dropbox preview.");
					touch($path, max(time(), $modified + 1));
					clearstatcache(true, $path);
					Records::updateDropboxThumbnail((int) $image["asset_id"], $metadata["dropbox_rev"], $size[0], $size[1], strlen($content));
				} finally {
					if (is_file($temp)) unlink($temp);
				}
				$complete++;
			}
			return $complete / count($images);
		}
	}
