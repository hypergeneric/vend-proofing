<?php

	/** Shared persistence/completion for provider-verified payments. No catalog calculations here. */
	class Payments {
		public static function get (string $suid): array {
			$query = Database::connection()->prepare("SELECT payments.*, orders.suid, orders.total_minor, orders.email,
				orders.access_token, orders.proofing_session_id FROM payments JOIN orders ON orders.id = payments.order_id WHERE orders.suid = ? ORDER BY payments.id DESC LIMIT 1");
			$query->execute(array($suid));
			$result = $query->fetch();
			if (!$result) throw new InvalidArgumentException("invalid_order");
			return $result;
		}

		/** Only terminal, independently confirmed unpaid attempts may be replaced. */
		public static function retry (array $attempt): array {
			return Database::transaction(function (PDO $db) use ($attempt): array {
				$current = self::get($attempt["suid"]);
				if ($current["id"]!==$attempt["id"]) return $current;
				if (!in_array($current["status"], array("cancelled", "failed"), true)) throw new InvalidArgumentException("invalid_payment");
				$db->prepare("INSERT INTO payments (order_id, provider, provider_mode, idempotency_key, amount_minor, currency, status, created_at, updated_at)
					VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)")->execute(array($current["order_id"], $current["provider"], $current["provider_mode"],
						bin2hex(random_bytes(24)), $current["amount_minor"], $current["currency"], time(), time()));
				return self::get($attempt["suid"]);
			});
		}

		public static function authorize (string $suid, string $token): array {
			$payment = self::get($suid);
			if ($token==="" || !hash_equals((string) $payment["access_token"], $token)) throw new InvalidArgumentException("invalid_order");
			return $payment;
		}

		public static function attach (string $suid, string $providerId): void {
			if ($providerId==="") throw new InvalidArgumentException("invalid_payment");
			Database::transaction(function (PDO $db) use ($suid, $providerId): void {
				$payment = self::get($suid);
				if ($payment["provider_reference"]!==null && $payment["provider_reference"]!==$providerId) throw new InvalidArgumentException("invalid_payment");
				$db->prepare("UPDATE payments SET provider_reference = ?, updated_at = ? WHERE id = ?")
					->execute(array($providerId, time(), $payment["id"]));
			});
		}

		/** Called only after signature/API verification by a provider adapter, or a server-known free order. */
		public static function reconcile (string $suid, string $provider, string $providerId, string $transaction,
			int $amount, string $currency, string $status, string $eventId, string $eventType, int $refunded=0): bool {
			return Database::transaction(function (PDO $db) use ($suid, $provider, $providerId, $transaction, $amount, $currency, $status, $eventId, $eventType, $refunded): bool {
				$payment = self::get($suid);
				if (!in_array($status, array("pending", "paid", "failed", "cancelled", "refunded"), true)
					|| $payment["provider"]!==$provider || (string) $payment["provider_reference"]!==$providerId
					|| (int) $payment["amount_minor"]!==$amount || $payment["currency"]!==strtoupper($currency)
					|| ($payment["transaction_id"] && $transaction!=="" && $payment["transaction_id"]!==$transaction)
					|| ($status==="paid" && $transaction==="" && $amount!==0)
					|| $refunded<0 || $refunded>$amount) throw new InvalidArgumentException("invalid_payment");
				$eventKey = $provider . ":" . $payment["provider_mode"] . ":" . $eventId;
				$event = $db->prepare("SELECT 1 FROM payment_events WHERE provider_event_id = ?");
				$event->execute(array($eventKey));
				if ($event->fetchColumn()!==false) return false;
				$db->prepare("INSERT INTO payment_events (payment_id, provider_event_id, event_type, received_at) VALUES (?, ?, ?, ?)")
					->execute(array($payment["id"], $eventKey, $eventType, time()));
				$old = $payment["status"];
				if ($old==="refunded" || ($old==="paid" && !in_array($status, array("paid", "refunded"), true))) return false;
				if ($status==="refunded" && $refunded!==$amount) throw new InvalidArgumentException("invalid_payment");
				$db->prepare("UPDATE payments SET status = ?, transaction_id = COALESCE(NULLIF(?, ''), transaction_id),
					refunded_minor = MAX(refunded_minor, ?), error_code = '', updated_at = ? WHERE id = ?")
					->execute(array($status, $transaction, $refunded, time(), $payment["id"]));
				if ($transaction!=="") $db->prepare("UPDATE orders SET transaction_reference = ? WHERE id = ?")->execute(array($transaction, $payment["order_id"]));
				if ($status==="refunded") $db->prepare("UPDATE fulfillments SET status = 'revoked' WHERE order_id = ? AND method = 'digital'")->execute(array($payment["order_id"]));
				if ($status==="paid" && $old!=="paid") self::ready($db, $payment);
				return $old!==$status;
			});
		}

		public static function ready (PDO $db, array $payment): void {
			$db->prepare("INSERT OR IGNORE INTO fulfillments (order_id, status, method, created_at)
				SELECT ?, 'ready', 'digital', ? WHERE EXISTS (SELECT 1 FROM order_items WHERE order_id = ? AND item_type = 'download')")
				->execute(array($payment["order_id"], time(), $payment["order_id"]));
			foreach (array("customer_receipt", "owner_receipt") as $purpose) {
				$db->prepare("INSERT OR IGNORE INTO messages (order_id, recipient, subject, body, kind, delivery_status, created_at, purpose)
					VALUES (?, ?, '', '', 'order', 'queued', ?, ?)")->execute(array($payment["order_id"], $payment["email"], time(), $purpose));
			}
		}

		public static function refund (string $suid, string $provider, string $transaction, string $refundId, int $amount, string $currency): void {
			Database::transaction(function (PDO $db) use ($suid, $provider, $transaction, $refundId, $amount, $currency): void {
				$payment = self::get($suid);
				if ($payment["provider"]!==$provider || $payment["transaction_id"]!==$transaction || $payment["currency"]!==$currency
					|| !in_array($payment["status"], array("paid", "refunded"), true) || $amount<=0 || $amount>(int) $payment["amount_minor"]) throw new InvalidArgumentException("invalid_payment");
				$key = $provider . ":" . $payment["provider_mode"] . ":refund:" . $refundId;
				$db->prepare("INSERT OR IGNORE INTO payment_events (payment_id, provider_event_id, event_type, received_at, payload_json)
					VALUES (?, ?, 'verified_refund', ?, ?)")->execute(array($payment["id"], $key, time(), json_encode(array("amount_minor" => $amount), JSON_THROW_ON_ERROR)));
				$query = $db->prepare("SELECT COALESCE(SUM(json_extract(payload_json, '$.amount_minor')), 0) FROM payment_events WHERE payment_id = ? AND event_type = 'verified_refund'");
				$query->execute(array($payment["id"]));
				$total = max((int) $payment["refunded_minor"], (int) $query->fetchColumn());
				if ($total>(int) $payment["amount_minor"]) throw new InvalidArgumentException("invalid_payment");
				$status = $total===(int) $payment["amount_minor"] ? "refunded" : "paid";
				$db->prepare("UPDATE payments SET refunded_minor = ?, status = ?, updated_at = ? WHERE id = ?")
					->execute(array($total, $status, time(), $payment["id"]));
				if ($status==="refunded") $db->prepare("UPDATE fulfillments SET status = 'revoked' WHERE order_id = ? AND method = 'digital'")->execute(array($payment["order_id"]));
			});
		}

		public static function canDownload (string $suid): bool {
			$query = Database::connection()->prepare("SELECT 1 FROM payments JOIN orders ON orders.id = payments.order_id
				JOIN fulfillments ON fulfillments.order_id = orders.id WHERE orders.suid = ? AND payments.status = 'paid'
				AND fulfillments.method = 'digital' AND fulfillments.status = 'ready'");
			$query->execute(array($suid));
			return $query->fetchColumn()!==false;
		}

		public static function summary (string $suid): string {
			$payment = self::get($suid);
			$fields = array("provider", "provider_mode", "provider_reference", "transaction_id", "amount_minor", "currency", "status", "refunded_minor", "error_code", "created_at", "updated_at");
			$summary = array_intersect_key($payment, array_flip($fields));
			$query = Database::connection()->prepare("SELECT purpose, delivery_status FROM messages WHERE order_id = ? AND purpose IS NOT NULL");
			$query->execute(array($payment["order_id"]));
			$summary["receipts"] = $query->fetchAll();
			return json_encode($summary, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR);
		}

		public static function invoiceUrl (array $payment): string {
			return Func::getPublicBaseUrl(false) . "/?/order/" . $payment["suid"] . "/invoice/" . md5($payment["email"]) . "/";
		}
	}
