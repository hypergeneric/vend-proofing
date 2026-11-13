#!/usr/bin/env bash
set -euo pipefail

# Fresh installation: page and image records exist only in SQLite.
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_dir="$(mktemp -d /tmp/vend-basic-set.XXXXXX)"
trap 'rm -rf "$fixture_dir"' EXIT

mkdir -p "$fixture_dir/dist"
cp -a "$project_dir/dist/vend-proofing-core" "$fixture_dir/dist/"
cp "$project_dir"/dist/index.php "$project_dir"/dist/vend-proofing-{config,gateway,index,resample}.php "$fixture_dir/dist/"
mkdir -p "$fixture_dir/dist/vend-proofing-data"/{storage,auth,temp,cache,uploads}
mkdir -p "$fixture_dir/scripts"
cp "$project_dir/scripts/install.php" "$project_dir/scripts/admin-account.php" "$project_dir/scripts/dev-router.php" "$project_dir/scripts/dropbox-records-test.php" "$project_dir/scripts/message-records-test.php" "$project_dir/scripts/media-records-test.php" "$project_dir/scripts/pricing-records-test.php" "$project_dir/scripts/misc-records-test.php" "$project_dir/scripts/proofing-records-test.php" "$project_dir/scripts/order-records-test.php" "$fixture_dir/scripts/"
cp "$project_dir/scripts/checkout-fixture.php" "$fixture_dir/scripts/"
cp "$project_dir/scripts/configuration-test.php" "$fixture_dir/scripts/configuration-test.php"

