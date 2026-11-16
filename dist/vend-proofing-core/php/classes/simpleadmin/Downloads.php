<?php

	/** Invoice delivery state. Entitlement stays with Payments; provider work stays in its adapter. */
	class Downloads {
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
			return array("count" => $state["count"] ?? 0, "progress" => $state ? $state["done"] / count($state["items"]) : 0,
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
				$part = 1; $bytes = 0; $files = 0;
				foreach ($query as $row) {
					$source = json_decode($row["formula_snapshot_json"], true)["download_source"] ?? null;
					if (!$source || $source["provider"]!=="dropbox") throw new RuntimeException("The order has no supported download source. Create a new test order.");
					$size = $source["quality"]==="high" ? $source["size"] : 2000000;
					if ($size>=250000000000) throw new RuntimeException("This image is too large for a Dropbox folder download.");
					// Small, convenient parts; a single large original gets its own part.
					if ($files && ($bytes + $size>1000000000 || $files>=1000)) { $part++; $bytes = 0; $files = 0; }
					$name = basename(str_replace("\\", "/", $source["name"]));
					$name = preg_replace('/[\x00-\x1f<>:"|?*]/', "_", $name);
					if ($source["quality"]==="low") $name = pathinfo($name, PATHINFO_FILENAME) . ".jpg";
					$items[] = array("source" => $source, "path" => "/part-" . $part . "/" . $source["quality"] . "/" . $row["id"] . "-" . $name);
					$bytes += $size; $files++;
				}
				if (!$items) throw new RuntimeException("This order has no downloadable images.");
				self::save($order, array("root" => "/vend-deliveries/" . $order . "-" . bin2hex(random_bytes(12)),
					"items" => $items, "done" => 0, "parts" => $part, "count" => 0, "created" => time()));
			});
		}

		public static function next (string $order): float {
			self::authorize($order);
			return self::locked($order, function () use ($order): float {
				$state = self::read($order);
				if (!$state) throw new RuntimeException("Prepare this order first.");
				$started = microtime(true);
				$provider = new DropboxDelivery();
				while ($state["done"]<count($state["items"])) {
					$item = $state["items"][$state["done"]];
					$provider->copy($item["source"], $state["root"] . $item["path"]);
					$state["done"]++;
					self::save($order, $state);
					if (microtime(true) - $started>=8) break;
				}
				return $state["done"] / count($state["items"]);
			});
		}

		public static function links (string $order): array {
			self::authorize($order);
			return self::locked($order, function () use ($order): array {
				$state = self::read($order);
				if (!$state || $state["done"]!==count($state["items"])) throw new RuntimeException("Finish preparing all purchased images first.");
				if ($state["count"]>=3) return array();
				$links = array();
				$provider = new DropboxDelivery();
				for ($part = 1; $part<=$state["parts"]; $part++) $links[] = $provider->link($state["root"] . "/part-" . $part);
				self::authorize($order);
				$state["count"]++;
				self::save($order, $state);
				return $links;
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
				(new DropboxDelivery())->delete($state["root"]);
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
