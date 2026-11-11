<?php

	/*
		Translate the existing admin Gateway requests into catalog operations.
		The Gateway still owns authentication and response formatting.
		*/
	class CatalogGateway {

		public static function dispatch (string $action, array $request): ?array {
			$name = self::value($request, "name");
			$suid = self::value($request, "suid");

			if ($name=="page" && str_starts_with($action, "set_")) {
				return self::pages($action, $request, $suid);
			}

			if ($name=="page" && str_starts_with($action, "image_")) {
				$type = Catalog::pageType($suid);
				if ($type==="UploadSet" || $type==="CategorySet") {
					return self::images($action, $request, $suid);
				}
			}

			if ($name==="category" && str_starts_with($action, "set_")) {
				$parent = self::value($request, "puid");
				if (Catalog::pageType($parent)==="CategorySet") {
					return self::categories($action, $request, $parent, $suid);
				}
			}

			return null;
		}

		private static function value (array $request, string $key, string $default=""): string {
			if (isset($request[$key]) && is_string($request[$key]) && $request[$key]!=="") {
				return $request[$key];
			}
			return $default;
		}

		private static function row (array $request): array {
			$values = explode("\t", self::value($request, "data"));
			foreach ($values as $index => $value) {
				if ($value=="null") $values[$index] = null;
			}
			return $values;
		}

		private static function changed (array $rows): array {
			return array(
				"success" => true,
				"data" => Catalog::rowsText($rows),
				"invalidate" => true
			);
		}

		private static function pages (string $action, array $request, string $suid): array {
			switch ($action) {
				case "set_list":
					return array(
						"success" => true,
						"data" => Catalog::rowsText(Catalog::pageRows())
					);

				case "set_create":
					if ($suid=="") $suid = Database::allocateSuid();
					Catalog::savePage($suid, self::row($request));
					return self::changed(Catalog::pageRows());

				case "set_update":
					Catalog::savePage($suid, self::row($request));
					return self::changed(Catalog::pageRows());

				case "set_delete":
					return self::deletePage($suid);

				case "set_reindex":
					$from = (int) self::value($request, "from");
					$to = (int) self::value($request, "to");
					Catalog::reorderPages($from, $to);
					return self::changed(Catalog::pageRows());
			}

			return array("success" => false, "data" => "Page action not available");
		}

		private static function deletePage (string $suid): array {
			if (!preg_match('/^[a-f0-9]{1,16}$/i', $suid)) {
				throw new InvalidArgumentException("Invalid page identifier.");
			}

			Catalog::deletePage($suid);

			// The media folder is cleaned after the database record is removed.
			$folder = SA_DIR_STORAGE . "/" . $suid;
			if (is_dir($folder) && !is_link($folder)) {
				Filesystem::purgeFolder($folder);
				Filesystem::deleteFolder($folder);
			}

			return self::changed(Catalog::pageRows());
		}

		private static function categories (string $action, array $request, string $parent, string $key): array {
			switch ($action) {
				case "set_list":
					return array("success" => true, "data" => Catalog::rowsText(Catalog::categoryRows($parent)));

				case "set_create":
				case "set_update":
					$row = self::row($request);
					$name = (string) ($row[0] ?? "");
					if ($key==="") $key = md5($name);
					Catalog::saveCategory($parent, $key, $name);
					return self::changed(Catalog::categoryRows($parent));

				case "set_delete":
					Catalog::deleteCategory($parent, $key);
					return self::changed(Catalog::categoryRows($parent));

				case "set_reindex":
					$from = (int) self::value($request, "from");
					$to = (int) self::value($request, "to");
					Catalog::reorderCategories($parent, $from, $to);
					return self::changed(Catalog::categoryRows($parent));
			}

			return array("success" => false, "data" => "Category action not available");
		}

		private static function images (string $action, array $request, string $suid): ?array {
			switch ($action) {
				case "image_list":
					return array(
						"success" => true,
						"data" => Catalog::rowsText(Catalog::imageRows($suid))
					);

				case "image_upload":
					return self::uploadImage($suid, $request);

				case "image_update":
					Catalog::updateImage($suid, self::row($request));
					return self::changed(Catalog::imageRows($suid));

				case "image_delete":
					return self::deleteImages($suid, self::value($request, "files"));

				case "image_reindex":
					$from = (int) self::value($request, "from");
					$to = (int) self::value($request, "to");
					Catalog::reorderImages($suid, $from, $to);
					return self::changed(Catalog::imageRows($suid));

				case "image_snapshot":
					return null;
			}

			return array(
				"success" => false,
				"data" => "Image action not yet available for relational upload sets"
			);
		}

		private static function uploadImage (string $suid, array $request): array {
			// Flatfile still moves the physical upload; Catalog stores its record.
			$row = Flatfile::uploadFile("image", $suid);
			if (!is_array($row)) {
				return array("success" => false, "data" => $row);
			}

			$categoryName = "";
			$path = trim(self::value($request, "path"), "/");
			$parts = explode("/", $path);
			if (count($parts)>=2) {
				array_pop($parts);
				$categoryName = (string) array_pop($parts);
			}

			try {
				Catalog::addImage($suid, $row, $categoryName);
			} catch (Throwable $error) {
				@unlink(SA_DIR_STORAGE . "/" . $suid . "/" . $row[0]);
				throw $error;
			}

			if ($categoryName!=="" && Catalog::pageType($suid)==="CategorySet") {
				$row[6] = md5($categoryName);
			}

			return array(
				"success" => true,
				"data" => implode("\t", $row),
				"invalidate" => true
			);
		}

		private static function deleteImages (string $suid, string $files): array {
			$existing = Catalog::imageRows($suid);
			$requested = explode(",", $files);
			$keys = array();

			foreach ($requested as $key) {
				if (isset($existing[$key])) $keys[] = $key;
			}

			Catalog::deleteImages($suid, $keys);

			foreach ($keys as $key) {
				@unlink(SA_DIR_STORAGE . "/" . $suid . "/" . $key);
				@unlink(SA_DIR_STORAGE . "/" . $suid . "/" . $key . ".snapshot.jpg");
			}

			return self::changed(Catalog::imageRows($suid));
		}

	}
