<?php

	/** Orders v2 REST API. PayPal owns approval/funding UI; Vend owns prices and captures. */
	class PayPalPayment {
		public static $transport = null;
		private static array $tokens = array();

		private static function request (string $mode, string $method, string $path, ?array $body=null, string $requestId=""): array {
			$prefix = "paypal_" . $mode . "_";
			$base = $mode==="live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
			$credentials = PaymentSettings::get($prefix . "client_id") . ":" . PaymentSettings::get($prefix . "secret");
			$key = $mode . ":" . hash("sha256", $credentials);
			$token = self::$tokens[$key] ?? self::http($base . "/v1/oauth2/token", "POST", "grant_type=client_credentials", array("Content-Type: application/x-www-form-urlencoded"), $credentials);
			self::$tokens[$key] = $token;
			if (empty($token["access_token"])) throw new RuntimeException("payment_connection_failed");
			$headers = array("Content-Type: application/json", "Authorization: Bearer " . $token["access_token"], "Prefer: return=representation");
			if ($requestId!=="") $headers[] = "PayPal-Request-Id: " . $requestId;
			return self::http($base . $path, $method, $body===null ? null : ($body===array() ? "{}" : json_encode($body, JSON_THROW_ON_ERROR)), $headers);
		}

		private static function http (string $url, string $method, ?string $body, array $headers, string $basic=""): array {
			if (self::$transport) return (self::$transport)($url, $method, $body, $headers, $basic);
			$curl = curl_init($url);
			curl_setopt_array($curl, array(CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $method,
				CURLOPT_HTTPHEADER => $headers, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 30,
				CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2, CURLOPT_FOLLOWLOCATION => false));
			if ($body!==null) curl_setopt($curl, CURLOPT_POSTFIELDS, $body);
			if ($basic!=="") curl_setopt($curl, CURLOPT_USERPWD, $basic);
			$response = curl_exec($curl);
			$status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
			curl_close($curl);
			if ($response===false || $status<200 || $status>=300) throw new RuntimeException("payment_connection_failed");
			$result = json_decode($response, true, 512, JSON_THROW_ON_ERROR);
			if (!is_array($result)) throw new RuntimeException("payment_connection_failed");
			return $result;
		}

		public static function start (array $payment): string {
			if ($payment["provider_reference"]) {
				self::refresh($payment, false, "retry-check:" . bin2hex(random_bytes(12)), "retrieve");
				$current = Payments::get($payment["suid"]);
				if (in_array($current["status"], array("failed", "cancelled"), true)) return self::start(Payments::retry($current));
				return $payment["provider_reference"];
			}
			if (time() - $payment["created_at"]>5 * 3600) throw new RuntimeException("payment_requires_review");
			$unit = array("reference_id" => $payment["suid"], "custom_id" => $payment["suid"], "invoice_id" => $payment["suid"],
				"amount" => array("currency_code" => $payment["currency"], "value" => self::amount((int) $payment["amount_minor"], $payment["currency"])));
			$return = Func::getPublicBaseUrl() . "/vend-proofing-gateway.php?action=payment_return&order=" . $payment["suid"] . "&access=" . $payment["access_token"];
			$order = self::request($payment["provider_mode"], "POST", "/v2/checkout/orders", array("intent" => "CAPTURE", "purchase_units" => array($unit),
				"payment_source" => array("paypal" => array("experience_context" => array("shipping_preference" => "NO_SHIPPING", "user_action" => "PAY_NOW", "return_url" => $return, "cancel_url" => $return . "&cancel=1")))),
				substr($payment["idempotency_key"], 0, 32) . "-new");
			Payments::attach($payment["suid"], (string) ($order["id"] ?? ""));
			self::refresh(Payments::get($payment["suid"]), false, "create:" . $order["id"], "created");
			return $order["id"];
		}

		private static function amount (int $cents, string $currency): string {
			if (in_array($currency, array("HUF", "JPY", "TWD"), true)) {
				if ($cents % 100!==0) throw new InvalidArgumentException("invalid_currency_precision");
				return (string) intdiv($cents, 100);
			}
			return number_format($cents / 100, 2, ".", "");
		}

		public static function refresh (array $payment, bool $capture, string $eventId, string $eventType): array {
			$path = "/v2/checkout/orders/" . rawurlencode($payment["provider_reference"]);
			$order = self::request($payment["provider_mode"], "GET", $path);
			self::verifyOrder($payment, $order);
			if ($capture && $order["status"]==="APPROVED") {
				try {
					self::request($payment["provider_mode"], "POST", $path . "/capture", array(), substr($payment["idempotency_key"], 0, 32) . "-cap");
				} catch (RuntimeException $error) {
					// A timeout or simultaneous webhook may already have captured it. Retrieve before deciding.
				}
				$order = self::request($payment["provider_mode"], "GET", $path);
				self::verifyOrder($payment, $order);
			}
			$captures = $order["purchase_units"][0]["payments"]["captures"] ?? array();
			$status = "pending";
			$transaction = "";
			if ($captures) {
				if (count($captures)!==1) throw new InvalidArgumentException("invalid_payment");
				$record = self::request($payment["provider_mode"], "GET", "/v2/payments/captures/" . rawurlencode($captures[0]["id"]));
				if (($record["id"] ?? "")!==$captures[0]["id"]) throw new InvalidArgumentException("invalid_payment");
				if (CheckoutQuote::postedCents($record["amount"]["value"])!==(int) $payment["amount_minor"] || $record["amount"]["currency_code"]!==$payment["currency"]
					|| empty($captures[0]["final_capture"])) throw new InvalidArgumentException("invalid_payment");
				$transaction = $record["id"];
				$status = match ($record["status"]) { "COMPLETED", "PARTIALLY_REFUNDED" => "paid", "REFUNDED", "REVERSED" => "refunded", "DECLINED", "FAILED", "DENIED" => "failed", default => "pending" };
			}
			if (in_array($order["status"], array("VOIDED", "CANCELLED"), true)) $status = "cancelled";
			Payments::reconcile($payment["suid"], "paypal", $payment["provider_reference"], $transaction,
				(int) $payment["amount_minor"], $payment["currency"], $status, $eventId, $eventType,
				$status==="refunded" ? (int) $payment["amount_minor"] : 0);
			return $order;
		}

		private static function verifyOrder (array $payment, array $order): void {
			$units = $order["purchase_units"] ?? array();
			$unit = $units[0] ?? array();
			if (($order["id"] ?? "")!==$payment["provider_reference"] || ($order["intent"] ?? "")!=="CAPTURE" || count($units)!==1
				|| ($unit["custom_id"] ?? "")!==$payment["suid"] || ($unit["invoice_id"] ?? "")!==$payment["suid"]
				|| ($unit["reference_id"] ?? "")!==$payment["suid"] || ($unit["amount"]["currency_code"] ?? "")!==$payment["currency"]
				|| CheckoutQuote::postedCents($unit["amount"]["value"] ?? "")!==(int) $payment["amount_minor"]) throw new InvalidArgumentException("invalid_payment");
		}

		public static function webhook (string $body, array $headers, string $mode): void {
			$event = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
			if (PaymentSettings::get("paypal_" . $mode . "_webhook_id")==="") throw new InvalidArgumentException("invalid_webhook_signature");
			$data = array("webhook_id" => PaymentSettings::get("paypal_" . $mode . "_webhook_id"), "webhook_event" => $event);
			foreach (array("auth_algo", "cert_url", "transmission_id", "transmission_sig", "transmission_time") as $field) {
				$data[$field] = $headers["HTTP_PAYPAL_" . strtoupper($field)] ?? "";
				if ($data[$field]==="") throw new InvalidArgumentException("invalid_webhook_signature");
			}
			$result = self::request($mode, "POST", "/v1/notifications/verify-webhook-signature", $data);
			if (($result["verification_status"] ?? "")!=="SUCCESS") throw new InvalidArgumentException("invalid_webhook_signature");
			$type = $event["event_type"] ?? "";
			if (!in_array($type, array("CHECKOUT.ORDER.APPROVED", "CHECKOUT.ORDER.COMPLETED", "PAYMENT.CAPTURE.COMPLETED", "PAYMENT.CAPTURE.PENDING", "PAYMENT.CAPTURE.DENIED", "PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED"), true)) return;
			$resource = $event["resource"] ?? array();
			if ($type==="PAYMENT.CAPTURE.REFUNDED") {
				$refund = self::request($mode, "GET", "/v2/payments/refunds/" . rawurlencode($resource["id"] ?? ""));
				if (($refund["status"] ?? "")!=="COMPLETED") return;
				$captureId = "";
				foreach ($refund["links"] ?? array() as $link) {
					if (($link["rel"] ?? "")==="up" && preg_match('~/v2/payments/captures/([A-Za-z0-9_-]+)$~', $link["href"], $matches)) $captureId = $matches[1];
				}
				$capture = self::request($mode, "GET", "/v2/payments/captures/" . rawurlencode($captureId));
				$relatedOrder = $capture["supplementary_data"]["related_ids"]["order_id"] ?? "";
				$invoice = $refund["invoice_id"] ?? ($capture["invoice_id"] ?? "");
				$query = Database::connection()->prepare("SELECT orders.suid FROM orders JOIN payments ON payments.order_id = orders.id
					WHERE provider = 'paypal' AND provider_mode = ? AND (transaction_id = ? OR provider_reference = ? OR orders.suid = ?)");
				$query->execute(array($mode, $captureId, $relatedOrder, $invoice));
				$suid = $query->fetchColumn();
				if ($suid===false) return;
				self::refresh(Payments::get($suid), false, $event["id"], $type);
				Payments::refund($suid, "paypal", $captureId, $refund["id"], CheckoutQuote::postedCents($refund["amount"]["value"]), $refund["amount"]["currency_code"]);
				return;
			}
			$orderId = str_starts_with($type, "CHECKOUT.ORDER.") ? ($resource["id"] ?? "") : ($resource["supplementary_data"]["related_ids"]["order_id"] ?? "");
			$query = Database::connection()->prepare("SELECT orders.suid FROM orders JOIN payments ON payments.order_id = orders.id
				WHERE payments.provider = 'paypal' AND provider_mode = ? AND (provider_reference = ? OR transaction_id = ? OR orders.suid = ?)");
			$query->execute(array($mode, $orderId, $resource["supplementary_data"]["related_ids"]["capture_id"] ?? ($resource["id"] ?? ""), $resource["invoice_id"] ?? ""));
			$suid = $query->fetchColumn();
			if ($suid===false) return;
			self::refresh(Payments::get($suid), $type==="CHECKOUT.ORDER.APPROVED", $event["id"], $type);
		}

		public static function approvalUrl (array $payment): string {
			$id = self::start($payment);
			$order = self::request($payment["provider_mode"], "GET", "/v2/checkout/orders/" . rawurlencode($id));
			self::verifyOrder(Payments::get($payment["suid"]), $order);
			foreach ($order["links"] ?? array() as $link) {
				if (in_array($link["rel"], array("approve", "payer-action"), true)
					&& parse_url($link["href"], PHP_URL_SCHEME)==="https"
					&& parse_url($link["href"], PHP_URL_HOST)===($payment["provider_mode"]==="live" ? "www.paypal.com" : "www.sandbox.paypal.com")) return $link["href"];
			}
			return Payments::invoiceUrl($payment);
		}

		public static function test (): void {
			$mode = PaymentSettings::mode("paypal");
			$base = $mode==="live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
			$result = self::http($base . "/v1/oauth2/token", "POST", "grant_type=client_credentials", array("Content-Type: application/x-www-form-urlencoded"),
				PaymentSettings::get("paypal_" . $mode . "_client_id") . ":" . PaymentSettings::get("paypal_" . $mode . "_secret"));
			if (empty($result["access_token"])) throw new RuntimeException("payment_connection_failed");
		}
	}