docker run --rm --network none -v "$fixture_dir":/app -w /app/dist devwithlando/php:8.4-apache-7 sh -lc '
set -eu
php ../scripts/install.php
php ../scripts/configuration-test.php
printf "%s\n" "SyntheticAdminPassword123!" | php ../scripts/admin-account.php create testadmin owner@example.invalid
php -r '\''$image=imagecreatetruecolor(640,480); imagefill($image,0,0,imagecolorallocate($image,32,96,160)); imagejpeg($image,"/tmp/basic-set.jpg",85);'\''
php -d display_errors=1 -d error_reporting=24575 -d disable_functions=checkdnsrr,mail,curl_init,fsockopen -S 127.0.0.1:8080 -t /app/dist /app/scripts/dev-router.php >/tmp/vend-basic-server.log 2>&1 &
server_pid=$!
trap "kill \$server_pid 2>/dev/null || true; chmod -R a+rwX /app/dist/vend-proofing-data" EXIT
sleep 1
gateway=http://127.0.0.1:8080/vend-proofing-gateway.php
login=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=login" --data-urlencode "username=testadmin" --data-urlencode "password=SyntheticAdminPassword123!" "$gateway")
case "$login" in *"s=true"*) ;; *) echo "FAIL login"; exit 1 ;; esac
token="${login#*r=}"
created=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_create" --data-urlencode "name=page" --data-urlencode "data=Basic Gallery	UploadSet	0" --data-urlencode "token=$token" "$gateway")
case "$created" in s=true*) ;; *) echo "FAIL create: $created"; exit 1 ;; esac
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); $row=$db->query("SELECT suid, title FROM pages")->fetch(PDO::FETCH_ASSOC); if(!$row || $row["title"]!=="Basic Gallery") exit(1); file_put_contents("/tmp/basic-suid",$row["suid"]);'\''
suid=$(cat /tmp/basic-suid)
php -r '\''define("SA_DIR_AUTH", "vend-proofing-data/auth"); define("SA_DIR_DEFAULTS", "vend-proofing-core/defaults"); require "vend-proofing-core/php/classes/simpleadmin/Database.php"; require "vend-proofing-core/php/classes/simpleadmin/Configuration.php"; if (!Configuration::save("uploadset", $argv[1], file_get_contents(SA_DIR_DEFAULTS . "/uploadset.json"))) exit(1);'\'' "$suid"
test ! -e vend-proofing-data/storage/set.page.table
list=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_list" --data-urlencode "name=page" --data-urlencode "token=$token" "$gateway")
case "$list" in *"Basic%20Gallery"*) ;; *) echo "FAIL page list: $list"; exit 1 ;; esac
echo "PASS create and list a relational upload set"
php ../scripts/misc-records-test.php
tax_data=$(printf "California\t\t7.25")
tax_created=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_create" --data-urlencode "name=ustaxchart" --data-urlencode "suid=CA" --data-urlencode "data=$tax_data" --data-urlencode "token=$token" "$gateway")
case "$tax_created" in *California*) ;; *) echo "FAIL tax Gateway create: $tax_created"; exit 1 ;; esac
tax_deleted=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_delete" --data-urlencode "name=ustaxchart" --data-urlencode "suid=CA" --data-urlencode "token=$token" "$gateway")
case "$tax_deleted" in s=true*) ;; *) echo "FAIL tax Gateway delete: $tax_deleted"; exit 1 ;; esac
echo "PASS download, discount, tax, and form table types in SQLite"
php -d error_reporting=24575 -d disable_functions=checkdnsrr,mail,curl_init,fsockopen ../scripts/message-records-test.php
message_suid=$(cat /tmp/message-suid)
test ! -e vend-proofing-data/storage/set.messages.table
messages=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_list" --data-urlencode "name=messages" --data-urlencode "token=$token" "$gateway")
case "$messages" in *Synthetic%20subject*) echo "FAIL message subject was not encoded: $messages"; exit 1 ;; esac
case "$messages" in *U3ludGhldGljIHN1YmplY3Q%3D*) ;; *) echo "FAIL relational message list: $messages"; exit 1 ;; esac
mkdir -p "vend-proofing-data/storage/$message_suid"
printf "keep\n" > "vend-proofing-data/storage/$message_suid/sentinel.txt"
deleted=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_delete" --data-urlencode "name=messages" --data-urlencode "suid=$message_suid" --data-urlencode "token=$token" "$gateway")
case "$deleted" in s=true*) ;; *) echo "FAIL delete message: $deleted"; exit 1 ;; esac
test -f "vend-proofing-data/storage/$message_suid/sentinel.txt"
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); if($db->query("SELECT COUNT(*) FROM messages")->fetchColumn()!=0) exit(1);'\''
echo "PASS relational email log, admin list, and delete"
for kind in asset audio track package product; do
  media_folder="$kind"
  if [ "$kind" = track ]; then media_folder="$suid"; fi
  cp /tmp/basic-set.jpg "/tmp/basic-$kind.jpg"
  media_uploaded=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies -F "action=${kind}_upload" -F "token=$token" -F "suid=$media_folder" -F "Filedata=@/tmp/basic-$kind.jpg;filename=basic-$kind.jpg;type=image/jpeg" "$gateway")
  case "$media_uploaded" in s=true*) ;; *) echo "FAIL $kind upload: $media_uploaded"; exit 1 ;; esac
  media_key=$(php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); $q=$db->prepare("SELECT public_key FROM media_assets WHERE media_type = ?"); $q->execute(array($argv[1])); echo $q->fetchColumn();'\'' "$kind")
  test -n "$media_key"
  test ! -e "vend-proofing-data/storage/$media_folder/$kind.table"
  media_list=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=${kind}_list" --data-urlencode "suid=$media_folder" --data-urlencode "token=$token" "$gateway")
  case "$media_list" in *"basic-$kind.jpg"*) ;; *) echo "FAIL $kind list: $media_list"; exit 1 ;; esac
  if [ "$kind" = asset ]; then
    printf "decoy.jpg\tOld asset\t1x1\n" > "vend-proofing-data/storage/asset/asset.table"
    media_list=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=asset_list" --data-urlencode "token=$token" "$gateway")
    case "$media_list" in *decoy.jpg*) echo "FAIL legacy asset table was read"; exit 1 ;; esac
    rm -f "vend-proofing-data/storage/asset/asset.table"
    asset_snapshot_data="data:image/jpeg;base64,$(base64 -w0 /tmp/basic-asset.jpg)"
    asset_snapshot=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=asset_snapshot" --data-urlencode "filename=$media_key" --data-urlencode "data=$asset_snapshot_data" --data-urlencode "token=$token" "$gateway")
    case "$asset_snapshot" in s=true*) ;; *) echo "FAIL asset canvas snapshot: $asset_snapshot"; exit 1 ;; esac
    cmp -s /tmp/basic-asset.jpg "vend-proofing-data/storage/asset/$media_key.snapshot.jpg"
    asset_snapshot_upload=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies -F action=asset_upload -F "token=$token" -F snapshot=true -F "filename=$media_key" -F "Filedata=@/tmp/basic-asset.jpg;filename=snapshot.jpg;type=image/jpeg" "$gateway")
    case "$asset_snapshot_upload" in s=true*) ;; *) echo "FAIL asset multipart snapshot: $asset_snapshot_upload"; exit 1 ;; esac
    cmp -s /tmp/basic-asset.jpg "vend-proofing-data/storage/asset/$media_key.snapshot.jpg"
  fi
  media_data=$(printf "%s\t%s\tnull\tnull\tnull\t%s" "$media_key" "Updated $kind" "Synthetic description")
  media_updated=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=${kind}_update" --data-urlencode "suid=$media_folder" --data-urlencode "data=$media_data" --data-urlencode "token=$token" "$gateway")
  case "$media_updated" in *Updated%20$kind*) ;; *) echo "FAIL $kind update: key=$media_key list=$media_list data=$media_data response=$media_updated"; exit 1 ;; esac
  if [ "$kind" = asset ] || [ "$kind" = audio ] || [ "$kind" = track ]; then
    curl -fsS --get --data-urlencode "action=get_public_asset" --data-urlencode "folder=$media_folder" --data-urlencode "filename=$media_key" -o "/tmp/public-$kind.jpg" "$gateway" || { echo "FAIL $kind public asset"; exit 1; }
    cmp -s "/tmp/public-$kind.jpg" "/tmp/basic-$kind.jpg"
  fi
  curl -fsS --get --data-urlencode "q=$media_folder:$media_key:80:60:1:jpg" -o "/tmp/resized-$kind.jpg" http://127.0.0.1:8080/vend-proofing-resample.php
  php -r '\''$size=getimagesize($argv[1]); if($size[0]!==80 || $size[1]!==60) exit(1);'\'' "/tmp/resized-$kind.jpg"
  media_deleted=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=${kind}_delete" --data-urlencode "suid=$media_folder" --data-urlencode "files=$media_key" --data-urlencode "token=$token" "$gateway")
  case "$media_deleted" in s=true*) ;; *) echo "FAIL $kind delete: $media_deleted"; exit 1 ;; esac
  test ! -e "vend-proofing-data/storage/$media_folder/$media_key"
  test ! -e "vend-proofing-data/storage/$media_folder/$media_key.snapshot.jpg"
