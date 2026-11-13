<?php

/** First-install workflow. Public writes stop as soon as installation is complete. */
class SetupWizard {
	public static function ready (): bool {
		return Database::installed()
			&& Configuration::getDocument('installation', null, true) instanceof ConfigurationDocument
			&& AdminAccount::exists();
	}

	public static function languages (): array {
		$codes = [];
		foreach (glob(SA_DIR_LANG . '/*.json') as $path) {
			$code = basename($path, '.json');
			if (preg_match('/^[a-z]{2}$/', $code)) $codes[] = $code;
		}
		return $codes;
	}

	public static function guesses (): array {
		$script = $_SERVER['SCRIPT_NAME'] ?? '/index.php';
		$directory = rtrim(str_replace('\\', '/', dirname($script)), '/.');
		$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
		if (!preg_match('/^[a-zA-Z0-9.\-\[\]:]+$/', $host)) $host = 'localhost';
		return ['language' => 'en', 'indexpath' => basename($script) === 'index.php' ? '' : basename($script),
			'basepath' => './', 'baseurl' => 'https://' . $host . $directory];
	}

	public static function settings (array $values): ConfigurationDocument {
		if (!in_array($values['language'], self::languages(), true)) throw new InvalidArgumentException('Setup Invalid Language');
		if (!preg_match('~^(?:[a-zA-Z0-9_-]+\.php)?$~', $values['indexpath'])) throw new InvalidArgumentException('Setup Invalid Paths');
		if (!preg_match('~^(?:\./|/[a-zA-Z0-9_/-]*)$~', $values['basepath']) || (str_contains($values['basepath'], '//') || !str_ends_with($values['basepath'], '/'))) throw new InvalidArgumentException('Setup Invalid Paths');
		$url = rtrim(trim($values['baseurl']), '/');
		$parts = parse_url($url);
		if (!filter_var($url, FILTER_VALIDATE_URL) || !$parts || ($parts['scheme'] ?? '') !== 'https'
			|| isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])) {
			throw new InvalidArgumentException('Setup Invalid URL');
		}
		$document = Configuration::getDocument('installation');
		foreach ($values as $key => $value) $document->editNode('data.setup.' . $key, $key === 'baseurl' ? $url : $value);
		return $document;
	}

	public static function locked (callable $work): void {
		if (!is_dir(SA_DIR_AUTH) && !mkdir(SA_DIR_AUTH, 0770, true) && !is_dir(SA_DIR_AUTH)) throw new RuntimeException('Setup Storage Failed');
		$lock = fopen(SA_DIR_AUTH . '/setup.lock', 'c');
		if (!$lock) throw new RuntimeException('Setup Storage Failed');
		try {
			if (!flock($lock, LOCK_EX)) throw new RuntimeException('Setup Storage Failed');
			if (self::ready()) throw new InvalidArgumentException('Setup Already Complete');
			if (AdminAccount::exists() && !(new Auth())->sessionAuthenticated()) throw new InvalidArgumentException('Setup Sign In Required');
			$work();
		} finally {
			flock($lock, LOCK_UN);
			fclose($lock);
		}
	}

	public static function saveSettings (array $values): void {
		self::locked(function () use ($values): void {
			$document = self::settings($values);
			if (!Database::installed()) Database::install();
			if (!Configuration::save('installation', null, $document->toString())) throw new RuntimeException('Setup Storage Failed');
		});
	}

	public static function finish (array $settings, array $account, array $contact): void {
		if (!filter_var($contact['email'], FILTER_VALIDATE_EMAIL)) throw new InvalidArgumentException('You Must Supply A Valid Email Address');
		if ($contact['website'] !== '' && (!filter_var($contact['website'], FILTER_VALIDATE_URL)
			|| !in_array(parse_url($contact['website'], PHP_URL_SCHEME), ['http', 'https'], true))) throw new InvalidArgumentException('Setup Invalid Website');
		self::locked(function () use ($settings, $account, $contact): void {
			Database::transaction(function (PDO $db) use ($settings, $account, $contact): void {
				if (AdminAccount::exists()) throw new InvalidArgumentException('Setup Already Complete');
				$installation = self::settings($settings);
				$details = Configuration::getDocument('contact')->toArray();
				$details['data']['_attributes']['default'] = 'false';
				$details['data']['details']['your_email'] = ['_value' => $contact['name'], '_attributes' => ['href' => $contact['email']]];
				$details['data']['details']['your_website_url'] = ['_value' => $contact['website_name'], '_attributes' => ['href' => $contact['website']]];
				$details['data']['details']['your_phone_number']['_value'] = $contact['phone'];
				$details['data']['details']['your_physical_address']['_value'] = $contact['address'];
				if (!Configuration::save('installation', null, $installation->toString())
					|| !Configuration::save('contact', null, json_encode($details, JSON_THROW_ON_ERROR))) throw new RuntimeException('Setup Storage Failed');
				AdminAccount::createFirstFromHash($account['username'], $account['email'], $account['hash']);
			});
		});
	}
}
