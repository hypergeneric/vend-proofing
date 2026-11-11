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
mkdir -p "$fixture_dir/vend-proofing-data/storage/asset"
printf 'public asset' > "$fixture_dir/vend-proofing-data/storage/asset/test.png"
printf 'test.png\ttest.png\t1x1\n' > "$fixture_dir/vend-proofing-data/storage/asset/asset.table"
cp "$project_dir/scripts/phase1-storage.php" "$fixture_dir/phase1-storage.php"
mkdir -p "$fixture_dir/scripts"
cp "$project_dir/scripts/admin-account.php" "$fixture_dir/scripts/admin-account.php"
cp "$project_dir/scripts/install.php" "$fixture_dir/scripts/install.php"
cp "$project_dir/scripts/migrate.php" "$fixture_dir/scripts/migrate.php"
cp "$project_dir/scripts/foundation-test.php" "$fixture_dir/scripts/foundation-test.php"
cp "$project_dir/scripts/foundation-worker.php" "$fixture_dir/scripts/foundation-worker.php"
cp "$project_dir/scripts/foundation-auth-test.php" "$fixture_dir/scripts/foundation-auth-test.php"
cp "$project_dir/scripts/dev-router.php" "$fixture_dir/scripts/dev-router.php"

docker run --rm --network none -v "$fixture_dir":/app -w /app devwithlando/php:8.4-apache-7 sh -lc '
set -eu
php -v | head -1
find vend-proofing-core/php/classes/simpleadmin vend-proofing-core/php -maxdepth 1 -name "*.php" -print0 | xargs -0 -n1 php -l > /tmp/vend-lint.txt
# Existing Guzzle Promise 1.5.2 emits PHP 8.4 deprecations during autoload.
# Keep warnings/errors visible; dependency upgrade is tracked in the phase log.
php -d display_errors=1 -d error_reporting=24575 phase1-storage.php
php scripts/install.php
php scripts/migrate.php
php scripts/foundation-test.php
php -r '\''define("SA_DIR_AUTH", "/app/vend-proofing-data/auth"); require "vend-proofing-core/php/classes/simpleadmin/Database.php"; require "vend-proofing-core/php/classes/simpleadmin/Catalog.php"; Catalog::savePage("875c", ["Test Gallery", "UploadSet", 0]); unlink("vend-proofing-data/storage/set.page.table");'\''
php -d display_errors=1 -d error_reporting=24575 -d disable_functions=checkdnsrr,mail,curl_init,fsockopen -S 127.0.0.1:8080 -t /app /app/scripts/dev-router.php >/tmp/vend-server.log 2>&1 &
server_pid=$!
trap "kill $server_pid" EXIT
sleep 1
curl -fsS "http://127.0.0.1:8080/?/admin/" | grep -q "scripts/admin-account.php create USERNAME EMAIL"
echo "PASS existing init template before administrator creation"
printf "%s\n" "SyntheticAdminPassword123!" | php scripts/admin-account.php create testadmin owner@example.invalid
php scripts/foundation-auth-test.php
for route in / /?/admin/ /?/set/875c/test-gallery/ /?/order/ /?/js/admin/1.0.00/ /?/xml/cronjob/; do
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
  esac
done
private_status="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8080/vend-proofing-data/auth/vend.sqlite")"
[ "$private_status" = 403 ]
gateway="http://127.0.0.1:8080/vend-proofing-gateway.php"
for action in system_phpinfo get_xml get_files get_set; do
  [ "$(curl -s -o /dev/null -w "%{http_code}" --data-urlencode "action=$action" --data-urlencode "type=setup" --data-urlencode "name=page" "$gateway")" = 403 ]
done
[ "$(curl -s -o /dev/null -w "%{http_code}" --data-urlencode "action=get_public_asset" --data-urlencode "folder=../auth" --data-urlencode "filename=vend.sqlite" "$gateway")" = 404 ]
[ "$(curl -s -o /dev/null -w "%{http_code}" --data-urlencode "action=list_session_table" --data-urlencode "puid=../auth" --data-urlencode "name=admin" "$gateway")" = 400 ]
[ "$(curl -s -o /dev/null -w "%{http_code}" --data-urlencode "action=validate_login" --data-urlencode "suid=../auth" "$gateway")" = 400 ]
curl -fsS "$gateway?action=get_public_asset&folder=asset&filename=test.png" | grep -q "public asset"
echo "PASS public Gateway and asset boundaries"
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies -d "action=auth_status" "$gateway" | grep -q "s=false"
echo "PASS unauthenticated status"
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies -d "action=login&username=testadmin&password=wrong" "$gateway" | grep -q "s=false"
echo "PASS rejected password"
login_result="$(curl -fsS -D /tmp/vend-login-headers -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=login" --data-urlencode "username=testadmin" --data-urlencode "password=SyntheticAdminPassword123!" "$gateway")"
case "$login_result" in *"s=true"*) ;; *) exit 1 ;; esac
grep -Eiq "Set-Cookie: VEND_ADMIN=.*HttpOnly; SameSite=Lax" /tmp/vend-login-headers
csrf="${login_result#*r=}"
[ ${#csrf} -eq 64 ]
echo "PASS login"
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies -d "action=auth_status" "$gateway" | grep -q "s=true"
echo "PASS authenticated status"
forged_result="$(curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies -d "action=set_list&name=page&token=forged" "$gateway")"
case "$forged_result" in *"s=true"*) echo "FAIL forged token accepted"; exit 1 ;; esac
echo "PASS rejected token"
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=set_list" --data-urlencode "name=page" --data-urlencode "token=$csrf" "$gateway" | grep -q "s=true"
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=get_xml" --data-urlencode "type=setup" --data-urlencode "token=$csrf" "$gateway" | grep -q "<data"
echo "PASS authorized Gateway"
printf "%s\n" "ReplacementPassword123!" | php scripts/admin-account.php reset testadmin
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies -d "action=auth_status" "$gateway" | grep -q "s=false"
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies -d "action=login&username=testadmin&password=SyntheticAdminPassword123!" "$gateway" | grep -q "s=false"
login_result="$(curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=login" --data-urlencode "username=testadmin" --data-urlencode "password=ReplacementPassword123!" "$gateway")"
case "$login_result" in *"s=true"*) ;; *) exit 1 ;; esac
csrf="${login_result#*r=}"
echo "PASS CLI reset invalidates sessions and old password"
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=logout" --data-urlencode "token=$csrf" "$gateway" | grep -q "s=true"
echo "PASS logout"
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies -d "action=auth_status" "$gateway" | grep -q "s=false"
if grep -Eiq "(Fatal error|Parse error|Uncaught|Deprecated:|Warning:)" /tmp/vend-server.log; then
  cat /tmp/vend-server.log
  exit 1
fi
echo "HTTP smoke and storage contract assertions passed"
'
