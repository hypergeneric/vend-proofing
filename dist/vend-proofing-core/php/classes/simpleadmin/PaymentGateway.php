<?php

	/** Small HTTP boundary for checkout and provider callbacks, alongside the existing Gateway. */
	class PaymentGateway {
		private static function field (string $key): string {
			$value = $_POST[$key] ?? $_GET[$key] ?? "";
			if (!is_string($value) || strlen($value)>100000) throw new InvalidArgumentException("invalid_order");
			return $value;
		}

		public static function dispatch (): void {
			$action = $_POST["action"] ?? $_GET["action"] ?? "";
			if (!is_string($action)) { http_response_code(400); self::respond(array("success" => false, "error" => "invalid_order")); }
			$actions = array("checkout_submit", "payment_start", "payment_capture", "payment_status", "payment_cancel", "payment_return", "payment_webhook", "payment_test", "payment_mark_paid", "payment_receipts", "finalize_order", "process_credit_card", "validate_paypal_ipn");
			if (!in_array($action, $actions, true)) return;
			header("Cache-Control: no-store");
			header("Referrer-Policy: no-referrer");
			try {
				if (!in_array($action, array("payment_return"), true) && ($_SERVER["REQUEST_METHOD"] ?? "")!=="POST") throw new InvalidArgumentException("invalid_order");
				if (in_array($action, array("process_credit_card", "validate_paypal_ipn"), true)) throw new InvalidArgumentException("payment_unavailable");
				if ($action==="payment_webhook") {
					$provider = self::field("provider");
					$mode = self::field("mode");
					if (!in_array($mode, array("test", "live"), true)) throw new InvalidArgumentException("invalid_payment");
					$body = file_get_contents("php://input", false, null, 0, 1048577);
					if (strlen($body)>1048576) throw new InvalidArgumentException("invalid_payment");
					if ($provider==="stripe") StripePayment::webhook($body, $_SERVER["HTTP_STRIPE_SIGNATURE"] ?? "", $mode);
					elseif ($provider==="paypal") PayPalPayment::webhook($body, $_SERVER, $mode);
					else throw new InvalidArgumentException("invalid_payment");
					self::sendReceipts();
					self::respond(array("success" => true));
				}
				if (in_array($action, array("payment_test", "payment_mark_paid", "payment_receipts"), true)) {
					if (!(new Auth())->authenticate()["authenticated"]) { http_response_code(403); self::respond(array("success" => false, "error" => "unauthorized")); }
					if ($action==="payment_test") {
						$provider = self::field("provider");
						if ($provider==="stripe") StripePayment::test();
						elseif ($provider==="paypal") PayPalPayment::test();
						else throw new InvalidArgumentException("payment_unavailable");
					} else {
						$payment = Payments::get(self::field("order"));
						if ($action==="payment_mark_paid") {
							if ($payment["provider"]!=="offline") throw new InvalidArgumentException("invalid_order");
							Payments::reconcile($payment["suid"], "offline", "", "manual:" . $payment["suid"], (int) $payment["amount_minor"], $payment["currency"], "paid", "manual:" . $payment["suid"], "admin_manual_payment");
						}
						Database::connection()->prepare("UPDATE messages SET delivery_status = 'queued' WHERE order_id = ? AND purpose IS NOT NULL AND delivery_status = 'failed'")->execute(array($payment["order_id"]));
						self::sendReceipts($payment["suid"]);
					}
					self::respond(array("success" => true));
				}
				if ($action==="checkout_submit" || $action==="finalize_order") {
					$row = explode("\t", self::field("data"));
					if (count($row)!==25) throw new InvalidArgumentException("invalid_order");
					$provider = $action==="finalize_order" ? "offline" : self::field("provider");
					if (self::field("puid")!==$row[1]) throw new InvalidArgumentException("invalid_order");
					$row[3] = $provider;
					$row[4] = "";
					OrderRecords::create(self::field("puid"), self::field("name"), $row, "", $provider==="paypal" ? (self::field("funding") ?: "paypal") : "paypal");
					$payment = Payments::get($row[0]);
					self::sendReceipts($row[0]);
					if ($action==="finalize_order") { header("Content-Type: text/plain; charset=utf-8"); exit("true\t"); }
					self::respond(self::start($payment));
				}
				$payment = Payments::authorize(self::field("order"), self::field("access"));
				if ($action==="payment_start") self::respond(self::start($payment));
				if ($action==="payment_capture" || $action==="payment_return" || $action==="payment_status") {
					if ($payment["provider_reference"]) {
						$event = "retrieve:" . bin2hex(random_bytes(12));
						if ($payment["provider"]==="stripe") StripePayment::refresh($payment, $event, "retrieve");
						elseif ($payment["provider"]==="paypal") PayPalPayment::refresh($payment, $action!=="payment_status", $event, "retrieve");
					}
					self::sendReceipts($payment["suid"]);
				}
				if ($action==="payment_cancel") {
					// Browser cancellation is advisory; reconcile provider state before exposing recovery.
					if ($payment["provider"]==="paypal" && $payment["provider_reference"]) PayPalPayment::refresh($payment, false, "cancel:" . bin2hex(random_bytes(12)), "browser_cancel");
				}
				$payment = Payments::get($payment["suid"]);
				if ($action==="payment_return") { header("Location: " . Payments::invoiceUrl($payment), true, 303); exit; }
				self::respond(array("success" => true, "status" => $payment["status"], "url" => Payments::invoiceUrl($payment)));
			} catch (Throwable $error) {
				$allowed = array("invalid_order", "quote_changed", "invalid_pricing_formula", "invalid_email_address", "payment_unavailable", "invalid_currency_precision", "payment_requires_review");
				$key = in_array($error->getMessage(), $allowed, true) ? $error->getMessage() : "payment_connection_failed";
				if (isset($payment) && is_array($payment) && isset($payment["id"])) {
					Database::connection()->prepare("UPDATE payments SET error_code = ?, updated_at = ? WHERE id = ?")
						->execute(array($key, time(), $payment["id"]));
				}
				// Never export provider exception text: it can contain credentials or buyer data.
				if ($action==="finalize_order") { header("Content-Type: text/plain; charset=utf-8"); exit("false\t" . $key); }
				if ($action==="payment_webhook") http_response_code($error instanceof RuntimeException && !$error instanceof InvalidArgumentException ? 503 : 400);
				$response = array("success" => false, "error" => $key);
				if (isset($payment) && is_array($payment) && isset($payment["suid"]) && $payment["order_status"]!=="checkout") $response["invoice"] = Payments::invoiceUrl($payment);
				self::respond($response);
			}
		}

		private static function start (array $payment): array {
			$response = array("success" => true, "order" => $payment["suid"], "access" => $payment["access_token"], "invoice" => Payments::invoiceUrl($payment), "status" => $payment["status"]);
			if ($payment["provider"]==="offline" || in_array($payment["status"], array("paid", "refunded"), true)) {
				$response["url"] = Payments::invoiceUrl($payment);
			} elseif ($payment["provider"]==="stripe") $response = array_merge($response, StripePayment::start($payment));
			elseif ($payment["provider"]==="paypal") {
				$response["providerOrder"] = PayPalPayment::start($payment);
				$response["funding"] = $payment["funding"];
				$response["paypalClientId"] = PaymentSettings::get("paypal_" . $payment["provider_mode"] . "_client_id");
				$response["paypalMode"] = $payment["provider_mode"];
				$response["currency"] = $payment["currency"];
			}
			$current = Payments::get($payment["suid"]);
			$response["status"] = $current["status"];
			if (in_array($current["status"], array("paid", "refunded"), true)) {
				$response["url"] = Payments::invoiceUrl($current); unset($response["providerOrder"]);
			}
			return $response;
		}

		/** A claimed send is never automatically repeated after a process crash. Failed sends can be retried in admin. */
		public static function sendReceipts (?string $suid=null): void {
			$query = Database::connection()->prepare("SELECT messages.id, messages.purpose, orders.suid FROM messages
				JOIN orders ON orders.id = messages.order_id WHERE purpose IS NOT NULL AND delivery_status = 'queued'
				AND (? IS NULL OR orders.suid = ?) ORDER BY messages.id LIMIT 10");
			$query->execute(array($suid, $suid));
			foreach ($query->fetchAll() as $message) {
				$claim = Database::connection()->prepare("UPDATE messages SET delivery_status = 'sending' WHERE id = ? AND delivery_status = 'queued'");
				$claim->execute(array($message["id"]));
				if ($claim->rowCount()!==1) continue;
				try { $success = (new Order())->sendReceipt($message["suid"], $message["purpose"]); }
				catch (Throwable $error) { $success = false; }
				Database::connection()->prepare("UPDATE messages SET delivery_status = ?, sent_at = ? WHERE id = ?")
					->execute(array($success ? "sent" : "failed", $success ? time() : null, $message["id"]));
			}
		}

		private static function respond (array $data): never {
			header("Content-Type: application/json; charset=utf-8");
			echo json_encode($data, JSON_THROW_ON_ERROR);
			exit;
		}
	}
