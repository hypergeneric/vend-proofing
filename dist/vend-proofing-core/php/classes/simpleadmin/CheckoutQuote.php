<?php

	/** Verifies the existing browser quote against Vend's own catalog and ordering rules. */
	class CheckoutQuote {
		public static function cents (string|float|int $value): int {
			if (!is_numeric($value) || !is_finite((float) $value) || abs((float) $value)>100000000) {
				throw new InvalidArgumentException("invalid_order");
			}
			return (int) round((float) $value * 100);
		}

		public static function postedCents (string $value): int {
			if (!preg_match('/^[0-9]+(?:\.[0-9]{1,2})?$/', $value)) throw new InvalidArgumentException("invalid_order");
			return self::cents($value);
		}

		private static function same (mixed $posted, float $expected): void {
			if (!is_numeric($posted) || !is_finite((float) $posted) || abs((float) $posted - $expected)>0.00001) {
				throw new InvalidArgumentException("quote_changed");
			}
		}

		public static function settings (): ConfigurationDocument {
			return Configuration::getDocument("ordering");
		}

		public static function value (string $key): string {
			return (string) self::settings()->getNodeVal("data.ordering." . $key);
		}

		public static function enabled (string $key): bool {
			return self::value($key)==="true";
		}

		public static function gallerySettings (string $gallery): ConfigurationDocument {
			$type = Records::pageType($gallery);
			$name = array("UploadSet" => "uploadset", "CategorySet" => "categoryset", "DropboxSet" => "dropboxset")[$type] ?? null;
			if ($name===null) throw new InvalidArgumentException("invalid_order");
			return Configuration::getDocument($name, $gallery);
		}

		public static function downloads (string $gallery): ConfigurationDocument {
			$settings = self::gallerySettings($gallery);
			$profile = Records::pageType($gallery)==="DropboxSet" ? $settings->getNodeVal("data.settings.download_set") : null;
			return Configuration::getDocument("downloads", $profile);
		}

		/** Resolve only within an assigned group; never pick the first of ambiguous labels. */
		private static function option (array $rows, string $label, bool $optional=false): array {
			if ($optional && $label==="") return array();
			$matches = array_values(array_filter($rows, fn ($row) => $row[1]===$label));
			if (count($matches)!==1) throw new InvalidArgumentException("quote_changed");
			return $matches[0];
		}

		private static function quantity (string $value): int {
			if (!preg_match('/^[1-9][0-9]{0,3}$/', $value)) throw new InvalidArgumentException("invalid_order");
			return (int) $value;
		}

		public static function cart (string $gallery, string $session, bool $complete=true): array {
			$config = self::gallerySettings($gallery);
			$groups = array();
			foreach (array("format", "paper", "modifier", "package", "product") as $kind) {
				$group = $config->getNodeVal("data.settings." . $kind . "_set");
				$groups[$kind] = $group ? Records::getSetTable($kind, $group) : array();
			}
			$rows = Proofing::rows($gallery, $session);
			$query = Database::connection()->prepare("SELECT items.* FROM cart_items AS items
				JOIN carts ON carts.id = items.cart_id JOIN proofing_sessions AS sessions ON sessions.id = carts.session_id
				JOIN pages ON pages.id = sessions.gallery_id WHERE pages.suid = ? AND sessions.email_key = ? ORDER BY items.position, items.id");
			$query->execute(array($gallery, $session));
			$items = $query->fetchAll();
			if (!$items) throw new InvalidArgumentException("invalid_order");
			$packages = array();
			$rules = array();
			$amounts = array();
			$subtotal = 0.0;
			$shipping = 0.0;
			$digital = 0.0;
			$count = 0;
			$physical = false;
			$shippingEnabled = self::enabled("calculate_and_display_shipping_bool");
			foreach ($items as $item) {
				if (!in_array($item["item_type"], array("package", "product"), true)) continue;
				$row = $rows[$item["public_key"]];
				if (self::quantity($row[4])!==1) throw new InvalidArgumentException("invalid_order");
				$definition = self::option($groups[$item["item_type"]], $row[3]);
				$unit = PriceExpression::evaluate($definition[3]);
				$freight = $shippingEnabled ? PriceExpression::evaluate($definition[4]) : 0;
				self::same($row[5], $unit);
				self::same($row[6], $freight);
				$components = Records::getSetTable("lineitem", $definition[0]);
				$expected = array();
				foreach ($components as $component) {
					if (isset($expected[$component[1]])) throw new InvalidArgumentException("invalid_pricing_formula");
					$expected[$component[1]] = array("row" => $component, "used" => 0);
				}
				$titles = str_starts_with($row[7], "%:") ? explode(",", substr($row[7], 2)) : explode(",", $row[7]);
				$titles = $row[7]==="" || $row[7]==="%:" ? array() : array_map(
					str_starts_with($row[7], "%:") ? "rawurldecode" : "base64_decode", $titles);
				if ($titles!==array_keys($expected)) throw new InvalidArgumentException("quote_changed");
				foreach (array_values($components) as $index => $component) {
					self::same(explode(",", $row[8])[$index] ?? "", (float) $component[2]);
					self::same(explode(",", $row[10])[$index] ?? "", (float) $component[3] * (float) $component[4]);
				}
				$packages[$item["id"]] = $expected;
				$rules[$item["public_key"]] = array("definition" => $definition, "components" => $components);
				$amounts[$item["id"]] = array($unit, $freight);
				if (!$components) $count++;
			}
			$downloadConfig = self::downloads($gallery);
			$bulk = array();
			foreach ($items as $item) {
				$type = $item["item_type"];
				$row = $rows[$item["public_key"]];
				if (isset($amounts[$item["id"]])) {
					$physical = true;
					[$unit, $freight] = $amounts[$item["id"]];
					$subtotal += $unit;
					$shipping += $freight;
					continue;
				}
				if ($item["image_id"]===null) throw new InvalidArgumentException("invalid_order");
				if ($type==="download") {
					if (Records::pageType($gallery)!=="DropboxSet") throw new InvalidArgumentException("invalid_order");
					$values = json_decode($item["selection_json"], true, 512, JSON_THROW_ON_ERROR);
					$quality = $row[5];
					if (!in_array($quality, array("high", "low"), true)) throw new InvalidArgumentException("invalid_order");
					$isBulk = ($values["_bulk_group"] ?? "")==="cart";
					$flag = $isBulk ? "allow_download_all_bool" : ($quality==="high" ? "allow_single_downloads_bool" : "allow_web_version_bool");
					if ($downloadConfig->getNodeVal("data.settings." . $flag)!=="true") throw new InvalidArgumentException("invalid_order");
					$field = $quality==="high" ? "single_download" : "web_version_download";
					$price = PriceExpression::evaluate((string) $downloadConfig->getNodeVal("data.settings." . $field . ($isBulk ? "_all_price" : "_price")));
					$flat = $isBulk && $downloadConfig->getNodeVal("data.settings.download_all_flatfee_bool")==="true";
					$unit = $price;
					if ($flat) {
						$bulk[$quality][] = $item;
						$unit = (float) $row[6];
					}
					if (!$flat) self::same($row[6], $unit);
					$freight = 0.0;
					$digital += $unit;
					$rules[$item["public_key"]] = array("download" => $downloadConfig->toArray());
					$count++;
				} else {
					$physical = true;
					$quantity = self::quantity($row[4]);
					$definition = array();
					if ($type==="allocation") {
						$parent = $item["parent_item_id"];
						if (!isset($packages[$parent][$row[6]])) throw new InvalidArgumentException("invalid_order");
						$component = &$packages[$parent][$row[6]];
						$component["used"] += $quantity;
						$definition = array("", $component["row"][1], $component["row"][3], $component["row"][4], "0", "0");
						unset($component);
					} elseif ($row[6]!=="" || $groups["format"]) $definition = self::option($groups["format"], $row[6]);
					$area = $definition ? (float) $definition[2] * (float) $definition[3] : 0;
					$price = $definition ? PriceExpression::evaluate($definition[4], $area, $quantity) : 0;
					$freight = $definition && $shippingEnabled ? PriceExpression::evaluate($definition[5], $area, $quantity, $price) : 0;
					self::same($row[8]==="" ? "0" : $row[8], $price);
					self::same($row[9]==="" ? "0" : $row[9], $freight);
					$unit = $price;
					$selectedRules = array("format" => $definition);
					foreach (array("paper" => 13, "modifier" => 16) as $kind => $index) {
						$option = self::option($groups[$kind], $row[$index], true);
						$extra = $option ? PriceExpression::evaluate($option[2], $area, $quantity, $price) : 0;
						$extraShipping = $option && $shippingEnabled ? PriceExpression::evaluate($option[3], $area, $quantity, $price) : 0;
						self::same($row[$index + 1]==="" ? "0" : $row[$index + 1], $extra);
						self::same($row[$index + 2]==="" ? "0" : $row[$index + 2], $extraShipping);
						$unit += $extra;
						$freight += $extraShipping;
						$selectedRules[$kind] = $option;
					}
					self::same($row[19], $unit);
					self::same($row[20], $freight);
					$rules[$item["public_key"]] = $selectedRules;
					$count += $quantity;
				}
				if ($unit<0 || $freight<0) throw new InvalidArgumentException("invalid_order");
				$amounts[$item["id"]] = array($unit, $freight);
				$quantity = $type==="download" ? 1 : (int) $row[4];
				$subtotal += $unit * $quantity;
				$shipping += $freight * $quantity;
			}
			foreach ($bulk as $quality => $batch) {
				$images = Records::getFileTable("image", $gallery);
				$ids = array_map(fn ($item) => (string) json_decode($item["selection_json"], true)["cuid"], $batch);
				if (count($ids)!==count($images) || count(array_unique($ids))!==count($images)
					|| array_diff($ids, array_keys($images))) throw new InvalidArgumentException("invalid_order");
				$field = $quality==="high" ? "single_download_all_price" : "web_version_download_all_price";
				$expected = PriceExpression::evaluate((string) $downloadConfig->getNodeVal("data.settings." . $field));
				$actual = array_sum(array_map(fn ($item) => $amounts[$item["id"]][0], $batch));
				self::same($actual, $expected);
			}
			if ($complete) foreach ($packages as $components) foreach ($components as $component) {
				if ($component["used"]!==(int) $component["row"][2]) throw new InvalidArgumentException("invalid_order");
			}
			return array("subtotal" => $subtotal, "shipping" => $shipping, "digital" => $digital,
				"count" => $count, "physical" => $physical, "items" => $items, "rules" => $rules, "amounts" => $amounts);
		}

		public static function verify (string $gallery, string $session, array $row): array {
			$cart = self::cart($gallery, $session);
			$subtotal = self::cents($cart["subtotal"]);
			if (self::postedCents($row[15] ?? "")!==$subtotal) throw new InvalidArgumentException("quote_changed");
			if (!filter_var($row[8] ?? "", FILTER_VALIDATE_EMAIL)) throw new InvalidArgumentException("invalid_email_address");
			$home = self::value("default_country");
			$country = (string) ($row[11] ?? "");
			$locale = json_decode(file_get_contents(SA_DIR_LANG . "/en.json"), true, 512, JSON_THROW_ON_ERROR)["data"];
			$countries = array_column(array_column($locale["country_iso_codes"]["code"], "_attributes"), "value");
			if ($country==="--" || !in_array($country, $countries, true)) throw new InvalidArgumentException("invalid_order");
			if (self::enabled("calculate_and_display_sales_tax_bool") && $country===$home && in_array($home, array("US", "CA"), true)) {
				$states = array_column(array_column($locale[$home==="US" ? "us_states" : "ca_province"]["code"], "_attributes"), "value");
				if (($row[13] ?? "--")==="--" || !in_array($row[13] ?? "", $states, true)) throw new InvalidArgumentException("invalid_order");
			}
			$local = ($row[5] ?? "")==="local";
			if (!in_array($row[5] ?? "", array("local", "ship", "standard"), true)
				|| ($local && $cart["physical"] && !self::enabled("allow_local_pickup_bool"))
				|| (!self::enabled("allow_international_purchases_bool") && $country!==$home)) throw new InvalidArgumentException("invalid_order");
			$discount = 0;
			$freeShipping = false;
			if (($row[6] ?? "")!=="") {
				if (!self::enabled("allow_discount_codes_bool")) throw new InvalidArgumentException("invalid_order");
				$query = Database::connection()->prepare("SELECT reservations.*, discounts.free_shipping FROM discount_reservations AS reservations
					JOIN discounts ON discounts.id = reservations.discount_id WHERE order_suid = ?");
				$query->execute(array($row[0]));
				$reserved = $query->fetch();
				if (!$reserved || strcasecmp($reserved["code"], $row[6])!==0 || $reserved["session_key"]!==$session
					|| (int) $reserved["subtotal_minor"]!==$subtotal) throw new InvalidArgumentException("invalid_order");
				$discount = (int) $reserved["discount_minor"];
				$freeShipping = (bool) $reserved["free_shipping"];
			}
			$shipping = 0;
			$handling = 0;
			if (self::enabled("calculate_and_display_shipping_bool") && !$local && $cart["physical"] && !$freeShipping) {
				$shipping = self::cents($cart["shipping"] + (float) self::value("shipping_flat_fee_num")
					+ ($subtotal - $discount) / 100 * (float) self::value("shipping_flat_rate_num") / 100);
				$handling = self::cents((float) self::value("handling_flat_fee_num")
					+ ($country!==$home ? (float) self::value("international_handling_flat_fee_num") : 0));
			}
			$taxable = max(0, $subtotal - $discount - (self::enabled("downloads_taxable_bool") ? 0 : self::cents($cart["digital"])));
			if (self::enabled("shipping_taxable_bool")) $taxable += $shipping;
			if (self::enabled("handling_taxable_bool")) $taxable += $handling;
			$taxRate = 0.0;
			$taxRules = Records::getSetTable(in_array($home, array("US", "CA"), true) ? strtolower($home) . "taxchart" : "vattaxchart");
			$location = in_array($home, array("US", "CA"), true) ? (string) ($row[13] ?? "") : $country;
			$rateRow = $taxRules[$location] ?? null;
			$rates = array(0);
			if (self::enabled("calculate_and_display_sales_tax_bool") && $rateRow && (!in_array($home, array("US", "CA"), true) || $country===$home)) {
				if ($home==="CA") {
					$rates = array((float) $rateRow[2], (float) $rateRow[3], (float) $rateRow[4], $location==="QC");
					$taxRate = ($rates[0] + $rates[1] + $rates[2]) / 100 + ($rates[3] ? $rates[1] * $rates[2] / 10000 : 0);
				} else {
					$rates = array((float) $rateRow[$home==="US" ? 3 : 2]);
					$taxRate = $rates[0] / 100;
				}
			}
			$tax = (int) round($taxable * $taxRate);
			$total = $subtotal - $discount + $shipping + $handling + $tax;
			$amounts = array(14 => $total, 15 => $subtotal, 16 => $discount, 17 => $shipping, 18 => $handling, 19 => $tax);
			foreach ($amounts as $index => $expected) {
				if ($expected<0 || self::postedCents($row[$index] ?? "")!==$expected) throw new InvalidArgumentException("quote_changed");
				$row[$index] = number_format($expected / 100, 2, ".", "");
			}
			$minimumValue = (float) self::value("cart_minimum_value_num");
			$displaySubtotal = $subtotal / 100 * (self::enabled("purchase_price_includes_tax_bool") ? 1 + $taxRate : 1);
			if ($displaySubtotal + 0.00001 < $minimumValue || $cart["count"]<(int) self::value("cart_minimum_count_num")) throw new InvalidArgumentException("invalid_order");
			$row[20] = implode(",", array_map(fn ($value) => is_bool($value) ? ($value ? "true" : "false") : (string) $value, $rates));
			foreach (array(21 => "purchase_price_includes_tax_bool", 22 => "shipping_taxable_bool", 23 => "handling_taxable_bool") as $index => $key) $row[$index] = self::enabled($key) ? "true" : "false";
			$orderingRules = array();
			foreach (array("default_country", "default_currency", "allow_local_pickup_bool", "allow_international_purchases_bool",
				"calculate_and_display_shipping_bool", "calculate_and_display_sales_tax_bool", "shipping_flat_fee_num", "shipping_flat_rate_num",
				"handling_flat_fee_num", "international_handling_flat_fee_num", "shipping_taxable_bool", "handling_taxable_bool",
				"downloads_taxable_bool", "purchase_price_includes_tax_bool", "cart_minimum_value_num", "cart_minimum_count_num") as $key) $orderingRules[$key] = self::value($key);
			$cart["checkout_rules"] = array("ordering" => $orderingRules, "tax_rule" => $rateRow, "discount" => $reserved ?? null);
			$cart["row"] = $row;
			$cart["currency"] = self::value("default_currency") ?: "USD";
			return $cart;
		}
	}
