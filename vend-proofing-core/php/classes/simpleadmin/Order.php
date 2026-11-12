<?php

	/** Existing order/admin projections and receipt templates. Payments are handled separately. */
	class Order {
		protected array $flag_order_array = array();
		protected array $flag_order_lookup;
		protected ConfigurationDocument $ordering_data;

		public function __construct () {
			$this->ordering_data = Configuration::getDocument("ordering");
			$this->flag_order_lookup = array(
				"orderid" => 0,
				"setid" => 1,
				"timestamp" => 2,
				"payment_type" => 3,
				"transactionid" => 4,
				"shipping_type" => 5,
				"discount_code" => 6,
				"full_name" => 7,
				"email_address" => 8,
				"phone_number" => 9,
				"shipping_address" => 10,
				"country" => 11,
				"postal_code" => 12,
				"state" => 13,
				"gross" => 14,
				"subtotal" => 15,
				"discount" => 16,
				"shipping" => 17,
				"handling" => 18,
				"tax" => 19,
				"taxrate" => 20,
				"prices_include_tax" => 21,
				"shipping_taxable" => 22,
				"handling_taxable" => 23,
				"comments" => 24
			);
		}

		protected function prop (string $key): string {
			return (string) $this->flag_order_array[$this->flag_order_lookup[$key]];
		}

		public function getOrderSession ($oid, $msts) { return OrderRecords::items($oid); }
		public function deleteOrder ($oid, $msts) { OrderRecords::delete($oid); }
		public function getLogById ($oid) { return OrderRecords::getLog($oid); }
		public function getOrderById ($oid) { return OrderRecords::get($oid); }
		public function search ($start, $end, $params=array()) { return OrderRecords::search($start, $end, $params); }
		public function statsSearch ($start, $end) { return OrderRecords::stats($start, $end); }
		public function daysInMonth ($month, $year) { return cal_days_in_month(CAL_GREGORIAN, (int) $month, (int) $year); }

		public function sendReceipt (string $suid, string $purpose): bool {
			$this->flag_order_array = OrderRecords::get($suid);
			if (!$this->flag_order_array) throw new InvalidArgumentException("invalid_order");
			// get data stuff
			$ordering = $this->ordering_data;
			$contact = Configuration::getDocument("contact", null, true);
			// post/pre
			$post = array (
				"ORDER_ID" => $this->prop("orderid"),
				"PURCHASER_NAME" => $this->prop("full_name"),
				"PURCHASER_EMAIL" => $this->prop("email_address"),
				"PURCHASER_PHONE" => $this->prop("phone_number"),
				"OWNER_NAME" => $contact->getNodeVal("data.details.your_email"),
				"OWNER_EMAIL" => $contact->getAttrVal("data.details.your_email.href")
			);
			$pre = array (
				"INVOICE_URL" => PaymentSettings::baseUrl() . "/?/order/" . $this->prop("orderid") . "/invoice/" . md5($this->prop("email_address")) . "/",
				"OUTPUT_URL" => PaymentSettings::baseUrl() . "/?/order/" . $this->prop("orderid") . "/output/" . md5($this->prop("email_address")) . "/"
			);
			// inbox
			$inbox_email = $post["OWNER_EMAIL"];
			$inbox_name = $post["OWNER_NAME"];
			if ( $ordering!=false ) {
				$inbox_email = $ordering->getAttrVal("data.ordering.offline_order_inbox_email.href");
				$inbox_name = $ordering->getNodeVal("data.ordering.offline_order_inbox_email");
				if ( $inbox_email=="" ) {
					$inbox_email = $post["OWNER_EMAIL"];
					$inbox_name = $post["OWNER_NAME"];
				}
			}
			$email = new Email();
			if ($purpose==="customer_receipt") {
				$email->setSender($post["OWNER_EMAIL"], $post["OWNER_NAME"]);
				$email->setRecipient($post["PURCHASER_EMAIL"], $post["PURCHASER_NAME"]);
				$email->setSubjectTemplate("data.contact.order_client_reciept_subject");
				$email->setBodyTemplate("data.contact.order_client_reciept_message_body");
			} else {
				$email->setSender($post["OWNER_EMAIL"], $post["OWNER_NAME"]);
				$email->setRecipient($inbox_email, $inbox_name);
				$email->setSubjectTemplate("data.contact.order_merchant_reciept_subject");
				$email->setBodyTemplate("data.contact.order_merchant_reciept_message_body");
			}
			$email->addPreTags($pre);
			$email->addPostTags($post);
			$email->send();
			return $email->success();
		}
	}
