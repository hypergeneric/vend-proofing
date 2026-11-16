#!/usr/bin/env bash
set -euo pipefail

# Runs Vend against disposable, synthetic data in a container with no network.
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_dir="$(mktemp -d /tmp/vend-php84.XXXXXX)"
trap 'rm -rf "$fixture_dir"' EXIT

mkdir -p "$fixture_dir/dist"
cp -a "$project_dir/dist/vend-proofing-core" "$fixture_dir/dist/"
cp "$project_dir"/dist/index.php "$project_dir"/dist/vend-proofing-{config,gateway,index,resample}.php "$fixture_dir/dist/"
mkdir -p "$fixture_dir/dist/vend-proofing-data"/{storage,auth,temp,cache,uploads}
cat > "$fixture_dir/dist/vend-proofing-data/storage/set.page.table" <<'DATA'
875c	Test Gallery	UploadSet	0
DATA
mkdir -p "$fixture_dir/dist/vend-proofing-data/storage/875c"
mkdir -p "$fixture_dir/dist/vend-proofing-data/storage/asset"
printf 'public asset' > "$fixture_dir/dist/vend-proofing-data/storage/asset/test.png"
for extension in mp4 webm ogg; do
  printf 'synthetic video response' > "$fixture_dir/dist/vend-proofing-data/storage/asset/test.$extension"
done
printf 'not listed' > "$fixture_dir/dist/vend-proofing-data/storage/asset/unlisted.png"
mkdir -p "$fixture_dir/scripts"
cp "$project_dir/scripts/phase1-storage.php" "$fixture_dir/scripts/phase1-storage.php"
mkdir -p "$fixture_dir/scripts"
cp "$project_dir/scripts/admin-account.php" "$fixture_dir/scripts/admin-account.php"
cp "$project_dir/scripts/install.php" "$fixture_dir/scripts/install.php"
cp "$project_dir/scripts/migrate.php" "$fixture_dir/scripts/migrate.php"
cp "$project_dir/scripts/foundation-test.php" "$fixture_dir/scripts/foundation-test.php"
cp "$project_dir/scripts/foundation-worker.php" "$fixture_dir/scripts/foundation-worker.php"
cp "$project_dir/scripts/foundation-auth-test.php" "$fixture_dir/scripts/foundation-auth-test.php"
cp "$project_dir/scripts/users-test.php" "$fixture_dir/scripts/users-test.php"
cp "$project_dir/scripts/public-base-url-test.php" "$fixture_dir/scripts/public-base-url-test.php"
cp "$project_dir/scripts/password-recovery-test.php" "$fixture_dir/scripts/password-recovery-test.php"
cp "$project_dir/scripts/password-recovery-http-test.php" "$fixture_dir/scripts/password-recovery-http-test.php"
cp "$project_dir/scripts/configuration-test.php" "$fixture_dir/scripts/configuration-test.php"
cp "$project_dir/scripts/configuration-sync-test.php" "$project_dir/scripts/sync-settings.php" "$fixture_dir/scripts/"
cp "$project_dir/scripts/dev-router.php" "$fixture_dir/scripts/dev-router.php"

