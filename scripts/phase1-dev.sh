#!/usr/bin/env bash
set -euo pipefail

# Disposable PHP 8.4 development copy. Visit http://127.0.0.1:8048/.
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_dir="$(mktemp -d /tmp/vend-php84-dev.XXXXXX)"
trap 'rm -rf "$fixture_dir"' EXIT

cp -a "$project_dir/vend-proofing-core" "$fixture_dir/"
cp "$project_dir"/index.php "$project_dir"/vend-proofing-{config,gateway,index,resample}.php "$project_dir/vend-proofing-config.xml" "$fixture_dir/"
mkdir -p "$fixture_dir/vend-proofing-data"/{storage,auth,temp,cache,uploads}
printf '875c\tTest Gallery\tUploadSet\t0\n' > "$fixture_dir/vend-proofing-data/storage/set.page.table"
mkdir -p "$fixture_dir/vend-proofing-data/storage/875c"
cp "$project_dir/vend-proofing-core/defaults/uploadset.xml" "$fixture_dir/vend-proofing-data/storage/875c/uploadset.xml"
cp "$project_dir/vend-proofing-core/defaults/contact.xml" "$fixture_dir/vend-proofing-data/storage/contact.xml"
sed -i 's#<your_email href=""></your_email>#<your_email href="owner@example.invalid">Owner</your_email>#' "$fixture_dir/vend-proofing-data/storage/contact.xml"

echo "Disposable PHP 8.4 Vend: http://127.0.0.1:8048/"
echo "Gallery: http://127.0.0.1:8048/?/set/875c/test-gallery/"
echo "Press Ctrl-C to stop and remove the synthetic fixture."
docker run --rm -p 127.0.0.1:8048:8080 -v "$fixture_dir":/app -w /app devwithlando/php:8.4-apache-7 \
  php -d display_errors=1 -d error_reporting=24575 \
  -d disable_functions=checkdnsrr,mail,curl_init,fsockopen \
  -S 0.0.0.0:8080 -t /app
