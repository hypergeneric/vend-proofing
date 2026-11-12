<?php

	/** Merchant credentials stay in the existing private SQLite settings document. */
	class PaymentSettings {
		public const SECRETS = array("stripe_test_secret", "stripe_live_secret", "stripe_test_webhook", "stripe_live_webhook",
			"paypal_test_secret", "paypal_live_secret");

		public static function get (string $key): string {
			return (string) Configuration::getDocument("ordering")->getNodeVal("data.payment_gateway." . $key);
		}


		public static function baseUrl (bool $required=true): string {
			$url = rtrim(self::get("payment_site_url"), "/");
			if (filter_var($url, FILTER_VALIDATE_URL) && parse_url($url, PHP_URL_SCHEME)==="https"
				&& !parse_url($url, PHP_URL_USER) && !parse_url($url, PHP_URL_QUERY) && !parse_url($url, PHP_URL_FRAGMENT)) return $url;
			if ($required) throw new InvalidArgumentException("payment_unavailable");
			// Relative browser returns are safe without trusting Host/forwarded-host headers.
			return rtrim(str_replace("\\", "/", dirname($_SERVER["SCRIPT_NAME"] ?? "/index.php")), "/");
		}

		public static function mode (string $provider): string {
			return self::get($provider . "_mode")==="live" ? "live" : "test";
		}

		public static function configured (string $provider): bool {
			if (!in_array($provider, array("stripe", "paypal"), true) || self::get($provider . "_enabled_bool")!=="true") return false;
			$prefix = $provider . "_" . self::mode($provider);
			$required = $provider==="stripe" ? array("secret", "webhook") : array("client_id", "secret", "webhook_id");
			foreach ($required as $key) if (trim(self::get($prefix . "_" . $key))==="") return false;
			try { self::baseUrl(); } catch (InvalidArgumentException $error) { return false; }
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
				$document->editNode("data.payment_gateway." . $provider . "_webhook_url", self::baseUrl(false) . "/vend-proofing-gateway.php?action=payment_webhook&provider=" . $provider . "&mode=" . self::mode($provider));
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