done
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); if($db->query("SELECT COUNT(*) FROM media_entries")->fetchColumn()!=0) exit(1);'\''
echo "PASS five relational media table types through upload, list, edit, public read, and delete"
php ../scripts/media-records-test.php
reordered=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=asset_reindex" --data-urlencode "indices=0,1;1,0" --data-urlencode "token=$token" "$gateway")
case "$reordered" in s=true*) ;; *) echo "FAIL asset reorder: $reordered"; exit 1 ;; esac
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); $keys=$db->query("SELECT assets.public_key FROM media_entries AS entries JOIN media_assets AS assets ON assets.id = entries.asset_id WHERE entries.kind = \"asset\" ORDER BY entries.position")->fetchAll(PDO::FETCH_COLUMN); if($keys!==array("synthetic-b.jpg", "synthetic-a.jpg")) exit(1);'\''
for media_key in synthetic-a.jpg synthetic-b.jpg; do
  curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=asset_delete" --data-urlencode "files=$media_key" --data-urlencode "token=$token" "$gateway" >/dev/null
done
echo "PASS relational media order, service rows, partial updates, and duplicate rollback"
uploaded=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies -F action=image_upload -F "token=$token" -F name=page -F "suid=$suid" -F "Filedata=@/tmp/basic-set.jpg;filename=basic-set.jpg;type=image/jpeg" "$gateway")
case "$uploaded" in s=true*) ;; *) echo "FAIL upload: $uploaded"; exit 1 ;; esac
test ! -e "vend-proofing-data/storage/$suid/image.table"
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); if($db->query("SELECT COUNT(*) FROM gallery_images")->fetchColumn()!=1 || $db->query("SELECT image_count FROM pages")->fetchColumn()!=1) exit(1);'\''
filename=$(find "vend-proofing-data/storage/$suid" -maxdepth 1 -name "*.jpg" -printf "%f\n" | head -1)
snapshot_data="data:image/jpeg;base64,$(base64 -w0 /tmp/basic-set.jpg)"
snapshot_saved=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=image_snapshot" --data-urlencode "name=page" --data-urlencode "suid=$suid" --data-urlencode "filename=$filename" --data-urlencode "data=$snapshot_data" --data-urlencode "token=$token" "$gateway")
case "$snapshot_saved" in s=true*) ;; *) echo "FAIL image snapshot: $snapshot_saved"; exit 1 ;; esac
cmp -s /tmp/basic-set.jpg "vend-proofing-data/storage/$suid/$filename.snapshot.jpg"
snapshot_uploaded=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies -F action=image_upload -F "token=$token" -F name=page -F "suid=$suid" -F snapshot=true -F "filename=$filename" -F "Filedata=@/tmp/basic-set.jpg;filename=snapshot.jpg;type=image/jpeg" "$gateway")
case "$snapshot_uploaded" in s=true*) ;; *) echo "FAIL multipart snapshot: $snapshot_uploaded"; exit 1 ;; esac
cmp -s /tmp/basic-set.jpg "vend-proofing-data/storage/$suid/$filename.snapshot.jpg"
echo "PASS image snapshot data and multipart upload"
php ../scripts/proofing-records-test.php "$suid" "$filename"
php ../scripts/order-records-test.php "$suid" "$filename"
session_key=$(curl -fsS --data-urlencode "action=open_session" --data-urlencode "puid=$suid" --data-urlencode "email=browser@example.invalid" "$gateway")
expected_key=$(php -r '\''echo md5("browser@example.invalid");'\'')
test "$session_key" = "$expected_key"
favorite_row=$(printf "browser-f\t%s\t%s\tPhoto.jpg\t640\t480" "$suid" "$filename")
saved_favorite=$(curl -fsS --data-urlencode "action=update_session_item" --data-urlencode "type=favorites" --data-urlencode "puid=$suid" --data-urlencode "name=$session_key" --data-urlencode "data=$favorite_row" "$gateway")
case "$saved_favorite" in *browser-f*) ;; *) echo "FAIL public favorite save: $saved_favorite"; exit 1 ;; esac
listed_session=$(curl -fsS --data-urlencode "action=list_session_table" --data-urlencode "puid=$suid" --data-urlencode "name=$session_key" "$gateway")
case "$listed_session" in *browser-f*) ;; *) echo "FAIL public session list: $listed_session"; exit 1 ;; esac
admin_sessions=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_list" --data-urlencode "name=session" --data-urlencode "puid=$suid" --data-urlencode "token=$token" "$gateway")
case "$admin_sessions" in *browser%40example.invalid*) ;; *) echo "FAIL admin session list: $admin_sessions"; exit 1 ;; esac
admin_favorites=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_list" --data-urlencode "name=$session_key" --data-urlencode "puid=$suid" --data-urlencode "token=$token" "$gateway")
case "$admin_favorites" in *browser-f*) ;; *) echo "FAIL admin favorite export: $admin_favorites"; exit 1 ;; esac
removed_session=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_delete" --data-urlencode "name=session" --data-urlencode "suid=$session_key" --data-urlencode "puid=$suid" --data-urlencode "token=$token" "$gateway")
case "$removed_session" in s=true*) ;; *) echo "FAIL admin session delete: $removed_session"; exit 1 ;; esac
echo "PASS public and admin proofing Gateway responses"
php ../scripts/checkout-fixture.php "$suid"
checkout_key=$(curl -fsS --data-urlencode "action=open_session" --data-urlencode "puid=$suid" --data-urlencode "email=checkout@example.invalid" "$gateway")
checkout_item=$(printf "%s\t" "checkout-print" "$suid" "$filename" "Photo.jpg" "1" "color" "Eight by Ten" "0.8" "10" "0" "portrait" "0" "0" "" "0" "0" "" "0" "0" "10.00" "0.00" "")
curl -fsS --data-urlencode "action=update_session_item" --data-urlencode "type=cart" --data-urlencode "puid=$suid" --data-urlencode "name=$checkout_key" --data-urlencode "data=$checkout_item" "$gateway" >/dev/null
php -r '\''define("SA_DIR_AUTH", "vend-proofing-data/auth"); require "vend-proofing-core/php/classes/simpleadmin/Database.php"; require "vend-proofing-core/php/classes/simpleadmin/Records.php"; Records::saveDiscount(Database::allocateSuid(), $argv[1], array($argv[1], "CHECKOUT10", "10", "percentage", "0", "1", "", "0", "0"));'\'' "$suid"
verified=$(curl -fsS --data-urlencode "action=verify_discount_code" --data-urlencode "puid=$suid" --data-urlencode "code=CHECKOUT10" --data-urlencode "subtotal=10" "$gateway")
case "$verified" in true?*CHECKOUT10*) ;; *) echo "FAIL discount verification: $verified"; exit 1 ;; esac
unknown=$(curl -fsS --data-urlencode "action=verify_discount_code" --data-urlencode "puid=$suid" --data-urlencode "code=UNKNOWN" --data-urlencode "subtotal=10" "$gateway")
case "$unknown" in false?discount_does_not_exist) ;; *) echo "FAIL discount language key: $unknown"; exit 1 ;; esac
wrong_cart=$(curl -fsS --data-urlencode "action=prequalify_order" --data-urlencode "puid=$suid" --data-urlencode "name=$checkout_key" --data-urlencode "code=CHECKOUT10" --data-urlencode "subtotal=9" "$gateway")
case "$wrong_cart" in false?invalid_order) ;; *) echo "FAIL order language key: $wrong_cart"; exit 1 ;; esac
prequalified=$(curl -fsS --data-urlencode "action=prequalify_order" --data-urlencode "puid=$suid" --data-urlencode "name=$checkout_key" --data-urlencode "email=checkout@example.invalid" --data-urlencode "code=CHECKOUT10" --data-urlencode "subtotal=10" "$gateway")
case "$prequalified" in true?*) ;; *) echo "FAIL order prequalification: $prequalified"; exit 1 ;; esac
checkout_orderid=$(printf "%s" "$prequalified" | cut -f2)
retried=$(curl -fsS --data-urlencode "action=prequalify_order" --data-urlencode "puid=$suid" --data-urlencode "name=$checkout_key" --data-urlencode "orderid=$checkout_orderid" --data-urlencode "code=CHECKOUT10" --data-urlencode "subtotal=10" "$gateway")
test "$retried" = "$prequalified"
exhausted=$(curl -fsS --data-urlencode "action=prequalify_order" --data-urlencode "puid=$suid" --data-urlencode "name=$checkout_key" --data-urlencode "code=CHECKOUT10" --data-urlencode "subtotal=10" "$gateway")
test "$exhausted" = "$prequalified"
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); if($db->query("SELECT SUM(use_count) FROM discounts")->fetchColumn()!=1 || $db->query("SELECT COUNT(*) FROM discount_reservations")->fetchColumn()!=1) exit(1);'\''
checkout_row=$(printf "%s\t" "$checkout_orderid" "$suid" "0" "stripe" "forged-reference" "standard" "CHECKOUT10" "Checkout Buyer" "checkout@example.invalid" "" "" "US" "" "CA" "9.00" "10.00" "1.00" "0.00" "0.00" "0.00" "0" "false" "false" "false")
placed=$(curl -fsS --data-urlencode "action=finalize_order" --data-urlencode "puid=$suid" --data-urlencode "name=$checkout_key" --data-urlencode "data=$checkout_row" "$gateway")
case "$placed" in true?*) ;; *) echo "FAIL offline checkout: $placed"; exit 1 ;; esac
replayed=$(curl -fsS --data-urlencode "action=finalize_order" --data-urlencode "puid=$suid" --data-urlencode "name=$checkout_key" --data-urlencode "data=$checkout_row" "$gateway")
case "$replayed" in true?*) ;; *) echo "FAIL offline checkout replay: $replayed"; exit 1 ;; esac
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); $payment=$db->query("SELECT provider,status,provider_reference FROM payments")->fetch(PDO::FETCH_ASSOC); if($payment["provider"]!=="offline" || $payment["status"]!=="pending" || $payment["provider_reference"]!==null || $db->query("SELECT transaction_reference FROM orders")->fetchColumn()!=="") exit(1);'\''
retired=$(curl -fsS --data-urlencode action=process_credit_card "$gateway")
case "$retired" in *payment_unavailable*) ;; *) echo "FAIL retired raw-card action"; exit 1 ;; esac
unsigned_code=$(curl -sS -o /tmp/unsigned-webhook.json -w "%{http_code}" -H "Content-Type: application/json" --data "{}" "$gateway?action=payment_webhook&provider=stripe&mode=test")
test "$unsigned_code" = 400
admin_payment_code=$(curl -sS -o /tmp/unauthorized-payment.json -w "%{http_code}" --data-urlencode action=payment_mark_paid --data-urlencode "order=$checkout_orderid" "$gateway")
test "$admin_payment_code" = 403

