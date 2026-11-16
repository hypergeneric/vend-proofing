<?php

	/** Invoice delivery state. Entitlement stays with Payments; provider work stays in its adapter. */
	class Downloads {
		public static function images (string $gallery): array {
			return array_filter(Records::getFileTable("image", $gallery), fn ($row) =>
				in_array(strtolower(pathinfo($row[0], PATHINFO_EXTENSION)), array("jpg", "jpeg", "png"), true));
		}

		public static function snapshot (string $gallery, int $assetId, string $quality): array {
			return Records::pageType($gallery)==="DropboxSet" ? DropboxDelivery::snapshot($assetId, $quality) : LocalDelivery::snapshot($assetId, $quality);
		}

		private static function provider (array $state): DropboxDelivery|LocalDelivery {
			return match ($state["items"][0]["source"]["provider"]) {
				"dropbox" => new DropboxDelivery(),
				"local" => new LocalDelivery(),
				default => throw new RuntimeException("Unsupported download storage.")
			};
		}

		private static function progress (array $state): float {
			$local = self::provider($state) instanceof LocalDelivery;
			return ($state["done"] + ($local ? $state["packed"] : 0)) / (count($state["items"]) + ($local ? $state["parts"] : 0));
		}

		private static function read (string $order): ?array {
			$query = Database::connection()->prepare("SELECT state_json FROM download_jobs WHERE order_suid = ?");
			$query->execute(array($order));
			$json = $query->fetchColumn();
			return $json===false ? null : json_decode($json, true, 512, JSON_THROW_ON_ERROR);
		}

		private static function save (string $order, array $state): void {
			Database::connection()->prepare("INSERT INTO download_jobs (order_suid, state_json, updated_at) VALUES (?, ?, ?)
				ON CONFLICT(order_suid) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at")
				->execute(array($order, json_encode($state, JSON_THROW_ON_ERROR), time()));
		}

		/** Serialize an order's browser requests without holding a SQLite lock during network calls. */
		private static function locked (string $order, callable $work): mixed {
			$lock = fopen(SA_DIR_AUTH . "/download-" . hash("sha256", $order) . ".lock", "c");
			if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
				if ($lock) fclose($lock);
				throw new RuntimeException("This order is being prepared in another request. Try again shortly.");
			}
			try { return $work(); }
			finally { flock($lock, LOCK_UN); fclose($lock); }
		}

		private static function authorize (string $order): void {
			if (($_SESSION["authorized_order"] ?? "")!==$order || !Payments::canDownload($order)) {
				throw new RuntimeException("This order is not authorized for downloads.");
			}
		}

		public static function status (string $order): array {
			$state = self::read($order);
			return array("count" => $state["count"] ?? 0, "progress" => $state ? self::progress($state) : 0,
				"started" => $state!==null);
		}

		public static function prepare (string $order): void {
			self::authorize($order);
			self::locked($order, function () use ($order): void {
				if (self::read($order)) return;
				$query = Database::connection()->prepare("SELECT items.id, items.formula_snapshot_json FROM order_items AS items
					JOIN orders ON orders.id = items.order_id WHERE orders.suid = ? AND items.item_type = 'download' ORDER BY items.position, items.id");
				$query->execute(array($order));
				$items = array();
				$part = 1; $bytes = 0; $files = 0; $storage = null;
				foreach ($query as $row) {
					$source = json_decode($row["formula_snapshot_json"], true)["download_source"] ?? null;
					if (!$source || !in_array($source["provider"], array("dropbox", "local"), true)) throw new RuntimeException("The order has no supported download source. Create a new test order.");
					if ($storage!==null && $storage!==$source["provider"]) throw new RuntimeException("An order must use one delivery provider.");
					$storage = $source["provider"];
					$partLimit = $storage==="local" ? 250000000 : 1000000000;
					$size = $source["quality"]==="high" ? $source["size"] : 2000000;
					if ($storage==="dropbox" && $size>=250000000000) throw new RuntimeException("This image is too large for a Dropbox folder download.");
					// Small, convenient parts; a single large original gets its own part.
					if ($files && ($bytes + $size>$partLimit || $files>=1000)) { $part++; $bytes = 0; $files = 0; }
					$name = basename(str_replace("\\", "/", $source["name"]));
					$name = preg_replace('/[\x00-\x1f<>:"|?*]/', "_", $name);
					if ($source["quality"]==="low") $name = pathinfo($name, PATHINFO_FILENAME) . ".jpg";
					$items[] = array("source" => $source, "path" => "/part-" . $part . "/" . $source["quality"] . "/" . $row["id"] . "-" . $name);
					$bytes += $size; $files++;
				}
				if (!$items) throw new RuntimeException("This order has no downloadable images.");
				self::save($order, array("root" => "/vend-deliveries/" . $order . "-" . bin2hex(random_bytes(12)),
					"items" => $items, "done" => 0, "packed" => 0, "parts" => $part, "count" => 0, "created" => time()));
			});
		}

		public static function next (string $order): float {
			self::authorize($order);
			return self::locked($order, function () use ($order): float {
				$state = self::read($order);
				if (!$state) throw new RuntimeException("Prepare this order first.");
				$started = microtime(true);
				$provider = self::provider($state);
				$copied = false;
				while ($state["done"]<count($state["items"])) {
					$item = $state["items"][$state["done"]];
					$provider->copy($item["source"], $state["root"] . $item["path"]);
					$state["done"]++;
					$copied = true;
					self::save($order, $state);
					if ($provider instanceof LocalDelivery || microtime(true) - $started>=8) break;
				}
				if (!$copied && $provider instanceof LocalDelivery && $state["done"]===count($state["items"]) && $state["packed"]<$state["parts"]) {
					$provider->finish($state["root"] . "/part-" . ($state["packed"] + 1));
					$state["packed"]++;
					self::save($order, $state);
				}
				return self::progress($state);
			});
		}

		public static function links (string $order): array {
			self::authorize($order);
			return self::locked($order, function () use ($order): array {
				$state = self::read($order);
				if (!$state || self::progress($state)!==1.0) throw new RuntimeException("Finish preparing all purchased images first.");
				if ($state["count"]>=3) return array();
				$links = array();
				$provider = self::provider($state);
				for ($part = 1; $part<=$state["parts"]; $part++) $links[] = $provider->link($state["root"] . "/part-" . $part, $order, $part);
				self::authorize($order);
				$state["count"]++;
				self::save($order, $state);
				return $links;
			});
		}

		/** Open only an issued part of this customer's paid order; the route streams the handle. */
		public static function open (string $order, int $part): array {
			self::authorize($order);
			return self::locked($order, function () use ($order, $part): array {
				$state = self::read($order);
				if (!$state || !(self::provider($state) instanceof LocalDelivery) || self::progress($state)!==1.0
					|| $state["count"]<1 || $part<1 || $part>$state["parts"]) throw new RuntimeException("This download is unavailable. Open the invoice to prepare it.");
				$path = LocalDelivery::packagePath($state["root"] . "/part-" . $part) . ".zip";
				$file = @fopen($path, "rb");
				if (!$file) throw new RuntimeException("The prepared ZIP is missing. Contact the photographer.");
				$size = fstat($file)["size"];
				return array("file" => $file, "size" => $size, "name" => "order-" . $order . "-part-" . $part . ".zip");
			});
		}

		/** Caller is the owner approval route, not an unauthenticated customer action. */
		public static function reset (string $order): void {
			self::locked($order, function () use ($order): void {
				$state = self::read($order);
				if ($state) { $state["count"] = 0; self::save($order, $state); }
			});
		}

		/** Only stored, owned delivery folders are eligible for deletion. */
		public static function delete (string $order, ?int $olderThan=null): void {
			self::locked($order, function () use ($order, $olderThan): void {
				$state = self::read($order);
				if (!$state) return;
				if ($olderThan!==null) {
					$query = Database::connection()->prepare("SELECT updated_at FROM download_jobs WHERE order_suid = ?");
					$query->execute(array($order));
					if ($query->fetchColumn()>=$olderThan) return;
				}
				self::provider($state)->delete($state["root"]);
				Database::connection()->prepare("DELETE FROM download_jobs WHERE order_suid = ?")->execute(array($order));
			});
		}

		public static function purge (int $age): array {
			$query = Database::connection()->prepare("SELECT order_suid FROM download_jobs WHERE updated_at < ?");
			$query->execute(array(time() - $age));
			$orders = $query->fetchAll(PDO::FETCH_COLUMN);
			$result = array();
			foreach ($orders as $order) {
				$state = self::read($order);
				try { self::delete($order, time() - $age); $deleted = self::read($order)===null; }
				catch (RuntimeException $error) { $deleted = false; }
				$result[] = array("id" => $order, "created" => $state["created"], "deleted" => $deleted);
			}
			return $result;
		}
	}
