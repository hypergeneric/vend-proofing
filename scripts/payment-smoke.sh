#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_dir="$(mktemp -d /tmp/vend-payments.XXXXXX)"
trap 'rm -rf "$fixture_dir"' EXIT
mkdir -p "$fixture_dir/dist"
cp -a "$project_dir/dist/vend-proofing-core" "$fixture_dir/dist/"
mkdir -p "$fixture_dir/scripts" "$fixture_dir/dist/vend-proofing-data"/{auth,storage,cache,temp}
cp "$project_dir/scripts/payment-test.php" "$project_dir/scripts/payment-worker.php" "$fixture_dir/scripts/"
docker run --rm --network none -v "$fixture_dir":/app -w /app/dist devwithlando/php:8.4-apache-7 sh -lc '
set -eu
find vend-proofing-core/php/classes/simpleadmin -name "*.php" -print0 | xargs -0 -n1 php -l >/tmp/payment-lint.txt
php -d display_errors=1 -d error_reporting=24575 -d disable_functions=mail,curl_init,fsockopen ../scripts/payment-test.php
'
