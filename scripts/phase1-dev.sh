#!/usr/bin/env bash
set -euo pipefail

# Disposable PHP 8.4 development copy. Visit http://127.0.0.1:8048/.
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_dir="$(mktemp -d /tmp/vend-php84-dev.XXXXXX)"
trap 'rm -rf "$fixture_dir"' EXIT

cp -a "$project_dir/vend-proofing-core" "$fixture_dir/"
cp "$project_dir"/index.php "$project_dir"/vend-proofing-{config,gateway,index,resample}.php "$fixture_dir/"
mkdir -p "$fixture_dir/vend-proofing-data"/{storage,auth,temp,cache,uploads}
mkdir -p "$fixture_dir/scripts"
cp "$project_dir/scripts/admin-account.php" "$project_dir/scripts/install.php" "$project_dir/scripts/dev-router.php" "$fixture_dir/scripts/"
cp "$project_dir/scripts/configuration-test.php" "$fixture_dir/scripts/configuration-test.php"
docker run --rm --network none -v "$fixture_dir":/app -w /app devwithlando/php:8.4-apache-7 php scripts/install.php
docker run --rm --network none -v "$fixture_dir":/app -w /app devwithlando/php:8.4-apache-7 php scripts/configuration-test.php
printf '%s\n' 'SyntheticAdminPassword123!' | docker run --rm --network none -i -v "$fixture_dir":/app -w /app devwithlando/php:8.4-apache-7 php scripts/admin-account.php create testadmin owner@example.invalid

echo "Disposable PHP 8.4 Vend: http://127.0.0.1:8048/"
echo "Admin: testadmin / SyntheticAdminPassword123! (disposable local fixture)"
echo "Create an Upload Set in admin, then upload a JPEG to test the SQLite catalog."
echo "Press Ctrl-C to stop and remove the synthetic fixture."
docker run --rm -p 127.0.0.1:8048:8080 -v "$fixture_dir":/app -w /app devwithlando/php:8.4-apache-7 \
  php -d display_errors=1 -d error_reporting=24575 \
  -d disable_functions=checkdnsrr,mail,curl_init,fsockopen \
  -S 0.0.0.0:8080 -t /app /app/scripts/dev-router.php
