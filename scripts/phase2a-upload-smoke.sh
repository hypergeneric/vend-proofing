#!/usr/bin/env bash
set -euo pipefail

# Exercise multipart folder uploads and resampling against disposable synthetic data.
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_dir="$(mktemp -d /tmp/vend-upload84.XXXXXX)"
trap 'rm -rf "$fixture_dir"' EXIT

cp -a "$project_dir/vend-proofing-core" "$fixture_dir/"
cp "$project_dir"/index.php "$project_dir"/vend-proofing-{config,gateway,index,resample}.php "$project_dir/vend-proofing-config.xml" "$fixture_dir/"
mkdir -p "$fixture_dir/vend-proofing-data"/{storage,auth,temp,cache,uploads}
mkdir -p "$fixture_dir/vend-proofing-data/storage/875c"
cp "$project_dir/vend-proofing-core/defaults/categoryset.xml" "$fixture_dir/vend-proofing-data/storage/875c/categoryset.xml"
cp "$project_dir/vend-proofing-core/defaults/contact.xml" "$fixture_dir/vend-proofing-data/storage/contact.xml"
sed -i 's#<your_email href=""></your_email>#<your_email href="owner@example.invalid">Owner</your_email>#' "$fixture_dir/vend-proofing-data/storage/contact.xml"
mkdir -p "$fixture_dir/scripts"
cp "$project_dir/scripts/install.php" "$fixture_dir/scripts/install.php"
cp "$project_dir/scripts/admin-account.php" "$fixture_dir/scripts/admin-account.php"
cp "$project_dir/scripts/dev-router.php" "$fixture_dir/scripts/dev-router.php"

docker run --rm --network none -v "$fixture_dir":/app -w /app devwithlando/php:8.4-apache-7 sh -lc '
set -eu
php scripts/install.php
php -r '\''define("SA_DIR_AUTH", "/app/vend-proofing-data/auth"); require "vend-proofing-core/php/classes/simpleadmin/Database.php"; require "vend-proofing-core/php/classes/simpleadmin/Records.php"; Records::savePage("875c", ["Upload Test", "CategorySet", 0]);'\''
printf "%s\n" "SyntheticAdminPassword123!" | php scripts/admin-account.php create testadmin owner@example.invalid
php -r '\''$image=imagecreatetruecolor(1200,800); imagefill($image,0,0,imagecolorallocate($image,32,96,160)); imagejpeg($image,"/tmp/upload-test.jpg",85);'\''
php -d display_errors=1 -d error_reporting=24575 -d disable_functions=checkdnsrr,mail,curl_init,fsockopen -S 127.0.0.1:8080 -t /app /app/scripts/dev-router.php >/tmp/vend-upload-server.log 2>&1 &
server_pid=$!
trap "kill $server_pid" EXIT
sleep 1
login_result=$(curl -fsS -c /tmp/vend-upload-cookies -b /tmp/vend-upload-cookies --data-urlencode "action=login" --data-urlencode "username=testadmin" --data-urlencode "password=SyntheticAdminPassword123!" http://127.0.0.1:8080/vend-proofing-gateway.php)
case "$login_result" in *"s=true"*) ;; *) echo "FAIL upload login"; exit 1 ;; esac
csrf="${login_result#*r=}"
for category in Outside Inside; do
  response=$(curl -fsS -c /tmp/vend-upload-cookies -b /tmp/vend-upload-cookies -F action=image_upload -F "token=$csrf" -F name=page -F suid=875c -F "path=Batch/$category/photo.jpg" -F "Filedata=@/tmp/upload-test.jpg;filename=$category.jpg;type=image/jpeg" http://127.0.0.1:8080/vend-proofing-gateway.php)
  case "$response" in s=true*) echo "PASS upload $category" ;; *) echo "FAIL upload $category: $response"; exit 1 ;; esac
done
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); if($db->query("SELECT COUNT(*) FROM gallery_images")->fetchColumn()!=2||$db->query("SELECT COUNT(*) FROM gallery_categories")->fetchColumn()!=2||$db->query("SELECT image_count FROM pages LIMIT 1")->fetchColumn()!=2||file_exists("vend-proofing-data/storage/875c/image.table")||file_exists("vend-proofing-data/storage/875c/set.category.table")) exit(1); echo "PASS two relational images and categories, no record files\n";'\''
filename=$(php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); echo $db->query("SELECT public_key FROM media_assets ORDER BY id LIMIT 1")->fetchColumn();'\'')
categories=$(curl -fsS -c /tmp/vend-upload-cookies -b /tmp/vend-upload-cookies --data-urlencode action=set_list --data-urlencode name=category --data-urlencode puid=875c --data-urlencode "token=$csrf" http://127.0.0.1:8080/vend-proofing-gateway.php)
images=$(curl -fsS -c /tmp/vend-upload-cookies -b /tmp/vend-upload-cookies --data-urlencode action=image_list --data-urlencode name=page --data-urlencode suid=875c --data-urlencode "token=$csrf" http://127.0.0.1:8080/vend-proofing-gateway.php)
outside_hash=$(php -r '\''echo md5("Outside");'\'')
case "$categories$images" in *"$outside_hash"*) echo "PASS Gateway category and image rows" ;; *) echo "FAIL Gateway category/image rows"; exit 1 ;; esac
curl -fsS "http://127.0.0.1:8080/?/set/875c/upload-test/" -o /tmp/vend-category-storefront.html
if ! grep -q "data-suid=\"875c\"" /tmp/vend-category-storefront.html; then
  head -c 800 /tmp/vend-category-storefront.html
  cat /tmp/vend-upload-server.log
  echo "FAIL category storefront rendering"
  exit 1