php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); if($db->query("SELECT COUNT(*) FROM orders")->fetchColumn()!=1 || $db->query("SELECT COUNT(*) FROM order_items")->fetchColumn()!=1 || $db->query("SELECT COUNT(*) FROM discount_redemptions")->fetchColumn()!=1 || $db->query("SELECT COUNT(*) FROM discount_reservations")->fetchColumn()!=0) exit(1);'\''
invoice_html=$(curl -fsS "http://127.0.0.1:8080/?/order/$checkout_orderid/invoice/$(php -r '\''echo md5("checkout@example.invalid");'\'')/")
case "$invoice_html" in *"Checkout Buyer"*"Photo"*"cart-final-total"*"</html>"*) ;; *) echo "FAIL invoice did not render its item and total"; exit 1 ;; esac
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); $db->prepare("UPDATE payments SET provider = ?")->execute(array("stripe")); $db->prepare("UPDATE orders SET payment_type = ?")->execute(array("stripe"));'\''
curl -fsS "http://127.0.0.1:8080/?/order/$checkout_orderid/invoice/$(php -r '\''echo md5("checkout@example.invalid");'\'')/" -o /tmp/online-invoice.html
php -r '\''$html=file_get_contents("/tmp/online-invoice.html"); if(strpos($html,"vend-payment-retry")===false) exit(1); preg_match_all("~<script\b[^>]*>(.*?)</script>~si",$html,$matches); file_put_contents("/app/online-invoice-check.js",implode("\n",$matches[1])); $db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); $db->prepare("UPDATE payments SET provider = ?")->execute(array("offline")); $db->prepare("UPDATE orders SET payment_type = ?")->execute(array("offline"));'\''
curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=delete_order" --data-urlencode "orderid=$checkout_orderid" --data-urlencode "timestamp=0" --data-urlencode "token=$token" "$gateway" >/dev/null
php -r '\''define("SA_DIR_AUTH","vend-proofing-data/auth"); require "vend-proofing-core/php/classes/simpleadmin/Database.php"; require "vend-proofing-core/php/classes/simpleadmin/Proofing.php"; Proofing::deleteSession($argv[1],$argv[2]);'\'' "$suid" "$checkout_key"
echo "PASS offline checkout and invoice through Gateway with relational order rows"
php ../scripts/checkout-fixture.php "$suid" cleanup
second_upload=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies -F action=image_upload -F "token=$token" -F name=page -F "suid=$suid" -F "Filedata=@/tmp/basic-set.jpg;filename=sorted-second.jpg;type=image/jpeg" "$gateway")
case "$second_upload" in s=true*) ;; *) echo "FAIL second image upload: $second_upload"; exit 1 ;; esac
second_key=$(php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); $q=$db->prepare("SELECT public_key FROM media_assets WHERE original_name = ?"); $q->execute(array("sorted-second.jpg")); echo $q->fetchColumn();'\'')
sorted=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=image_reindex" --data-urlencode "name=page" --data-urlencode "suid=$suid" --data-urlencode "indices=0,1;1,0" --data-urlencode "token=$token" "$gateway")
case "$sorted" in s=true*) ;; *) echo "FAIL image reorder: $sorted"; exit 1 ;; esac
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); $keys=$db->query("SELECT assets.public_key FROM gallery_images AS images JOIN media_assets AS assets ON assets.id = images.asset_id ORDER BY images.position")->fetchAll(PDO::FETCH_COLUMN); if($keys!==array($argv[1],$argv[2])) exit(1);'\'' "$second_key" "$filename"
removed_second=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=image_delete" --data-urlencode "name=page" --data-urlencode "suid=$suid" --data-urlencode "files=$second_key" --data-urlencode "token=$token" "$gateway")
case "$removed_second" in s=true*) ;; *) echo "FAIL delete second image: $removed_second"; exit 1 ;; esac
echo "PASS image order from the admin indices map"
listed_images=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=image_list" --data-urlencode "name=page" --data-urlencode "suid=$suid" --data-urlencode "token=$token" "$gateway")
case "$listed_images" in *"$filename"*) ;; *) echo "FAIL relational image list: $listed_images"; exit 1 ;; esac
curl -fsS --get --data-urlencode "q=$suid:$filename:120:90:1:jpg" -o /tmp/basic-resized.jpg http://127.0.0.1:8080/vend-proofing-resample.php
php -r '\''$size=getimagesize("/tmp/basic-resized.jpg"); if($size[0]!==120||$size[1]!==90) exit(1);'\''
curl -fsS "http://127.0.0.1:8080/?/set/$suid/basic-gallery/" | grep -q "data-suid=\"$suid\""
echo "PASS image upload, resize, and storefront with no record files"
printf "dead\tDecoy Gallery\tUploadSet\t1\n" > vend-proofing-data/storage/set.page.table
printf "decoy.jpg\tDecoy Image\t1x1\n" > "vend-proofing-data/storage/$suid/image.table"
list=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_list" --data-urlencode "name=page" --data-urlencode "token=$token" "$gateway")
images=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=image_list" --data-urlencode "name=page" --data-urlencode "suid=$suid" --data-urlencode "token=$token" "$gateway")
case "$list$images" in *Decoy*|*decoy*) echo "FAIL flat-file decoy was read"; exit 1 ;; esac
rm -f vend-proofing-data/storage/set.page.table "vend-proofing-data/storage/$suid/image.table"
echo "PASS flat-file gallery records are ignored"
kill "$server_pid"
wait "$server_pid" 2>/dev/null || true
php -d display_errors=1 -d error_reporting=24575 -d disable_functions=checkdnsrr,mail,curl_init,fsockopen -S 127.0.0.1:8080 -t /app/dist /app/scripts/dev-router.php >/tmp/vend-basic-restart.log 2>&1 &
server_pid=$!
sleep 1
curl -fsS "http://127.0.0.1:8080/?/set/$suid/basic-gallery/" | grep -q "data-suid=\"$suid\""
echo "PASS persistence after restart"
updated=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_update" --data-urlencode "name=page" --data-urlencode "suid=$suid" --data-urlencode "data=Renamed Gallery	null	null" --data-urlencode "token=$token" "$gateway")
case "$updated" in s=true*) ;; *) echo "FAIL update set: $updated"; exit 1 ;; esac
updated=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=image_update" --data-urlencode "name=page" --data-urlencode "suid=$suid" --data-urlencode "data=$filename	null	null	null	null	New caption" --data-urlencode "token=$token" "$gateway")
case "$updated" in s=true*) ;; *) echo "FAIL update image: $updated"; exit 1 ;; esac
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); if($db->query("SELECT title FROM pages LIMIT 1")->fetchColumn()!=="Renamed Gallery" || $db->query("SELECT caption FROM gallery_images LIMIT 1")->fetchColumn()!=="New caption") exit(1);'\''
deleted=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=image_delete" --data-urlencode "name=page" --data-urlencode "suid=$suid" --data-urlencode "files=$filename" --data-urlencode "token=$token" "$gateway")
case "$deleted" in s=true*) ;; *) echo "FAIL delete image: $deleted"; exit 1 ;; esac
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); if($db->query("SELECT COUNT(*) FROM gallery_images")->fetchColumn()!=0 || $db->query("SELECT image_count FROM pages")->fetchColumn()!=0) exit(1);'\''
test ! -e "vend-proofing-data/storage/$suid/$filename"
test ! -e "vend-proofing-data/storage/$suid/$filename.snapshot.jpg"
echo "PASS edit and delete set image records"
php -r '\''define("SA_DIR_AUTH", "vend-proofing-data/auth"); require "vend-proofing-core/php/classes/simpleadmin/Database.php"; require "vend-proofing-core/php/classes/simpleadmin/Records.php"; Records::addMedia("track", $argv[1], array("gallery-track.mp3", "Gallery track", "x", "10", "100", ""));'\'' "$suid"
deleted=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_delete" --data-urlencode "name=page" --data-urlencode "suid=$suid" --data-urlencode "token=$token" "$gateway")
case "$deleted" in s=true*) ;; *) echo "FAIL delete set: $deleted"; exit 1 ;; esac
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); if($db->query("SELECT COUNT(*) FROM pages")->fetchColumn()!=0 || $db->query("SELECT COUNT(*) FROM media_entries")->fetchColumn()!=0 || $db->query("SELECT COUNT(*) FROM media_assets")->fetchColumn()!=0) exit(1);'\''
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); $query=$db->prepare("SELECT COUNT(*) FROM configuration_documents WHERE scope_id = ?"); $query->execute(array($argv[1])); if($query->fetchColumn()!=0) exit(1);'\'' "$suid"
echo "PASS delete relational set"
created=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_create" --data-urlencode "name=page" --data-urlencode "data=Remote Gallery	DropboxSet	0" --data-urlencode "token=$token" "$gateway")
case "$created" in s=true*) ;; *) echo "FAIL create Dropbox set: $created"; exit 1 ;; esac
dropbox_suid=$(php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); echo $db->query("SELECT suid FROM pages LIMIT 1")->fetchColumn();'\'')
test -n "$dropbox_suid"
test ! -e "vend-proofing-data/storage/$dropbox_suid/image.table"
test ! -e "vend-proofing-data/storage/$dropbox_suid/set.category.table"
php ../scripts/dropbox-records-test.php "$dropbox_suid"
dropbox_images=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=image_list" --data-urlencode "name=page" --data-urlencode "suid=$dropbox_suid" --data-urlencode "token=$token" "$gateway")
case "$dropbox_images" in *ceremony-a.jpg*) ;; *) echo "FAIL Dropbox relational image list: $dropbox_images"; exit 1 ;; esac
dropbox_meta=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=dropboxset_meta" --data-urlencode "suid=$dropbox_suid" --data-urlencode "token=$token" "$gateway")
case "$dropbox_meta" in *image_count%3D1*category_count%3D1*) ;; *) echo "FAIL Dropbox metadata: $dropbox_meta"; exit 1 ;; esac
mkdir -p "vend-proofing-data/storage/$dropbox_suid"
cp /tmp/basic-set.jpg "vend-proofing-data/storage/$dropbox_suid/ceremony-a.jpg"
curl -fsS "http://127.0.0.1:8080/?/set/$dropbox_suid/remote-gallery/" | grep -Fq "ceremony-a.jpg"
curl -fsS --get --data-urlencode "q=$dropbox_suid:ceremony-a.jpg:120:90:1:jpg" -o /tmp/dropbox-resized.jpg http://127.0.0.1:8080/vend-proofing-resample.php
php -r '\''$size=getimagesize("/tmp/dropbox-resized.jpg"); if($size[0]!==120 || $size[1]!==90) exit(1);'\''
test ! -e "vend-proofing-data/storage/$dropbox_suid/image.table"
test ! -e "vend-proofing-data/storage/$dropbox_suid/set.category.table"
deleted=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_delete" --data-urlencode "name=page" --data-urlencode "suid=$dropbox_suid" --data-urlencode "token=$token" "$gateway")
case "$deleted" in s=true*) ;; *) echo "FAIL delete Dropbox set: $deleted"; exit 1 ;; esac
echo "PASS relational Dropbox image and category records without remote sync"
for group in formatset paperset modifierset packageset productset; do
  created=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_create" --data-urlencode "name=$group" --data-urlencode "data=Test $group" --data-urlencode "token=$token" "$gateway")
  case "$created" in s=true*) ;; *) echo "FAIL create $group: $created"; exit 1 ;; esac
  test ! -e "vend-proofing-data/storage/set.$group.table"
