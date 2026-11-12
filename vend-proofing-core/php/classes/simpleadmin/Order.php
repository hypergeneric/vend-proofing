<?php

	use Omnipay\Omnipay;

	class Order {

		/* ---- Public Methods ---- */

		public function daysInMonth($month, $year) {
			return $month == 2 ? ($year % 4 ? 28 : ($year % 100 ? 29 : ($year % 400 ? 28 : 29))) : (($month - 1) % 7 % 2 ? 30 : 31);
		}

		public function getOrderSession ($oid, $msts) {
			return OrderRecords::items($oid);
		}

		public function deleteOrder ($oid, $msts) {
			OrderRecords::delete($oid);
		}

		public function getLogById ($oid) {
			return OrderRecords::getLog($oid);
		}

		public function getOrderById ($oid) {
			return OrderRecords::get($oid);
		}

		public function search ($start, $end, $params=array()) {
			return OrderRecords::search($start, $end, $params);
		}

		public function statsSearch ($start, $end) {
			return OrderRecords::stats($start, $end);
		}

		public function setAction ($str) {
			switch ($str) {
			 case "validate_paypal_ipn" :
				$this->flag_type = "paypal";
				break;
			 case "process_credit_card" :
				$this->flag_type = "merchant";
				break;
			 case "finalize_order" :
				$this->flag_type = "offline";
				break;
			}
		}

		public function setCCProps ($cc_num="", $cc_expiry="", $cc_cvv="", $cc_zip="") {
			if ($this->flag_type=="paypal") return;
			$this->flag_cc_num = $cc_num;
			$this->flag_cc_expiry = $cc_expiry;
			$this->flag_cc_cvv = $cc_cvv;
			$this->flag_cc_zip = $cc_zip;
		}

		public function setOrderProps ($puid="", $name="", $data="") {
			if ($this->flag_type=="paypal") return;
			$this->flag_setid = $puid;
			$this->flag_session_hash = $name;
			$this->flag_order_array = strlen($data)>0 ? explode("\t", $data) : array();
		}

		public function process () {
			if ($this->flag_type=="paypal") {
				$this->doPaypalIPN();
				if ($this->flag_success) {
					$existing = OrderRecords::get((string) $this->prop("orderid"));
					if ($existing!==null) {
						if ($existing[1]!==$this->flag_setid || $existing[4]!==$this->prop("transactionid")) {
							$this->flag_success = false;
							$this->flag_error = "invalid_order";
						}
						$this->fileLog();
						return;
					}
				}
			}
			if ($this->flag_success) {
				try {
					OrderRecords::validateBeforePayment($this->flag_setid,
						$this->flag_session_hash, $this->flag_order_array);
				} catch (InvalidArgumentException $error) {
					$this->flag_success = false;
					$this->flag_error = "invalid_order";
				}
			}
			if ($this->flag_success && $this->flag_type=="merchant") {
				$this->processCreditCard();
			}
			$this->fileLog();
			if ($this->flag_success==true) {
				if ($this->createOrder()) $this->sendMails();
			}
		}

		public function success () {
			return $this->flag_success;
		}

		public function error () {
			return $this->flag_error;
		}
		
		/* ---- Constructor ---- */
		
		public function __construct() {
			/* set the local timezone
				*/
			$this->setup_data = 			Configuration::getDocument("setup");
			$this->ordering_data = 			Configuration::getDocument("ordering");
			$setup = 					$this->setup_data;
			$local_timezone = 			$setup->getNodeVal("data.settings.local_timezone");
			$local_timezone =				explode(",", $local_timezone);
			$timezone_locale =			$local_timezone[1];
			$timezone_offset = 			$local_timezone[0];
			$timezone_offset_arr = 			explode(':', $timezone_offset);
			$timezone_offset_dec = 			$timezone_offset_arr[0] . "." . (($timezone_offset_arr[1]/60)*100);
			$this->timezone_offset = 		$timezone_offset_dec * 60 * 60;
									if (function_exists("date_default_timezone_set")==false) @putenv("TZ=$timezone_locale");
									else @date_default_timezone_set($timezone_locale);
			/* set the order row properties
				*/
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
			$this->flag_order_array = array_pad(array(), count($this->flag_order_lookup), "");
			/* set the current timestamp
				*/
			$year = date("Y");
			$month = date("n");
			$day = date("j");
			$this->flag_order_timestamp = array($year, $month, $day);
		}

		/* ---- Private Properties ---- */

		protected $flag_type;
		protected $flag_setid;
		protected $flag_session_hash;
		protected $flag_order_lookup;
		protected $flag_order_array;
		protected $flag_success = true;
		protected $flag_error = "";
		protected $flag_logdata;
		protected $flag_order_timestamp;
		protected $flag_cc_num;
		protected $flag_cc_expiry;
		protected $flag_cc_cvv;
		protected $flag_cc_zip;

		protected $timezone_offset = 0;
		protected $setup_data;
		protected $ordering_data;
		
		protected function prop ($name, $value=null) {
			$index = $this->flag_order_lookup[$name];
			if ($value!=null) {
				$this->flag_order_array[$index] = $value;
			}
			return $this->flag_order_array[$index];
		}
		
		protected function sendMails () {
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
				"INVOICE_URL" => Func::getBaseUrl() . "/?/order/" . $this->prop("orderid") . "/invoice/" . md5($this->prop("email_address")) . "/",
				"OUTPUT_URL" => Func::getBaseUrl() . "/?/order/" . $this->prop("orderid") . "/output/" . md5($this->prop("email_address")) . "/"
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
			// send to purchaser
			$email = new Email();
			$email->setSender($post["OWNER_EMAIL"], $post["OWNER_NAME"]);
			$email->setRecipient($post["PURCHASER_EMAIL"], $post["PURCHASER_NAME"]);
			$email->setSubjectTemplate("data.contact.order_client_reciept_subject");
			$email->setBodyTemplate("data.contact.order_client_reciept_message_body");
			$email->addPreTags($pre);
			$email->addPostTags($post);
			$email->send();
			// send to owner
			$email = new Email();
			$email->setSender($post["PURCHASER_EMAIL"], $post["PURCHASER_NAME"]);
			$email->setRecipient($inbox_email, $inbox_name);
			$email->setSubjectTemplate("data.contact.order_merchant_reciept_subject");
			$email->setBodyTemplate("data.contact.order_merchant_reciept_message_body");
			$email->addPreTags($pre);
			$email->addPostTags($post);
			$email->send();
		}

		protected function fileLog () {
			if (strlen($this->flag_logdata)>0) {
				$logdata = date('r') . "\n-----------------------------------------------------\n" . $this->flag_logdata . "\n\n";
				OrderRecords::log($this->prop("orderid"), $logdata);
			}
		}

		protected function createOrder () {
			$timestamp_ms = time() * 1000;
			$timestamp = $timestamp_ms - $this->timezone_offset - (date("I", $timestamp_ms)==1?3600:0);
			$this->prop("timestamp", $timestamp);
			$currency = $this->ordering_data->getNodeVal("data.ordering.default_currency");
			if ($currency==="") $currency = "USD";
			return OrderRecords::create($this->flag_setid, $this->flag_session_hash,
				$this->flag_order_array, $currency);
		}

		protected function processCreditCard () {
			// get the setup file
			$ordering = $this->ordering_data;
			$merchant_gateway = $ordering->getNodeVal("data.payment_gateway.merchant_gateway");
			if ($merchant_gateway=="stripe") $this->processStripe();
		}
		
		protected function getCardInfo () {
			$ordering = 	$this->ordering_data;
			$default_country = 		$ordering->getNodeVal("data.ordering.default_country");
			$shipping_address = 		$this->prop("shipping_address");
			$shipping_address = 		explode("<[[BR]]>", $shipping_address);
			if ( $default_country=="US" || $default_country=="CA") {
				$address1 = 	$shipping_address[0];
				$address2 = 	$shipping_address[1];
				$city = 		$shipping_address[2];
			} else {
				$address1 = 	implode("\n", $shipping_address);
				$address2 = 	"";
				$city = 		"";
			}
			$card = array(
				'number' => 			$this->flag_cc_num, 
				'expiryMonth' => 		substr($this->flag_cc_expiry, 0, 2), 
				'expiryYear' => 		substr($this->flag_cc_expiry, 2), 
				'cvv' => 				$this->flag_cc_cvv,
				'name' => 				$this->prop("full_name"),
				'postcode' => 			$this->flag_cc_zip,
				'country' => 			$this->prop("country"),
				'phone' => 				$this->prop("phone_number"),
				'email' => 				$this->prop("email_address"),
				'state' => 				$this->prop("state"),
				'address1' => 			$address1,
				'address2' => 			$address2,
				'city' => 				$city
			);
			return $card;
		}
		
		protected function processStripe () {
			// get the setup file
			$ordering = 	$this->ordering_data;
			$default_currency = 			$ordering->getNodeVal("data.ordering.default_currency");
			$stripe_api_key = 				$ordering->getNodeVal("data.payment_gateway.stripe_api_key");
				$stripe_api_key = 				base64_decode($stripe_api_key);
			$stripe_charge_description =	$ordering->getNodeVal("data.payment_gateway.stripe_charge_description");
			// create the charge
			$gateway = Omnipay::create('Stripe');
			$gateway->setApiKey($stripe_api_key);
			try {
				$purchase = $gateway->purchase(array(
					'amount' => 		$this->prop("gross"), 
					'currency' => 		$default_currency, 
					'description' => 	$stripe_charge_description . " (" . $this->prop("orderid") . ")", 
					'card' => 			$this->getCardInfo()
				))->send();
				if ($purchase->isSuccessful()) {
					$this->prop("transactionid", $purchase->getTransactionReference());
					$this->flag_success = true;
				} else {
					switch ($purchase->getCode()) {
						case "incorrect_number" :
						case "invalid_number" :
							$error = "invalid_card_type";
							break;
						case "invalid_expiry_month" :
						case "invalid_expiry_year" :
							$error = "invalid_expiration";
							break;
						case "incorrect_cvc" :
						case "invalid_cvc" :
							$error = "cvv_invalid";
							break;
						case "expired_card" :
							$error = "card_expired";
							break;
						case "incorrect_zip" :
							$error = "zip_code_no_match";
							break;
						case "card_declined" :
						case "processing_error" :
							$error = "processor_declined";
							break;
					}
					$this->flag_error = $error;
					$this->flag_success = false;
				}
				$response = $purchase->getData();
			} catch( \Exception $e ) {
				switch ($e->getMessage()) {
					case "The number parameter is required" :
						$error = "invalid_card_type";
						break;
					case "Card has expired" :
						$error = "card_expired";
						break;
					case "Card number is invalid" :
					case "Card number should have 12 to 19 digits" :
						$error = "invalid_card_type";
						break;
				}
				$this->flag_error = $error;
				$this->flag_success = false;
				$response = array();
			}
			$this->flag_logdata = var_export($response, true);
		}

		protected function doPaypalIPN () {
			$post = array_map("stripslashes", $_POST);
			$logdata = "";
			$validation = "";
			// try validating it via the "standard" paypal way
			// read the post from PayPal system and add 'cmd'
			$req = 'cmd=_notify-validate';
			foreach ($post as $key => $value) {
				$value = urlencode($value);
				$req .= "&$key=$value";
			}
			// post back to PayPal system to validate
			$fp = @fsockopen ('ssl://www.paypal.com', 443, $errno, $errstr, 30);
			if ($fp) {
				$header = "POST /cgi-bin/webscr HTTP/1.1\r\n";
				$header .= "Content-Type: application/x-www-form-urlencoded\r\n";
				$header .= "Host: www.paypal.com\r\n";
				$header .= "Connection: close\r\n";
				$header .= "Content-Length: " . strlen($req) . "\r\n\r\n";
				fputs ($fp, $header . $req);
				while (!feof($fp)) {
					$res = fgets ($fp, 1024);
					$res = trim($res); //NEW & IMPORTANT
					if (strcmp($res, "VERIFIED") == 0) {
						$this->flag_success = true;
						$validation = "VERIFIED";
					} else if (strcmp ($res, "INVALID") == 0) {
						$this->flag_success = false;
						$validation = "INVALID";
					}
				}
				fclose($fp);
			} else {
				// for now, flag this as false, and call it an http error
				$this->flag_success = false;
				$validation = "UNKNOWN";
				// ok, ssl sockets didn't work, let's try a curl based implementation
				$ch = curl_init("https://www.paypal.com/cgi-bin/webscr");
				if ($ch != false) {
					curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);
					curl_setopt($ch, CURLOPT_POST, 1);
					curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
					curl_setopt($ch, CURLOPT_POSTFIELDS, $req);
					//curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 1);
					//curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
					curl_setopt($ch, CURLOPT_FORBID_REUSE, 1);
					//curl_setopt($ch, CURLOPT_HEADER, 1);
					//curl_setopt($ch, CURLINFO_HEADER_OUT, 1);
					curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 30);
					curl_setopt($ch, CURLOPT_HTTPHEADER, array('Connection: Close'));
					//curl_setopt($ch, CURLOPT_CAINFO, $cert);
					$res = curl_exec($ch);
					$res = trim($res); //NEW & IMPORTANT
					curl_close($ch);
					if (strcmp ($res, "VERIFIED") == 0) {
						$this->flag_success = true;
						$validation = "VERIFIED";
					} else if (strcmp ($res, "INVALID") == 0) {
						$this->flag_success = false;
						$validation = "INVALID";
					}
				}
				
			}
			// add the validation type
			$logdata .= "IPN Validated\t" . $validation . "\n";
			foreach ($post as $key => $value) {
				$logdata .= $key . "\t" . $value . "\n";
			}
			// create log data
			$this->flag_logdata = $logdata;
			// pull the important stuff
			$payment_status = 		isset($post['payment_status']) ? $post['payment_status'] : "";
			$custom = 				isset($post['custom']) ? $post['custom'] : "--------";
			$first_name = 			isset($post['first_name']) ? $post['first_name'] : "";
			$last_name = 			isset($post['last_name']) ? $post['last_name'] : "";
			$address_zip = 			isset($post['address_zip']) ? $post['address_zip'] : "";
			$address_state = 		isset($post['address_state']) ? $post['address_state'] : "";
			$address_status = 		isset($post['address_status']) ? $post['address_status'] : "";
			$address_name = 		isset($post['address_name']) ? $post['address_name'] : "";
			$address_street = 		isset($post['address_street']) ? $post['address_street'] : "";
			$address_city = 		isset($post['address_city']) ? $post['address_city'] : "";
			$address_country = 		isset($post['address_country']) ? $post['address_country'] : "";
			$invoice = 				isset($post['invoice']) ? $post['invoice'] : "";
			$txn_id = 				isset($post['txn_id']) ? $post['txn_id'] : "";
			$payer_email = 			isset($post['payer_email']) ? $post['payer_email'] : "";
			$contact_phone = 		isset($post['contact_phone']) ? $post['contact_phone'] : "";
			$address_country_code = isset($post['address_country_code']) ? $post['address_country_code'] : "";
			$mc_gross = 			isset($post['mc_gross']) ? $post['mc_gross'] : "0";
			$shipping = 			isset($post['shipping']) ? $post['shipping'] : "0";
			$handling_amount = 		isset($post['handling_amount']) ? $post['handling_amount'] : "0";
			$tax = 					isset($post['tax']) ? $post['tax'] : "0";
			$option_selection1 = 	isset($post['option_selection1']) ? $post['option_selection1'] : "";
			// if valid, create our data object
			if ( $this->flag_success==true && $payment_status=="Completed" ) {
				$custom = explode("-", $custom); // setid + "-" + session_hash + "-" + subtotal + "-" + discount + "-" + discount_code
				$shipping_address = "";
				if (strlen($address_status)>0) {
					$shipping_address .= $address_name . "\n";
					$shipping_address .= $address_street . "\n";
					$shipping_address .= $address_city . "," . $address_state . " " . $address_zip . "\n";
					$shipping_address .= $address_country;
					$shipping_address = str_replace("\t", "     ", $shipping_address);
					$shipping_address = str_replace("\n", "<[[BR]]>", $shipping_address);
					$shipping_address = str_replace("\r", "<[[BR]]>", $shipping_address);
				}
				$shipping_type = $shipping_address=="" ? "local" : "ship";
				// set all the variables
				$this->flag_setid = $custom[0];
				$this->flag_session_hash = $custom[1];
				$this->prop("orderid", $invoice);
				$this->prop("setid", $this->flag_setid);
				$this->prop("payment_type", "paypal");
				$this->prop("transactionid", $txn_id);
				$this->prop("shipping_type", $shipping_type);
				$this->prop("discount_code", $custom[4]);
				$this->prop("full_name",  "$first_name $last_name");
				$this->prop("email_address",  $payer_email);
				$this->prop("phone_number",  $contact_phone);
				$this->prop("shipping_address",  $shipping_address);
				$this->prop("country",  $address_country_code);
				$this->prop("postal_code",  $address_zip);
				$this->prop("state", $address_state);
				$this->prop("gross", $mc_gross);
				$this->prop("subtotal", $custom[2]);
				$this->prop("discount", $custom[3]);
				$this->prop("shipping", $shipping);
				$this->prop("handling", $handling_amount);
				$this->prop("tax", $tax);
				$this->prop("taxrate", $custom[5]);
				$this->prop("prices_include_tax", ($custom[6]=="1"?"true":"false"));
				$this->prop("shipping_taxable", ($custom[7]=="1"?"true":"false"));
				$this->prop("handling_taxable", ($custom[8]=="1"?"true":"false"));
				$this->prop("comments", $option_selection1);
			} else {
				$this->prop("orderid", $invoice);
				$this->flag_success = false;
			}
		}

	}

?>