fi
echo "PASS category storefront rendering"
printf "decoy.jpg\tOld image\t1x1\t\t0\t\t%s\n" "$outside_hash" > vend-proofing-data/storage/875c/image.table
printf "deadbeef\tOld category\n" > vend-proofing-data/storage/875c/set.category.table
images=$(curl -fsS -c /tmp/vend-upload-cookies -b /tmp/vend-upload-cookies --data-urlencode action=image_list --data-urlencode name=page --data-urlencode suid=875c --data-urlencode "token=$csrf" http://127.0.0.1:8080/vend-proofing-gateway.php)
categories=$(curl -fsS -c /tmp/vend-upload-cookies -b /tmp/vend-upload-cookies --data-urlencode action=set_list --data-urlencode name=category --data-urlencode puid=875c --data-urlencode "token=$csrf" http://127.0.0.1:8080/vend-proofing-gateway.php)
case "$images$categories" in *decoy*|*deadbeef*) echo "FAIL old category records were read"; exit 1 ;; esac
rm -f vend-proofing-data/storage/875c/image.table vend-proofing-data/storage/875c/set.category.table
kill "$server_pid"
wait "$server_pid" 2>/dev/null || true
php -d display_errors=1 -d error_reporting=24575 -d disable_functions=checkdnsrr,mail,curl_init,fsockopen -S 127.0.0.1:8080 -t /app /app/scripts/dev-router.php >/tmp/vend-upload-restart.log 2>&1 &
server_pid=$!
trap "kill $server_pid" EXIT
sleep 1
curl -fsS "http://127.0.0.1:8080/?/set/875c/upload-test/" -o /tmp/vend-category-storefront.html
grep -q "data-suid=\"875c\"" /tmp/vend-category-storefront.html
echo "PASS database authoritative after restart"
curl -fsS --get --data-urlencode "q=875c:$filename:300:200:1,50,50:jpg:90,1,0:1:0::50:50:50:0:ffffff:100" -o /tmp/upload-resized.jpg http://127.0.0.1:8080/vend-proofing-resample.php
php -r '\''$size=getimagesize("/tmp/upload-resized.jpg"); if($size[0]!==300||$size[1]!==200) exit(1); echo "PASS uploaded image resizes to 300x200\n";'\''
printf "private record" > vend-proofing-data/storage/875c/unlisted.jpg
[ "$(curl -s -o /dev/null -w "%{http_code}" --get --data-urlencode "q=875c:unlisted.jpg:300:200:1:jpg" http://127.0.0.1:8080/vend-proofing-resample.php)" = 404 ]
[ "$(curl -s -o /dev/null -w "%{http_code}" --get --data-urlencode "q=../auth:vend.sqlite:300:200:1:jpg" http://127.0.0.1:8080/vend-proofing-resample.php)" = 404 ]
echo "PASS unlisted and traversal image sources rejected"
reordered=$(curl -fsS -c /tmp/vend-upload-cookies -b /tmp/vend-upload-cookies --data-urlencode action=set_reindex --data-urlencode name=category --data-urlencode puid=875c --data-urlencode from=0 --data-urlencode to=1 --data-urlencode "token=$csrf" http://127.0.0.1:8080/vend-proofing-gateway.php)
case "$reordered" in s=true*) ;; *) echo "FAIL category reorder: $reordered"; exit 1 ;; esac
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); if($db->query("SELECT name FROM gallery_categories ORDER BY position LIMIT 1")->fetchColumn()!=="Inside") exit(1);'\''
deleted=$(curl -fsS -c /tmp/vend-upload-cookies -b /tmp/vend-upload-cookies --data-urlencode action=image_delete --data-urlencode name=page --data-urlencode suid=875c --data-urlencode "files=$filename" --data-urlencode "token=$csrf" http://127.0.0.1:8080/vend-proofing-gateway.php)
case "$deleted" in s=true*) ;; *) echo "FAIL image delete: $deleted"; exit 1 ;; esac
deleted=$(curl -fsS -c /tmp/vend-upload-cookies -b /tmp/vend-upload-cookies --data-urlencode action=set_delete --data-urlencode name=category --data-urlencode puid=875c --data-urlencode "suid=$outside_hash" --data-urlencode "token=$csrf" http://127.0.0.1:8080/vend-proofing-gateway.php)
case "$deleted" in s=true*) ;; *) echo "FAIL category delete: $deleted"; exit 1 ;; esac
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); if($db->query("SELECT COUNT(*) FROM gallery_images")->fetchColumn()!=1||$db->query("SELECT COUNT(*) FROM gallery_categories")->fetchColumn()!=1||$db->query("SELECT image_count FROM pages LIMIT 1")->fetchColumn()!=1) exit(1);'\''
echo "PASS reorder and delete category records"
if grep -Eiq "Fatal error|Parse error|Uncaught|Warning:" /tmp/vend-upload-server.log /tmp/vend-upload-restart.log; then cat /tmp/vend-upload-server.log /tmp/vend-upload-restart.log; exit 1; fi
'