done
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); if($db->query("SELECT COUNT(*) FROM pricing_groups")->fetchColumn()!=5) exit(1);'\''
groups=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_list" --data-urlencode "name=formatset" --data-urlencode "token=$token" "$gateway")
case "$groups" in *"Test%20formatset"*) ;; *) echo "FAIL relational pricing group list: $groups"; exit 1 ;; esac
echo "PASS create and list five relational pricing group types without index files"
php ../scripts/pricing-records-test.php
package_group=$(php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); echo $db->query("SELECT suid FROM pricing_groups WHERE kind = \"package\"")->fetchColumn();'\'')
product_group=$(php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); echo $db->query("SELECT suid FROM pricing_groups WHERE kind = \"product\"")->fetchColumn();'\'')
packages=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_list" --data-urlencode "name=package" --data-urlencode "puid=$package_group" --data-urlencode "token=$token" "$gateway")
case "$packages" in *Test%20package*) ;; *) echo "FAIL package Gateway list: $packages"; exit 1 ;; esac
echo "PASS relational package, product, and line-item rows with formulas and media references"
for item in format paper modifier; do
  group_suid=$(php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); $query=$db->prepare("SELECT suid FROM pricing_groups WHERE kind = ?"); $query->execute(array($argv[1])); echo $query->fetchColumn();'\'' "$item")
  test -n "$group_suid"
  case "$item" in
    format) fields="Eight by Ten	8	10	2.5 * width + 1	width * height / 100" ;;
    paper) fields="Matte	base_price * 0.15	2 + quantity" ;;
    modifier) fields="Retouch	12.50 + quantity	0" ;;
  esac
  created=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_create" --data-urlencode "name=$item" --data-urlencode "puid=$group_suid" --data-urlencode "data=$fields" --data-urlencode "token=$token" "$gateway")
  case "$created" in s=true*) ;; *) echo "FAIL create $item: $created"; exit 1 ;; esac
  test ! -e "vend-proofing-data/storage/$group_suid/set.$item.table"
