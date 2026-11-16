<?php

	/** Merchant credentials stay in the existing private SQLite settings document. */
	class PaymentSettings {
		public const SECRETS = array("stripe_test_secret", "stripe_live_secret", "stripe_test_webhook", "stripe_live_webhook",
			"paypal_test_secret", "paypal_live_secret");

		public static function get (string $key): string {
			return (string) Configuration::getDocument("ordering")->getNodeVal("data.payment_gateway." . $key);
		}

		public static function mode (string $provider): string {
			return self::get($provider . "_mode")==="live" ? "live" : "test";
		}

		public static function configured (string $provider): bool {
			if (!in_array($provider, array("stripe", "paypal"), true) || self::get($provider . "_enabled_bool")!=="true") return false;
			$prefix = $provider . "_" . self::mode($provider);
			$required = $provider==="stripe" ? array("secret", "publishable_key", "webhook") : array("client_id", "secret", "webhook_id");
			foreach ($required as $key) if (trim(self::get($prefix . "_" . $key))==="") return false;
			try { Func::getPublicBaseUrl(); } catch (InvalidArgumentException $error) { return false; }
			return true;
		}

		public static function forAdmin (string $json): string {
			$document = new ConfigurationDocument($json);
			foreach (self::SECRETS as $key) {
				$set = (string) $document->getNodeVal("data.payment_gateway." . $key)!=="";
				$document->editNode("data.payment_gateway." . $key, "", "secret=true;configured=" . ($set ? "true" : "false"));
			}
			foreach (array("stripe", "paypal") as $provider) {
				$document->editNode("data.payment_gateway." . $provider . "_status", self::configured($provider) ? "Configured" : "Disabled or incomplete");
				$document->editNode("data.payment_gateway." . $provider . "_webhook_endpoint", Func::getPublicBaseUrl(false) . "/vend-proofing-gateway.php?action=payment_webhook&provider=" . $provider . "&mode=" . self::mode($provider));
			}
			return $document->toRuntimeString();
		}

		public static function merge (string $json): string {
			$document = new ConfigurationDocument($json);
			foreach (self::SECRETS as $key) {
				$path = "data.payment_gateway." . $key;
				$value = $document->getNodeVal($path);
				$clear = $document->getAttrVal($path . ".clear_secret")==="true";
				$document->editNode($path, $clear ? "" : ($value ?: self::get($key)), "clear_secret=false;configured=false;secret=true");
			}
			return $document->toString();
		}
	}
