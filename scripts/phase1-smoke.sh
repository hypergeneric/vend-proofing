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
sed -i 's#<sendgrid_api_key private="true" encoded="true"></sendgrid_api_key>#<sendgrid_api_key private="true" encoded="true">synthetic-private-key</sendgrid_api_key>#' "$fixture_dir/vend-proofing-data/storage/contact.xml"
cp "$project_dir/vend-proofing-core/defaults/cron.xml" "$fixture_dir/vend-proofing-data/storage/cron.xml"
sed -i 's#<cron_enabled_bool>false</cron_enabled_bool>#<cron_enabled_bool>true</cron_enabled_bool>#; s#<expiring_notify_bool>false</expiring_notify_bool>#<expiring_notify_bool>true</expiring_notify_bool>#' "$fixture_dir/vend-proofing-data/storage/cron.xml"
mkdir -p "$fixture_dir/vend-proofing-data/storage/asset"
printf 'public asset' > "$fixture_dir/vend-proofing-data/storage/asset/test.png"
printf 'not listed' > "$fixture_dir/vend-proofing-data/storage/asset/unlisted.png"
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
php -r '\''define("SA_DIR_AUTH", "/app/vend-proofing-data/auth"); require "vend-proofing-core/php/classes/simpleadmin/Database.php"; require "vend-proofing-core/php/classes/simpleadmin/Records.php"; Records::savePage("875c", ["Test Gallery", "UploadSet", 0]); Records::addMedia("asset", "asset", ["test.png", "test.png", "1x1"]); unlink("vend-proofing-data/storage/set.page.table");'\''
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
for retired_action in get_xml get_files get_set; do
  retired_response=$(curl -fsS --data-urlencode "action=$retired_action" --data-urlencode "type=contact" --data-urlencode "name=page" "$gateway")
  case "$retired_response" in *"<error>"*"</error>"*) ;; *) echo "FAIL retired action remained public: $retired_action ($retired_response)"; exit 1 ;; esac
done
[ "$(curl -s -o /dev/null -w "%{http_code}" --data-urlencode "action=get_public_asset" --data-urlencode "folder=../auth" --data-urlencode "filename=vend.sqlite" "$gateway")" = 404 ]
[ "$(curl -s -o /dev/null -w "%{http_code}" --data-urlencode "action=list_session_table" --data-urlencode "puid=../auth" --data-urlencode "name=admin" "$gateway")" = 400 ]
[ "$(curl -s -o /dev/null -w "%{http_code}" --data-urlencode "action=validate_login" --data-urlencode "suid=../auth" "$gateway")" = 400 ]
curl -fsS "$gateway?action=get_public_asset&folder=asset&filename=test.png" | grep -q "public asset"
[ "$(curl -s -o /dev/null -w "%{http_code}" --data-urlencode "action=get_public_asset" --data-urlencode "folder=asset" --data-urlencode "filename=unlisted.png" "$gateway")" = 404 ]
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
admin_xml=$(curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=setup_load" --data-urlencode "type=contact" --data-urlencode "token=$csrf" "$gateway")
case "$admin_xml" in *owner%40example.invalid*synthetic-private-key*) ;; *) echo "FAIL authenticated admin XML load"; exit 1 ;; esac
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=set_list" --data-urlencode "name=page" --data-urlencode "token=$csrf" "$gateway" | grep -q "Test%20Gallery"
tax_data=$(printf "California\t\t7.25")
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=set_create" --data-urlencode "name=ustaxchart" --data-urlencode "suid=CA" --data-urlencode "data=$tax_data" --data-urlencode "token=$csrf" "$gateway" | grep -q "s=true"
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=set_list" --data-urlencode "name=ustaxchart" --data-urlencode "token=$csrf" "$gateway" | grep -q "California"
for retired_action in get_xml get_files get_set; do
  retired_response=$(curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=$retired_action" --data-urlencode "token=$csrf" "$gateway")
  case "$retired_response" in *"<error>"*"</error>"*) ;; *) echo "FAIL retired action remained authenticated: $retired_action ($retired_response)"; exit 1 ;; esac
done
system_info=$(curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=system_getinfo" --data-urlencode "token=$csrf" "$gateway")
case "$system_info" in *reseller_id*) echo "FAIL retired reseller property remained"; exit 1 ;; esac
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=account_changepassword" --data-urlencode "username=testadmin" --data-urlencode "o_password=wrong" --data-urlencode "n_password=ReplacementPassword123!" --data-urlencode "token=$csrf" "$gateway" | grep -q "s=false"
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=account_changeusername" --data-urlencode "o_username=testadmin" --data-urlencode "n_username=otheradmin" --data-urlencode "password=wrong" --data-urlencode "token=$csrf" "$gateway" | grep -q "s=false"
echo "PASS authorized Gateway"
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=account_changeusername" --data-urlencode "o_username=testadmin" --data-urlencode "n_username=otheradmin" --data-urlencode "password=SyntheticAdminPassword123!" --data-urlencode "token=$csrf" "$gateway" | grep -q "s=true"
login_result=$(curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=login" --data-urlencode "username=otheradmin" --data-urlencode "password=SyntheticAdminPassword123!" "$gateway")
case "$login_result" in *"s=true"*) ;; *) echo "FAIL changed username login"; exit 1 ;; esac
csrf="${login_result#*r=}"
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=account_changeusername" --data-urlencode "o_username=otheradmin" --data-urlencode "n_username=testadmin" --data-urlencode "password=SyntheticAdminPassword123!" --data-urlencode "token=$csrf" "$gateway" | grep -q "s=true"
login_result=$(curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=login" --data-urlencode "username=testadmin" --data-urlencode "password=SyntheticAdminPassword123!" "$gateway")
case "$login_result" in *"s=true"*) ;; *) echo "FAIL restored username login"; exit 1 ;; esac
csrf="${login_result#*r=}"
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=account_changepassword" --data-urlencode "username=testadmin" --data-urlencode "o_password=SyntheticAdminPassword123!" --data-urlencode "n_password=TemporaryPassword123!" --data-urlencode "token=$csrf" "$gateway" | grep -q "s=true"
login_result=$(curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=login" --data-urlencode "username=testadmin" --data-urlencode "password=TemporaryPassword123!" "$gateway")
case "$login_result" in *"s=true"*) ;; *) echo "FAIL changed password login"; exit 1 ;; esac
csrf="${login_result#*r=}"
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=account_changepassword" --data-urlencode "username=testadmin" --data-urlencode "o_password=TemporaryPassword123!" --data-urlencode "n_password=SyntheticAdminPassword123!" --data-urlencode "token=$csrf" "$gateway" | grep -q "s=true"
login_result=$(curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=login" --data-urlencode "username=testadmin" --data-urlencode "password=SyntheticAdminPassword123!" "$gateway")
case "$login_result" in *"s=true"*) ;; *) echo "FAIL restored password login"; exit 1 ;; esac
csrf="${login_result#*r=}"
echo "PASS administrator username and password changes"
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
