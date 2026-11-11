<?php

// Disposable fixture only. Run after creating the synthetic administrator.
if (PHP_SAPI !== 'cli') exit(2);
define('SA_DIR_AUTH', dirname(__DIR__) . '/vend-proofing-data/auth');
require dirname(__DIR__) . '/vend-proofing-core/php/classes/simpleadmin/Database.php';
require dirname(__DIR__) . '/vend-proofing-core/php/classes/simpleadmin/AdminAccount.php';
require dirname(__DIR__) . '/vend-proofing-core/php/classes/simpleadmin/Auth.php';

function check_auth (bool $condition, string $message): void {
	if (!$condition) throw new RuntimeException($message);
}

$db = Database::connection();
$auth = new Auth();
check_auth($auth->login('testadmin', 'wrong') === '', 'Wrong password accepted');
check_auth((int) $db->query('SELECT COUNT(*) FROM admin_sessions')->fetchColumn() === 0, 'Wrong password created a session');
$token = $auth->login('testadmin', 'SyntheticAdminPassword123!');
check_auth(strlen($token) === 64 && $auth->sessionAuthenticated(), 'Login did not create a session');
$_POST['token'] = 'forged';
check_auth(!$auth->authenticate()['authenticated'], 'Forged token accepted');
$_POST['token'] = $token;
check_auth($auth->authenticate()['authenticated'], 'Valid token rejected');
check_auth(hash('sha256', $_COOKIE['VEND_ADMIN']) === $db->query('SELECT id_hash FROM admin_sessions')->fetchColumn(), 'Session ID was stored in plaintext');
$expiry = (int) $db->query('SELECT expires_at FROM admin_sessions')->fetchColumn();
check_auth(abs($expiry - time() - 12 * 3600) <= 2, 'Ordinary session lifetime changed');
$db->exec('UPDATE admin_sessions SET expires_at = 1');
check_auth(!$auth->sessionAuthenticated(), 'Expired session accepted');
$token = $auth->login('testadmin', 'SyntheticAdminPassword123!', true);
check_auth(strlen($token) === 64 && $auth->sessionAuthenticated(), 'Remembered login failed');
$expiry = (int) $db->query('SELECT expires_at FROM admin_sessions')->fetchColumn();
check_auth(abs($expiry - time() - 14 * 86400) <= 2, 'Remembered session lifetime changed');
AdminAccount::resetPassword('testadmin', 'TemporaryReplacement123!');
check_auth(!$auth->sessionAuthenticated(), 'Password reset did not invalidate session');
AdminAccount::resetPassword('testadmin', 'SyntheticAdminPassword123!');
$token = $auth->login('testadmin', 'SyntheticAdminPassword123!');
check_auth($auth->token() === $token, 'Session token did not restore');
$auth->invalidate();
check_auth(!$auth->sessionAuthenticated(), 'Logout failed');
check_auth((int) $db->query('SELECT COUNT(*) FROM admin_sessions')->fetchColumn() === 0, 'Logout retained a session');
echo "PASS admin login, token, expiry, remember, reset invalidation, and logout\n";
