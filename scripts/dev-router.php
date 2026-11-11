<?php

// PHP's built-in server ignores .htaccess. Keep all persistent data private.
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/');
if ($path === '/vend-proofing-data' || str_starts_with($path, '/vend-proofing-data/')) {
	http_response_code(403);
	exit;
}
return false;
