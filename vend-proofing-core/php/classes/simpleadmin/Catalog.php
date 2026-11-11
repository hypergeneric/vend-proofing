<?php

	/*
		Page and upload-set image records live in the application database.
		The arrays returned here preserve the Gateway and template row shapes.
		*/
	class Catalog {

		/* ---- Page Catalog ---- */

		public static function pageRows (): array {
			$sql = "SELECT pages.suid, pages.title, galleries.gallery_type, pages.image_count
				FROM pages
				JOIN galleries ON galleries.page_id = pages.id
				ORDER BY pages.position, pages.id";
			$query = Database::connection()->query($sql);
			$rows = array();

			foreach ($query as $page) {
				$suid = $page["suid"];
				$rows[$suid] = array(
					$suid,
					$page["title"],
					$page["gallery_type"],
					(string) $page["image_count"]
				);
			}

			return $rows;
		}

		public static function pageType (string $suid): ?string {
			$sql = "SELECT galleries.gallery_type
				FROM galleries
				JOIN pages ON pages.id = galleries.page_id
				WHERE pages.suid = ?";
			$query = Database::connection()->prepare($sql);
			$query->execute(array($suid));
			$type = $query->fetchColumn();

			return $type===false ? null : $type;
		}

		public static function setImageCount (string $suid, int $count): void {
			$sql = "UPDATE pages SET image_count = ?, updated_at = ? WHERE suid = ?";
			$query = Database::connection()->prepare($sql);
			$query->execute(array(max(0, $count), time(), $suid));
		}

		public static function savePage (string $suid, array $values): void {
			if (!preg_match('/^[a-f0-9]{1,16}$/i', $suid)) {
				throw new InvalidArgumentException("Invalid page identifier.");
			}

			Database::transaction(function (PDO $db) use ($suid, $values): void {
				$sql = "SELECT pages.id, pages.title, pages.image_count, galleries.gallery_type
					FROM pages
					JOIN galleries ON galleries.page_id = pages.id
					WHERE pages.suid = ?";
				$query = $db->prepare($sql);
				$query->execute(array($suid));
				$existing = $query->fetch();

				// A null field in an admin update means retain the stored value.
				$title = isset($values[0]) ? (string) $values[0] : ($existing["title"] ?? "");
				$type = isset($values[1]) ? (string) $values[1] : ($existing["gallery_type"] ?? "UploadSet");
				$count = isset($values[2]) ? max(0, (int) $values[2]) : (int) ($existing["image_count"] ?? 0);

				$allowed = array("UploadSet", "CategorySet", "DropboxSet");
				if (!in_array($type, $allowed, true)) {
					throw new InvalidArgumentException("Invalid gallery type.");
				}

				$now = time();
				if ($existing) {
					$update = $db->prepare("UPDATE pages SET title = ?, image_count = ?, updated_at = ? WHERE id = ?");
					$update->execute(array($title, $count, $now, $existing["id"]));

					$update = $db->prepare("UPDATE galleries SET gallery_type = ? WHERE page_id = ?");
					$update->execute(array($type, $existing["id"]));
				} else {
					$position = (int) $db->query("SELECT COALESCE(MAX(position), -1) + 1 FROM pages")->fetchColumn();
					$sql = "INSERT INTO pages
						(suid, kind, title, position, image_count, created_at, updated_at)
						VALUES (?, ?, ?, ?, ?, ?, ?)";
					$insert = $db->prepare($sql);
					$insert->execute(array($suid, "gallery", $title, $position, $count, $now, $now));

					$pageId = (int) $db->lastInsertId();
					$insert = $db->prepare("INSERT INTO galleries (page_id, gallery_type) VALUES (?, ?)");
					$insert->execute(array($pageId, $type));
				}
			});
		}

		public static function deletePage (string $suid): void {
			Database::transaction(function (PDO $db) use ($suid): void {
				$query = $db->prepare("SELECT id FROM pages WHERE suid = ?");
				$query->execute(array($suid));
				$pageId = $query->fetchColumn();
				if ($pageId===false) return;

				$assets = $db->prepare("SELECT asset_id FROM gallery_images WHERE gallery_id = ?");
				$assets->execute(array($pageId));
				$assetIds = $assets->fetchAll(PDO::FETCH_COLUMN);

				$delete = $db->prepare("DELETE FROM gallery_images WHERE gallery_id = ?");
				$delete->execute(array($pageId));
				$delete = $db->prepare("DELETE FROM pages WHERE id = ?");
				$delete->execute(array($pageId));

				$sql = "DELETE FROM media_assets
					WHERE id = ?
					AND id NOT IN (SELECT asset_id FROM gallery_images)";
				$delete = $db->prepare($sql);
				foreach ($assetIds as $assetId) {
					$delete->execute(array($assetId));
				}
			});
		}

		public static function reorderPages (int $from, int $to): void {
			$rows = array_values(self::pageRows());
			if (!isset($rows[$from]) || $to<0 || $to>=count($rows)) return;

			$moved = array_splice($rows, $from, 1);
			array_splice($rows, $to, 0, $moved);

			Database::transaction(function (PDO $db) use ($rows): void {
				$update = $db->prepare("UPDATE pages SET position = ? WHERE suid = ?");
				foreach ($rows as $position => $row) {
					$update->execute(array($position, $row[0]));
				}
			});
		}

		/* ---- Gallery Categories and Images ---- */

		public static function categoryRows (string $suid): array {
			$sql = "SELECT categories.public_key, categories.name
				FROM gallery_categories AS categories
				JOIN pages ON pages.id = categories.gallery_id
				WHERE pages.suid = ?
				ORDER BY categories.position, categories.id";
			$query = Database::connection()->prepare($sql);
			$query->execute(array($suid));
			$rows = array();

			foreach ($query as $category) {
				$key = $category["public_key"];
				$rows[$key] = array($key, $category["name"]);
			}

			return $rows;
		}

		public static function saveCategory (string $suid, string $key, string $name): void {
			if (self::pageType($suid)!=="CategorySet") {
				throw new InvalidArgumentException("Categories require a category set.");
			}
			if (!preg_match('/^[a-f0-9]{32}$/i', $key) || $name==="") {
				throw new InvalidArgumentException("Invalid category.");
			}

			Database::transaction(function (PDO $db) use ($suid, $key, $name): void {
				$query = $db->prepare("SELECT id FROM pages WHERE suid = ?");
				$query->execute(array($suid));
				$pageId = (int) $query->fetchColumn();

				$query = $db->prepare("SELECT id FROM gallery_categories WHERE gallery_id = ? AND public_key = ?");
				$query->execute(array($pageId, $key));
				$categoryId = $query->fetchColumn();
				if ($categoryId!==false) {
					$update = $db->prepare("UPDATE gallery_categories SET name = ? WHERE id = ?");
					$update->execute(array($name, $categoryId));
					return;
				}

				$query = $db->prepare("SELECT COALESCE(MAX(position), -1) + 1 FROM gallery_categories WHERE gallery_id = ?");
				$query->execute(array($pageId));
				$position = (int) $query->fetchColumn();
				$insert = $db->prepare("INSERT INTO gallery_categories (gallery_id, public_key, name, position) VALUES (?, ?, ?, ?)");
				$insert->execute(array($pageId, $key, $name, $position));
			});
		}

		public static function deleteCategory (string $suid, string $key): void {
			Database::transaction(function (PDO $db) use ($suid, $key): void {
				$sql = "DELETE FROM gallery_categories
					WHERE gallery_id = (SELECT id FROM pages WHERE suid = ?)
					AND public_key = ?
					AND id NOT IN (SELECT category_id FROM gallery_images WHERE category_id IS NOT NULL)";
				$delete = $db->prepare($sql);
				$delete->execute(array($suid, $key));
				if ($delete->rowCount()===0) {
					throw new InvalidArgumentException("Category is missing or still contains images.");
				}
			});
		}

		public static function reorderCategories (string $suid, int $from, int $to): void {
			$keys = array_keys(self::categoryRows($suid));
			if (!isset($keys[$from]) || $to<0 || $to>=count($keys)) return;

			$moved = array_splice($keys, $from, 1);
			array_splice($keys, $to, 0, $moved);
			Database::transaction(function (PDO $db) use ($suid, $keys): void {
				$sql = "UPDATE gallery_categories SET position = ?
					WHERE gallery_id = (SELECT id FROM pages WHERE suid = ?) AND public_key = ?";
				$update = $db->prepare($sql);
				foreach ($keys as $position => $key) {
					$update->execute(array($position, $suid, $key));
				}
			});
		}

		public static function imageRows (string $suid): array {
			$isCategorySet = self::pageType($suid)==="CategorySet";
			$sql = "SELECT assets.public_key, assets.original_name, assets.width, assets.height,
					assets.duration, assets.byte_size, images.caption, categories.public_key AS category_key
				FROM gallery_images AS images
				JOIN media_assets AS assets ON assets.id = images.asset_id
				LEFT JOIN gallery_categories AS categories ON categories.id = images.category_id
				JOIN pages ON pages.id = images.gallery_id
				WHERE pages.suid = ?
				ORDER BY images.position, images.id";
			$query = Database::connection()->prepare($sql);
			$query->execute(array($suid));
			$rows = array();

			foreach ($query as $image) {
				$key = $image["public_key"];
				$dimensions = $image["width"] . "x" . $image["height"];
				$row = array(
					$key,
					$image["original_name"],
					$dimensions,
					(string) ($image["duration"] ?? ""),
					(string) ($image["byte_size"] ?? ""),
					$image["caption"]
				);
				if ($isCategorySet) {
					$row[] = (string) ($image["category_key"] ?? "");
				}
				$rows[$key] = $row;
			}

			return $rows;
		}

		public static function rowsText (array $rows): string {
			$lines = array();
			foreach ($rows as $row) {
				$lines[] = implode("\t", $row);
			}
			return implode("\n", $lines);
		}

		public static function addImage (string $suid, array $row, string $categoryName=""): void {
			$type = self::pageType($suid);
			if ($type!=="UploadSet" && $type!=="CategorySet") {
				throw new InvalidArgumentException("Image upload requires an upload or category set.");
			}
			if (!isset($row[0]) || !preg_match('/^[A-Za-z0-9._-]+$/', $row[0])) {
				throw new InvalidArgumentException("Invalid media filename.");
			}

			$dimensions = explode("x", (string) ($row[2] ?? ""), 2);
			$width = is_numeric($dimensions[0] ?? null) ? (float) $dimensions[0] : null;
			$height = is_numeric($dimensions[1] ?? null) ? (float) $dimensions[1] : null;
			$size = is_numeric($row[4] ?? null) ? (int) $row[4] : null;
			$duration = is_numeric($row[3] ?? null) ? (float) $row[3] : null;

			Database::transaction(function (PDO $db) use ($suid, $row, $width, $height, $size, $duration, $type, $categoryName): void {
				$query = $db->prepare("SELECT id FROM pages WHERE suid = ?");
				$query->execute(array($suid));
				$pageId = $query->fetchColumn();
				$categoryId = null;
				if ($type==="CategorySet" && $categoryName!=="") {
					$categoryKey = md5($categoryName);
					self::saveCategory($suid, $categoryKey, $categoryName);
					$query = $db->prepare("SELECT id FROM gallery_categories WHERE gallery_id = ? AND public_key = ?");
					$query->execute(array($pageId, $categoryKey));
					$categoryId = (int) $query->fetchColumn();
				}

				$query = $db->prepare("SELECT COALESCE(MAX(position), -1) + 1 FROM gallery_images WHERE gallery_id = ?");
				$query->execute(array($pageId));
				$position = (int) $query->fetchColumn();

				$sql = "INSERT INTO media_assets
						(public_key, original_name, media_type, relative_path, width, height,
						byte_size, duration, created_at)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
				$insert = $db->prepare($sql);
				$insert->execute(array(
					$row[0],
					(string) ($row[1] ?? $row[0]),
					"image",
					$suid . "/" . $row[0],
					$width,
					$height,
					$size,
					$duration,
					time()
				));
				$assetId = (int) $db->lastInsertId();

				$sql = "INSERT INTO gallery_images (gallery_id, asset_id, category_id, position, caption)
					VALUES (?, ?, ?, ?, ?)";
				$insert = $db->prepare($sql);
				$insert->execute(array($pageId, $assetId, $categoryId, $position, (string) ($row[5] ?? "")));

				$update = $db->prepare("UPDATE pages SET image_count = image_count + 1, updated_at = ? WHERE id = ?");
				$update->execute(array(time(), $pageId));
			});
		}

		public static function deleteImages (string $suid, array $keys): void {
			Database::transaction(function (PDO $db) use ($suid, $keys): void {
				$sql = "SELECT images.id, assets.id AS asset_id
					FROM gallery_images AS images
					JOIN media_assets AS assets ON assets.id = images.asset_id
					JOIN pages ON pages.id = images.gallery_id
					WHERE pages.suid = ? AND assets.public_key = ?";
				$find = $db->prepare($sql);
				$deleteImage = $db->prepare("DELETE FROM gallery_images WHERE id = ?");
				$sql = "DELETE FROM media_assets
					WHERE id = ?
					AND id NOT IN (SELECT asset_id FROM gallery_images)";
				$deleteAsset = $db->prepare($sql);

				foreach ($keys as $key) {
					$find->execute(array($suid, $key));
					$image = $find->fetch();
					if (!$image) continue;

					$deleteImage->execute(array($image["id"]));
					$deleteAsset->execute(array($image["asset_id"]));
				}

				$sql = "UPDATE pages
					SET image_count = (SELECT COUNT(*) FROM gallery_images WHERE gallery_id = pages.id),
						updated_at = ?
					WHERE suid = ?";
				$update = $db->prepare($sql);
				$update->execute(array(time(), $suid));
			});
		}

		public static function updateImage (string $suid, array $row): void {
			if (!isset($row[0])) {
				throw new InvalidArgumentException("Image identifier required.");
			}

			Database::transaction(function (PDO $db) use ($suid, $row): void {
				$sql = "SELECT assets.id, images.id AS image_id
					FROM media_assets AS assets
					JOIN gallery_images AS images ON images.asset_id = assets.id
					JOIN pages ON pages.id = images.gallery_id
					WHERE pages.suid = ? AND assets.public_key = ?";
				$find = $db->prepare($sql);
				$find->execute(array($suid, $row[0]));
				$image = $find->fetch();
				if (!$image) throw new InvalidArgumentException("Image not found.");

				if (isset($row[1])) {
					$update = $db->prepare("UPDATE media_assets SET original_name = ? WHERE id = ?");
					$update->execute(array($row[1], $image["id"]));
				}
				if (isset($row[5])) {
					$update = $db->prepare("UPDATE gallery_images SET caption = ? WHERE id = ?");
					$update->execute(array($row[5], $image["image_id"]));
				}
			});
		}

		public static function reorderImages (string $suid, int $from, int $to): void {
			$keys = array_keys(self::imageRows($suid));
			if (!isset($keys[$from]) || $to<0 || $to>=count($keys)) return;

			$moved = array_splice($keys, $from, 1);
			array_splice($keys, $to, 0, $moved);

			Database::transaction(function (PDO $db) use ($suid, $keys): void {
				$sql = "UPDATE gallery_images
					SET position = ?
					WHERE id = (
						SELECT images.id
						FROM gallery_images AS images
						JOIN media_assets AS assets ON assets.id = images.asset_id
						JOIN pages ON pages.id = images.gallery_id
						WHERE pages.suid = ? AND assets.public_key = ?
					)";
				$update = $db->prepare($sql);
				foreach ($keys as $position => $key) {
					$update->execute(array($position, $suid, $key));
				}
			});
		}

	}
