<?php

	/** Stripe Checkout Sessions with Elements; Vend never receives card data. */
	class StripePayment {
		public static $clientFactory = null;

		private static function client (string $mode): object {
			if (self::$clientFactory) return (self::$clientFactory)($mode);
			return new \Stripe\StripeClient(PaymentSettings::get("stripe_" . $mode . "_secret"));
		}

		/** Vend's existing snapshots use hundredths; convert explicitly for provider currencies. */
		public static function providerAmount (int $cents, string $currency): int {
			$zero = array("BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF");
			if (in_array(strtoupper($currency), $zero, true)) {
				if ($cents % 100!==0) throw new InvalidArgumentException("invalid_currency_precision");
				return intdiv($cents, 100);
			}
			if (in_array(strtoupper($currency), array("BHD", "JOD", "KWD", "OMR", "TND"), true)) return $cents * 10;
			return $cents;
		}

		public static function start (array $payment): array {
			$client = self::client($payment["provider_mode"]);
			if (!$payment["provider_reference"]) {
				// Stripe retains idempotency keys for at least 24h. Never recreate an ambiguous older charge.
				if (time() - $payment["created_at"]>23 * 3600) throw new RuntimeException("payment_requires_review");
				$url = Func::getPublicBaseUrl() . "/vend-proofing-gateway.php?action=payment_return&order=" . $payment["suid"] . "&access=" . $payment["access_token"];
				$session = $client->checkout->sessions->create(array(
					"mode" => "payment", "ui_mode" => "custom", "payment_method_types" => array("card", "link"),
					"client_reference_id" => $payment["suid"], "metadata" => array("vend_order" => $payment["suid"]),
					"payment_intent_data" => array("metadata" => array("vend_order" => $payment["suid"])),
					"customer_email" => $payment["email"],
					"line_items" => array(array("quantity" => 1, "price_data" => array("currency" => strtolower($payment["currency"]),
						"unit_amount" => self::providerAmount((int) $payment["amount_minor"], $payment["currency"]),
						"product_data" => array("name" => "Order " . $payment["suid"])))),
					"return_url" => $url
				), array("idempotency_key" => $payment["idempotency_key"]));
				Payments::attach($payment["suid"], $session->id);
				$payment = Payments::get($payment["suid"]);
			}
			$session = self::refresh($payment, "return:" . bin2hex(random_bytes(12)), "retrieve");
			$intent = $session->payment_intent;
			if ($session->status==="complete" && is_object($intent) && in_array($intent->status, array("requires_payment_method", "canceled"), true)) {
				if ($intent->status!=="canceled") {
					$result = $client->paymentIntents->cancel($intent->id, array(), array("idempotency_key" => $payment["idempotency_key"] . "-cancel"));
					if ($result->status!=="canceled") throw new RuntimeException("payment_requires_review");
				}
				Payments::reconcile($payment["suid"], "stripe", $payment["provider_reference"], $intent->id, (int) $payment["amount_minor"], $payment["currency"], "cancelled", "cancel:" . $intent->id, "cancel_failed_intent");
				return self::start(Payments::retry(Payments::get($payment["suid"])));
			}
			if ($session->status==="expired") return self::start(Payments::retry(Payments::get($payment["suid"])));
			if ($session->status!=="open") return array("url" => Payments::invoiceUrl($payment));
			if (!is_string($session->client_secret) || $session->client_secret==="") throw new RuntimeException("invalid_payment");
			return array("clientSecret" => $session->client_secret,
				"publishableKey" => PaymentSettings::get("stripe_" . $payment["provider_mode"] . "_publishable_key"));
		}

		public static function refresh (array $payment, string $eventId, string $eventType): object {
			$session = self::client($payment["provider_mode"])->checkout->sessions->retrieve($payment["provider_reference"], array("expand" => array("payment_intent")));
			if ($session->id!==$payment["provider_reference"] || $session->client_reference_id!==$payment["suid"]
				|| ($session->metadata->vend_order ?? "")!==$payment["suid"] || $session->mode!=="payment"
				|| (bool) $session->livemode!==($payment["provider_mode"]==="live")
				|| (int) $session->amount_total!==self::providerAmount((int) $payment["amount_minor"], $payment["currency"])
				|| strtoupper($session->currency)!==$payment["currency"]) throw new InvalidArgumentException("invalid_payment");
			$intent = $session->payment_intent;
			$paid = $session->payment_status==="paid" && is_object($intent) && $intent->status==="succeeded";
			if ($paid && ((int) $intent->amount_received!==self::providerAmount((int) $payment["amount_minor"], $payment["currency"])
				|| strtoupper($intent->currency)!==$payment["currency"])) throw new InvalidArgumentException("invalid_payment");
			$refunded = 0;
			if ($paid) {
				$charge = $intent->latest_charge;
				if (is_string($charge)) $charge = self::client($payment["provider_mode"])->charges->retrieve($charge, array());
				$expected = self::providerAmount((int) $payment["amount_minor"], $payment["currency"]);
				if (!is_object($charge) || $charge->payment_intent!==$intent->id || (int) $charge->amount!==$expected
					|| strtoupper($charge->currency)!==$payment["currency"] || $charge->status!=="succeeded") throw new InvalidArgumentException("invalid_payment");
				$refunded = (int) round((int) $charge->amount_refunded * (int) $payment["amount_minor"] / $expected);
			}
			$status = $paid ? ($refunded===(int) $payment["amount_minor"] ? "refunded" : "paid")
				: ($session->status==="expired" ? "cancelled" : (is_object($intent) && in_array($intent->status, array("requires_payment_method", "canceled"), true) && $session->status==="complete" ? "failed" : "pending"));
			Payments::reconcile($payment["suid"], "stripe", $session->id, is_object($intent) ? $intent->id : "",
				(int) $payment["amount_minor"], $payment["currency"], $status, $eventId, $eventType, $refunded);
			return $session;
		}

		public static function webhook (string $body, string $signature, string $mode): void {
			$secret = PaymentSettings::get("stripe_" . $mode . "_webhook");
			if ($secret==="") throw new InvalidArgumentException("invalid_webhook_signature");
			$event = \Stripe\Webhook::constructEvent($body, $signature, $secret);
			if ((bool) $event->livemode!==($mode==="live")) throw new InvalidArgumentException("invalid_payment");
			$type = $event->type;
			if (!in_array($type, array("checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired", "charge.refunded"), true)) return;
			$object = $event->data->object;
			$suid = (string) ($object->metadata->vend_order ?? "");
			if ($type==="charge.refunded" && $suid==="") {
				$intent = self::client($mode)->paymentIntents->retrieve($object->payment_intent, array());
				$suid = (string) ($intent->metadata->vend_order ?? "");
			}
			if ($suid==="") return; // Unrelated payments in the photographer's account.
			$payment = Payments::get($suid);
			if ($payment["provider"]!=="stripe" || $payment["provider_mode"]!==$mode) throw new InvalidArgumentException("invalid_payment");
			if ($type!=="charge.refunded" && $object->id!==$payment["provider_reference"]) throw new InvalidArgumentException("invalid_payment");
			self::refresh($payment, $event->id, $type);
		}

		public static function test (): void {
			self::client(PaymentSettings::mode("stripe"))->balance->retrieve(array());
		}
	}
