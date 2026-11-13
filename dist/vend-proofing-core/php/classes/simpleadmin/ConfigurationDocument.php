<?php

	/** The field tree used by both PHP rendering and the admin editor. */
	class ConfigurationDocument {
		private array $data;

		public function __construct (string $json) {
			$data = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
			if (!is_array($data) || !isset($data["data"]) || !is_array($data["data"])) {
				throw new JsonException("Configuration must contain a data object.");
			}
			$this->data = $data;
			$this->data["data"] = self::completeNode($this->data["data"]);
		}

		public function toArray (): array {
			return $this->data;
		}

		public function toString (): string {
			$compact = $this->data;
			$compact["data"] = self::compactNode($compact["data"]);
			return json_encode($compact, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
		}

		public function toRuntimeString (): string {
			$runtime = $this->data;
			$runtime["data"] = self::runtimeNode($runtime["data"]);
			return json_encode($runtime, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
		}

		public function getNodeVal (string $path): ?string {
			$node = $this->node($path);
			return isset($node["_value"]) ? (string) $node["_value"] : null;
		}

		public function getAttrVal (string $path): ?string {
			$parts = explode(".", $path);
			$attribute = array_pop($parts);
			$node = $this->node(implode(".", $parts));
			return isset($node["_attributes"][$attribute]) ? (string) $node["_attributes"][$attribute] : null;
		}

		public function editNode (string $path, ?string $value=null, ?string $attributes=null): void {
			$node = &$this->data;
			foreach (explode(".", $path) as $part) {
				if (!isset($node[$part]) || !is_array($node[$part])) $node[$part] = array();
				$node = &$node[$part];
			}
			if ($value!==null) $node["_value"] = $value;
			if ($attributes!==null) {
				foreach (explode(";", $attributes) as $assignment) {
					$pair = explode("=", $assignment, 2);
					$node["_attributes"][$pair[0]] = $pair[1] ?? "";
				}
			}
		}

		private function node (string $path): ?array {
			$node = $this->data;
			foreach (explode(".", $path) as $part) {
				if (!isset($node[$part]) || !is_array($node[$part])) return null;
				$node = $node[$part];
			}
			return $node;
		}

		private static function completeNode (array $node): array {
			if ($node!==array() && array_is_list($node)) {
				foreach ($node as $index => $child) {
					$node[$index] = self::completeNode($child);
				}
				return $node;
			}

			if (!array_key_exists("_value", $node)) $node["_value"] = "";
			if (!array_key_exists("_attributes", $node)) $node["_attributes"] = array();
			foreach ($node as $key => $child) {
				if ($key==="_value" || $key==="_attributes") continue;
				if (is_array($child)) $node[$key] = self::completeNode($child);
			}
			return $node;
		}

		private static function compactNode (array $node): array|object {
			if ($node!==array() && array_is_list($node)) {
				foreach ($node as $index => $child) {
					$node[$index] = self::compactNode($child);
				}
				return $node;
			}

			if (($node["_value"] ?? null)==="") unset($node["_value"]);
			if (($node["_attributes"] ?? null)===array()) unset($node["_attributes"]);
			foreach ($node as $key => $child) {
				if ($key==="_value" || $key==="_attributes") continue;
				if (is_array($child)) $node[$key] = self::compactNode($child);
			}
			return $node===array() ? (object) array() : $node;
		}

		private static function runtimeNode (array $node): array {
			if ($node!==array() && array_is_list($node)) {
				foreach ($node as $index => $child) {
					$node[$index] = self::runtimeNode($child);
				}
				return $node;
			}

			if ($node["_attributes"]===array()) $node["_attributes"] = (object) array();
			foreach ($node as $key => $child) {
				if ($key==="_value" || $key==="_attributes") continue;
				if (is_array($child)) $node[$key] = self::runtimeNode($child);
			}
			return $node;
		}
	}
