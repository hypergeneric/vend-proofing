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
			$query = Database::connection()->prepare(self::orderQuery() . " WHERE orders.suid = ? AND orders.status <> 'checkout'");
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

		public static function validateBeforePayment (string $gallery, string $session, array $row): void {
			CheckoutQuote::verify($gallery, $session, $row);
		}

		public static function create (string $gallery, string $session, array $row, string $currency, string $funding="paypal"): bool {
			return Database::transaction(function (PDO $db) use ($gallery, $session, $row, $currency, $funding): bool {
				$suid = (string) ($row[0] ?? "");
				if (!preg_match('/^[a-f0-9]{1,16}$/i', $suid)) throw new InvalidArgumentException("Invalid order identifier.");
				$provider = (string) ($row[3] ?? "offline");
				if (!in_array($provider, array("offline", "stripe", "paypal"), true)) throw new InvalidArgumentException("invalid_order");
				if (!in_array($funding, array("paypal", "venmo"), true) || ($funding==="venmo" && $provider!=="paypal")) throw new InvalidArgumentException("invalid_order");
				$row[4] = "";
				$row[2] = "0";
				$submissionHash = hash("sha256", json_encode(array($gallery, $session, $row, $funding), JSON_THROW_ON_ERROR));
				$exists = $db->prepare("SELECT orders.id, orders.submission_hash, sessions.email_key FROM orders
					JOIN proofing_sessions AS sessions ON sessions.id = orders.proofing_session_id WHERE orders.suid = ?");
				$exists->execute(array($suid));
				$existing = $exists->fetch();
				if ($existing) {
					if ($existing["email_key"]!==$session || $existing["submission_hash"]!==$submissionHash) throw new InvalidArgumentException("invalid_order");
					return false;
				}
				if ($provider!=="offline" && !PaymentSettings::configured($provider)) throw new InvalidArgumentException("payment_unavailable");
				$sessionQuery = $db->prepare("SELECT sessions.id, sessions.gallery_id, carts.checkout_suid FROM proofing_sessions AS sessions
					JOIN pages ON pages.id = sessions.gallery_id JOIN carts ON carts.session_id = sessions.id
					WHERE pages.suid = ? AND sessions.email_key = ?");
				$sessionQuery->execute(array($gallery, $session));
				$proofing = $sessionQuery->fetch();
				if (!$proofing || $proofing["checkout_suid"]!==$suid || ($row[1] ?? "")!==$gallery) throw new InvalidArgumentException("invalid_order");
				$galleryId = (int) $proofing["gallery_id"];
				$quote = CheckoutQuote::verify($gallery, $session, $row);
				$row = $quote["row"];
				$currency = $quote["currency"];
				if ($funding==="venmo" && ($currency!=="USD" || $row[11]!=="US")) throw new InvalidArgumentException("payment_unavailable");
				$items = $quote["items"];
				if ($provider!=="offline" && self::minor($row[14])===0) throw new InvalidArgumentException("invalid_order");
				$subtotal = self::minor($row[15]);
				$total = self::minor($row[14]);
				$discount = self::minor($row[16]);
				$shipping = self::minor($row[17]);
				$handling = self::minor($row[18]);
				$tax = self::minor($row[19]);
				if ($provider==="offline" && $total>0 && (!CheckoutQuote::enabled("allow_offline_payment_bool") || $quote["digital"]>0)) throw new InvalidArgumentException("payment_unavailable");
				$amountText = array("total" => $row[14], "subtotal" => $row[15], "discount" => $row[16],
					"shipping" => $row[17], "handling" => $row[18], "tax" => $row[19]);
				$now = time();
				$placedAtMs = $now * 1000;
				$sql = "INSERT INTO orders (suid, gallery_id, proofing_session_id, placed_at, placed_at_ms,
					status, currency, customer_name, email, phone, shipping_address_json, shipping_method,
					comments, subtotal_minor, discount_minor, shipping_minor, handling_minor, tax_minor,
					total_minor, pricing_snapshot_json, payment_type, transaction_reference, discount_code,
					country_code, postal_code, subdivision_code, tax_rate_text, prices_include_tax,
					shipping_taxable, handling_taxable)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
				$db->prepare($sql)->execute(array(
					$suid, $galleryId, $proofing["id"], $now, $placedAtMs,
					"checkout", $currency, (string) ($row[7] ?? ""), (string) $row[8], (string) ($row[9] ?? ""),
					json_encode(array("text" => (string) ($row[10] ?? "")), JSON_THROW_ON_ERROR),
					(string) ($row[5] ?? ""), (string) ($row[24] ?? ""), $subtotal, $discount,
					$shipping, $handling, $tax, $total,
					json_encode(array("funding" => $funding, "amount_text" => $amountText, "rules" => $quote["rules"], "checkout_rules" => $quote["checkout_rules"], "currency" => $currency), JSON_THROW_ON_ERROR),
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
						$description, $item["quantity"], CheckoutQuote::cents($quote["amounts"][$item["id"]][0]),
						CheckoutQuote::cents($quote["amounts"][$item["id"]][1]), $item["selection_json"], $position, $item["public_key"]));
					$orderItemIds[$item["id"]] = (int) $db->lastInsertId();
					$rules = $quote["rules"][$item["public_key"]];
					if ($item["item_type"]==="download") $rules["download_source"] = Downloads::snapshot($gallery, (int) $assetId, $values["quality"]);
					$db->prepare("UPDATE order_items SET formula_snapshot_json = ? WHERE id = ?")
						->execute(array(json_encode($rules, JSON_THROW_ON_ERROR), $orderItemIds[$item["id"]]));
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
				self::reservedDiscount($db, $suid, (int) $galleryId, $session, $code, $discount, $subtotal);
				$db->prepare("UPDATE orders SET submission_hash = ?, access_token = ? WHERE id = ?")
					->execute(array($submissionHash, bin2hex(random_bytes(32)), $orderId));
				$db->prepare("INSERT INTO payments (order_id, provider, idempotency_key, amount_minor,
					currency, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)")
					->execute(array($orderId, $provider, bin2hex(random_bytes(24)), $total, $currency, $now, $now));
				$db->prepare("UPDATE payments SET provider_mode = ? WHERE order_id = ?")
					->execute(array($provider==="offline" ? "test" : PaymentSettings::mode($provider), $orderId));
				if ($provider==="offline") {
					self::place($db, $orderId);
					$payment = Payments::get($suid);
					if ($total===0) Payments::reconcile($suid, "offline", "", "", 0, $currency, "paid", "free:" . $suid, "free_order");
					else Payments::ready($db, $payment);
				}
				return true;
			});
		}

		/** Convert private checkout details into an order, once, after verified payment or manual submission. */
		public static function place (PDO $db, int $orderId): void {
			$query = $db->prepare("SELECT orders.*, sessions.email_key FROM orders
				LEFT JOIN proofing_sessions AS sessions ON sessions.id = orders.proofing_session_id WHERE orders.id = ?");
			$query->execute(array($orderId));
			$order = $query->fetch();
			if (!$order || $order["status"]!=="checkout") return;
			$db->prepare("UPDATE orders SET status = 'placed', placed_at = ?, placed_at_ms = ? WHERE id = ?")
				->execute(array(time(), time() * 1000, $orderId));
			self::redeemDiscount($db, $order["suid"], (int) $order["gallery_id"], (string) $order["email_key"],
				$order["discount_code"], $orderId, (int) $order["discount_minor"], (int) $order["subtotal_minor"]);

			// Remove purchased selections only. Keep additions and edits made in another tab.
			$query = $db->prepare("SELECT cart_items.* FROM cart_items JOIN carts ON carts.id = cart_items.cart_id WHERE carts.session_id = ?");
			$query->execute(array($order["proofing_session_id"]));
			$cart = $query->fetchAll();
			$query = $db->prepare("SELECT source_cart_item_id, selection_snapshot_json FROM order_items WHERE order_id = ?");
			$query->execute(array($orderId));
			$purchased = $query->fetchAll(PDO::FETCH_KEY_PAIR);
			$remove = array();
			foreach ($cart as $item) {
				if (($purchased[$item["id"]] ?? null)===$item["selection_json"]) $remove[$item["id"]] = true;
			}
			// Packages and their allocations must stay together if any part was edited.
			foreach ($cart as $item) {
				if ($item["parent_item_id"]!==null && !isset($remove[$item["id"]])) unset($remove[$item["parent_item_id"]]);
			}
			foreach ($cart as $item) {
				if ($item["parent_item_id"]!==null && !isset($remove[$item["parent_item_id"]])) unset($remove[$item["id"]]);
			}
			$delete = $db->prepare("DELETE FROM cart_items WHERE id = ?");
			foreach (array_keys($remove) as $id) $delete->execute(array($id));
			$db->prepare("UPDATE carts SET checkout_hash = NULL, checkout_suid = NULL WHERE checkout_suid = ?")
				->execute(array($order["suid"]));
		}

		/** Claim a discount before payment. A changed quote gets a new order ID and leaves the old claim counted. */
		public static function prequalify (string $gallery, string $session, string $requestedId,
			string $code, string $subtotalText, string $details=""): string {
			return Database::transaction(function (PDO $db) use ($gallery, $session, $requestedId, $code, $subtotalText, $details): string {
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
				$cart = $db->prepare("SELECT * FROM carts WHERE session_id = ?");
				$cart->execute(array($sessionId));
				$cartRecord = $cart->fetch();

				$quote = CheckoutQuote::cart($gallery, $session);
				if (CheckoutQuote::cents($quote["subtotal"])!==$subtotal) throw new InvalidArgumentException("Order subtotal differs from cart.");
				$code = strtoupper(trim($code));
				if ($code!=="" && !CheckoutQuote::enabled("allow_discount_codes_bool")) throw new InvalidArgumentException("invalid_order");
				$fingerprint = hash("sha256", json_encode(array($quote["items"], $quote["rules"], $code, $details), JSON_THROW_ON_ERROR));
				$orderId = $cartRecord && $cartRecord["checkout_hash"]===$fingerprint
					? $cartRecord["checkout_suid"] : Database::allocateSuid();
				$db->prepare("UPDATE carts SET checkout_hash = ?, checkout_suid = ? WHERE session_id = ?")
					->execute(array($fingerprint, $orderId, $sessionId));
				$reservationQuery = $db->prepare("SELECT * FROM discount_reservations WHERE order_suid = ?");
				$reservationQuery->execute(array($orderId));
				$reservation = $reservationQuery->fetch();
				if ($reservation) {
					$sameQuote = (int) $reservation["gallery_id"]===(int) $galleryId
						&& $reservation["session_key"]===$session
						&& strcasecmp($reservation["code"], $code)===0
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
			$setup = Configuration::getDocument("setup");
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
				WHERE discounts.code = ? COLLATE NOCASE AND discounts.active = 1
					AND (discounts.gallery_id = ? OR discounts.gallery_id IS NULL)
				ORDER BY discounts.gallery_id IS NULL, discounts.id LIMIT 1");
			$query->execute(array(trim($code), $galleryId));
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
				|| $reservation["session_key"]!==$session || strcasecmp($reservation["code"], $code)!==0
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
			Downloads::delete($suid);
			$query = Database::connection()->prepare("SELECT DISTINCT image_asset_id FROM order_items JOIN orders ON orders.id = order_items.order_id WHERE orders.suid = ? AND image_asset_id IS NOT NULL");
			$query->execute(array($suid));
			$assets = $query->fetchAll(PDO::FETCH_COLUMN);
			Database::transaction(function (PDO $db) use ($suid): void {
				$query = $db->prepare("SELECT id FROM orders WHERE suid = ?");
				$query->execute(array($suid));
				$id = $query->fetchColumn();
				if ($id===false) return;
				$payment = Payments::get($suid);
				if ($payment["provider"]!=="offline") {
					$db->prepare("UPDATE orders SET status = 'archived' WHERE id = ?")->execute(array($id));
					return;
				}
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
			MediaFiles::releasePurchased($assets);
		}

		public static function search (string $start, string $end, array $params): string {
			$from = strtotime(str_replace("/", "-", $start) . " 00:00:00");
			$to = strtotime(str_replace("/", "-", $end) . " 23:59:59");
			if ($from===false || $to===false) return "";
			$query = Database::connection()->prepare(self::orderQuery() . " WHERE orders.status NOT IN ('archived', 'checkout') AND placed_at BETWEEN ? AND ? ORDER BY placed_at, orders.id");
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
				$payment = Payments::get($row[0]);
				$lines[] = implode("\t", array_merge($row, array($payment["status"], $payment["error_code"], (string) $payment["refunded_minor"])));
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
