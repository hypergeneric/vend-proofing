<?php

	class DropboxException extends RuntimeException {
		public function __construct (public array $details) {
			parent::__construct("Dropbox could not complete this file operation. Check that the purchased image is still available.");
		}

		public function missing (): bool {
			return ($this->details[".tag"] ?? "")==="path" && ($this->details["path"][".tag"] ?? "")==="not_found";
		}
	}
