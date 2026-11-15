<?php

/** Single-use recovery credentials; email bodies and raw tokens are never logged. */
class PasswordRecovery {
	public const LIFETIME = 1800;

	private static function allowRequest (PDO $db, string $bucket, int $limit): bool {
		$key = hash_hmac('sha256', $bucket, Database::installationSecret());
		$query = $db->prepare('SELECT attempts FROM administrator_recovery_limits WHERE bucket_hash = ?');
		$query->execute([$key]);
		if ((int) $query->fetchColumn() >= $limit) return false;
		$db->prepare('INSERT INTO administrator_recovery_limits (bucket_hash, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(bucket_hash) DO UPDATE SET attempts = attempts + 1')
			->execute([$key, time() + 3600]);
		return true;
	}

	/** The caller always displays the same response, including for throttled and failed delivery. */
	public static function request (string $email, string $address, ?callable $deliver = null): void {
		if (!Database::installed()) return;
		$email = strtolower(trim($email));
		if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return;
		$resets = Database::transaction(function (PDO $db) use ($email, $address): ?array {
			$db->prepare('DELETE FROM administrator_recovery_limits WHERE expires_at <= ?')->execute([time()]);
			$db->prepare('DELETE FROM administrator_password_resets WHERE expires_at <= ?')->execute([time()]);
			if (!self::allowRequest($db, 'global', 60) || !self::allowRequest($db, 'ip:' . $address, 10)
				|| !self::allowRequest($db, 'email:' . $email, 3)) return null;
			$query = $db->prepare('SELECT * FROM administrators WHERE lower(email) = ?');
			$query->execute([$email]);
			$accounts = $query->fetchAll();
			$resets = [];
			foreach ($accounts as $account) {
				$token = bin2hex(random_bytes(32));
				$hash = hash('sha256', $token);
				$db->prepare('INSERT INTO administrator_password_resets (administrator_id, token_hash, account_version, created_at, expires_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(administrator_id) DO UPDATE SET token_hash = excluded.token_hash, account_version = excluded.account_version, created_at = excluded.created_at, expires_at = excluded.expires_at')
					->execute([$account['id'], $hash, $account['account_version'], time(), time() + self::LIFETIME]);
				$resets[] = ['account' => $account, 'token' => $token, 'hash' => $hash];
			}
			return $resets;
		});
		if (!$resets) return;
		foreach ($resets as $reset) {
			try {
				$sent = $deliver ? $deliver($reset['account'], $reset['token']) : self::deliver($reset['account'], $reset['token']);
			} catch (Throwable $error) {
				$sent = false;
			}
			if (!$sent) {
				Database::connection()->prepare('DELETE FROM administrator_password_resets WHERE token_hash = ?')->execute([$reset['hash']]);
				error_log('Vend administrator recovery delivery failed; check mail settings and SA_BASE_URL.');
			}
		}
	}

	private static function deliver (array $account, string $token): bool {
		global $LANG;
		// Use the configured canonical URL, never the request Host or forwarded headers.
		$url = Func::getPublicBaseUrl() . '/' . SA_DIR_INDEXPATH . '?/admin/&recover=1#token=' . $token;
		$contact = Configuration::getDocument('contact', null, true);
		if (!$contact || !in_array($contact->getNodeVal('data.mailer_settings.mail_provider'), ['mail', 'smtp', 'sendgrid'], true)) return false;
		$mail = new Email();
		$mail->logMessage(false);
		$mail->doDebug(false);
		$mail->setSender($contact->getAttrVal('data.details.your_email.href'), $contact->getNodeVal('data.details.your_email'));
		$mail->setRecipient($account['email'], $account['username']);
		$mail->setSubjectTemplate('data.contact.password_recovery_subject');
		$mail->setBodyTemplate('data.contact.password_recovery_message_body');
		$mail->addPreTags([
			'SUBJECT' => $LANG->lookup('Recovery Email Subject'),
			'MESSAGE' => strtr($LANG->lookup('Recovery Email Body'), ['{USERNAME}' => $account['username'], '{RESET_URL}' => $url]),
		]);
		$mail->send();
		return $mail->success();
	}

	/** Atomically consume the link, update the password, and end every account session. */
	public static function reset (string $token, string $password): bool {
		if (!preg_match('/^[a-f0-9]{64}$/', $token) || strlen($password) < 12 || strlen($password) > 4096 || str_contains($password, "\0")) return false;
		return Database::transaction(function (PDO $db) use ($token, $password): bool {
			$query = $db->prepare('SELECT r.administrator_id FROM administrator_password_resets r JOIN administrators a ON a.id = r.administrator_id WHERE r.token_hash = ? AND r.expires_at > ? AND r.account_version = a.account_version');
			$query->execute([hash('sha256', $token), time()]);
			$id = $query->fetchColumn();
			if ($id === false) return false;
			$db->prepare('UPDATE administrators SET password_hash = ?, account_version = account_version + 1, updated_at = ? WHERE id = ?')
				->execute([password_hash($password, PASSWORD_DEFAULT), time(), $id]);
			$db->prepare('DELETE FROM administrator_password_resets WHERE administrator_id = ?')->execute([$id]);
			$db->prepare('DELETE FROM admin_sessions WHERE administrator_id = ?')->execute([$id]);
			return true;
		});
	}
}
