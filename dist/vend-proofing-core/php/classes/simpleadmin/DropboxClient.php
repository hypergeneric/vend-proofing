<?php

	/** Dropbox OAuth, gallery reads and delivery file operations. */
	class DropboxClient {
		public static $transport = null;
		private const TOKENS = array("dropbox_token", "dropbox_refresh_token", "dropbox_expires_at");
		private const PREFIX = "data.payment_gateway.";

		public static function setting (string $key): string {
			return (string) Configuration::getDocument("ordering")->getNodeVal(self::PREFIX . $key);
		}

		public static function authorize (): string {
			if (self::setting("dropbox_api_key")==="" || self::setting("dropbox_api_secret")==="") {
				throw new RuntimeException("Save the Dropbox app key and secret first.");
			}
			// No redirect: Dropbox displays a code to paste into the authenticated settings form.
			return "https://www.dropbox.com/oauth2/authorize?" . http_build_query(array(
				"client_id" => self::setting("dropbox_api_key"), "response_type" => "code", "token_access_type" => "offline"
			));
		}

		public static function forAdmin (string $json): string {
			$document = new ConfigurationDocument($json);
			$secret = $document->getNodeVal(self::PREFIX . "dropbox_api_secret");
			$connected = $document->getNodeVal(self::PREFIX . "dropbox_refresh_token");
			$document->editNode(self::PREFIX . "dropbox_api_key", null, "private=true;encoded=false");
			$document->editNode(self::PREFIX . "dropbox_api_secret", "", "private=true;encoded=false;secret=true;configured=" . ($secret ? "true" : "false"));
			$document->editNode(self::PREFIX . "dropbox_authorization_code", "", "private=true;encoded=false");
			foreach (self::TOKENS as $key) $document->editNode(self::PREFIX . $key, "", "access=h;private=true");
			$document->editNode(self::PREFIX . "dropbox_status", $connected ? "Connected" : "Not connected", "access=r");
			return $document->toRuntimeString();
		}

		/** Consume new authorization codes on save; browser fields never supply saved tokens. */
		public static function merge (string $json): string {
			$document = new ConfigurationDocument($json);
			$secretPath = self::PREFIX . "dropbox_api_secret";
			$secret = trim((string) $document->getNodeVal($secretPath));
			if ($secret==="" && $document->getAttrVal($secretPath . ".clear_secret")!=="true") $secret = self::setting("dropbox_api_secret");
			$document->editNode($secretPath, $secret, "clear_secret=false;private=true;secret=true;encoded=false");
			$key = trim((string) $document->getNodeVal(self::PREFIX . "dropbox_api_key"));
			$document->editNode(self::PREFIX . "dropbox_api_key", $key, "private=true;encoded=false");
			$changed = $key!==self::setting("dropbox_api_key") || $secret!==self::setting("dropbox_api_secret");
			foreach (self::TOKENS as $field) $document->editNode(self::PREFIX . $field, $changed ? "" : self::setting($field), "access=h;private=true");
			$code = trim((string) $document->getNodeVal(self::PREFIX . "dropbox_authorization_code"));
			if ($code!=="") {
				$result = self::tokenRequest($key, $secret, array("grant_type" => "authorization_code", "code" => $code));
				if (empty($result["refresh_token"])) throw new RuntimeException("Authorize Dropbox again to allow offline access.");
				self::setToken($document, $result);
				$document->editNode(self::PREFIX . "dropbox_refresh_token", $result["refresh_token"]);
			}
			$document->editNode(self::PREFIX . "dropbox_authorization_code", "", "private=true;encoded=false");
			return $document->toString();
		}

		public static function accessToken (): string {
			$document = Configuration::getDocument("ordering");
			$refresh = (string) $document->getNodeVal(self::PREFIX . "dropbox_refresh_token");
			if ($refresh==="") throw new RuntimeException("Connect Dropbox in the ordering settings first.");
			if ((int) $document->getNodeVal(self::PREFIX . "dropbox_expires_at") <= time() + 60) {
				$result = self::tokenRequest(self::setting("dropbox_api_key"), self::setting("dropbox_api_secret"), array("grant_type" => "refresh_token", "refresh_token" => $refresh));
				// Reload so a network request does not overwrite other settings saved while it ran.
				$document = Configuration::getDocument("ordering");
				self::setToken($document, $result);
				Configuration::save("ordering", null, $document->toString());
			}
			return (string) $document->getNodeVal(self::PREFIX . "dropbox_token");
		}

		private static function setToken (ConfigurationDocument $document, array $result): void {
			if (empty($result["access_token"]) || empty($result["expires_in"])) throw new RuntimeException("Dropbox did not return an access token.");
			$document->editNode(self::PREFIX . "dropbox_token", $result["access_token"]);
			$document->editNode(self::PREFIX . "dropbox_expires_at", (string) (time() + (int) $result["expires_in"]));
		}

		private static function tokenRequest (string $key, string $secret, array $parameters): array {
			if ($key==="" || $secret==="") throw new RuntimeException("Save the Dropbox app key and secret first.");
			$parameters["client_id"] = $key;
			$parameters["client_secret"] = $secret;
			$response = self::http("https://api.dropboxapi.com/oauth2/token", http_build_query($parameters), array("Content-Type: application/x-www-form-urlencoded"));
			return json_decode($response, true, 512, JSON_THROW_ON_ERROR);
		}

		public function listImages (string $folder): array {
			$result = $this->rpc("files/list_folder", array("path" => $folder, "recursive" => true));
			$images = array();
			do {
				foreach ($result["entries"] as $entry) {
					if ($entry[".tag"]==="file" && in_array(strtolower(pathinfo($entry["name"], PATHINFO_EXTENSION)), array("jpg", "jpeg", "png"), true)) $images[] = $entry;
				}
				if (!$result["has_more"]) break;
				$result = $this->rpc("files/list_folder/continue", array("cursor" => $result["cursor"]));
			} while (true);
			usort($images, fn ($a, $b) => strnatcasecmp($a["path_lower"], $b["path_lower"]));
			return $images;
		}

		public function rpc (string $path, array $parameters): array {
			$response = self::http("https://api.dropboxapi.com/2/" . $path, json_encode($parameters, JSON_THROW_ON_ERROR), array(
				"Authorization: Bearer " . self::accessToken(), "Content-Type: application/json"
			));
			return json_decode($response, true, 512, JSON_THROW_ON_ERROR);
		}

		public function thumbnail (string $revision): string {
			$parameters = array("resource" => array(".tag" => "path", "path" => "rev:" . $revision),
				"format" => "jpeg", "size" => "w1024h768", "mode" => "strict");
			return self::http("https://content.dropboxapi.com/2/files/get_thumbnail_v2", "", array(
				"Authorization: Bearer " . self::accessToken(), "Content-Type: application/octet-stream",
				"Dropbox-API-Arg: " . json_encode($parameters, JSON_THROW_ON_ERROR)
			));
		}

		public function upload (string $path, string $bytes): array {
			$response = self::http("https://content.dropboxapi.com/2/files/upload", $bytes, array(
				"Authorization: Bearer " . self::accessToken(), "Content-Type: application/octet-stream",
				"Dropbox-API-Arg: " . json_encode(array("path" => $path, "mode" => "overwrite", "mute" => true), JSON_THROW_ON_ERROR)
			));
			return json_decode($response, true, 512, JSON_THROW_ON_ERROR);
		}

		private static function http (string $url, string $body, array $headers): string {
			if (self::$transport) {
				list($status, $response) = (self::$transport)($url, $body, $headers);
			} else {
				$curl = curl_init($url);
				curl_setopt_array($curl, array(CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_HTTPHEADER => $headers,
					CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 30));
				$response = curl_exec($curl);
				$status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
				curl_close($curl);
			}
			// Do not send provider response bodies (which may contain credentials) to the admin UI.
			if ($status===401 || $status===400) throw new RuntimeException("Dropbox authorization failed. Reconnect in the ordering settings.");
			if ($status===429) throw new RuntimeException("Dropbox is busy. Please try syncing again later.");
			if ($status===409) {
				$error = json_decode($response, true)["error"] ?? array();
				throw new DropboxException($error);
			}
			if ($response===false || $status<200 || $status>=300) throw new RuntimeException("Dropbox request failed. Check the gallery folder and try again.");
			return $response;
		}
	}
