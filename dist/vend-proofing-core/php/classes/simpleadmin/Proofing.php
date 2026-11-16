<?php

	/** Customer selections. Gateway row text is projected from relational records. */
	class Proofing {
		private const FIELDS = array(
			"favorites" => array("puid", "cuid", "filename", "width", "height"),
			"download" => array("puid", "cuid", "filename", "dimensions", "quality", "subtotal", "allprice"),
			"package" => array("type", "nickname", "title", "quantity", "subtotal", "shipping",
				"format_titles", "format_quantities", "format_aspects", "format_areas"),
			"cart" => array("puid", "cuid", "filename", "quantity", "toning", "format_label",
				"format_aspect", "format_price", "format_shipping", "orientation", "orientation_x",
				"orientation_y", "paper_label", "paper_price", "paper_shipping", "modifier_label",
				"modifier_price", "modifier_shipping", "subtotal", "shipping", "comments")
		);

		private static function galleryId (PDO $db, string $gallery): int {
			$query = $db->prepare("SELECT galleries.page_id FROM galleries JOIN pages ON pages.id = galleries.page_id WHERE pages.suid = ?");
			$query->execute(array($gallery));
			$id = $query->fetchColumn();
			if ($id===false) throw new InvalidArgumentException("Unknown gallery.");
			return (int) $id;
		}

		private static function sessionId (PDO $db, string $gallery, string $key): ?int {
			$galleryId = self::galleryId($db, $gallery);
			if (!preg_match('/^[a-f0-9]{32}$/i', $key)) throw new InvalidArgumentException("Invalid proofing session.");
			$query = $db->prepare("SELECT id FROM proofing_sessions WHERE gallery_id = ? AND email_key = ?");
			$query->execute(array($galleryId, $key));
			$id = $query->fetchColumn();
			return $id===false ? null : (int) $id;
		}

		private static function imageId (PDO $db, int $galleryId, string $key): int {
			$query = $db->prepare("SELECT images.id FROM gallery_images AS images
				JOIN media_assets AS assets ON assets.id = images.asset_id
				WHERE images.gallery_id = ? AND assets.public_key = ?");
			$query->execute(array($galleryId, $key));
			$id = $query->fetchColumn();
			if ($id===false) throw new InvalidArgumentException("Image is not in this gallery.");
			return (int) $id;
		}

		private static function values (string $type, array $row): array {
			$values = array();
			foreach (self::FIELDS[$type] as $index => $field) {
				$values[$field] = (string) ($row[$index + 1] ?? "");
			}
			return $values;
		}

		private static function row (string $type, string $key, string $json): array {
			$values = json_decode($json, true);
			if (!is_array($values)) $values = array();
			$row = array($key);
			foreach (self::FIELDS[$type] as $field) {
				$row[] = (string) ($values[$field] ?? "");
			}
			return $row;
		}

		public static function snapshotRow (string $type, string $key, string $json): array {
			if (!isset(self::FIELDS[$type])) throw new InvalidArgumentException("Unknown selection type.");
			return self::row($type, $key, $json);
		}

		public static function open (string $gallery, string $email): string {
			$key = md5($email);
			Database::transaction(function (PDO $db) use ($gallery, $email, $key): void {
				$galleryId = self::galleryId($db, $gallery);
				$now = time();
				$sql = "INSERT INTO proofing_sessions (gallery_id, email, email_key, created_at, updated_at)
					VALUES (?, ?, ?, ?, ?)
					ON CONFLICT (gallery_id, email_key) DO UPDATE SET email = excluded.email, updated_at = excluded.updated_at";
				$db->prepare($sql)->execute(array($galleryId, $email, $key, $now, $now));
			});
			return $key;
		}

		public static function rows (string $gallery, string $key): array {
			$db = Database::connection();
			$sessionId = self::sessionId($db, $gallery, $key);
			if ($sessionId===null) return array();
			$rows = array();
			$query = $db->prepare("SELECT public_key, selection_json FROM favorites WHERE session_id = ? ORDER BY position, id");
			$query->execute(array($sessionId));
			foreach ($query as $favorite) {
				$row = self::row("favorites", $favorite["public_key"], $favorite["selection_json"]);
				$rows[$row[0]] = $row;
			}
			$sql = "SELECT items.public_key, items.item_type, items.selection_json FROM cart_items AS items
				JOIN carts ON carts.id = items.cart_id WHERE carts.session_id = ? ORDER BY items.position, items.id";
			$query = $db->prepare($sql);
			$query->execute(array($sessionId));
			foreach ($query as $item) {
				$type = $item["item_type"]==="download" ? "download"
					: (in_array($item["item_type"], array("package", "product"), true) ? "package" : "cart");
				$row = self::row($type, $item["public_key"], $item["selection_json"]);
				$rows[$row[0]] = $row;
			}
			return $rows;
		}

		public static function rowsText (array $rows): string {
			$lines = array();
			foreach ($rows as $row) $lines[] = implode("\t", $row);
			return implode("\n", $lines);
		}

		public static function responseRows (string $gallery, string $key, string $type="*"): array {
			$rows = self::rows($gallery, $key);
			if ($type==="*") return $rows;
			if ($type==="favorites") {
				return array_filter($rows, fn ($row) => str_ends_with($row[0], "-f"));
			}
			$packages = array_filter($rows, fn ($row) => str_ends_with($row[0], "-p"));
			$downloads = array_filter($rows, fn ($row) => str_ends_with($row[0], "-d"));
			$other = array_filter($rows, fn ($row) => !str_ends_with($row[0], "-f")
				&& !str_ends_with($row[0], "-d") && !str_ends_with($row[0], "-p"));
			return $packages + $downloads + $other;
		}

		public static function sessionRows (string $gallery): array {
			$db = Database::connection();
			$galleryId = self::galleryId($db, $gallery);
			$query = $db->prepare("SELECT email_key, email FROM proofing_sessions WHERE gallery_id = ? ORDER BY created_at, id");
			$query->execute(array($galleryId));
			$rows = array();
			foreach ($query as $session) {
				$items = 0;
				$total = 0.0;
				$favorites = 0;
				foreach (self::rows($gallery, $session["email_key"]) as $row) {
					$key = $row[0];
					if (str_ends_with($key, "-f")) {
						$favorites++;
					} elseif (str_ends_with($key, "-p")) {
						$total += (float) ($row[5] ?? 0) + (float) ($row[6] ?? 0);
					} elseif (str_ends_with($key, "-d")) {
						$items++;
						$total += (float) ($row[6] ?? 0);
					} else {
						$quantity = (int) ($row[4] ?? 0);
						$items += $quantity;
						$total += ((float) ($row[19] ?? 0) + (float) ($row[20] ?? 0)) * $quantity;
					}
				}
				$key = $session["email_key"];
				$rows[$key] = array($key, $session["email"], (string) $items, (string) $total, (string) $favorites);
			}
			return $rows;
		}

		public static function save (string $gallery, string $session, string $type, array $row): array {
			if (!isset(self::FIELDS[$type])) throw new InvalidArgumentException("Unknown selection type.");
			$key = (string) ($row[0] ?? "");
			if ($key==="" || strlen($key)>128 || str_contains($key, "\t")) throw new InvalidArgumentException("Invalid selection key.");
			Database::transaction(function (PDO $db) use ($gallery, $session, $type, $row, $key): void {
				$sessionId = self::sessionId($db, $gallery, $session);
				if ($sessionId===null) throw new InvalidArgumentException("Unknown proofing session.");
				$galleryId = self::galleryId($db, $gallery);
				$values = self::values($type, $row);
				$json = json_encode($values, JSON_THROW_ON_ERROR);
				$imageKey = (string) ($values["cuid"] ?? "");
				$imageId = $imageKey!=="" ? self::imageId($db, $galleryId, $imageKey) : null;
				if ($type==="favorites") {
					if (!str_ends_with($key, "-f") || $imageId===null) throw new InvalidArgumentException("Invalid favorite.");
					$position = (int) $db->query("SELECT COALESCE(MAX(position), -1) + 1 FROM favorites")->fetchColumn();
					$sql = "INSERT INTO favorites (session_id, image_id, public_key, selection_json, position, created_at)
						VALUES (?, ?, ?, ?, ?, ?)
						ON CONFLICT (session_id, image_id) DO UPDATE SET public_key = excluded.public_key,
						selection_json = excluded.selection_json";
					$db->prepare($sql)->execute(array($sessionId, $imageId, $key, $json, $position, time()));
				} else {
					$db->prepare("INSERT INTO carts (session_id, updated_at) VALUES (?, ?) ON CONFLICT (session_id) DO UPDATE SET updated_at = excluded.updated_at")
						->execute(array($sessionId, time()));
					$cart = $db->prepare("SELECT id FROM carts WHERE session_id = ?");
					$cart->execute(array($sessionId));
					$cartId = (int) $cart->fetchColumn();
					$kind = $type==="download" ? "download" : ($type==="package"
						? (($values["type"] ?? "")==="product" ? "product" : "package")
						: (str_contains($key, ":") ? "allocation" : "print"));
					$parentItemId = null;
					if ($kind==="allocation") {
						$parentKey = explode(":", $key, 2)[1] . "-p";
						$parentQuery = $db->prepare("SELECT id FROM cart_items WHERE cart_id = ? AND public_key = ?");
						$parentQuery->execute(array($cartId, $parentKey));
						$foundParent = $parentQuery->fetchColumn();
						if ($foundParent!==false) $parentItemId = (int) $foundParent;
					}
					$quantity = $type==="download" ? 1 : max(1, (int) ($values["quantity"] ?? 1));
					$unit = (float) ($values["subtotal"] ?? 0);
					$shipping = (float) ($values["shipping"] ?? 0);
					$position = (int) $db->query("SELECT COALESCE(MAX(position), -1) + 1 FROM cart_items")->fetchColumn();
					$sql = "INSERT INTO cart_items (cart_id, item_type, image_id, parent_item_id, quantity,
						selection_json, quoted_unit_minor, quoted_shipping_minor, position, public_key)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
						ON CONFLICT (cart_id, public_key) DO UPDATE SET item_type = excluded.item_type,
						image_id = excluded.image_id, parent_item_id = excluded.parent_item_id,
						quantity = excluded.quantity,
						selection_json = excluded.selection_json, quoted_unit_minor = excluded.quoted_unit_minor,
						quoted_shipping_minor = excluded.quoted_shipping_minor";
					$db->prepare($sql)->execute(array($cartId, $kind, $imageId, $parentItemId, $quantity, $json,
						(int) round($unit * 100), (int) round($shipping * 100), $position, $key));
					if (in_array($kind, array("package", "product"), true)) {
						$parentQuery = $db->prepare("SELECT id FROM cart_items WHERE cart_id = ? AND public_key = ?");
						$parentQuery->execute(array($cartId, $key));
						$parentItemId = (int) $parentQuery->fetchColumn();
						$db->prepare("UPDATE cart_items SET parent_item_id = ? WHERE cart_id = ? AND public_key LIKE ?")
							->execute(array($parentItemId, $cartId, "%:" . substr($key, 0, -2)));
					}
				}
				$db->prepare("UPDATE proofing_sessions SET updated_at = ? WHERE id = ?")->execute(array(time(), $sessionId));
			});
			return self::responseRows($gallery, $session, $type);
		}

		public static function deleteItem (string $gallery, string $session, string $type, string $key): array {
			Database::transaction(function (PDO $db) use ($gallery, $session, $type, $key): void {
				$sessionId = self::sessionId($db, $gallery, $session);
				if ($sessionId===null) return;
				if ($type==="favorites") {
					$db->prepare("DELETE FROM favorites WHERE session_id = ? AND public_key = ?")->execute(array($sessionId, $key));
				} else {
					$cart = $db->prepare("SELECT id FROM carts WHERE session_id = ?");
					$cart->execute(array($sessionId));
					$cartId = $cart->fetchColumn();
					if ($cartId!==false) {
						$delete = $db->prepare("DELETE FROM cart_items WHERE cart_id = ? AND public_key = ?");
						$delete->execute(array($cartId, $key));
						if ($type==="package") {
							$prefix = explode("-", $key)[0];
							$db->prepare("DELETE FROM cart_items WHERE cart_id = ? AND public_key LIKE ?")
								->execute(array($cartId, "%:" . $prefix));
						}
					}
				}
				$db->prepare("UPDATE proofing_sessions SET updated_at = ? WHERE id = ?")->execute(array(time(), $sessionId));
			});
			return self::responseRows($gallery, $session, $type);
		}

		public static function clear (string $gallery, string $session, string $type): array {
			Database::transaction(function (PDO $db) use ($gallery, $session, $type): void {
				$sessionId = self::sessionId($db, $gallery, $session);
				if ($sessionId===null) return;
				if ($type==="favorites") {
					$db->prepare("DELETE FROM favorites WHERE session_id = ?")->execute(array($sessionId));
				} else {
					$cart = $db->prepare("SELECT id FROM carts WHERE session_id = ?");
					$cart->execute(array($sessionId));
					$cartId = $cart->fetchColumn();
					if ($cartId!==false) {
						if ($type==="cart") {
							$db->prepare("DELETE FROM cart_items WHERE cart_id = ?")->execute(array($cartId));
						} elseif ($type==="download") {
							$db->prepare("DELETE FROM cart_items WHERE cart_id = ? AND item_type = 'download'")->execute(array($cartId));
						} elseif ($type==="alacarte") {
							$db->prepare("DELETE FROM cart_items WHERE cart_id = ? AND item_type = 'print'")->execute(array($cartId));
						}
					}
				}
				$db->prepare("UPDATE proofing_sessions SET updated_at = ? WHERE id = ?")->execute(array(time(), $sessionId));
			});
			return self::responseRows($gallery, $session, $type);
		}

		public static function addDownloads (string $gallery, string $session, string $group,
			string $quality, float $price, bool $flat): array {
			if (!in_array($group, array("cart", "favorites"), true)) {
				throw new InvalidArgumentException("Unknown download group.");
			}
			$images = array();
			if ($group==="cart") {
				$images = array_values(Downloads::images($gallery));
			} else {
				foreach (self::rows($gallery, $session) as $row) {
					if (str_ends_with($row[0], "-f")) {
						$images[] = array($row[2], $row[3], $row[4] . "x" . $row[5]);
					}
				}
			}
			$eligible = Downloads::images($gallery);
			$images = array_values(array_filter($images, fn ($row) => isset($eligible[$row[0]])));
			if (!$images) return self::responseRows($gallery, $session, "download");
			$each = $flat ? floor($price / count($images) * 100) / 100 : $price;
			$remainder = $flat ? $price - $each * count($images) : 0;
			Database::transaction(function (PDO $db) use ($gallery, $session, $quality, $images, $each, $remainder, $group): void {
				$galleryId = self::galleryId($db, $gallery);
				$sessionId = self::sessionId($db, $gallery, $session);
				if ($sessionId===null) throw new InvalidArgumentException("Unknown proofing session.");
				$db->prepare("INSERT INTO carts (session_id, updated_at) VALUES (?, ?)
					ON CONFLICT (session_id) DO UPDATE SET updated_at = excluded.updated_at")
					->execute(array($sessionId, time()));
				$cart = $db->prepare("SELECT id FROM carts WHERE session_id = ?");
				$cart->execute(array($sessionId));
				$cartId = (int) $cart->fetchColumn();
				$next = $db->prepare("SELECT COALESCE(MAX(position), -1) + 1 FROM cart_items WHERE cart_id = ?");
				$next->execute(array($cartId));
				$position = (int) $next->fetchColumn();
				$sql = "INSERT INTO cart_items (cart_id, item_type, image_id, quantity,
					selection_json, quoted_unit_minor, quoted_shipping_minor, position, public_key)
					VALUES (?, 'download', ?, 1, ?, ?, 0, ?, ?)
					ON CONFLICT (cart_id, public_key) DO UPDATE SET image_id = excluded.image_id,
					selection_json = excluded.selection_json, quoted_unit_minor = excluded.quoted_unit_minor";
				$insert = $db->prepare($sql);
				foreach ($images as $index => $image) {
					$amount = $each + ($index===count($images) - 1 ? $remainder : 0);
					$key = md5($gallery . $image[0] . $quality) . "-d";
					$row = array($key, $gallery, $image[0], $image[1], $image[2], $quality,
						(string) $amount, "1");
					$values = self::values("download", $row);
					$values["_bulk_group"] = $group;
					$imageId = self::imageId($db, $galleryId, $image[0]);
					$insert->execute(array($cartId, $imageId, json_encode($values, JSON_THROW_ON_ERROR),
						(int) round($amount * 100), $position++, $key));
				}
				$db->prepare("UPDATE proofing_sessions SET updated_at = ? WHERE id = ?")
					->execute(array(time(), $sessionId));
			});
			return self::responseRows($gallery, $session, "download");
		}

		public static function deleteSession (string $gallery, string $key): void {
			Database::transaction(function (PDO $db) use ($gallery, $key): void {
				$id = self::sessionId($db, $gallery, $key);
				if ($id!==null) $db->prepare("DELETE FROM proofing_sessions WHERE id = ?")->execute(array($id));
			});
		}

		public static function clearGallery (string $gallery): void {
			Database::transaction(function (PDO $db) use ($gallery): void {
				$id = self::galleryId($db, $gallery);
				$db->prepare("DELETE FROM proofing_sessions WHERE gallery_id = ?")->execute(array($id));
			});
		}
	}
