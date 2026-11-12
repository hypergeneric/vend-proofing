<?php

	/*
		Relational records for the table types currently migrated.
		The arrays returned here preserve the Gateway and template row shapes.
		*/
	class Records {
		private const PRICING_GROUPS = array(
			"formatset" => "format",
			"paperset" => "paper",
			"modifierset" => "modifier",
			"packageset" => "package",
			"productset" => "product"
		);
		private const PRICING_ITEMS = array(
			"format" => "formats",
			"paper" => "papers",
			"modifier" => "modifiers",
			"package" => "packages",
			"product" => "products"
		);
		private const MEDIA_TYPES = array("asset", "audio", "track", "package", "product");

		public static function hasMediaTable (string $name): bool {
			return in_array($name, self::MEDIA_TYPES, true);
		}

		public static function isPricingGroup (string $name): bool {
			return isset(self::PRICING_GROUPS[$name]);
		}

		public static function hasSetTable (string $name): bool {
			return in_array($name, array("page", "category", "messages", "session", "lineitem", "downloadset",
				"discount", "ustaxchart", "cataxchart", "vattaxchart", "formobjects"), true) ||
				self::isPricingGroup($name) || isset(self::PRICING_ITEMS[$name]);
		}

		public static function getSetTable (string $name, ?string $parent=null): array {
			if (self::isPricingGroup($name)) {
				return self::pricingGroupRows($name);
			}
			if (isset(self::PRICING_ITEMS[$name])) {
				return self::pricingItemRows($name, $parent ?? "");
			}
			switch ($name) {
				case "page":
					return self::pageRows();
				case "category":
					return self::categoryRows($parent ?? "");
				case "messages":
					return self::messageRows();
				case "session":
					return Proofing::sessionRows($parent ?? "");
				case "lineitem":
					return self::componentRows($parent ?? "");
				case "downloadset":
					return self::downloadRows();
				case "discount":
					return self::discountRows($parent ?? "");
				case "ustaxchart":
				case "cataxchart":
				case "vattaxchart":
					return self::taxRows($name);
				case "formobjects":
					return self::formRows();
			}
			throw new InvalidArgumentException("Unknown relational set table.");
		}

		public static function getFileTable (string $name, ?string $parent=null): array {
			if ($name==="image") return self::imageRows($parent);
			if (self::hasMediaTable($name)) return self::mediaRows($name, $parent ?? $name);
			throw new InvalidArgumentException("Unknown relational file table.");
		}

		private static function mediaPageId (PDO $db, string $name, string $parent): ?int {
			if ($parent===$name || $parent==="") return null;
			$query = $db->prepare("SELECT page_id FROM galleries JOIN pages ON pages.id = galleries.page_id WHERE pages.suid = ?");
			$query->execute(array($parent));
			$pageId = $query->fetchColumn();
			if ($pageId===false) throw new InvalidArgumentException("Unknown media gallery.");
			return (int) $pageId;
		}

		public static function mediaRows (string $name, string $parent): array {
			if (!self::hasMediaTable($name)) throw new InvalidArgumentException("Unknown media type.");
			if (self::hasMediaTable($parent) && $parent!==$name) return array();
			$db = Database::connection();
			$pageId = self::mediaPageId($db, $name, $parent);
			$sql = "SELECT assets.public_key, assets.original_name, assets.width, assets.height,
				assets.duration, assets.byte_size, entries.description, assets.source_uri,
				assets.metadata_json
				FROM media_entries AS entries
				JOIN media_assets AS assets ON assets.id = entries.asset_id
				WHERE entries.kind = ? AND entries.page_id IS ?
				ORDER BY entries.position, entries.id";
			$query = $db->prepare($sql);
			$query->execute(array($name, $pageId));
			$rows = array();
			foreach ($query as $asset) {
				$key = $asset["public_key"];
				$dimensions = (string) ($asset["width"] ?? "") . "x" . (string) ($asset["height"] ?? "");
				$row = array(
					$key,
					$asset["original_name"],
					$dimensions,
					(string) ($asset["duration"] ?? ""),
					(string) ($asset["byte_size"] ?? ""),
					$asset["description"]
				);
				if ($asset["source_uri"]!==null) {
					$metadata = json_decode($asset["metadata_json"], true);
					$row[] = $asset["source_uri"];
					$row[] = (string) ($metadata["service"] ?? "");
				}
				$rows[$key] = $row;
			}
			return $rows;
		}

		public static function addMedia (string $name, string $parent, array $row): void {
			if (!self::hasMediaTable($name)) throw new InvalidArgumentException("Unknown media type.");
			$key = (string) ($row[0] ?? "");
			if ($key==="" || !preg_match('/^[A-Za-z0-9._-]+$/', $key) || $key[0]==='.') {
				throw new InvalidArgumentException("Invalid media filename.");
			}
			$dimensions = explode("x", (string) ($row[2] ?? ""), 2);
			$width = is_numeric($dimensions[0] ?? null) ? (float) $dimensions[0] : null;
			$height = is_numeric($dimensions[1] ?? null) ? (float) $dimensions[1] : null;
			$duration = is_numeric($row[3] ?? null) ? (float) $row[3] : null;
			$size = is_numeric($row[4] ?? null) ? (int) $row[4] : null;
			$sourceUri = isset($row[6]) && $row[6]!=="" ? (string) $row[6] : null;
			$metadata = json_encode(array("service" => (string) ($row[7] ?? "")));

			Database::transaction(function (PDO $db) use ($name, $parent, $row, $key, $width, $height, $duration, $size, $sourceUri, $metadata): void {
				$pageId = self::mediaPageId($db, $name, $parent);
				$query = $db->prepare("SELECT COALESCE(MAX(position), -1) + 1 FROM media_entries WHERE kind = ? AND page_id IS ?");
				$query->execute(array($name, $pageId));
				$position = (int) $query->fetchColumn();
				$sql = "INSERT INTO media_assets
					(public_key, original_name, media_type, relative_path, width, height,
					byte_size, duration, source_uri, metadata_json, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
				$insert = $db->prepare($sql);
				$insert->execute(array(
					$key, (string) ($row[1] ?? $key), $name,
					$parent . "/" . $key, $width, $height, $size, $duration,
					$sourceUri, $metadata, time()
				));
				$assetId = (int) $db->lastInsertId();
				$insert = $db->prepare("INSERT INTO media_entries (asset_id, page_id, kind, description, position) VALUES (?, ?, ?, ?, ?)");
				$insert->execute(array($assetId, $pageId, $name, (string) ($row[5] ?? ""), $position));
			});
		}

		public static function updateMedia (string $name, string $parent, array $values): void {
			$key = (string) ($values[0] ?? "");
			Database::transaction(function (PDO $db) use ($name, $parent, $values, $key): void {
				$pageId = self::mediaPageId($db, $name, $parent);
				$sql = "SELECT assets.id AS asset_id, entries.id AS entry_id, assets.metadata_json
					FROM media_entries AS entries JOIN media_assets AS assets ON assets.id = entries.asset_id
					WHERE entries.kind = ? AND entries.page_id IS ? AND assets.public_key = ?";
				$query = $db->prepare($sql);
				$query->execute(array($name, $pageId, $key));
				$found = $query->fetch();
				if (!$found) throw new InvalidArgumentException("Unknown media record.");
				$fields = array();
				$params = array();
				if (($values[1] ?? null)!==null) {
					$fields[] = "original_name = ?";
					$params[] = (string) $values[1];
				}
				if (($values[2] ?? null)!==null) {
					$dimensions = explode("x", (string) $values[2], 2);
					$fields[] = "width = ?";
					$fields[] = "height = ?";
					$params[] = is_numeric($dimensions[0] ?? null) ? (float) $dimensions[0] : null;
					$params[] = is_numeric($dimensions[1] ?? null) ? (float) $dimensions[1] : null;
				}
				if (($values[3] ?? null)!==null) {
					$fields[] = "duration = ?";
					$params[] = is_numeric($values[3]) ? (float) $values[3] : null;
				}
				if (($values[4] ?? null)!==null) {
					$fields[] = "byte_size = ?";
					$params[] = is_numeric($values[4]) ? (int) $values[4] : null;
				}
				if (($values[6] ?? null)!==null) {
					$fields[] = "source_uri = ?";
					$params[] = $values[6]==="" ? null : (string) $values[6];
				}
				if (($values[7] ?? null)!==null) {
					$metadata = json_decode($found["metadata_json"], true) ?: array();
					$metadata["service"] = (string) $values[7];
					$fields[] = "metadata_json = ?";
					$params[] = json_encode($metadata);
				}
				if ($fields) {
					$params[] = $found["asset_id"];
					$update = $db->prepare("UPDATE media_assets SET " . implode(", ", $fields) . " WHERE id = ?");
					$update->execute($params);
				}
				if (($values[5] ?? null)!==null) {
					$update = $db->prepare("UPDATE media_entries SET description = ? WHERE id = ?");
					$update->execute(array($values[5], $found["entry_id"]));
				}
			});
		}

		public static function deleteMedia (string $name, string $parent, array $keys): void {
			Database::transaction(function (PDO $db) use ($name, $parent, $keys): void {
				$pageId = self::mediaPageId($db, $name, $parent);
				$sql = "DELETE FROM media_assets WHERE id IN (
					SELECT assets.id FROM media_assets AS assets
					JOIN media_entries AS entries ON entries.asset_id = assets.id
					WHERE entries.kind = ? AND entries.page_id IS ? AND assets.public_key = ?)";
				$delete = $db->prepare($sql);
				foreach ($keys as $key) $delete->execute(array($name, $pageId, $key));
			});
		}

		public static function reorderMedia (string $name, string $parent, array $moves, ?int $from=null, ?int $to=null): void {
			Database::transaction(function (PDO $db) use ($name, $parent, $moves, $from, $to): void {
				$pageId = self::mediaPageId($db, $name, $parent);
				$query = $db->prepare("SELECT id FROM media_entries WHERE kind = ? AND page_id IS ? ORDER BY position, id");
				$query->execute(array($name, $pageId));
				$ids = $query->fetchAll(PDO::FETCH_COLUMN);
				$ids = self::reorderedKeys($ids, $moves, $from, $to);
				$update = $db->prepare("UPDATE media_entries SET position = ? WHERE id = ?");
				foreach ($ids as $position => $id) $update->execute(array($position, $id));
			});
		}

		private static function reorderedKeys (array $keys, array $moves, ?int $from, ?int $to): array {
			if ($moves) {
				$ordered = array();
				foreach ($moves as $source => $target) {
					if (!isset($keys[$source]) || !isset($keys[$target]) || isset($ordered[$target])) {
						throw new InvalidArgumentException("Invalid media order.");
					}
					$ordered[$target] = $keys[$source];
				}
				if (count($ordered)!==count($keys)) throw new InvalidArgumentException("Incomplete media order.");
				ksort($ordered);
				return array_values($ordered);
			}

			if ($from!==null && $to!==null && isset($keys[$from]) && isset($keys[$to])) {
				$moved = array_splice($keys, $from, 1);
				array_splice($keys, $to, 0, $moved);
			}
			return $keys;
		}

		public static function saveSetRow (string $name, string $suid, ?string $parent, array $values): void {
			if ($name==="category") {
				$label = (string) ($values[0] ?? "");
				if ($suid==="") $suid = md5($label);
				self::saveCategory($parent ?? "", $suid, $label);
				return;
			}
			if (isset(self::PRICING_ITEMS[$name])) {
				if ($suid==="") $suid = Database::allocateSuid();
				self::savePricingItem($name, $suid, $parent ?? "", $values);
				return;
			}
			if ($name==="lineitem") {
				if ($suid==="") $suid = Database::allocateSuid();
				self::saveComponent($suid, $parent ?? "", $values);
				return;
			}
			if ($name==="downloadset") {
				if ($suid==="") $suid = Database::allocateSuid();
				self::saveDownload($suid, $values);
				return;
			}
			if ($name==="discount") {
				if ($suid==="") $suid = Database::allocateSuid();
				self::saveDiscount($suid, $parent ?? "", $values);
				return;
			}
			if (in_array($name, array("ustaxchart", "cataxchart", "vattaxchart"), true)) {
				self::saveTax($name, $suid, $values);
				return;
			}
			if ($name==="formobjects") {
				if ($suid==="") $suid = Database::allocateSuid();
				self::saveForm($suid, $values);
				return;
			}
			if ($name!=="page" && !self::isPricingGroup($name)) {
				throw new InvalidArgumentException("Unknown relational set table.");
			}

			if ($suid==="") $suid = Database::allocateSuid();
			if ($name==="page") {
				self::savePage($suid, $values);
				return;
			}
			if (self::isPricingGroup($name)) {
				self::savePricingGroup($name, $suid, $values);
				return;
			}
		}

		public static function deleteSetRow (string $name, string $suid, ?string $parent): void {
			if ($name==="page") {
				self::deletePage($suid);
			} elseif ($name==="category") {
				self::deleteCategory($parent ?? "", $suid);
			} elseif (self::isPricingGroup($name)) {
				self::deletePricingGroup($name, $suid);
			} elseif (isset(self::PRICING_ITEMS[$name])) {
				self::deletePricingItem($name, $suid, $parent ?? "");
			} elseif ($name==="messages") {
				self::deleteMessage($suid);
			} elseif ($name==="session") {
				Proofing::deleteSession($parent ?? "", $suid);
			} elseif ($name==="lineitem") {
				self::deleteComponent($suid, $parent ?? "");
			} elseif ($name==="downloadset") {
				self::deleteDownload($suid);
			} elseif ($name==="discount") {
				self::deleteDiscount($suid, $parent ?? "");
			} elseif (in_array($name, array("ustaxchart", "cataxchart", "vattaxchart"), true)) {
				self::deleteTax($name, $suid);
			} elseif ($name==="formobjects") {
				self::deleteForm($suid);
			} else {
				throw new InvalidArgumentException("Unknown relational set table.");
			}
		}

		public static function reorderSetRows (string $name, ?string $parent, int $from, int $to): void {
			if ($name==="page") {
				self::reorderPages($from, $to);
			} elseif ($name==="category") {
				self::reorderCategories($parent ?? "", $from, $to);
			} elseif (self::isPricingGroup($name)) {
				self::reorderPricingGroups($name, $from, $to);
			} elseif (isset(self::PRICING_ITEMS[$name])) {
				self::reorderPricingItems($name, $parent ?? "", $from, $to);
			} elseif ($name==="lineitem") {
				self::reorderComponents($parent ?? "", $from, $to);
			} elseif ($name==="downloadset") {
				self::reorderSimple("download_profiles", $from, $to);
			} elseif ($name==="discount") {
				self::reorderDiscounts($parent ?? "", $from, $to);
			} elseif (in_array($name, array("ustaxchart", "cataxchart", "vattaxchart"), true)) {
				self::reorderTax($name, $from, $to);
			} elseif ($name==="formobjects") {
				self::reorderSimple("form_fields", $from, $to);
			} else {
				throw new InvalidArgumentException("Unknown relational set table.");
			}
		}

		public static function messageRows (): array {
			$sql = "SELECT suid, created_at, delivery_status, sender_name, sender_email,
				recipient_name, recipient, subject, body
				FROM messages WHERE suid IS NOT NULL ORDER BY created_at, id";
			$query = Database::connection()->query($sql);
			$rows = array();

			foreach ($query as $message) {
				$suid = $message["suid"];
				$sent = in_array($message["delivery_status"], array("sent", "partial"), true);
				$rows[$suid] = array(
					$suid,
					(string) ($message["created_at"] * 1000),
					$sent ? "true" : "false",
					$message["sender_name"],
					$message["sender_email"],
					$message["recipient_name"],
					$message["recipient"],
					base64_encode($message["subject"]),
					base64_encode($message["body"])
				);
			}

			return $rows;
		}

		public static function addMessage (array $message): string {
			$status = (string) ($message["status"] ?? "failed");
			if (!in_array($status, array("sent", "partial", "failed"), true)) {
				throw new InvalidArgumentException("Invalid message delivery status.");
			}

			return Database::transaction(function (PDO $db) use ($message, $status): string {
				$now = time();
				$suid = Database::allocateSuid();
				$galleryId = null;
				$gallerySuid = (string) ($message["gallery_suid"] ?? "");
				if ($gallerySuid!=="") {
					$gallery = $db->prepare("SELECT page_id FROM galleries JOIN pages ON pages.id = galleries.page_id WHERE pages.suid = ?");
					$gallery->execute(array($gallerySuid));
					$found = $gallery->fetchColumn();
					if ($found!==false) $galleryId = (int) $found;
				}

				$sql = "INSERT INTO messages (suid, gallery_id, recipient, recipient_name,
					sender_name, sender_email, subject, body, kind, delivery_status, created_at, sent_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'email', ?, ?, ?)";
				$insert = $db->prepare($sql);
				$insert->execute(array(
					$suid,
					$galleryId,
					(string) ($message["recipient_email"] ?? ""),
					(string) ($message["recipient_name"] ?? ""),
					(string) ($message["sender_name"] ?? ""),
					(string) ($message["sender_email"] ?? ""),
					(string) ($message["subject"] ?? ""),
					(string) ($message["body"] ?? ""),
					$status,
					$now,
					$status==="failed" ? null : $now
				));

				$delete = $db->prepare("DELETE FROM messages WHERE created_at < ?");
				$delete->execute(array($now - 90 * 86400));
				return $suid;
			});
		}

		public static function deleteMessage (string $suid): void {
			Database::transaction(function (PDO $db) use ($suid): void {
				$delete = $db->prepare("DELETE FROM messages WHERE suid = ?");
				$delete->execute(array($suid));
			});
		}

		public static function downloadRows (): array {
			$query = Database::connection()->query("SELECT suid, name FROM download_profiles ORDER BY position, id");
			$rows = array();
			foreach ($query as $profile) {
				$rows[$profile["suid"]] = array($profile["suid"], $profile["name"]);
			}
			return $rows;
		}

		public static function saveDownload (string $suid, array $values): void {
			if (!preg_match('/^[a-f0-9]{1,16}$/i', $suid)) throw new InvalidArgumentException("Invalid download identifier.");
			Database::transaction(function (PDO $db) use ($suid, $values): void {
				$query = $db->prepare("SELECT id, name FROM download_profiles WHERE suid = ?");
				$query->execute(array($suid));
				$existing = $query->fetch();
				$name = (string) ($values[0] ?? $existing["name"] ?? "");
				if ($existing) {
					$update = $db->prepare("UPDATE download_profiles SET name = ? WHERE id = ?");
					$update->execute(array($name, $existing["id"]));
				} else {
					$position = (int) $db->query("SELECT COALESCE(MAX(position), -1) + 1 FROM download_profiles")->fetchColumn();
					$insert = $db->prepare("INSERT INTO download_profiles (suid, name, position) VALUES (?, ?, ?)");
					$insert->execute(array($suid, $name, $position));
				}
			});
		}

		public static function deleteDownload (string $suid): void {
			Database::transaction(function (PDO $db) use ($suid): void {
				$db->prepare("DELETE FROM configuration_documents WHERE type = 'downloads' AND scope_id = ?")
					->execute(array($suid));
				$delete = $db->prepare("DELETE FROM download_profiles WHERE suid = ?");
				$delete->execute(array($suid));
			});
		}

		private static function discountGalleryId (PDO $db, string $parent): ?int {
			if ($parent==="") return null;
			$query = $db->prepare("SELECT page_id FROM galleries JOIN pages ON pages.id = galleries.page_id WHERE pages.suid = ?");
			$query->execute(array($parent));
			$id = $query->fetchColumn();
			if ($id===false) throw new InvalidArgumentException("Discount gallery does not exist.");
			return (int) $id;
		}

		public static function discountRows (string $parent): array {
			$db = Database::connection();
			$galleryId = self::discountGalleryId($db, $parent);
			$sql = "SELECT suid, code, value_text, kind, use_count, max_uses,
				expires_at, minimum_text, free_shipping
				FROM discounts WHERE gallery_id IS ? AND suid IS NOT NULL ORDER BY position, id";
			$query = $db->prepare($sql);
			$query->execute(array($galleryId));
			$rows = array();
			foreach ($query as $discount) {
				$suid = $discount["suid"];
				$rows[$suid] = array(
					$suid, $parent, $discount["code"], $discount["value_text"],
					$discount["kind"], (string) $discount["use_count"],
					$discount["max_uses"]===null ? "" : (string) $discount["max_uses"],
					$discount["expires_at"]===null ? "" : (string) $discount["expires_at"],
					$discount["minimum_text"], (string) $discount["free_shipping"]
				);
			}
			return $rows;
		}

		public static function saveDiscount (string $suid, string $parent, array $values): void {
			if (!preg_match('/^[a-f0-9]{1,16}$/i', $suid)) throw new InvalidArgumentException("Invalid discount identifier.");
			Database::transaction(function (PDO $db) use ($suid, $parent, $values): void {
				$galleryId = self::discountGalleryId($db, $parent);
				$query = $db->prepare("SELECT * FROM discounts WHERE suid = ? AND gallery_id IS ?");
				$query->execute(array($suid, $galleryId));
				$existing = $query->fetch();
				$code = (string) ($values[1] ?? $existing["code"] ?? "");
				$amount = (string) ($values[2] ?? $existing["value_text"] ?? "0");
				$kind = (string) ($values[3] ?? $existing["kind"] ?? "percentage");
				$uses = (int) ($values[4] ?? $existing["use_count"] ?? 0);
				$maxUses = $values[5] ?? $existing["max_uses"] ?? null;
				$expires = $values[6] ?? $existing["expires_at"] ?? null;
				$minimum = (string) ($values[7] ?? $existing["minimum_text"] ?? "0");
				$freeShipping = (int) ($values[8] ?? $existing["free_shipping"] ?? 0);
				$maxUses = $maxUses==="" ? null : $maxUses;
				$expires = $expires==="" ? null : $expires;
				if ($existing) {
					$sql = "UPDATE discounts SET code = ?, value_text = ?, kind = ?, use_count = ?,
						max_uses = ?, expires_at = ?, minimum_text = ?, free_shipping = ? WHERE id = ?";
					$write = $db->prepare($sql);
					$write->execute(array($code, $amount, $kind, $uses, $maxUses, $expires, $minimum, $freeShipping, $existing["id"]));
				} else {
					$query = $db->prepare("SELECT COALESCE(MAX(position), -1) + 1 FROM discounts WHERE gallery_id IS ?");
					$query->execute(array($galleryId));
					$position = (int) $query->fetchColumn();
					$sql = "INSERT INTO discounts
						(suid, gallery_id, code, value_text, kind, use_count, max_uses,
						expires_at, minimum_text, free_shipping, position)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
					$write = $db->prepare($sql);
					$write->execute(array($suid, $galleryId, $code, $amount, $kind, $uses, $maxUses, $expires, $minimum, $freeShipping, $position));
				}
			});
		}

		public static function deleteDiscount (string $suid, string $parent): void {
			Database::transaction(function (PDO $db) use ($suid, $parent): void {
				$galleryId = self::discountGalleryId($db, $parent);
				$delete = $db->prepare("DELETE FROM discounts WHERE suid = ? AND gallery_id IS ?");
				$delete->execute(array($suid, $galleryId));
			});
		}

		public static function reorderDiscounts (string $parent, int $from, int $to): void {
			Database::transaction(function (PDO $db) use ($parent, $from, $to): void {
				$galleryId = self::discountGalleryId($db, $parent);
				self::reorderTable($db, "discounts", "gallery_id IS ?", array($galleryId), $from, $to);
			});
		}

		private static function taxCountry (string $name): string {
			return match ($name) {
				"ustaxchart" => "US",
				"cataxchart" => "CA",
				"vattaxchart" => "VAT",
				default => throw new InvalidArgumentException("Unknown tax chart.")
			};
		}

		public static function taxRows (string $name): array {
			$country = self::taxCountry($name);
			$query = Database::connection()->prepare("SELECT subdivision_code, name, rate_text, unused_text, hst_text, gst_text, pst_text FROM tax_rates WHERE country_code = ? ORDER BY position, id");
			$query->execute(array($country));
			$rows = array();
			foreach ($query as $rate) {
				$code = $rate["subdivision_code"];
				if ($country==="US") {
					$rows[$code] = array($code, $rate["name"], $rate["unused_text"], $rate["rate_text"]);
				} elseif ($country==="CA") {
					$rows[$code] = array($code, $rate["name"], $rate["hst_text"], $rate["gst_text"], $rate["pst_text"]);
				} else {
					$rows[$code] = array($code, $rate["name"], $rate["rate_text"]);
				}
			}
			return $rows;
		}

		public static function saveTax (string $name, string $code, array $values): void {
			$country = self::taxCountry($name);
			if (!preg_match('/^[A-Za-z0-9_-]{1,32}$/', $code)) throw new InvalidArgumentException("Invalid tax code.");
			Database::transaction(function (PDO $db) use ($country, $code, $values): void {
				$query = $db->prepare("SELECT * FROM tax_rates WHERE country_code = ? AND subdivision_code = ?");
				$query->execute(array($country, $code));
				$existing = $query->fetch();
				$name = (string) ($values[0] ?? $existing["name"] ?? "");
				$rate = (string) ($existing["rate_text"] ?? "0");
				$unused = (string) ($existing["unused_text"] ?? "");
				$hst = (string) ($existing["hst_text"] ?? "0");
				$gst = (string) ($existing["gst_text"] ?? "0");
				$pst = (string) ($existing["pst_text"] ?? "0");
				if ($country==="US") {
					$unused = (string) ($values[1] ?? $unused);
					$rate = (string) ($values[2] ?? $rate);
				} elseif ($country==="CA") {
					$hst = (string) ($values[1] ?? $hst);
					$gst = (string) ($values[2] ?? $gst);
					$pst = (string) ($values[3] ?? $pst);
				} else {
					$rate = (string) ($values[1] ?? $rate);
				}
				if ($existing) {
					$sql = "UPDATE tax_rates SET name = ?, rate_text = ?, unused_text = ?, hst_text = ?, gst_text = ?, pst_text = ? WHERE id = ?";
					$write = $db->prepare($sql);
					$write->execute(array($name, $rate, $unused, $hst, $gst, $pst, $existing["id"]));
				} else {
					$query = $db->prepare("SELECT COALESCE(MAX(position), -1) + 1 FROM tax_rates WHERE country_code = ?");
					$query->execute(array($country));
					$position = (int) $query->fetchColumn();
					$sql = "INSERT INTO tax_rates (country_code, subdivision_code, name, rate_text, unused_text, hst_text, gst_text, pst_text, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
					$write = $db->prepare($sql);
					$write->execute(array($country, $code, $name, $rate, $unused, $hst, $gst, $pst, $position));
				}
			});
		}

		public static function deleteTax (string $name, string $code): void {
			$country = self::taxCountry($name);
			Database::transaction(function (PDO $db) use ($country, $code): void {
				$delete = $db->prepare("DELETE FROM tax_rates WHERE country_code = ? AND subdivision_code = ?");
				$delete->execute(array($country, $code));
			});
		}

		public static function reorderTax (string $name, int $from, int $to): void {
			$country = self::taxCountry($name);
			Database::transaction(function (PDO $db) use ($country, $from, $to): void {
				self::reorderTable($db, "tax_rates", "country_code = ?", array($country), $from, $to);
			});
		}

		public static function formRows (): array {
			$query = Database::connection()->query("SELECT suid, field_key, label, kind, required, defaults_text, options_text FROM form_fields WHERE suid IS NOT NULL ORDER BY position, id");
			$rows = array();
			foreach ($query as $field) {
				$suid = $field["suid"];
				$rows[$suid] = array($suid, $field["field_key"], $field["label"], $field["kind"],
					(string) $field["required"], $field["defaults_text"], $field["options_text"]);
			}
			return $rows;
		}

		public static function saveForm (string $suid, array $values): void {
			if (!preg_match('/^[a-f0-9]{1,16}$/i', $suid)) throw new InvalidArgumentException("Invalid form field identifier.");
			Database::transaction(function (PDO $db) use ($suid, $values): void {
				$query = $db->prepare("SELECT * FROM form_fields WHERE suid = ?");
				$query->execute(array($suid));
				$existing = $query->fetch();
				$key = (string) ($values[0] ?? $existing["field_key"] ?? "");
				$label = (string) ($values[1] ?? $existing["label"] ?? "");
				$kind = (string) ($values[2] ?? $existing["kind"] ?? "");
				$required = (int) ($values[3] ?? $existing["required"] ?? 0);
				$defaults = (string) ($values[4] ?? $existing["defaults_text"] ?? "");
				$options = (string) ($values[5] ?? $existing["options_text"] ?? "");
				if ($existing) {
					$write = $db->prepare("UPDATE form_fields SET field_key = ?, label = ?, kind = ?, required = ?, defaults_text = ?, options_text = ? WHERE id = ?");
					$write->execute(array($key, $label, $kind, $required, $defaults, $options, $existing["id"]));
				} else {
					$position = (int) $db->query("SELECT COALESCE(MAX(position), -1) + 1 FROM form_fields")->fetchColumn();
					$write = $db->prepare("INSERT INTO form_fields (suid, field_key, label, kind, required, defaults_text, options_text, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
					$write->execute(array($suid, $key, $label, $kind, $required, $defaults, $options, $position));
				}
			});
		}

		public static function deleteForm (string $suid): void {
			Database::transaction(function (PDO $db) use ($suid): void {
				$delete = $db->prepare("DELETE FROM form_fields WHERE suid = ?");
				$delete->execute(array($suid));
			});
		}

		public static function subscribeContact (string $email, string $name): void {
			Database::transaction(function (PDO $db) use ($email, $name): void {
				$sql = "INSERT INTO mailing_contacts (email, name, consent_state, created_at)
					VALUES (?, ?, 'subscribed', ?)
					ON CONFLICT(email) DO UPDATE SET name = excluded.name, consent_state = excluded.consent_state";
				$write = $db->prepare($sql);
				$write->execute(array($email, $name, time()));
			});
		}

		private static function reorderTable (PDO $db, string $table, string $where, array $parameters, int $from, int $to): void {
			$query = $db->prepare("SELECT id FROM $table WHERE $where ORDER BY position, id");
			$query->execute($parameters);
			$ids = $query->fetchAll(PDO::FETCH_COLUMN);
			if (!isset($ids[$from]) || !isset($ids[$to])) return;
			$moved = array_splice($ids, $from, 1);
			array_splice($ids, $to, 0, $moved);
			$update = $db->prepare("UPDATE $table SET position = ? WHERE id = ?");
			foreach ($ids as $position => $id) $update->execute(array($position, $id));
		}

		public static function reorderSimple (string $table, int $from, int $to): void {
			if (!in_array($table, array("download_profiles", "form_fields"), true)) {
				throw new InvalidArgumentException("Unknown ordered table.");
			}
			Database::transaction(function (PDO $db) use ($table, $from, $to): void {
				self::reorderTable($db, $table, "1 = 1", array(), $from, $to);
			});
		}

		public static function pricingGroupRows (string $name): array {
			$kind = self::PRICING_GROUPS[$name] ?? null;
			if ($kind===null) throw new InvalidArgumentException("Unknown pricing group.");

			$sql = "SELECT suid, name FROM pricing_groups WHERE kind = ? ORDER BY position, id";
			$query = Database::connection()->prepare($sql);
			$query->execute(array($kind));
			$rows = array();
			foreach ($query as $group) {
				$suid = $group["suid"];
				$rows[$suid] = array($suid, $group["name"]);
			}

			return $rows;
		}

		public static function duplicateSet (string $name, string $source, string $label): string {
			if ($name==="downloadset") {
				return Database::transaction(function (PDO $db) use ($source, $label): string {
					$query = $db->prepare("SELECT settings_json FROM download_profiles WHERE suid = ?");
					$query->execute(array($source));
					$settings = $query->fetchColumn();
					if ($settings===false) throw new InvalidArgumentException("Download profile does not exist.");
					$suid = Database::allocateSuid();
					$position = (int) $db->query("SELECT COALESCE(MAX(position), -1) + 1 FROM download_profiles")->fetchColumn();
					$insert = $db->prepare("INSERT INTO download_profiles (suid, name, settings_json, position) VALUES (?, ?, ?, ?)");
					$insert->execute(array($suid, $label, $settings, $position));
					return $suid;
				});
			}
			if (!self::isPricingGroup($name)) throw new InvalidArgumentException("Set cannot be duplicated.");
			$kind = self::PRICING_GROUPS[$name];
			return Database::transaction(function (PDO $db) use ($name, $source, $label, $kind): string {
				if (!isset(self::pricingGroupRows($name)[$source])) {
					throw new InvalidArgumentException("Pricing group does not exist.");
				}
				$suid = Database::allocateSuid();
				self::savePricingGroup($name, $suid, array($label));
				foreach (self::pricingItemRows($kind, $source) as $item) {
					$newItem = Database::allocateSuid();
					self::savePricingItem($kind, $newItem, $suid, array_slice($item, 1));
					if ($kind==="package" || $kind==="product") {
						foreach (self::componentRows($item[0]) as $component) {
							self::saveComponent(Database::allocateSuid(), $newItem, array_slice($component, 1));
						}
					}
				}
				return $suid;
			});
		}

		public static function savePricingGroup (string $name, string $suid, array $values): void {
			$kind = self::PRICING_GROUPS[$name] ?? null;
			if ($kind===null || !preg_match('/^[a-f0-9]{1,16}$/i', $suid)) {
				throw new InvalidArgumentException("Invalid pricing group.");
			}

			Database::transaction(function (PDO $db) use ($kind, $suid, $values): void {
				$query = $db->prepare("SELECT id, name FROM pricing_groups WHERE suid = ? AND kind = ?");
				$query->execute(array($suid, $kind));
				$existing = $query->fetch();
				$label = isset($values[0]) ? (string) $values[0] : ($existing["name"] ?? "");
				if ($label==="") throw new InvalidArgumentException("Pricing group name is required.");

				if ($existing) {
					$update = $db->prepare("UPDATE pricing_groups SET name = ? WHERE id = ?");
					$update->execute(array($label, $existing["id"]));
				} else {
					$query = $db->prepare("SELECT COALESCE(MAX(position), -1) + 1 FROM pricing_groups WHERE kind = ?");
					$query->execute(array($kind));
					$position = (int) $query->fetchColumn();
					$insert = $db->prepare("INSERT INTO pricing_groups (suid, kind, name, position) VALUES (?, ?, ?, ?)");
					$insert->execute(array($suid, $kind, $label, $position));
				}
			});
		}

		public static function deletePricingGroup (string $name, string $suid): void {
			$kind = self::PRICING_GROUPS[$name] ?? null;
			if ($kind===null) throw new InvalidArgumentException("Unknown pricing group.");

			Database::transaction(function (PDO $db) use ($kind, $suid): void {
				if (isset(self::PRICING_ITEMS[$kind])) {
					$table = self::PRICING_ITEMS[$kind];
					$children = $db->prepare("DELETE FROM $table WHERE group_id = (SELECT id FROM pricing_groups WHERE suid = ? AND kind = ?)");
					$children->execute(array($suid, $kind));
				}
				$delete = $db->prepare("DELETE FROM pricing_groups WHERE suid = ? AND kind = ?");
				$delete->execute(array($suid, $kind));
			});
		}

		public static function pricingItemRows (string $name, string $parent): array {
			if ($name==="package" || $name==="product") {
				return self::packageProductRows($name, $parent);
			}
			$table = self::PRICING_ITEMS[$name];
			$columns = $name==="format"
				? "suid, name, width, height, price_expression, shipping_expression"
				: "suid, name, price_expression, shipping_expression";
			$sql = "SELECT $columns FROM $table WHERE group_id = (SELECT id FROM pricing_groups WHERE suid = ? AND kind = ?) ORDER BY position, id";
			$query = Database::connection()->prepare($sql);
			$query->execute(array($parent, $name));
			$rows = array();
			foreach ($query as $item) {
				$suid = $item["suid"];
				$row = array($suid, $item["name"]);
				if ($name==="format") {
					$row[] = $item["width"]===null ? "" : (string) $item["width"];
					$row[] = $item["height"]===null ? "" : (string) $item["height"];
				}
				$row[] = $item["price_expression"];
				$row[] = $item["shipping_expression"];
				$rows[$suid] = $row;
			}
			return $rows;
		}

		public static function savePricingItem (string $name, string $suid, string $parent, array $values): void {
			if ($name==="package" || $name==="product") {
				self::savePackageProduct($name, $suid, $parent, $values);
				return;
			}
			if (!preg_match('/^[a-f0-9]{1,16}$/i', $suid)) {
				throw new InvalidArgumentException("Invalid pricing item identifier.");
			}
			$table = self::PRICING_ITEMS[$name];
			Database::transaction(function (PDO $db) use ($name, $table, $suid, $parent, $values): void {
				$group = $db->prepare("SELECT id FROM pricing_groups WHERE suid = ? AND kind = ?");
				$group->execute(array($parent, $name));
				$groupId = $group->fetchColumn();
				if ($groupId===false) throw new InvalidArgumentException("Pricing group does not exist.");

				$existing = $db->prepare("SELECT * FROM $table WHERE suid = ? AND group_id = ?");
				$existing->execute(array($suid, $groupId));
				$item = $existing->fetch(PDO::FETCH_ASSOC) ?: array();
				$label = $values[0] ?? $item["name"] ?? "";
				$priceIndex = $name==="format" ? 3 : 1;
				$shippingIndex = $priceIndex + 1;
				$price = $values[$priceIndex] ?? $item["price_expression"] ?? "0";
				$shipping = $values[$shippingIndex] ?? $item["shipping_expression"] ?? "0";

				if ($name==="format") {
					$width = $values[1] ?? $item["width"] ?? "";
					$height = $values[2] ?? $item["height"] ?? "";
					$width = $width==="" ? null : $width;
					$height = $height==="" ? null : $height;
					if ($item) {
						$write = $db->prepare("UPDATE formats SET name = ?, width = ?, height = ?, price_expression = ?, shipping_expression = ? WHERE id = ?");
						$write->execute(array($label, $width, $height, $price, $shipping, $item["id"]));
					} else {
						$positionQuery = $db->prepare("SELECT COALESCE(MAX(position), -1) + 1 FROM formats WHERE group_id = ?");
						$positionQuery->execute(array($groupId));
						$position = (int) $positionQuery->fetchColumn();
						$write = $db->prepare("INSERT INTO formats (group_id, suid, name, width, height, price_expression, shipping_expression, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
						$write->execute(array($groupId, $suid, $label, $width, $height, $price, $shipping, $position));
					}
				} else {
					if ($item) {
						$write = $db->prepare("UPDATE $table SET name = ?, price_expression = ?, shipping_expression = ? WHERE id = ?");
						$write->execute(array($label, $price, $shipping, $item["id"]));
					} else {
						$positionQuery = $db->prepare("SELECT COALESCE(MAX(position), -1) + 1 FROM $table WHERE group_id = ?");
						$positionQuery->execute(array($groupId));
						$position = (int) $positionQuery->fetchColumn();
						$write = $db->prepare("INSERT INTO $table (group_id, suid, name, price_expression, shipping_expression, position) VALUES (?, ?, ?, ?, ?, ?)");
						$write->execute(array($groupId, $suid, $label, $price, $shipping, $position));
					}
				}
			});
		}

		public static function packageProductRows (string $name, string $parent): array {
			$table = self::PRICING_ITEMS[$name];
			$sql = "SELECT items.suid, items.name, assets.public_key AS filename,
				items.price_expression, items.shipping_expression, items.description
				FROM $table AS items
				LEFT JOIN media_assets AS assets ON assets.id = items.image_asset_id
				WHERE items.group_id = (SELECT id FROM pricing_groups WHERE suid = ? AND kind = ?)
				ORDER BY items.position, items.id";
			$query = Database::connection()->prepare($sql);
			$query->execute(array($parent, $name));
			$rows = array();
			foreach ($query as $item) {
				$suid = $item["suid"];
				$rows[$suid] = array(
					$suid, $item["name"], (string) ($item["filename"] ?? ""),
					$item["price_expression"], $item["shipping_expression"], $item["description"]
				);
			}
			return $rows;
		}

		public static function savePackageProduct (string $name, string $suid, string $parent, array $values): void {
			if (!preg_match('/^[a-f0-9]{1,16}$/i', $suid)) {
				throw new InvalidArgumentException("Invalid package or product identifier.");
			}
			$table = self::PRICING_ITEMS[$name];
			Database::transaction(function (PDO $db) use ($name, $table, $suid, $parent, $values): void {
				$group = $db->prepare("SELECT id FROM pricing_groups WHERE suid = ? AND kind = ?");
				$group->execute(array($parent, $name));
				$groupId = $group->fetchColumn();
				if ($groupId===false) throw new InvalidArgumentException("Pricing group does not exist.");

				$query = $db->prepare("SELECT * FROM $table WHERE suid = ? AND group_id = ?");
				$query->execute(array($suid, $groupId));
				$existing = $query->fetch();
				$label = (string) ($values[0] ?? $existing["name"] ?? "");
				$price = (string) ($values[2] ?? $existing["price_expression"] ?? "0");
				$shipping = (string) ($values[3] ?? $existing["shipping_expression"] ?? "0");
				$description = (string) ($values[4] ?? $existing["description"] ?? "");
				$assetId = $existing["image_asset_id"] ?? null;
				if (isset($values[1])) {
					$assetId = null;
					if ($values[1]!=="") {
						$asset = $db->prepare("SELECT id FROM media_assets WHERE public_key = ? AND media_type = ?");
						$asset->execute(array($values[1], $name));
						$assetId = $asset->fetchColumn();
						if ($assetId===false) throw new InvalidArgumentException("Package or product image is not listed.");
					}
				}

				if ($existing) {
					$update = $db->prepare("UPDATE $table SET name = ?, image_asset_id = ?, price_expression = ?, shipping_expression = ?, description = ? WHERE id = ?");
					$update->execute(array($label, $assetId, $price, $shipping, $description, $existing["id"]));
				} else {
					$positionQuery = $db->prepare("SELECT COALESCE(MAX(position), -1) + 1 FROM $table WHERE group_id = ?");
					$positionQuery->execute(array($groupId));
					$position = (int) $positionQuery->fetchColumn();
					$insert = $db->prepare("INSERT INTO $table (group_id, suid, name, image_asset_id, price_expression, shipping_expression, description, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
					$insert->execute(array($groupId, $suid, $label, $assetId, $price, $shipping, $description, $position));
				}
			});
		}

		private static function componentParent (PDO $db, string $parent): array {
			foreach (array("package" => "packages", "product" => "products") as $kind => $table) {
				$query = $db->prepare("SELECT id FROM $table WHERE suid = ?");
				$query->execute(array($parent));
				$id = $query->fetchColumn();
				if ($id!==false) return array($kind, (int) $id);
			}
			throw new InvalidArgumentException("Package or product does not exist.");
		}

		public static function componentRows (string $parent): array {
			$db = Database::connection();
			list($kind, $parentId) = self::componentParent($db, $parent);
			$table = $kind==="package" ? "package_components" : "product_components";
			$query = $db->prepare("SELECT suid, label, quantity, width, height FROM $table WHERE {$kind}_id = ? ORDER BY position, id");
			$query->execute(array($parentId));
			$rows = array();
			foreach ($query as $item) {
				$suid = $item["suid"];
				$rows[$suid] = array(
					$suid, $item["label"], (string) $item["quantity"],
					$item["width"]===null ? "" : (string) $item["width"],
					$item["height"]===null ? "" : (string) $item["height"]
				);
			}
			return $rows;
		}

		public static function saveComponent (string $suid, string $parent, array $values): void {
			if (!preg_match('/^[a-f0-9]{1,16}$/i', $suid)) throw new InvalidArgumentException("Invalid line item identifier.");
			Database::transaction(function (PDO $db) use ($suid, $parent, $values): void {
				list($kind, $parentId) = self::componentParent($db, $parent);
				$table = $kind==="package" ? "package_components" : "product_components";
				$query = $db->prepare("SELECT * FROM $table WHERE suid = ? AND {$kind}_id = ?");
				$query->execute(array($suid, $parentId));
				$existing = $query->fetch();
				$label = (string) ($values[0] ?? $existing["label"] ?? "");
				$quantity = (int) ($values[1] ?? $existing["quantity"] ?? 1);
				if ($quantity<1) throw new InvalidArgumentException("Line item quantity must be positive.");
				$width = $values[2] ?? $existing["width"] ?? null;
				$height = $values[3] ?? $existing["height"] ?? null;
				$width = $width==="" ? null : $width;
				$height = $height==="" ? null : $height;
				if ($existing) {
					$write = $db->prepare("UPDATE $table SET label = ?, quantity = ?, width = ?, height = ? WHERE id = ?");
					$write->execute(array($label, $quantity, $width, $height, $existing["id"]));
				} else {
					$positionQuery = $db->prepare("SELECT COALESCE(MAX(position), -1) + 1 FROM $table WHERE {$kind}_id = ?");
					$positionQuery->execute(array($parentId));
					$position = (int) $positionQuery->fetchColumn();
					$write = $db->prepare("INSERT INTO $table ({$kind}_id, suid, label, quantity, width, height, position) VALUES (?, ?, ?, ?, ?, ?, ?)");
					$write->execute(array($parentId, $suid, $label, $quantity, $width, $height, $position));
				}
			});
		}

		public static function deleteComponent (string $suid, string $parent): void {
			Database::transaction(function (PDO $db) use ($suid, $parent): void {
				list($kind, $parentId) = self::componentParent($db, $parent);
				$table = $kind==="package" ? "package_components" : "product_components";
				$delete = $db->prepare("DELETE FROM $table WHERE suid = ? AND {$kind}_id = ?");
				$delete->execute(array($suid, $parentId));
			});
		}

		public static function reorderComponents (string $parent, int $from, int $to): void {
			Database::transaction(function (PDO $db) use ($parent, $from, $to): void {
				list($kind, $parentId) = self::componentParent($db, $parent);
				$table = $kind==="package" ? "package_components" : "product_components";
				$rows = array_values(self::componentRows($parent));
				if (!isset($rows[$from]) || $to<0 || $to>=count($rows)) return;
				$moved = array_splice($rows, $from, 1);
				array_splice($rows, $to, 0, $moved);
				$update = $db->prepare("UPDATE $table SET position = ? WHERE suid = ? AND {$kind}_id = ?");
				foreach ($rows as $position => $row) $update->execute(array($position, $row[0], $parentId));
			});
		}

		public static function deletePricingItem (string $name, string $suid, string $parent): void {
			$table = self::PRICING_ITEMS[$name];
			Database::transaction(function (PDO $db) use ($name, $table, $suid, $parent): void {
				$delete = $db->prepare("DELETE FROM $table WHERE suid = ? AND group_id = (SELECT id FROM pricing_groups WHERE suid = ? AND kind = ?)");
				$delete->execute(array($suid, $parent, $name));
			});
		}

		public static function reorderPricingItems (string $name, string $parent, int $from, int $to): void {
			$table = self::PRICING_ITEMS[$name];
			Database::transaction(function (PDO $db) use ($name, $parent, $table, $from, $to): void {
				$rows = array_values(self::pricingItemRows($name, $parent));
				if (!isset($rows[$from]) || $to<0 || $to>=count($rows)) return;
				$moved = array_splice($rows, $from, 1);
				array_splice($rows, $to, 0, $moved);
				$update = $db->prepare("UPDATE $table SET position = ? WHERE suid = ? AND group_id = (SELECT id FROM pricing_groups WHERE suid = ? AND kind = ?)");
				foreach ($rows as $position => $row) {
					$update->execute(array($position, $row[0], $parent, $name));
				}
			});
		}

		public static function reorderPricingGroups (string $name, int $from, int $to): void {
			$rows = array_values(self::pricingGroupRows($name));
			if (!isset($rows[$from]) || $to<0 || $to>=count($rows)) return;

			$moved = array_splice($rows, $from, 1);
			array_splice($rows, $to, 0, $moved);
			Database::transaction(function (PDO $db) use ($name, $rows): void {
				$kind = self::PRICING_GROUPS[$name];
				$update = $db->prepare("UPDATE pricing_groups SET position = ? WHERE suid = ? AND kind = ?");
				foreach ($rows as $position => $row) {
					$update->execute(array($position, $row[0], $kind));
				}
			});
		}

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
				$db->prepare("DELETE FROM proofing_sessions WHERE gallery_id = ?")->execute(array($pageId));

				$assets = $db->prepare("SELECT asset_id FROM gallery_images WHERE gallery_id = ?");
				$assets->execute(array($pageId));
				$assetIds = $assets->fetchAll(PDO::FETCH_COLUMN);
				$assets = $db->prepare("SELECT asset_id FROM media_entries WHERE page_id = ?");
				$assets->execute(array($pageId));
				$assetIds = array_merge($assetIds, $assets->fetchAll(PDO::FETCH_COLUMN));

				$delete = $db->prepare("DELETE FROM gallery_images WHERE gallery_id = ?");
				$delete->execute(array($pageId));
				$db->prepare("DELETE FROM configuration_documents WHERE scope_id = ?")->execute(array($suid));
				$delete = $db->prepare("DELETE FROM pages WHERE id = ?");
				$delete->execute(array($pageId));

				$sql = "DELETE FROM media_assets
					WHERE id = ?
				AND id NOT IN (SELECT asset_id FROM gallery_images)
				AND id NOT IN (SELECT asset_id FROM media_entries)";
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
			$isDropboxSet = self::pageType($suid)==="DropboxSet";
			$sql = "SELECT categories.public_key, categories.name,
				(SELECT COUNT(*) FROM gallery_images WHERE category_id = categories.id) AS image_count
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
				if ($isDropboxSet) $rows[$key][] = (string) $category["image_count"];
			}

			return $rows;
		}

		public static function saveCategory (string $suid, string $key, string $name): void {
			if (!in_array(self::pageType($suid), array("CategorySet", "DropboxSet"), true)) {
				throw new InvalidArgumentException("Categories require a category or Dropbox set.");
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
			$type = self::pageType($suid);
			$sql = "SELECT assets.public_key, assets.original_name, assets.width, assets.height,
					assets.duration, assets.byte_size, images.caption, categories.public_key AS category_key,
					images.source_entry
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
				if ($type==="CategorySet" || $type==="DropboxSet") {
					$row[] = (string) ($image["category_key"] ?? "");
				}
				if ($type==="DropboxSet") $row[] = (string) $image["source_entry"];
				$rows[$key] = $row;
			}

			return $rows;
		}

		public static function replaceDropboxImages (string $suid, array $categories, array $images): void {
			if (self::pageType($suid)!=="DropboxSet") {
				throw new InvalidArgumentException("Dropbox images require a Dropbox set.");
			}

			Database::transaction(function (PDO $db) use ($suid, $categories, $images): void {
				$page = $db->prepare("SELECT id FROM pages WHERE suid = ?");
				$page->execute(array($suid));
				$pageId = (int) $page->fetchColumn();
				$db->prepare("DELETE FROM proofing_sessions WHERE gallery_id = ?")->execute(array($pageId));
				$oldAssets = $db->prepare("SELECT asset_id FROM gallery_images WHERE gallery_id = ?");
				$oldAssets->execute(array($pageId));
				$assetIds = $oldAssets->fetchAll(PDO::FETCH_COLUMN);
				$db->prepare("DELETE FROM gallery_images WHERE gallery_id = ?")->execute(array($pageId));
				$db->prepare("DELETE FROM gallery_categories WHERE gallery_id = ?")->execute(array($pageId));
				$deleteAsset = $db->prepare("DELETE FROM media_assets WHERE id = ? AND id NOT IN (SELECT asset_id FROM gallery_images)");
				foreach ($assetIds as $assetId) $deleteAsset->execute(array($assetId));

				$categoryIds = array();
				$insertCategory = $db->prepare("INSERT INTO gallery_categories (gallery_id, public_key, name, position) VALUES (?, ?, ?, ?)");
				foreach ($categories as $key => $name) {
					$insertCategory->execute(array($pageId, $key, $name, count($categoryIds)));
					$categoryIds[$key] = (int) $db->lastInsertId();
				}

				$insertAsset = $db->prepare("INSERT INTO media_assets (public_key, original_name, media_type, relative_path, width, height, byte_size, source_uri, created_at) VALUES (?, ?, 'image', ?, 0, 0, 0, ?, ?)");
				$insertImage = $db->prepare("INSERT INTO gallery_images (gallery_id, asset_id, category_id, position, source_entry) VALUES (?, ?, ?, ?, ?)");
				foreach ($images as $position => $image) {
					$key = $image[0];
					$remotePath = $image[1];
					$categoryId = $categoryIds[$image[6] ?? ""] ?? null;
					$insertAsset->execute(array($key, $remotePath, $suid . "/" . $key, $remotePath, time()));
					$insertImage->execute(array($pageId, $db->lastInsertId(), $categoryId, $position, $remotePath));
				}

				$update = $db->prepare("UPDATE pages SET image_count = ?, updated_at = ? WHERE id = ?");
				$update->execute(array(count($images), time(), $pageId));
			});
		}

		public static function updateDropboxThumbnail (string $suid, string $key, string $name, int $width, int $height, int $size): void {
			if (self::pageType($suid)!=="DropboxSet") throw new InvalidArgumentException("Dropbox set required.");
			Database::transaction(function (PDO $db) use ($suid, $key, $name, $width, $height, $size): void {
				$sql = "UPDATE media_assets SET original_name = ?, width = ?, height = ?, byte_size = ?
					WHERE public_key = ? AND id IN (SELECT images.asset_id FROM gallery_images AS images JOIN pages ON pages.id = images.gallery_id WHERE pages.suid = ?)";
				$db->prepare($sql)->execute(array($name, $width, $height, $size, $key, $suid));
				$db->prepare("UPDATE pages SET updated_at = ? WHERE suid = ?")->execute(array(time(), $suid));
			});
		}

		public static function dropboxMeta (string $suid): array {
			if (self::pageType($suid)!=="DropboxSet") return array();
			$images = self::imageRows($suid);
			if (count($images)===0) return array();
			$query = Database::connection()->prepare("SELECT updated_at FROM pages WHERE suid = ?");
			$query->execute(array($suid));
			$meta = array(
				"last_updated" => date("m/d/Y", (int) $query->fetchColumn()),
				"image_count" => count($images)
			);
			$categoryCount = count(self::categoryRows($suid));
			if ($categoryCount>0) $meta["category_count"] = $categoryCount;
			return $meta;
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
					$db->prepare("DELETE FROM favorites WHERE image_id = ?")->execute(array($image["id"]));
					$db->prepare("DELETE FROM cart_items WHERE image_id = ?")->execute(array($image["id"]));

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

		public static function reorderImages (string $suid, array $moves, ?int $from=null, ?int $to=null): void {
			$keys = array_keys(self::imageRows($suid));
			$keys = self::reorderedKeys($keys, $moves, $from, $to);

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
