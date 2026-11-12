<?php

	/** Relational purchase snapshots and the order-list projections used by admin and invoices. */
	class OrderRecords {
		private static function minor (string $amount): int {
			if (!is_numeric($amount) || !is_finite((float) $amount)) {
				throw new InvalidArgumentException("Invalid order amount.");
			}
			return (int) round((float) $amount * 100);
		}

		private static function amount (array $order, string $column): string {
			$snapshot = json_decode($order["pricing_snapshot_json"], true);
			if (isset($snapshot["amount_text"][$column])) return (string) $snapshot["amount_text"][$column];
			return number_format((int) $order[$column . "_minor"] / 100, 2, ".", "");
		}

		private static function project (array $order): array {
			$address = json_decode($order["shipping_address_json"], true);
			return array(
				$order["suid"], $order["gallery_suid"] ?? "", (string) ($order["placed_at_ms"] ?? ($order["placed_at"] * 1000)),
				$order["payment_type"], $order["transaction_reference"], $order["shipping_method"],
				$order["discount_code"], $order["customer_name"], $order["email"], $order["phone"],
				(string) ($address["text"] ?? ""), $order["country_code"], $order["postal_code"],
				$order["subdivision_code"],
				self::amount($order, "total"), self::amount($order, "subtotal"),
				self::amount($order, "discount"), self::amount($order, "shipping"),
				self::amount($order, "handling"), self::amount($order, "tax"),
				$order["tax_rate_text"], $order["prices_include_tax"], $order["shipping_taxable"],
				$order["handling_taxable"], $order["comments"]
			);
		}

		private static function orderQuery (): string {
			return "SELECT orders.*, pages.suid AS gallery_suid FROM orders
				LEFT JOIN pages ON pages.id = orders.gallery_id";
		}

		public static function get (string $suid): ?array {
			$query = Database::connection()->prepare(self::orderQuery() . " WHERE orders.suid = ?");
			$query->execute(array($suid));
			$order = $query->fetch();
			return $order ? self::project($order) : null;
		}

		public static function items (string $suid): array {
			$sql = "SELECT items.public_key, items.item_type, items.selection_snapshot_json
				FROM order_items AS items JOIN orders ON orders.id = items.order_id
				WHERE orders.suid = ? ORDER BY items.position, items.id";
			$query = Database::connection()->prepare($sql);
			$query->execute(array($suid));
			$rows = array();
			foreach ($query as $item) {
				$type = "cart";
				if ($item["item_type"]==="download") $type = "download";
				if ($item["item_type"]==="favorite") $type = "favorites";
				if (in_array($item["item_type"], array("package", "product"), true)) $type = "package";
				$row = Proofing::snapshotRow($type, $item["public_key"], $item["selection_snapshot_json"]);
				$rows[$row[0]] = $row;
			}
			return $rows;
		}

		public static function log (string $suid, string $body): void {
			Database::transaction(function (PDO $db) use ($suid, $body): void {
				$db->prepare("INSERT INTO payment_logs (order_suid, body, created_at) VALUES (?, ?, ?)")
					->execute(array($suid, $body, time()));
			});
		}

		public static function getLog (string $suid): ?string {
			$query = Database::connection()->prepare("SELECT body FROM payment_logs WHERE order_suid = ? ORDER BY id");
			$query->execute(array($suid));
			$parts = $query->fetchAll(PDO::FETCH_COLUMN);
			return $parts ? implode("", $parts) : null;
		}

		private static function cartSubtotal (array $items): int {
			$subtotal = 0;
			foreach ($items as $item) {
				$unit = (int) $item["quoted_unit_minor"];
				$subtotal += in_array($item["item_type"], array("download", "package", "product"), true)
					? $unit : $unit * (int) $item["quantity"];
			}
			return $subtotal;
		}

		public static function validateBeforePayment (string $gallery, string $session, array $row): void {
			$db = Database::connection();
			if (!preg_match('/^[a-f0-9]{1,16}$/i', (string) ($row[0] ?? ""))) {
				throw new InvalidArgumentException("Invalid order identifier.");
			}
			$existing = $db->prepare("SELECT 1 FROM orders WHERE suid = ?");
			$existing->execute(array((string) ($row[0] ?? "")));
			if ($existing->fetchColumn()!==false) throw new InvalidArgumentException("Order already exists.");
			$galleryQuery = $db->prepare("SELECT galleries.page_id FROM galleries JOIN pages ON pages.id = galleries.page_id WHERE pages.suid = ?");
			$galleryQuery->execute(array($gallery));
			$galleryId = $galleryQuery->fetchColumn();
			if ($galleryId===false || (string) ($row[1] ?? "")!==$gallery) throw new InvalidArgumentException("Unknown order gallery.");
			$proofing = $db->prepare("SELECT id FROM proofing_sessions WHERE gallery_id = ? AND email_key = ?");
			$proofing->execute(array($galleryId, $session));
			$owner = $proofing->fetch();
			if (!$owner) throw new InvalidArgumentException("Unknown proofing session.");
			$cart = $db->prepare("SELECT items.item_type, items.quantity, items.quoted_unit_minor
				FROM cart_items AS items JOIN carts ON carts.id = items.cart_id WHERE carts.session_id = ?");
			$cart->execute(array($owner["id"]));
			$items = $cart->fetchAll();
			if (!$items) throw new InvalidArgumentException("Cart is empty.");
			$subtotal = self::cartSubtotal($items);
			if (abs($subtotal - self::minor((string) ($row[15] ?? "")))>1) {
				throw new InvalidArgumentException("Order subtotal differs from cart.");
			}
			$discount = self::minor((string) ($row[16] ?? "0"));
			$code = (string) ($row[6] ?? "");
			if ($discount < 0 || $discount > $subtotal || ($code==="" && $discount!==0)) {
				throw new InvalidArgumentException("Invalid order discount.");
			}
			self::reservedDiscount($db, (string) $row[0], (int) $galleryId,
				$session, $code, $discount, $subtotal);
			$total = $subtotal - $discount + self::minor((string) ($row[17] ?? "0"))
				+ self::minor((string) ($row[18] ?? "0")) + self::minor((string) ($row[19] ?? "0"));
			if (abs($total - self::minor((string) ($row[14] ?? "")))>1) {
				throw new InvalidArgumentException("Order total does not add up.");
			}
		}

		public static function create (string $gallery, string $session, array $row, string $currency): bool {
			return Database::transaction(function (PDO $db) use ($gallery, $session, $row, $currency): bool {
				$suid = (string) ($row[0] ?? "");
				if (!preg_match('/^[a-f0-9]{1,16}$/i', $suid)) throw new InvalidArgumentException("Invalid order identifier.");
				$exists = $db->prepare("SELECT id FROM orders WHERE suid = ?");
				$exists->execute(array($suid));
				if ($exists->fetchColumn()!==false) return false;
				$galleryQuery = $db->prepare("SELECT galleries.page_id FROM galleries JOIN pages ON pages.id = galleries.page_id WHERE pages.suid = ?");
				$galleryQuery->execute(array($gallery));
				$galleryId = $galleryQuery->fetchColumn();
				if ($galleryId===false || (string) ($row[1] ?? "")!==$gallery) throw new InvalidArgumentException("Unknown order gallery.");
				$sessionQuery = $db->prepare("SELECT id FROM proofing_sessions WHERE gallery_id = ? AND email_key = ?");
				$sessionQuery->execute(array($galleryId, $session));
				$proofing = $sessionQuery->fetch();
				if (!$proofing) throw new InvalidArgumentException("Unknown proofing session.");
				$cartQuery = $db->prepare("SELECT items.* FROM cart_items AS items
					JOIN carts ON carts.id = items.cart_id WHERE carts.session_id = ? ORDER BY items.position, items.id");
				$cartQuery->execute(array($proofing["id"]));
				$items = $cartQuery->fetchAll();
				if (!$items) throw new InvalidArgumentException("Cart is empty.");
				$subtotal = self::cartSubtotal($items);
				$postedSubtotal = self::minor((string) ($row[15] ?? ""));
				if (abs($subtotal - $postedSubtotal)>1) throw new InvalidArgumentException("Order subtotal differs from cart.");
				$total = self::minor((string) ($row[14] ?? ""));
				$discount = self::minor((string) ($row[16] ?? "0"));
				if ($discount < 0 || $discount > $subtotal) throw new InvalidArgumentException("Invalid order discount.");
				if ((string) ($row[6] ?? "")==="" && $discount!==0) {
					throw new InvalidArgumentException("Order discount has no code.");
				}
				$shipping = self::minor((string) ($row[17] ?? "0"));
				$handling = self::minor((string) ($row[18] ?? "0"));
				$tax = self::minor((string) ($row[19] ?? "0"));
				if (abs($total - ($subtotal - $discount + $shipping + $handling + $tax))>1) {
					throw new InvalidArgumentException("Order total does not add up.");
				}
				$amountText = array("total" => (string) $row[14], "subtotal" => (string) $row[15],
					"discount" => (string) $row[16], "shipping" => (string) $row[17],
					"handling" => (string) $row[18], "tax" => (string) $row[19]);
				$now = time();
				$placedAtMs = (int) ($row[2] ?? ($now * 1000));
				$sql = "INSERT INTO orders (suid, gallery_id, proofing_session_id, placed_at, placed_at_ms,
					status, currency, customer_name, email, phone, shipping_address_json, shipping_method,
					comments, subtotal_minor, discount_minor, shipping_minor, handling_minor, tax_minor,
					total_minor, pricing_snapshot_json, payment_type, transaction_reference, discount_code,
					country_code, postal_code, subdivision_code, tax_rate_text, prices_include_tax,
					shipping_taxable, handling_taxable)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
				$db->prepare($sql)->execute(array(
					$suid, $galleryId, $proofing["id"], $now, $placedAtMs,
					"placed", $currency, (string) ($row[7] ?? ""), (string) $row[8], (string) ($row[9] ?? ""),
					json_encode(array("text" => (string) ($row[10] ?? "")), JSON_THROW_ON_ERROR),
					(string) ($row[5] ?? ""), (string) ($row[24] ?? ""), $subtotal, $discount,
					$shipping, $handling, $tax, $total,
					json_encode(array("amount_text" => $amountText), JSON_THROW_ON_ERROR),
					(string) ($row[3] ?? ""), (string) ($row[4] ?? ""), (string) ($row[6] ?? ""),
					(string) ($row[11] ?? ""), (string) ($row[12] ?? ""), (string) ($row[13] ?? ""),
					(string) ($row[20] ?? ""), (string) ($row[21] ?? ""), (string) ($row[22] ?? ""),
					(string) ($row[23] ?? "")
				));
				$orderId = (int) $db->lastInsertId();
				$insert = $db->prepare("INSERT INTO order_items (order_id, source_cart_item_id, item_type,
					image_asset_id, description, quantity, unit_minor, shipping_minor,
					selection_snapshot_json, position, public_key)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
				$orderItemIds = array();
				foreach ($items as $position => $item) {
					$values = json_decode($item["selection_json"], true);
					$assetId = null;
					if ($item["image_id"]!==null) {
						$asset = $db->prepare("SELECT asset_id FROM gallery_images WHERE id = ?");
						$asset->execute(array($item["image_id"]));
						$assetId = $asset->fetchColumn();
					}
					$description = (string) ($values["title"] ?? $values["filename"] ?? "");
					$insert->execute(array($orderId, $item["id"], $item["item_type"], $assetId,
						$description, $item["quantity"], $item["quoted_unit_minor"],
						$item["quoted_shipping_minor"], $item["selection_json"], $position, $item["public_key"]));
					$orderItemIds[$item["id"]] = (int) $db->lastInsertId();
				}
				$parentLink = $db->prepare("UPDATE order_items SET parent_item_id = ? WHERE id = ?");
				foreach ($items as $item) {
					$parentId = $item["parent_item_id"];
					if ($parentId===null || !isset($orderItemIds[$parentId])) continue;
					$parentLink->execute(array($orderItemIds[$parentId], $orderItemIds[$item["id"]]));
				}
				$favorites = $db->prepare("SELECT favorites.public_key, favorites.selection_json, images.asset_id
					FROM favorites JOIN gallery_images AS images ON images.id = favorites.image_id
					WHERE favorites.session_id = ? ORDER BY favorites.position, favorites.id");
				$favorites->execute(array($proofing["id"]));
				$position = count($items);
				foreach ($favorites as $favorite) {
					$values = json_decode($favorite["selection_json"], true);
					$insert->execute(array($orderId, null, "favorite", $favorite["asset_id"],
						(string) ($values["filename"] ?? ""), 1, 0, 0,
						$favorite["selection_json"], $position++, $favorite["public_key"]));
				}
				$code = (string) ($row[6] ?? "");
				self::redeemDiscount($db, $suid, (int) $galleryId, $session,
					$code, $orderId, $discount, $subtotal);
				$provider = (string) ($row[3] ?? "offline");
				$reference = (string) ($row[4] ?? "");
				$status = $provider==="offline" ? "pending" : "succeeded";
				$db->prepare("INSERT INTO payments (order_id, provider, provider_reference, amount_minor,
					currency, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
					->execute(array($orderId, $provider, $reference==="" ? null : $reference,
						$total, $currency, $status, $now, $now));
				$db->prepare("DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE session_id = ?)")
					->execute(array($proofing["id"]));
				return true;
			});
		}

		/** Claim a discount before payment. A changed quote gets a new order ID and leaves the old claim counted. */
		public static function prequalify (string $gallery, string $session, string $requestedId,
			string $code, string $subtotalText): string {
			return Database::transaction(function (PDO $db) use ($gallery, $session, $requestedId, $code, $subtotalText): string {
				$subtotal = self::minor($subtotalText);
				if ($subtotal<0) throw new InvalidArgumentException("Invalid order subtotal.");
				$galleryQuery = $db->prepare("SELECT galleries.page_id FROM galleries
					JOIN pages ON pages.id = galleries.page_id WHERE pages.suid = ?");
				$galleryQuery->execute(array($gallery));
				$galleryId = $galleryQuery->fetchColumn();
				if ($galleryId===false) throw new InvalidArgumentException("Unknown order gallery.");
				$sessionQuery = $db->prepare("SELECT id FROM proofing_sessions WHERE gallery_id = ? AND email_key = ?");
				$sessionQuery->execute(array($galleryId, $session));
				$sessionId = $sessionQuery->fetchColumn();
				if ($sessionId===false) throw new InvalidArgumentException("Unknown proofing session.");
				$cartQuery = $db->prepare("SELECT items.item_type, items.quantity, items.quoted_unit_minor
					FROM cart_items AS items JOIN carts ON carts.id = items.cart_id WHERE carts.session_id = ?");
				$cartQuery->execute(array($sessionId));
				$items = $cartQuery->fetchAll();
				if (!$items) throw new InvalidArgumentException("Cart is empty.");
				if (abs(self::cartSubtotal($items) - $subtotal)>1) {
					throw new InvalidArgumentException("Order subtotal differs from cart.");
				}
				if ($requestedId!=="" && !preg_match('/^[a-f0-9]{1,16}$/i', $requestedId)) {
					throw new InvalidArgumentException("Invalid order identifier.");
				}
				$orderId = $requestedId!=="" ? $requestedId : Database::allocateSuid();
				$existingOrder = $db->prepare("SELECT 1 FROM orders WHERE suid = ?");
				$existingOrder->execute(array($orderId));
				if ($existingOrder->fetchColumn()!==false) throw new InvalidArgumentException("Order already exists.");
				$reservationQuery = $db->prepare("SELECT * FROM discount_reservations WHERE order_suid = ?");
				$reservationQuery->execute(array($orderId));
				$reservation = $reservationQuery->fetch();
				if ($reservation) {
					$sameQuote = (int) $reservation["gallery_id"]===(int) $galleryId
						&& $reservation["session_key"]===$session
						&& $reservation["code"]===$code
						&& (int) $reservation["subtotal_minor"]===$subtotal;
					if ($sameQuote) return $orderId;
					$orderId = Database::allocateSuid();
				}
				if ($code==="") return $orderId;
				$quote = self::discountQuote($db, (int) $galleryId, $code, $subtotal);
				$db->prepare("UPDATE discounts SET use_count = use_count + 1 WHERE id = ?")
					->execute(array($quote["id"]));
				$db->prepare("INSERT INTO discount_reservations
					(order_suid, discount_id, gallery_id, session_key, code, subtotal_minor, discount_minor, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
					->execute(array($orderId, $quote["id"], $galleryId, $session, $code,
						$subtotal, $quote["amount"], time()));
				return $orderId;
			});
		}

		/** The storefront's discount row and prequalification use the same eligibility rules. */
		public static function verifyDiscountCode (string $gallery, string $code, string $subtotalText): array {
			try {
				$subtotal = self::minor($subtotalText);
				$db = Database::connection();
				$galleryQuery = $db->prepare("SELECT galleries.page_id FROM galleries
					JOIN pages ON pages.id = galleries.page_id WHERE pages.suid = ?");
				$galleryQuery->execute(array($gallery));
				$galleryId = $galleryQuery->fetchColumn();
				if ($galleryId===false) return array(false, "discount_does_not_exist");
				$quote = self::discountQuote($db, (int) $galleryId, $code, $subtotal);
				return array(true, implode("\t", $quote["row"]));
			} catch (InvalidArgumentException $error) {
				$key = $error->getMessage();
				return array(false, str_starts_with($key, "discount_") ? $key : "discount_does_not_exist");
			}
		}

		private static function discountExpired (?int $expiresAt): bool {
			if ($expiresAt===null || $expiresAt<=0) return false;
			$setup = Flatfile::getXmlArray("setup");
			$setting = (string) $setup->getNodeVal("data.settings.local_timezone");
			$timezoneName = explode(",", $setting, 2)[1] ?? "UTC";
			$timezone = new DateTimeZone($timezoneName);
			$enteredDate = gmdate("Y-m-d H:i:s", (int) ($expiresAt / 1000));
			$localExpiry = new DateTimeImmutable($enteredDate, $timezone);
			return $localExpiry->getTimestamp() < time();
		}

		private static function discountQuote (PDO $db, int $galleryId, string $code, int $subtotal): array {
			$query = $db->prepare("SELECT discounts.*, pages.suid AS gallery_suid FROM discounts
				LEFT JOIN pages ON pages.id = discounts.gallery_id
				WHERE discounts.code = ? AND discounts.active = 1
					AND (discounts.gallery_id = ? OR discounts.gallery_id IS NULL)
				ORDER BY discounts.gallery_id IS NULL, discounts.id LIMIT 1");
			$query->execute(array($code, $galleryId));
			$record = $query->fetch();
			if (!$record) throw new InvalidArgumentException("discount_does_not_exist");
			if (self::discountExpired($record["expires_at"]===null ? null : (int) $record["expires_at"])) {
				throw new InvalidArgumentException("discount_expired");
			}
			if ($record["max_uses"]!==null && $record["max_uses"]>0 && $record["use_count"] >= $record["max_uses"]) {
				throw new InvalidArgumentException("discount_maximum_uses_filled");
			}
			if (self::minor((string) $record["minimum_text"]) > $subtotal) {
				throw new InvalidArgumentException("discount_cart_minimum_not_fulfilled");
			}
			$amount = $record["kind"]==="percentage"
				? (int) round($subtotal * (float) $record["value_text"] / 100)
				: self::minor((string) $record["value_text"]);
			$row = array(
				$record["suid"], $record["gallery_suid"] ?? "", $record["code"],
				$record["value_text"], $record["kind"], (string) $record["use_count"],
				$record["max_uses"]===null ? "" : (string) $record["max_uses"],
				$record["expires_at"]===null ? "" : (string) $record["expires_at"],
				$record["minimum_text"], (string) $record["free_shipping"]
			);
			return array("id" => (int) $record["id"], "amount" => max(0, min($subtotal, $amount)), "row" => $row);
		}

		private static function reservedDiscount (PDO $db, string $orderSuid, int $galleryId,
			string $session, string $code, int $discount, int $subtotal): ?int {
			$query = $db->prepare("SELECT * FROM discount_reservations WHERE order_suid = ?");
			$query->execute(array($orderSuid));
			$reservation = $query->fetch();
			if ($code==="" && !$reservation) return null;
			if (!$reservation || (int) $reservation["gallery_id"]!==$galleryId
				|| $reservation["session_key"]!==$session || $reservation["code"]!==$code
				|| (int) $reservation["subtotal_minor"]!==$subtotal
				|| abs((int) $reservation["discount_minor"] - $discount)>1) {
				throw new InvalidArgumentException("Order discount was not reserved.");
			}
			return (int) $reservation["discount_id"];
		}

		private static function redeemDiscount (PDO $db, string $orderSuid, int $galleryId,
			string $session, string $code, int $orderId, int $discount, int $subtotal): void {
			$discountId = self::reservedDiscount($db, $orderSuid, $galleryId,
				$session, $code, $discount, $subtotal);
			if ($discountId===null) return;
			$db->prepare("INSERT INTO discount_redemptions (discount_id, order_id, amount_minor, created_at)
				VALUES (?, ?, ?, ?)")->execute(array($discountId, $orderId, $discount, time()));
			$db->prepare("DELETE FROM discount_reservations WHERE order_suid = ?")->execute(array($orderSuid));
		}

		public static function delete (string $suid): void {
			Database::transaction(function (PDO $db) use ($suid): void {
				$query = $db->prepare("SELECT id FROM orders WHERE suid = ?");
				$query->execute(array($suid));
				$id = $query->fetchColumn();
				if ($id===false) return;
				$db->prepare("UPDATE discounts SET use_count = MAX(0, use_count - 1)
					WHERE id IN (SELECT discount_id FROM discount_redemptions WHERE order_id = ?)")
					->execute(array($id));
				$db->prepare("DELETE FROM discount_redemptions WHERE order_id = ?")->execute(array($id));
				$db->prepare("DELETE FROM payment_events WHERE payment_id IN (SELECT id FROM payments WHERE order_id = ?)")
					->execute(array($id));
				$db->prepare("DELETE FROM payments WHERE order_id = ?")->execute(array($id));
				$db->prepare("DELETE FROM fulfillment_items WHERE fulfillment_id IN (SELECT id FROM fulfillments WHERE order_id = ?)")
					->execute(array($id));
				$db->prepare("DELETE FROM fulfillments WHERE order_id = ?")->execute(array($id));
				$db->prepare("UPDATE order_items SET parent_item_id = NULL WHERE order_id = ?")->execute(array($id));
				$db->prepare("DELETE FROM order_items WHERE order_id = ?")->execute(array($id));
				$db->prepare("DELETE FROM orders WHERE id = ?")->execute(array($id));
				$db->prepare("DELETE FROM payment_logs WHERE order_suid = ?")->execute(array($suid));
			});
		}

		public static function search (string $start, string $end, array $params): string {
			$from = strtotime(str_replace("/", "-", $start) . " 00:00:00");
			$to = strtotime(str_replace("/", "-", $end) . " 23:59:59");
			if ($from===false || $to===false) return "";
			$query = Database::connection()->prepare(self::orderQuery() . " WHERE placed_at BETWEEN ? AND ? ORDER BY placed_at, orders.id");
			$query->execute(array($from, $to));
			$lines = array();
			foreach ($query as $record) {
				$row = self::project($record);
				if ($params) {
					$matches = false;
					if (isset($params["payment_type"]) && $row[3]===$params["payment_type"]) $matches = true;
					if (isset($params["orderid"]) && $row[0]===$params["orderid"]) $matches = true;
					if (isset($params["setid"]) && $row[1]===$params["setid"]) $matches = true;
					if (isset($params["full_name"]) && stripos($row[7], $params["full_name"])!==false) $matches = true;
					if (isset($params["email_address"]) && stripos($row[8], $params["email_address"])!==false) $matches = true;
					if (!$matches) continue;
				}
				$lines[] = implode("\t", $row);
			}
			return implode("\n", $lines);
		}

		public static function stats (string $start, string $end): string {
			$first = DateTimeImmutable::createFromFormat("!Y/n/j", $start);
			$last = DateTimeImmutable::createFromFormat("!Y/n/j", $end);
			if (!$first || !$last || $first > $last) return "";
			$lines = array();
			for ($day = $first; $day <= $last; $day = $day->modify("+1 day")) {
				$date = $day->format("Y/n/j");
				$matches = self::search($date, $date, array());
				if ($matches==="") {
					$lines[] = implode("\t", array($date, "", "0", "0", "0", "0", "0", "0"));
					continue;
				}
				foreach (explode("\n", $matches) as $line) {
					$row = explode("\t", $line);
					$region = trim($row[11] . "-" . $row[13], "-");
					$lines[] = implode("\t", array($date, $region, $row[14], $row[15], $row[16],
						$row[17], $row[18], $row[19]));
				}
			}
			return implode("\n", $lines);
		}
	}
