#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_dir="$(mktemp -d /tmp/vend-setup.XXXXXX)"
trap 'rm -rf "$fixture_dir"' EXIT
mkdir -p "$fixture_dir/dist" "$fixture_dir/scripts"
cp -a "$project_dir/dist/vend-proofing-core" "$fixture_dir/dist/"
cp "$project_dir"/dist/index.php "$project_dir"/dist/vend-proofing-{config,gateway,index,resample}.php "$fixture_dir/dist/"
cp "$project_dir/scripts/dev-router.php" "$project_dir/scripts/setup-http-test.php" "$fixture_dir/scripts/"
docker run --rm --network none -v "$fixture_dir":/app -w /app/dist devwithlando/php:8.4-apache-7 sh -lc '
set -eu
php -d display_errors=1 -d error_reporting=24575 -d disable_functions=checkdnsrr,mail,curl_init,fsockopen -S 127.0.0.1:8080 -t /app/dist /app/scripts/dev-router.php >/tmp/setup-server.log 2>&1 &
server_pid=$!
trap "kill $server_pid; chmod -R a+rwX /app/dist/vend-proofing-data" EXIT
sleep 1
php ../scripts/setup-http-test.php
if grep -Ei "Fatal error|Parse error|Uncaught|Warning:|Deprecated:" /tmp/setup-server.log; then exit 1; fi
'
