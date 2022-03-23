<?php

	@include_once(SA_NAMESPACE."-auth.php");

	class Auth {
		
		public $cookie_name = 		array();
		public $post = 				array();
		public $cookie = 			array();
		public $standalone = 		true;
		public $hub = 				false;
		public $action = 			"";
		public $auth_subdomain = 	"members";
		public $auth_uri = 			"";
		public $auth_login = 		"";
		public $timeout = 			10;

		public function start() {
			return $this->startHub();
		}

		public function token() {
			return $this->getToken();
		}

		public function authenticate() {
			return $this->getAuthentication();
		}

		public function check() {
			return $this->checkLogin();
		}

		public function invalidate() {
			return $this->clearAuthentication();
		}

		public function validate ($expiration) {
			return $this->runValidation($expiration);
		}

		public function __construct() {
			global $CONFIG;
			$this->post = 			array_map("stripslashes", array_merge($_GET, $_POST));
			$this->cookie = 		array_map("stripslashes", $_COOKIE);
			$this->cookie_name = 	md5($CONFIG->getNodeVal("setup.product"));
			$this->standalone = 	$CONFIG->getNodeVal("setup.standalone")=="true";
			$this->hub = 			$CONFIG->getNodeVal("setup.hub")=="true";
			$this->action = 		$this->getRequestVariable("action");
			if (file_exists("/var/www/domains/members.server")) {
				$this->auth_subdomain = file_get_contents("/var/www/domains/members.server");
			}
			$this->auth_uri = 		"http://" . $this->auth_subdomain . ".intothedarkroom.com/product-reauth";
			$this->auth_login = 	"http://" . $this->auth_subdomain . ".intothedarkroom.com/login";
		}

		protected function getRequestVariable ($name, $default="") {
			if (isset($this->post[$name])&&strlen($this->post[$name])>0) {
				if ($default==null&&$this->post[$name]=="null") {
					return null;
				}
				return $this->post[$name];
			}
			return $default;
		}

		protected function getCookieValue ($name, $default="") {
			if (isset($this->cookie[$name])&&strlen($this->cookie[$name])>0) {
				if ($default==null&&$this->cookie[$name]=="null") {
					return null;
				}
				return $this->cookie[$name];
			}
			return $default;
		}

		protected function getSecretKey ($str) {
			if (function_exists("auth_get_secret_key")) {
				return auth_get_secret_key($str);
			}
			return $str;
		}

		protected function getToken() {
			if ($this->standalone) {
				if ($this->hub) {
					return $this->runValidation(0);
				} else {
					$this->clearAuthentication();
					return "";
				}
			} else {
				return $this->runValidation(0);
			}
		}

		protected function checkForAnonymousUpload() {
			if (substr($this->action, -7)=="_upload") {
				$cookie_name = $this->cookie_name;
				$cookie_value = $this->getRequestVariable($cookie_name);
				$cookie_hash = md5($cookie_value);
				$cookie_file = SA_DIR_TEMP . "/upload.$cookie_hash.tmp";
				if (file_exists($cookie_file)) {
					$now = time();
					$created = @filemtime($cookie_file);
					if ($now-$created<3600) { // one hour to complete an upload session, right?
						return true;
					}
				}
			}
			return false;
		}

		protected function validateToken() {
			global $CONFIG;
			/* if no incoming token, it's not authenticated
				*/
			$token = $this->getRequestVariable("token");
			if ($token=="") {
				return false;
			}
			/* ok, we've got a token, let's see if our cookie matches up
				*/
			$cookie_name = $this->cookie_name;
			$cookie_value = isset($_COOKIE[$cookie_name]) ? $_COOKIE[$cookie_name] : null;
			/* if no cookie, see if it's an upload call where cookies don't work
				*/
			if ($cookie_value==null||strlen($cookie_value)==0) {
				return $this->checkForAnonymousUpload();
			}
			/* ok, if we're this far, time to check to see if our cookie is legit
				*/
			$cookie_fragments = str_replace("-", "", $cookie_value);
			$cookie_fragments = explode(".", $cookie_fragments);
			if (count($cookie_fragments)!=2) { // invalid cookie format
				return false;
			}
			$cookie_product_hash = $cookie_fragments[0];
			$cookie_shared_key_hash = $cookie_fragments[1];
			$cookie_product_hash_actual = md5($CONFIG->getNodeVal("setup.product_key"));
			$cookie_shared_key_hash_actual = sha1($token);
			if ($cookie_product_hash!=$cookie_product_hash_actual) {
				return false;
			}
			if ($cookie_shared_key_hash!=$cookie_shared_key_hash_actual) {
				return false;
			}
			return true;
		}

		protected function validateSignature ($keys, $signature, $timestamp) {
			$valid = false;
			$checksum = "";
			foreach ($keys as $key => $value) {
				$checksum .= $timestamp . "_" . $key . ":::" . $value;
			}
			$checksum .= $this->getSecretKey($timestamp);
			$checksum = md5($checksum);
			return $checksum === $signature;
		}

		protected function validateHub() {
			$response = 	false;
			$cookie_name = 	$this->cookie_name;
			$signature = 	$this->getCookieValue("$cookie_name-signature");
			$timestamp = 	$this->getCookieValue("$cookie_name-timestamp");
			$keys = 		$this->getCookieValue("$cookie_name-keys");
			$reauth = 		$this->getCookieValue("$cookie_name-reauth");
			if ($signature!="" && $timestamp!="" && $keys!="" && $reauth!="") {
				$keys = unserialize(base64_decode($keys));
				if ((time()-$reauth)>$this->timeout) {
					$response = Func::getRemotePage($this->auth_uri . "/" . $signature . "/" . $this->getSecretKey($signature) . "/go.html");
					if ($response==1) {
						setcookie("$cookie_name-reauth", time()+$this->timeout, time()+3600);
						$response = true;
					} else {
						$response = false;
					}
				} else {
					$response = $this->validateSignature($keys, $signature, $timestamp);
				}
			}
			if ($response==false) {
				$response = $this->checkForAnonymousUpload();
			}
			if ($response==false) {
				$this->clearAuthentication();
			}
			return $response;
		}

		protected function startHub() {
			global $CONFIG;
			if ($this->standalone) {
				$admin_url = Func::getBaseUrl() . "/" . SA_DIR_INDEXPATH . "?/admin/";
				if ($this->hub) {
					$fields = 		array('ProductKey', 'ProductVersion', 'UserID', 'DateCreated', 'DomainName');
					$cookie_name = 	$this->cookie_name;
					$signature = 	"";
					$timestamp = 	"";
					$keys = 		array();
					foreach ($this->post as $key => $value) {
						if ($key=="auth_signature") {
							$signature = $value;
						} else if ($key=="auth_timestamp") {
							$timestamp = $value;
						} else if (in_array($key, $fields)) {
							$keys[$key] = $value;
						}
					}
					$keys = base64_encode(serialize($keys));
					if ($signature!="" && $timestamp!="") {
						setcookie("$cookie_name-signature", $signature, time()+3600);
						setcookie("$cookie_name-timestamp", $timestamp, time()+3600);
						setcookie("$cookie_name-keys", $keys, time()+3600);
						setcookie("$cookie_name-reauth", time()+$this->timeout, time()+3600);
						return $admin_url;
					} else {
						return $this->auth_login . '/' . $CONFIG->getNodeVal("setup.install_id") . '/go.html';
					}
				} else {
					return Func::getBaseUrl() . "/" . SA_DIR_INDEXPATH . "?/admin/";
				}
			} else {
				return Func::getBaseUrl() . "/wp-admin/";
			}
		}

		protected function validateWP() {
			$response = current_user_can("edit_pages");
			if ($response==false) {
				$response = $this->checkForAnonymousUpload();
			}
			if ($response==false) {
				$this->clearAuthentication();
			}
			return $response;
		}

		protected function checkLogin() {
			global $CONFIG;
			if ($this->standalone) {
				if ($this->hub) {
					$valid = $this->validateHub();
					if ($valid==false) {
						$this->doRedirect($this->auth_login . '/' . $CONFIG->getNodeVal("setup.install_id") . '/go.html');
					}
				}
			} else {
				$valid = $this->validateWP();
				if ($valid==false) {
					$this->doRedirect(Func::getBaseUrl() . "/wp-admin/");
				}
			}
		}

		protected function getAuthentication() {
			$response = false;
			if ($this->standalone) {
				if ($this->hub) {
					$response = $this->validateToken() && $this->validateHub();
				} else {
					$response = $this->validateToken();
				}
			} else {
				$response = $this->validateToken() && $this->validateWP();
			}
			return array(
				"authenticated" => $response,
				"admin" => true
			);
		}

		protected function runValidation($expiration) {
			global $CONFIG;
			$shared_key = uniqid(mt_rand(), true);
			$cookie_name = md5($CONFIG->getNodeVal("setup.product"));
			$cookie_product_hash = Func::fragmentString(md5($CONFIG->getNodeVal("setup.product_key")));
			$cookie_shared_key_hash = Func::fragmentString(sha1($shared_key));
			$cookie_value =  $cookie_product_hash . "." . $cookie_shared_key_hash;
			setcookie($cookie_name, $cookie_value, $expiration);
			return $shared_key;
		}

		protected function clearAuthentication() {
			$cookie_name = $this->cookie_name;
			setcookie($cookie_name, "", time() - 3600);
			if ($this->hub) {
				setcookie("$cookie_name-signature", "", time() - 3600);
				setcookie("$cookie_name-timestamp", "", time() - 3600);
				setcookie("$cookie_name-keys", "", time() - 3600);
				setcookie("$cookie_name-reauth", "", time() - 3600);
			}
		}

		protected function doRedirect ($uri) {
			header("Location: $uri");
			exit;
		}

	}

?>