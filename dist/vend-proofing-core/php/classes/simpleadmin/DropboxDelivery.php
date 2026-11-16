<?php

	/** Dropbox's implementation of purchased-file copies and folder delivery. */
	class DropboxDelivery {
		public static function snapshot (int $assetId, string $quality): array {
			$query = Database::connection()->prepare("SELECT * FROM media_assets WHERE id = ?");
			$query->execute(array($assetId));
			$asset = $query->fetch();
			$meta = json_decode($asset["metadata_json"] ?? "{}", true);
			if (empty($meta["dropbox_id"]) || empty($meta["dropbox_rev"]) || !in_array($quality, array("high", "low"), true)) {
				throw new RuntimeException("Sync the purchased Dropbox image before ordering.");
			}
			return array("provider" => "dropbox", "app" => hash("sha256", DropboxClient::setting("dropbox_api_key")),
				"id" => $meta["dropbox_id"], "rev" => $meta["dropbox_rev"], "quality" => $quality,
				"name" => $asset["original_name"], "size" => (int) $meta["original_size"]);
		}

		public function copy (array $source, string $destination): void {
			if ($source["app"]!==hash("sha256", DropboxClient::setting("dropbox_api_key"))) {
				throw new RuntimeException("Reconnect the Dropbox app used for this purchase.");
			}
			$client = new DropboxClient();
			if ($source["quality"]==="low") {
				$bytes = $client->thumbnail($source["rev"]);
				$image = @getimagesizefromstring($bytes);
				if (!$image || $image[2]!==IMAGETYPE_JPEG) throw new RuntimeException("Dropbox did not return a web-size JPEG.");
				$client->upload($destination, $bytes);
				return;
			}
			$reference = $client->rpc("files/copy_reference/get", array("path" => "rev:" . $source["rev"]));
			$original = $reference["metadata"];
			if ($original["id"]!==$source["id"] || $original["rev"]!==$source["rev"]) {
				throw new RuntimeException("The purchased image revision is unavailable.");
			}
			// A prior request may have copied the file before losing its response.
			try {
				$existing = $client->rpc("files/get_metadata", array("path" => $destination));
				if (!empty($original["content_hash"]) && ($existing["content_hash"] ?? "")===$original["content_hash"]) return;
				throw new RuntimeException("The prepared file differs from the purchased image.");
			} catch (DropboxException $error) {
				if (!$error->missing()) throw $error;
			}
			$client->rpc("files/copy_reference/save", array("copy_reference" => $reference["copy_reference"], "path" => $destination));
		}

		public function link (string $folder, string $order, int $part): string {
			$client = new DropboxClient();
			$result = $client->rpc("sharing/list_shared_links", array("path" => $folder, "direct_only" => true));
			$url = $result["links"][0]["url"] ?? "";
			if ($url==="") {
				$result = $client->rpc("sharing/create_shared_link_with_settings", array("path" => $folder,
					"settings" => array("requested_visibility" => "public")));
				$url = $result["url"];
			}
			$parts = parse_url($url);
			if (($parts["scheme"] ?? "")!=="https" || !in_array($parts["host"] ?? "", array("www.dropbox.com", "dropbox.com"), true)) {
				throw new RuntimeException("Dropbox did not return a download link.");
			}
			parse_str($parts["query"] ?? "", $query);
			$query["dl"] = "1";
			return "https://" . $parts["host"] . $parts["path"] . "?" . http_build_query($query);
		}

		public function delete (string $root): void {
			try {
				(new DropboxClient())->rpc("files/delete_v2", array("path" => $root));
			} catch (DropboxException $error) {
				if (!$error->missing()) throw $error;
			}
		}
	}
