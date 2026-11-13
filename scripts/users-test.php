<?php
// Synthetic HTTP fixture; invoked only by phase1-smoke.sh inside its disposable container.
if (PHP_SAPI !== 'cli') exit(2);
function usersCheck (bool $ok, string $message): void {
	if (!$ok) throw new RuntimeException($message);
}
function requestUser (array &$session, array $data): array {
	$headers = "Content-Type: application/x-www-form-urlencoded\r\n";
	if (isset($session['cookie'])) $headers .= 'Cookie: ' . $session['cookie'] . "\r\n";
	$data += ['token' => $session['token'] ?? ''];
	$body = file_get_contents('http://127.0.0.1:8080/vend-proofing-gateway.php', false, stream_context_create(['http' => [
		'method' => 'POST', 'header' => $headers, 'content' => http_build_query($data), 'ignore_errors' => true,
	]]));
	foreach ($http_response_header as $header) {
		if (preg_match('/^Set-Cookie: (VEND_ADMIN=[^;]*)/i', $header, $match)) $session['cookie'] = $match[1];
	}
	parse_str($body, $result);
	return $result;
}
function userLogin (string $username, string $password): array {
	$session = [];
	$result = requestUser($session, ['action' => 'login', 'username' => $username, 'password' => $password]);
	usersCheck(($result['s'] ?? '') === 'true', 'Login failed: ' . $username);
	$session['token'] = $result['r'];
	return $session;
}
$owner = userLogin('testadmin', 'SyntheticAdminPassword123!');
$anonymous = [];
foreach (['list', 'create', 'update', 'delete', 'type'] as $action) {
	usersCheck((requestUser($anonymous, ['action' => 'users_' . $action])['s'] ?? '') !== 'true', 'Anonymous action accepted');
	usersCheck((requestUser($owner, ['action' => 'users_' . $action, 'token' => 'forged'])['s'] ?? '') !== 'true', 'Forged token accepted');
}
$create = ['action' => 'users_create', 'username' => 'manager', 'email' => 'manager@example.invalid', 'password' => 'Synthetic\\Password123!', 'user_type' => 'manager'];
usersCheck(requestUser($owner, $create)['s'] === 'true', 'Create manager failed');
usersCheck(requestUser($owner, $create)['s'] === 'false', 'Duplicate username accepted');
foreach ([['user_type' => 'superuser'], ['password' => 'short'], ['email' => 'bad'], ['username' => '<script>']] as $invalid) {
	usersCheck(requestUser($owner, $invalid + ['username' => 'invalid'] + $create)['s'] === 'false', 'Invalid account accepted');
}
$list = json_decode(requestUser($owner, ['action' => 'users_list'])['r'], true);
usersCheck(count($list['users']) === 2, 'List count incorrect');
foreach ($list['users'] as $user) usersCheck(array_keys($user) === ['id', 'username', 'email', 'user_type'], 'Private account fields leaked');
$ownerId = $list['current_id'];
$manager = userLogin('manager', $create['password']);
$managerAgain = userLogin('manager', $create['password']);
$managerId = json_decode(requestUser($manager, ['action' => 'users_list'])['r'], true)['current_id'];
$edit = ['action' => 'users_update', 'id' => $managerId, 'username' => 'renamed', 'email' => 'new@example.invalid', 'password' => '', 'current_password' => $create['password']];
usersCheck(requestUser($owner, $edit)['s'] === 'false', 'Cross-account edit accepted even with known password');
usersCheck(requestUser($manager, ['current_password' => 'wrong'] + $edit)['s'] === 'false', 'Wrong current password accepted');
usersCheck(requestUser($manager, ['username' => 'testadmin'] + $edit)['s'] === 'false', 'Duplicate edit accepted');
usersCheck(requestUser($owner, ['action' => 'users_delete', 'id' => $ownerId])['s'] === 'false', 'Self-deletion accepted');
usersCheck(requestUser($owner, ['action' => 'users_type', 'id' => $managerId, 'user_type' => 'admin', 'username' => 'bypass'])['s'] === 'true', 'Type update failed');
usersCheck(requestUser($owner, ['action' => 'users_type', 'id' => $managerId, 'user_type' => 'root'])['s'] === 'false', 'Invalid type accepted');
usersCheck(requestUser($manager, $edit)['s'] === 'true', 'Self edit failed');
usersCheck(requestUser($managerAgain, ['action' => 'auth_status'])['s'] === 'false', 'Other session survived edit');
usersCheck(requestUser($owner, ['action' => 'auth_status'])['s'] === 'true', 'Unrelated session invalidated');
$manager = userLogin('renamed', $create['password']);
usersCheck(requestUser($manager, ['username' => 'renamed', 'password' => 'New\\SyntheticPassword123!'] + $edit)['s'] === 'true', 'Password edit failed');
$manager = userLogin('renamed', 'New\\SyntheticPassword123!');
usersCheck(requestUser($owner, ['action' => 'users_delete', 'id' => $managerId])['s'] === 'true', 'Delete failed');
usersCheck(requestUser($manager, ['action' => 'auth_status'])['s'] === 'false', 'Deleted session survived');
$manager = [];
usersCheck(requestUser($manager, ['action' => 'login', 'username' => 'renamed', 'password' => 'New\\SyntheticPassword123!'])['s'] === 'false', 'Deleted login survived');
echo "PASS users HTTP CRUD, types, validation, self-only edits, tokens, password backslashes, and session invalidation\n";