done
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); foreach(array("formats","papers","modifiers") as $table) { if($db->query("SELECT COUNT(*) FROM " . $table)->fetchColumn()!=1) exit(1); } if($db->query("SELECT price_expression FROM formats")->fetchColumn()!=="2.5 * width + 1") exit(1);'\''
format_group=$(php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); $query=$db->prepare("SELECT suid FROM pricing_groups WHERE kind = ?"); $query->execute(array("format")); echo $query->fetchColumn();'\'')
paper_group=$(php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); $query=$db->prepare("SELECT suid FROM pricing_groups WHERE kind = ?"); $query->execute(array("paper")); echo $query->fetchColumn();'\'')
modifier_group=$(php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); $query=$db->prepare("SELECT suid FROM pricing_groups WHERE kind = ?"); $query->execute(array("modifier")); echo $query->fetchColumn();'\'')
format_suid=$(php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); echo $db->query("SELECT suid FROM formats")->fetchColumn();'\'')
updated=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_update" --data-urlencode "name=format" --data-urlencode "puid=$format_group" --data-urlencode "suid=$format_suid" --data-urlencode "data=Updated Format	null	null	price * 1.2	null" --data-urlencode "token=$token" "$gateway")
case "$updated" in s=true*) ;; *) echo "FAIL update format: $updated"; exit 1 ;; esac
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); $row=$db->query("SELECT name,width,height,price_expression,shipping_expression FROM formats")->fetch(PDO::FETCH_ASSOC); if($row["name"]!=="Updated Format" || $row["width"]!=8 || $row["height"]!=10 || $row["price_expression"]!=="price * 1.2" || $row["shipping_expression"]!=="width * height / 100") exit(1);'\''
mkdir -p "vend-proofing-data/storage/$format_group"
printf "decoy\tLegacy Format\t1\t1\t0\t0\n" > "vend-proofing-data/storage/$format_group/set.format.table"
listed=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_list" --data-urlencode "name=format" --data-urlencode "puid=$format_group" --data-urlencode "token=$token" "$gateway")
case "$listed" in *Updated%20Format*) ;; *) echo "FAIL format list: $listed"; exit 1 ;; esac
case "$listed" in *Legacy*) echo "FAIL legacy format was read"; exit 1 ;; esac
rm -f "vend-proofing-data/storage/$format_group/set.format.table"
created=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_create" --data-urlencode "name=format" --data-urlencode "puid=$format_group" --data-urlencode "data=Five by Seven	5	7	7.50	0" --data-urlencode "token=$token" "$gateway")
case "$created" in s=true*) ;; *) echo "FAIL second format: $created"; exit 1 ;; esac
reordered=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_reindex" --data-urlencode "name=format" --data-urlencode "puid=$format_group" --data-urlencode "from=0" --data-urlencode "to=1" --data-urlencode "token=$token" "$gateway")
case "$reordered" in s=true*) ;; *) echo "FAIL reorder formats: $reordered"; exit 1 ;; esac
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); $names=$db->query("SELECT name FROM formats ORDER BY position")->fetchAll(PDO::FETCH_COLUMN); if($names!==array("Five by Seven","Updated Format")) { fwrite(STDERR,"FAIL format order: " . json_encode($names) . PHP_EOL); exit(1); }'\''
pricing_page=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_create" --data-urlencode "name=page" --data-urlencode "data=Pricing Gallery	UploadSet	0" --data-urlencode "token=$token" "$gateway")
case "$pricing_page" in s=true*) ;; *) echo "FAIL pricing page: $pricing_page"; exit 1 ;; esac
pricing_page_suid=$(php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); $query=$db->prepare("SELECT suid FROM pages WHERE title = ?"); $query->execute(array("Pricing Gallery")); echo $query->fetchColumn();'\'')
mkdir -p "vend-proofing-data/storage/$pricing_page_suid"
php -r '\''$data=json_decode(file_get_contents("vend-proofing-core/defaults/uploadset.json"), true); foreach(array("format","paper","modifier","package","product") as $i=>$name) { $data["data"]["settings"]["{$name}_set"]["_value"]=$argv[$i+1]; } file_put_contents("/tmp/pricing-gallery.json", json_encode($data, JSON_UNESCAPED_SLASHES));'\'' "$format_group" "$paper_group" "$modifier_group" "$package_group" "$product_group"
php -r '\''define("SA_DIR_AUTH", "vend-proofing-data/auth"); define("SA_DIR_DEFAULTS", "vend-proofing-core/defaults"); require "vend-proofing-core/php/classes/simpleadmin/Database.php"; require "vend-proofing-core/php/classes/simpleadmin/Configuration.php"; if (!Configuration::save("uploadset", $argv[1], file_get_contents($argv[2]))) exit(1);'\'' "$pricing_page_suid" /tmp/pricing-gallery.json
uploaded=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies -F action=image_upload -F "token=$token" -F name=page -F "suid=$pricing_page_suid" -F "Filedata=@/tmp/basic-set.jpg;filename=pricing.jpg;type=image/jpeg" "$gateway")
case "$uploaded" in s=true*) ;; *) echo "FAIL pricing image: $uploaded"; exit 1 ;; esac
pricing_html=$(curl -fsS "http://127.0.0.1:8080/?/set/$pricing_page_suid/pricing-gallery/")
case "$pricing_html" in *"price: \"price * 1.2\""*) ;; *) echo "FAIL storefront pricing: $(printf "%s" "$pricing_html" | grep -F "addFormat" | head -3)"; exit 1 ;; esac
case "$pricing_html" in *"price: \"base_price * 0.15\""*) ;; *) echo "FAIL storefront paper formula"; exit 1 ;; esac
case "$pricing_html" in *"price: \"12.50 + quantity\""*) ;; *) echo "FAIL storefront modifier formula"; exit 1 ;; esac
case "$pricing_html" in *Test%20package*) ;; *"Test package"*) ;; *) echo "FAIL storefront package"; exit 1 ;; esac
deleted=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_delete" --data-urlencode "name=page" --data-urlencode "suid=$pricing_page_suid" --data-urlencode "token=$token" "$gateway")
case "$deleted" in s=true*) ;; *) echo "FAIL delete pricing page: $deleted"; exit 1 ;; esac
deleted=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_delete" --data-urlencode "name=format" --data-urlencode "puid=$format_group" --data-urlencode "suid=$format_suid" --data-urlencode "token=$token" "$gateway")
case "$deleted" in s=true*) ;; *) echo "FAIL delete format: $deleted"; exit 1 ;; esac
deleted=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_delete" --data-urlencode "name=formatset" --data-urlencode "suid=$format_group" --data-urlencode "token=$token" "$gateway")
case "$deleted" in s=true*) ;; *) echo "FAIL delete format group: $deleted"; exit 1 ;; esac
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); if($db->query("SELECT COUNT(*) FROM formats")->fetchColumn()!=0) exit(1);'\''
echo "PASS relational format, paper, and modifier rows and exact formula expressions"
if grep -Eiq "Fatal error|Parse error|Uncaught|Warning:" /tmp/vend-basic-server.log /tmp/vend-basic-restart.log; then cat /tmp/vend-basic-server.log /tmp/vend-basic-restart.log; exit 1; fi
'

node --check "$fixture_dir/online-invoice-check.js"
