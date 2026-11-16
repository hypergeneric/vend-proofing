#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_dir="$(mktemp -d /tmp/vend-payments.XXXXXX)"
trap 'rm -rf "$fixture_dir"' EXIT
mkdir -p "$fixture_dir/dist"
cp -a "$project_dir/dist/vend-proofing-core" "$fixture_dir/dist/"
cp "$project_dir"/dist/index.php "$project_dir"/dist/vend-proofing-{config,gateway,index,resample}.php "$fixture_dir/dist/"
mkdir -p "$fixture_dir/scripts" "$fixture_dir/dist/vend-proofing-data"/{auth,storage,cache,temp}
cp "$project_dir/scripts/local-zip-test.php" "$fixture_dir/scripts/"
cp "$project_dir/scripts/payment-test.php" "$project_dir/scripts/payment-worker.php" "$project_dir/scripts/download-test.php" "$project_dir/scripts/local-download-test.php" "$project_dir/scripts/local-download-http-test.php" "$project_dir/scripts/dev-router.php" "$fixture_dir/scripts/"
docker run --rm --network none -v "$fixture_dir":/app -w /app/dist devwithlando/php:8.4-apache-7 sh -lc '
set -eu
trap "chmod -R a+rwX /app/dist/vend-proofing-data" EXIT
find vend-proofing-core/php/classes/simpleadmin -name "*.php" -print0 | xargs -0 -n1 php -l >/tmp/payment-lint.txt
php -n -d memory_limit=128M -d error_reporting=32767 ../scripts/local-zip-test.php fallback
php -d error_reporting=32767 ../scripts/local-zip-test.php verify
php -d display_errors=1 -d error_reporting=24575 -d disable_functions=mail,curl_init,fsockopen ../scripts/payment-test.php
php -d display_errors=0 -d error_reporting=24575 -d disable_functions=mail,curl_init,fsockopen,checkdnsrr -S 127.0.0.1:8080 -t /app/dist /app/scripts/dev-router.php >/tmp/download-server.log 2>&1 &
server_pid=$!
trap "kill $server_pid; chmod -R a+rwX /app/dist/vend-proofing-data" EXIT
sleep 1
php -d display_errors=1 -d error_reporting=24575 -d disable_functions=mail,curl_init,fsockopen ../scripts/local-download-http-test.php
'