docker run --rm --network none -v "$fixture_dir":/app -w /app/dist devwithlando/php:8.4-apache-7 sh -lc '
set -eu
php -v | head -1
find vend-proofing-core/php/classes/simpleadmin vend-proofing-core/php -maxdepth 1 -name "*.php" -print0 | xargs -0 -n1 php -l > /tmp/vend-lint.txt
# Existing Guzzle Promise 1.5.2 emits PHP 8.4 deprecations during autoload.
# Keep warnings/errors visible; dependency upgrade is tracked in the phase log.
php -d display_errors=1 -d error_reporting=24575 ../scripts/phase1-storage.php
php ../scripts/install.php
php ../scripts/migrate.php
php ../scripts/foundation-test.php
php ../scripts/public-base-url-test.php
php -d error_reporting=24575 -d disable_functions=checkdnsrr ../scripts/password-recovery-test.php
php ../scripts/configuration-test.php
php ../scripts/configuration-sync-test.php
php -r '\''define("SA_DIR_AUTH", "/app/dist/vend-proofing-data/auth"); require "vend-proofing-core/php/classes/simpleadmin/Database.php"; require "vend-proofing-core/php/classes/simpleadmin/Records.php"; Records::savePage("875c", ["Test Gallery", "UploadSet", 0]); Records::addMedia("asset", "asset", ["test.png", "test.png", "1x1"]); foreach (["mp4", "webm", "ogg"] as $extension) Records::addMedia("asset", "asset", ["test.$extension", "test.$extension", "1x1"]); unlink("vend-proofing-data/storage/set.page.table");'\''
php -d display_errors=1 -d error_reporting=24575 -d disable_functions=checkdnsrr,mail,curl_init,fsockopen -S 127.0.0.1:8080 -t /app/dist /app/scripts/dev-router.php >/tmp/vend-server.log 2>&1 &
server_pid=$!
trap "kill $server_pid" EXIT
sleep 1
[ "$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8080/?/admin/")" = 302 ]
echo "PASS admin redirects to setup before administrator creation"
printf "%s\n" "SyntheticAdminPassword123!" | php ../scripts/admin-account.php create testadmin owner@example.invalid
php ../scripts/foundation-auth-test.php
for route in / /?/admin/ /?/set/875c/test-gallery/ /?/order/ /vend-proofing-core/js/admin.js /?/xml/cronjob/ /?/xml/sitemap/; do
  curl -fsS -o /tmp/vend-response.html -w "%{http_code} %{size_download} bytes $route\n" "http://127.0.0.1:8080$route"
  if grep -Eiq "(<b>(Fatal error|Parse error|Uncaught|Deprecated|Warning)</b>|^(Fatal error|Parse error|Deprecated:|Warning:))" /tmp/vend-response.html; then
    head -c 600 /tmp/vend-response.html
    exit 1
  fi
  case "$route" in
    /) grep -q "<html" /tmp/vend-response.html ;;
    /?/admin/) grep -q "classes.Admin.initialize" /tmp/vend-response.html || { head -c 725 /tmp/vend-response.html; exit 1; } ;;
    /?/set/*) grep -q "data-suid=\"875c\"" /tmp/vend-response.html || { head -c 500 /tmp/vend-response.html; exit 1; } ;;
    /vend-proofing-core/js/admin.js) grep -q "classes.Admin" /tmp/vend-response.html ;;
    /?/xml/cronjob/) grep -q "recipients=\"0\"" /tmp/vend-response.html ;;
  esac
done
curl -fsS "http://127.0.0.1:8080/vend-proofing-core/js/storefront.js" -o /app/global-check.js
curl -fsS "http://127.0.0.1:8080/vend-proofing-core/js/admin.js" -o /app/admin-check.js
for retired_route in css/global css/admin js/global js/admin js/vend; do
  [ "$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8080/?/$retired_route/")" = 404 ]
done
curl -fsS "http://127.0.0.1:8080/" -o /app/storefront-check.html
curl -fsS "http://127.0.0.1:8080/?/admin/" -o /app/admin-check.html
private_status="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8080/vend-proofing-data/auth/vend.sqlite")"
[ "$private_status" = 403 ]
curl -fsS "http://127.0.0.1:8080/vend-proofing-core/lang/en.json" -o /tmp/vend-admin-lang.json
grep -q '"country_iso_codes"' /tmp/vend-admin-lang.json
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
for extension in mp4 webm ogg; do
  curl -fsS -D /tmp/vend-video-headers "$gateway?action=get_public_asset&folder=asset&filename=test.$extension" -o /tmp/vend-video-body
  grep -qi "Content-Type: video/$extension" /tmp/vend-video-headers
  grep -qi "Content-Length: 24" /tmp/vend-video-headers
  test "$(cat /tmp/vend-video-body)" = "synthetic video response"
done
echo "PASS public Gateway, video MIME types, and asset boundaries"
php -r '\''define("SA_DIR_AUTH", "vend-proofing-data/auth"); define("SA_DIR_DEFAULTS", "vend-proofing-core/defaults"); require "vend-proofing-core/php/classes/simpleadmin/Database.php"; require "vend-proofing-core/php/classes/simpleadmin/ConfigurationDocument.php"; require "vend-proofing-core/php/classes/simpleadmin/Configuration.php"; $gallery=new ConfigurationDocument(file_get_contents(SA_DIR_DEFAULTS . "/uploadset.json")); $gallery->editNode("data.settings.password", base64_encode("gallery-pass")); if (!Configuration::save("uploadset", "875c", $gallery->toString())) exit(1);'\''
gallery_token=$(curl -fsS -c /tmp/vend-gallery-cookies --data-urlencode "action=validate_login" --data-urlencode "suid=875c" --data-urlencode "password=gallery-pass" "$gateway")
expected_gallery_token=$(php -r '\''define("SA_DIR_AUTH", "vend-proofing-data/auth"); require "vend-proofing-core/php/classes/simpleadmin/Database.php"; echo hash_hmac("sha256", "875c", Database::installationSecret());'\'')
[ "$gallery_token" = "$expected_gallery_token" ]
curl -fsS -b /tmp/vend-gallery-cookies "http://127.0.0.1:8080/?/set/875c/test-gallery/" | grep -q "data-suid=\"875c\""
php -r '\''define("SA_DIR_AUTH", "vend-proofing-data/auth"); define("SA_DIR_DEFAULTS", "vend-proofing-core/defaults"); require "vend-proofing-core/php/classes/simpleadmin/Database.php"; require "vend-proofing-core/php/classes/simpleadmin/Configuration.php"; Configuration::revert("uploadset", "875c");'\''
echo "PASS gallery access secret and saved JSON settings"
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
admin_json=$(curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=setup_load" --data-urlencode "type=contact" --data-urlencode "token=$csrf" "$gateway")
case "$admin_json" in *owner%40example.invalid*synthetic-private-key*) ;; *) echo "FAIL authenticated admin JSON load"; exit 1 ;; esac
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=setup_defaults" --data-urlencode "type=splash" --data-urlencode "token=$csrf" "$gateway" | grep -q "s=true"
splash_override="{\"data\":{\"settings\":{\"description\":{\"_value\":\"SQLite only\",\"_attributes\":{}}}}}"
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=setup_save" --data-urlencode "type=splash" --data-urlencode "data=$splash_override" --data-urlencode "token=$csrf" "$gateway" | grep -q "s=true"
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=setup_load" --data-urlencode "type=splash" --data-urlencode "token=$csrf" "$gateway" | grep -q "SQLite%20only"
test ! -e vend-proofing-data/storage/splash.xml
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=setup_save" --data-urlencode "type=splash" --data-urlencode "data={broken" --data-urlencode "token=$csrf" "$gateway" | grep -q "s=false"
curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=setup_revert" --data-urlencode "type=splash" --data-urlencode "token=$csrf" "$gateway" | grep -q "s=true"
reverted_splash=$(curl -fsS -c /tmp/vend-cookies -b /tmp/vend-cookies --data-urlencode "action=setup_load" --data-urlencode "type=splash" --data-urlencode "token=$csrf" "$gateway")
case "$reverted_splash" in *SQLite%20only*) echo "FAIL JSON revert retained the override"; exit 1 ;; esac
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); $db->prepare("DELETE FROM configuration_documents WHERE type = ? AND scope_id = ?")->execute(array("contact", ""));'\''
contact_setup=$(curl -fsS -b /tmp/vend-cookies "http://127.0.0.1:8080/?/admin/")
case "$contact_setup" in *classes.Admin.initialize*) ;; *) echo "FAIL missing contact blocked admin"; exit 1 ;; esac
echo "PASS missing contact does not block admin"
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
echo "PASS authorized Gateway"
php ../scripts/users-test.php
php ../scripts/password-recovery-http-test.php
printf "%s\n" "ReplacementPassword123!" | php ../scripts/admin-account.php reset testadmin
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
node --check "$fixture_dir/global-check.js"
node --check "$fixture_dir/admin-check.js"
node "$project_dir/scripts/js-page-check.js" "$fixture_dir/storefront-check.html" "$fixture_dir/admin-check.html"
echo "Static bundles and inline page configuration syntax passed"
