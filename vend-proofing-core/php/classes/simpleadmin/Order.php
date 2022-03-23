<?php

	use Omnipay\Omnipay;

	class Order {

		/* ---- Public Methods ---- */

		public function daysInMonth($month, $year) {
			return $month == 2 ? ($year % 4 ? 28 : ($year % 100 ? 29 : ($year % 400 ? 28 : 29))) : (($month - 1) % 7 % 2 ? 30 : 31);
		}

		public function getOrderSession ($oid, $msts) {
			$base_path = $this->getFuzzyOrderBasePath($oid, $msts);
			$session_path = "$base_path/set.$oid.table";
			return Flatfile::getTableArray($session_path);
		}

		public function deleteOrder ($oid, $msts) {
			$base_path = $this->getFuzzyOrderBasePath($oid, $msts);
			$session_path = "$base_path/set.$oid.table";
			// the log path, if any
			$log_path = "$base_path/$oid.payment.log";
			// the daily order table
			$table_path = "$base_path/set.order.table";
			$table_data = Flatfile::deleteTableRow($table_path, $oid);
			// do the dirty deed
			Filesystem::deleteFile($session_path);
			Filesystem::deleteFile($log_path);
			Flatfile::saveTableArray($table_path, $table_data);
		}

		public function getLogById($oid, $path=""){
			if ($path=="") $path = SA_DIR_STORAGE . "/orders";
			$handle = @opendir($path);
			$filepath = null;
			$paths = array();
			if ($handle) {
				while (false !== ( $file = readdir($handle) )) {
					if (is_link("$path/$file") || $file == '.' || $file == '..') continue;
					if (is_file("$path/$file")&&$file=="$oid.payment.log") {
						$filepath = "$path/$file";
					} else if (is_dir("$path/$file")) {
						$paths[] = "$path/$file";
					}
				}
				closedir($handle);
			}
			if ($filepath!=null) {
				return Filesystem::getFileData($filepath);
			}
			foreach ($paths as $subdir) {
				$response = $this->getLogById($oid, $subdir);
				if ($response!=null) {
					return $response;
				}
			}
			return null;
		}

		public function getOrderById($oid, $path=""){
			if ($path=="") $path = SA_DIR_STORAGE . "/orders";
			$handle = @opendir($path);
			$files = array();
			$paths = array();
			if ($handle) {
				while (false !== ( $file = readdir($handle) )) {
					if (is_link("$path/$file") || $file == '.' || $file == '..') continue;
					if (is_file("$path/$file")&&$file=="set.order.table") {
						$files[] = "$path/$file";
					} else if (is_dir("$path/$file")) {
						$paths[] = "$path/$file";
					}
				}
				closedir($handle);
			}
			foreach ($files as $tablepath) {
				$table = Flatfile::getTableArray($tablepath);
				if (isset($table[$oid])) {
					return $table[$oid];
				}
			}
			foreach ($paths as $subdir) {
				$response = $this->getOrderById($oid, $subdir);
				if ($response!=null) {
					return $response;
				}
			}
			return null;
		}

		public function search ($start, $end, $params=array()) {
			$date_start = explode("/", $start);
			$date_end = explode("/", $end);
			$startyear = $date_start[0];
			$endyear = $date_end[0];
			$response = array();
			$matchy = count($params)>0;
			for ($year=$startyear; $year<=$endyear; ++$year) {
				$startmonth = 1;
				$endmonth = 12;
				if ($year==$date_start[0]) {
					$startmonth = $date_start[1];
				}
				if ($year==$date_end[0]) {
					$endmonth = $date_end[1];
				}
				for ($month=$startmonth; $month<=$endmonth; ++$month) {
					$startday = 1;
					$endday = $this->daysInMonth($month, $year);
					if ($month==$date_start[1] && $year==$date_start[0]) {
						$startday = $date_start[2];
					}
					if ($month==$date_end[1] && $year==$date_end[0]) {
						$endday = $date_end[2];
					}
					for ($day=$startday; $day<=$endday; ++$day) {
						$path = SA_DIR_STORAGE . "/orders/$year/$month/$day/set.order.table";
						if (file_exists($path)) {
							$table = Flatfile::getTableArray($path);
							foreach ($table as $key => $arr) {
								$match = true;
								if ($matchy) {
									$match = false;
									if (isset($params["payment_type"])) {
										if ($arr[3]==$params["payment_type"]) $match = true;
									}
									if ($match==false&&isset($params["orderid"])) {
										if ($arr[0]==$params["orderid"]) $match = true;
									}
									if ($match==false&&isset($params["setid"])) {
										if ($arr[1]==$params["setid"]) $match = true;
									}
									if ($match==false&&isset($params["full_name"])) {
										if (stristr($arr[7], $params["full_name"])!==false) $match = true;
									}
									if ($match==false&&isset($params["email_address"])) {
										if (stristr($arr[8], $params["email_address"])!==false) $match = true;
									}
								}
								if ($match) $response[] = implode("\t", $arr);
							}
						}
					}
				}
			}
			return implode("\n", $response);
		}

		public function statsSearch ($start, $end) {
			$date_start = explode("/", $start);
			$date_end = explode("/", $end);
			$startyear = $date_start[0];
			$endyear = $date_end[0];
			$response = array();
			for ($year=$startyear; $year<=$endyear; ++$year) {
				$startmonth = 1;
				$endmonth = 12;
				if ($year==$date_start[0]) {
					$startmonth = $date_start[1];
				}
				if ($year==$date_end[0]) {
					$endmonth = $date_end[1];
				}
				for ($month=$startmonth; $month<=$endmonth; ++$month) {
					$startday = 1;
					$endday = $this->daysInMonth($month, $year);
					if ($month==$date_start[1] && $year==$date_start[0]) {
						$startday = $date_start[2];
					}
					if ($month==$date_end[1] && $year==$date_end[0]) {
						$endday = $date_end[2];
					}
					for ($day=$startday; $day<=$endday; ++$day) {
						$path = SA_DIR_STORAGE . "/orders/$year/$month/$day/set.order.table";
						$data = array("$year/$month/$day", "", "", 0, 0, 0, 0, 0, 0, 0);
						if (file_exists($path)) {
							$table = Flatfile::getTableArray($path);
							$timestamp = "$year/$month/$day";
							foreach ($table as $key => $arr) {
								$region = $arr[11] . "-" . $arr[13];
								$data = array();
								$data[] = $timestamp;			// timestamp
								$data[] = trim($region, "-");		// region
								$data[] = $arr[14];			// gross
								$data[] = $arr[15];			// subtotal
								$data[] = $arr[16];			// discount
								$data[] = $arr[17];			// shipping
								$data[] = $arr[18];			// handling
								$data[] = $arr[19];			// tax
								$response[] = implode("\t", $data);
							}
						} else {
							$data = array("$year/$month/$day", "", "0", "0", "0", "0", "0", "0");
							$response[] = implode("\t", $data);
						}
					}
				}
			}
			return implode("\n", $response);
		}

		public function verifyDiscountCode ($puid, $code, $subtotal) {
			// check to see if it's a local discount
			$discount_obj = null;
			$local_discounts = Flatfile::getSetTable("discount", $puid);
			foreach ($local_discounts as $key => $arr) {
				if ($arr[1]==$puid&&$arr[2]==$code) {
					$discount_obj = $arr;
					break;
				}
			}
			if ($discount_obj==null) { // if here, no local discounts
				$global_discounts = Flatfile::getSetTable("discount");
				foreach ($global_discounts as $key => $arr) {
					if ($arr[2]==$code) {
						$discount_obj = $arr;
						break;
					}
				}
			}
			if ($discount_obj==null) { // does not exist
				return array (false, "discount_does_not_exist");
			}
			// ok, discount match, lets see if it's still valid
			$expires_on_date = $discount_obj[7];
			$expired = false;
			if ($expires_on_date>0&&strlen($expires_on_date)>0&&$expires_on_date!=null) {
				$expires_on_date_actual = $expires_on_date/1000;
				$expires_on_date_actual = $expires_on_date_actual - $this->timezone_offset - (date("I", $expires_on_date_actual)==1?3600:0);
				$expired = $expires_on_date_actual < time();
			}
			if ($expired==true) { // check the expiration first
				return array (false, "discount_expired");
			}
			if ($discount_obj[6]>0&&$discount_obj[5]>=$discount_obj[6]) { // check to see if there are any more slots
				return array (false, "discount_maximum_uses_filled");
			}
			if (isset($discount_obj[8])&&$discount_obj[8]>$subtotal) { // check to see if the cart min has been fulfilled
				return array (false, "discount_cart_minimum_not_fulfilled");
			}
			return array(true, implode("\t", $discount_obj));
		}

		public function applyDiscountCode ($puid, $code) {
			// check to see if it's a local discount
			$local = false;
			$data;
			$table = Flatfile::getSetTable("discount", $puid);
			foreach ($table as $key => $arr) {
				if ($arr[1]==$puid&&$arr[2]==$code) {
					$local = true;
					$data = $arr;
					break;
				}
			}
			if ($local==false) { // if here, no local discounts
				$table = Flatfile::getSetTable("discount");
				foreach ($table as $key => $arr) {
					if ($arr[2]==$code) {
						$data = $arr;
						break;
					}
				}
			}
			if ($local==false) $puid = null;
			$data[5] = $data[5]+1;
			$table = Flatfile::updateSetTable("discount", $data, $puid);
			Flatfile::saveSetTable($table, "discount", $puid);
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
			}
			if ($this->flag_type=="merchant") {
				$this->processCreditCard();
			}
			$this->fileLog();
			if ($this->flag_success==true) {
				$this->createOrder();
				$this->sendMails();
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
			$this->setup_data = 			Flatfile::getXmlArray("setup");
			$this->ordering_data = 			Flatfile::getXmlArray("ordering");
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
		
		protected function getFuzzyOrderBasePath($oid, $msts){
			$timestamp_ms = $msts/1000;
			$timestamp = $timestamp_ms - $this->timezone_offset - (date("I", $timestamp_ms)==1?3600:0);
			$order_year = date("Y", $timestamp);
			$order_month = date("n", $timestamp);
			$order_day = date("j", $timestamp);
			$order_path = SA_DIR_STORAGE . "/orders/$order_year/$order_month/$order_day/set.$oid.table";
			if (file_exists($order_path)==false) {
				// check the day before
				$order_path = SA_DIR_STORAGE . "/orders/$order_year/$order_month/" . ($order_day+1) . "/set.$oid.table";
				if (file_exists($order_path)==false) {
					// check the day after
					$order_path = SA_DIR_STORAGE . "/orders/$order_year/$order_month/" . ($order_day-1) . "/set.$oid.table";
					if (file_exists($order_path)==false) {
						// ok still no file -- look within the month
						$order_path = $this->getSessionPathById($oid, SA_DIR_STORAGE . "/orders/$order_year/$order_month");
						if (file_exists($order_path)==false) {
							// ok still no file -- look within the year
							$order_path = $this->getSessionPathById($oid, SA_DIR_STORAGE . "/orders/$order_year");
							if (file_exists($order_path)==false) {
								// ok still no file -- full search
								$order_path = $this->getSessionPathById($oid);
							}
						}
					}
				}
			}
			// get the order base path
			$base_path = explode("/", $order_path);
			array_pop($base_path);
			return implode("/", $base_path);
		}

		protected function getSessionPathById($oid, $path=""){
			if ($path=="") $path = SA_DIR_STORAGE . "/orders";
			$handle = @opendir($path);
			if ($handle) {
				while (false !== ( $file = readdir($handle) )) {
					$subpath = "$path/$file";
					if (is_link($subpath) || $file == '.' || $file == '..') continue;
					if (is_file($subpath)) {
						if ($file=="set.$oid.table") {
							return $subpath;
						}
					} else if (is_dir("$path/$file")) {
						$result = $this->getSessionPathById($oid, $subpath);
						if ($result!=null) {
							return $result;
						}
					}
				}
				closedir($handle);
			}
			return null;
		}

		protected function sendMails () {
			// get data stuff
			$ordering = $this->ordering_data;
			$contact = Flatfile::getXmlArray("contact", null, true);
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
				$path = SA_DIR_STORAGE . "/orders/" . implode("/", $this->flag_order_timestamp) . "/" . $this->prop("orderid") . ".payment.log";
				Filesystem::makeFile($path, $logdata, "a");
			}
		}

		protected function createOrder () {
			// set the time in the data
			$timestamp_ms = time()*1000;
			$timestamp = $timestamp_ms - $this->timezone_offset - (date("I", $timestamp_ms)==1?3600:0);
			$this->prop("timestamp", $timestamp);
			// load the original session file
			$path = SA_DIR_STORAGE . "/" . $this->flag_setid . "/set." . $this->flag_session_hash . ".table";
			$finalpath = SA_DIR_STORAGE . "/orders/" . implode("/", $this->flag_order_timestamp) . "/set." . $this->prop("orderid") . ".table";
			if ( file_exists($path)==true && file_exists($finalpath)==false ) {
				// load the local original session file
				$lineitems = Flatfile::getTableArray($path);
				// create a copy of the user's favorites
				$favorites = array();
				foreach($lineitems as $hash => $lineitem) {
					if (substr($hash, -2)=="-f") $favorites[$hash] = $lineitem;
				}
				// save only the favorites to the local session
				Flatfile::saveTableArray($path, $favorites);
				// save the original table to the final order path
				Flatfile::saveTableArray($finalpath, $lineitems);
			}
			// create/add to the daily order table
			$path = SA_DIR_STORAGE . "/orders/" . implode("/", $this->flag_order_timestamp) . "/set.order.table";
			$table = Flatfile::updateTableRow($path, $this->flag_order_array);
			Flatfile::saveTableArray($path, $table);
		}

		protected function processCreditCard () {
			// get the setup file
			$ordering = $this->ordering_data;
			$merchant_gateway = $ordering->getNodeVal("data.payment_gateway.merchant_gateway");
			if ($merchant_gateway=="paypal") $this->processPaypalMerchant();
			else if ($merchant_gateway=="authorizedotnet") $this->processAuthorizeDotNet();
			else if ($merchant_gateway=="stripe") $this->processStripe();
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
		
		protected function processAuthorizeDotNet () {
			// get the setup file
			$ordering = 	$this->ordering_data;
			$default_currency = $ordering->getNodeVal("data.ordering.default_currency");
			$authorize_net_login = $ordering->getNodeVal("data.payment_gateway.authorize_net_login");
				$authorize_net_login = base64_decode($authorize_net_login);
			$authorize_net_transkey = $ordering->getNodeVal("data.payment_gateway.authorize_net_transkey");
				$authorize_net_transkey = base64_decode($authorize_net_transkey);
			// create the charge
			$gateway = Omnipay::create('AuthorizeNet_AIM');
			$gateway->setApiLoginId($authorize_net_login);
			$gateway->setTransactionKey($authorize_net_transkey);
			//$gateway->setDeveloperMode(true);
			$gateway->setDuplicateWindow(0);
			try {
				$purchase = $gateway->purchase(array(
					'amount' => 		$this->prop("gross"), 
					'currency' => 		$default_currency, 
					'card' => 			$this->getCardInfo()
				))->setInvoiceNumber($this->prop("orderid"))->setDescription("Vend Purchase")->send();
				if ($purchase->isSuccessful()) {
					$this->prop("transactionid", $purchase->getTransactionReference());
					$this->flag_success = true;
				} else {
					$responseCode = $purchase->getResultCode();
					$avsResultCode = $purchase->getAVSCode();
					$cvvResultCode = $purchase->getData()->transactionResponse[0]->cvvResultCode;
					$error = "general_error";
					switch ($responseCode) {
						case "3" :
						case "4" :
							break;
						case "2" :
							$error = "processor_declined";
							switch ($avsResultCode) {
								case "A" :
								case "N" :
									$error = "zip_code_no_match";
									break;
								case "R" :
									$error = "temporarily_unavailable";
									break;
								case "B" :
								case "E" :
								case "G" :
								case "S" :
								case "U" :
								case "W" :
								case "Z" :
									$error = "gateway_decline";
									break;
								case "P" :
								case "X" :
								case "Y" :
							}
							switch ($cvvResultCode) {
								case "N" :
									$error = "cvv_invalid";
									break;
								case "S" :
								case "U" :
									$error = "gateway_decline";
									break;
								case "M" :
								case "P" :
							}
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

		protected function processPaypalMerchant () {
			// get the setup file
			$ordering = 	$this->ordering_data;
			$default_currency = $ordering->getNodeVal("data.ordering.default_currency");
			$paypal_merchant_username = $ordering->getNodeVal("data.payment_gateway.paypal_merchant_username");
				$paypal_merchant_username = base64_decode($paypal_merchant_username);
			$paypal_merchant_password = $ordering->getNodeVal("data.payment_gateway.paypal_merchant_password");
				$paypal_merchant_password = base64_decode($paypal_merchant_password);
			$paypal_merchant_api_key = $ordering->getNodeVal("data.payment_gateway.paypal_merchant_api_key");
				$paypal_merchant_api_key = base64_decode($paypal_merchant_api_key);
			// create the charge
			$gateway = Omnipay::create('PayPal_Pro');
			$gateway->setUsername($paypal_merchant_username);
			$gateway->setPassword($paypal_merchant_password);
			$gateway->setSignature($paypal_merchant_api_key);
			//$gateway->setTestMode(true);
			try {
				$purchase = $gateway->purchase(array(
					'amount' => 		$this->prop("gross"), 
					'currency' => 		$default_currency, 
					'card' => 			$this->getCardInfo()
				))->setDescription("Vend Purchase")->send();
				if ($purchase->isSuccessful()) {
					$this->prop("transactionid", $purchase->getTransactionReference());
					$this->flag_success = true;
				} else {
					$data = $purchase->getData();
					$responseCode = $data['L_ERRORCODE0'];
					$avsResultCode = isset($data['AVSCODE']) ? $data['AVSCODE'] : "";
					$cvvResultCode = isset($data['CVV2MATCH']) ? $data['CVV2MATCH'] : "";
					$error = "general_error";
					switch ($responseCode) {
						case "10001" :
						case "10002" :
						case "10014" :
						case "10102" :
						case "10761" :
						case "10764" :
							$error = "temporarily_unavailable";
							break;
						case "10069" :
						case "10537" :
						case "10538" :
						case "10539" :
						case "10540" :
						case "10554" :
						case "10555" :
						case "10556" :
						case "10626" :
						case "11611" :
						case "11821" :
						case "12000" :
						case "12001" :
						case "12203" :
							$error = "filter_declined";
							break;
						case "10216" :
						case "10505" :
						case "10544" :
						case "10545" :
						case "10546" :
						case "10561" :
						case "10564" :
						case "10754" :
						case "10759" :
						case "15001" :
						case "15002" :
						case "15011" :
							$error = "gateway_decline";
							break;
						case "10422" :
						case "10510" :
						case "10519" :
						case "10521" :
						case "10527" :
						case "10534" :
						case "10535" :
						case "10541" :
						case "10558" :
						case "10566" :
						case "10570" :
						case "10752" :
							$error = "invalid_card_type";
							break;
						case "10502" :
						case "15007" :
							$error = "card_expired";
							break;
						case "10504" :
						case "10748" :
						case "10762" :
						case "15004" :
							$error = "cvv_invalid";
							break;
						case "10508" :
						case "10562" :
						case "10563" :
							$error = "invalid_expiration";
							break;
						case "10578" :
						case "10606" :
						case "13112" :
						case "13113" :
						case "13122" :
						case "15005" :
						case "15006" :
							$error = "processor_declined";
							break;
						case "10706" :
						case "10712" :
						case "10716" :
						case "10717" :
						case "10724" :
						case "10730" :
						case "10734" :
						case "10735" :
							$error = "zip_code_no_match";
							break;
					}
					switch ($avsResultCode) {
						case "C" :
						case "E" :
						case "N" :
						case "1" :
							$error = "zip_code_no_match";
							break;
						case "R" :
							$error = "temporarily_unavailable";
							break;
					}
					switch ($cvvResultCode) {
						case "E" :
						case "I" :
						case "N" :
						case "S" :
						case "U" :
						case "X" :
							$error = "cvv_invalid";
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