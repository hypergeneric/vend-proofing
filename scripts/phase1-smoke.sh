#!/usr/bin/env bash
set -euo pipefail

# Runs Vend against disposable, synthetic data in a container with no network.
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_dir="$(mktemp -d /tmp/vend-php84.XXXXXX)"
trap 'rm -rf "$fixture_dir"' EXIT

cp -a "$project_dir/vend-proofing-core" "$fixture_dir/"
cp "$project_dir"/index.php "$project_dir"/vend-proofing-{config,gateway,index,resample}.php "$project_dir/vend-proofing-config.xml" "$fixture_dir/"
mkdir -p "$fixture_dir/vend-proofing-data"/{storage,auth,temp,cache,uploads}
cat > "$fixture_dir/vend-proofing-data/storage/set.page.table" <<'DATA'
875c	Test Gallery	UploadSet	0
DATA
cp "$project_dir/vend-proofing-core/defaults/uploadset.xml" "$fixture_dir/vend-proofing-data/storage/875c.xml"
mkdir -p "$fixture_dir/vend-proofing-data/storage/875c"
cp "$project_dir/vend-proofing-core/defaults/uploadset.xml" "$fixture_dir/vend-proofing-data/storage/875c/uploadset.xml"
cp "$project_dir/vend-proofing-core/defaults/contact.xml" "$fixture_dir/vend-proofing-data/storage/contact.xml"
sed -i 's#<your_email href=""></your_email>#<your_email href="owner@example.invalid">Owner</your_email>#' "$fixture_dir/vend-proofing-data/storage/contact.xml"
cp "$project_dir/vend-proofing-core/defaults/cron.xml" "$fixture_dir/vend-proofing-data/storage/cron.xml"
sed -i 's#<cron_enabled_bool>false</cron_enabled_bool>#<cron_enabled_bool>true</cron_enabled_bool>#; s#<expiring_notify_bool>false</expiring_notify_bool>#<expiring_notify_bool>true</expiring_notify_bool>#' "$fixture_dir/vend-proofing-data/storage/cron.xml"
cp "$project_dir/scripts/phase1-storage.php" "$fixture_dir/phase1-storage.php"

docker run --rm --network none -v "$fixture_dir":/app -w /app devwithlando/php:8.4-apache-7 sh -lc '
set -eu
php -v | head -1
find vend-proofing-core/php/classes/simpleadmin vend-proofing-core/php -maxdepth 1 -name "*.php" -print0 | xargs -0 -n1 php -l > /tmp/vend-lint.txt
# Existing Guzzle Promise 1.5.2 emits PHP 8.4 deprecations during autoload.
# Keep warnings/errors visible; dependency upgrade is tracked in the phase log.
php -d display_errors=1 -d error_reporting=24575 phase1-storage.php
php -d display_errors=1 -d error_reporting=24575 -d disable_functions=checkdnsrr,mail,curl_init,fsockopen -S 127.0.0.1:8080 -t /app >/tmp/vend-server.log 2>&1 &
server_pid=$!
trap "kill $server_pid" EXIT
sleep 1
for route in / /?/admin/ /?/set/875c/test-gallery/ /?/js/admin/1.0.00/ /?/xml/cronjob/ /vend-proofing-gateway.php?action=get_xml\&type=setup; do
  curl -fsS -o /tmp/vend-response.html -w "%{http_code} %{size_download} bytes $route\n" "http://127.0.0.1:8080$route"
  if grep -Eiq "(<b>(Fatal error|Parse error|Uncaught|Deprecated|Warning)</b>|^(Fatal error|Parse error|Deprecated:|Warning:))" /tmp/vend-response.html; then
    head -c 600 /tmp/vend-response.html
    exit 1
  fi
  case "$route" in
    /) grep -q "<html" /tmp/vend-response.html ;;
    /?/admin/) grep -q "classes.Admin.initialize" /tmp/vend-response.html || { head -c 725 /tmp/vend-response.html; exit 1; } ;;
    /?/set/*) grep -q "data-suid=\"875c\"" /tmp/vend-response.html || { head -c 500 /tmp/vend-response.html; exit 1; } ;;
    /?/js/admin/*) grep -q "classes.Admin" /tmp/vend-response.html ;;
    /?/xml/cronjob/) grep -q "recipients=\"0\"" /tmp/vend-response.html ;;
    */vend-proofing-gateway.php*) grep -q "<data" /tmp/vend-response.html ;;
  esac
done
if grep -Eiq "(Fatal error|Parse error|Uncaught|Deprecated:|Warning:)" /tmp/vend-server.log; then
  cat /tmp/vend-server.log
  exit 1
fi
echo "HTTP smoke and storage contract assertions passed"
'
