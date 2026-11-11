#!/usr/bin/env bash
set -euo pipefail

# Exercise multipart folder uploads and resampling against disposable synthetic data.
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_dir="$(mktemp -d /tmp/vend-upload84.XXXXXX)"
trap 'rm -rf "$fixture_dir"' EXIT

cp -a "$project_dir/vend-proofing-core" "$fixture_dir/"
cp "$project_dir"/index.php "$project_dir"/vend-proofing-{config,gateway,index,resample}.php "$project_dir/vend-proofing-config.xml" "$fixture_dir/"
mkdir -p "$fixture_dir/vend-proofing-data"/{storage,auth,temp,cache,uploads}
printf '875c\tUpload Test\tCategorySet\t0\n' > "$fixture_dir/vend-proofing-data/storage/set.page.table"
mkdir -p "$fixture_dir/vend-proofing-data/storage/875c"
cp "$project_dir/vend-proofing-core/defaults/categoryset.xml" "$fixture_dir/vend-proofing-data/storage/875c/categoryset.xml"
mkdir -p "$fixture_dir/scripts"
cp "$project_dir/scripts/install.php" "$fixture_dir/scripts/install.php"
cp "$project_dir/scripts/admin-account.php" "$fixture_dir/scripts/admin-account.php"

docker run --rm --network none -v "$fixture_dir":/app -w /app devwithlando/php:8.4-apache-7 sh -lc '
set -eu
php scripts/install.php
printf "%s\n" "SyntheticAdminPassword123!" | php scripts/admin-account.php create testadmin owner@example.invalid
php -r '\''$image=imagecreatetruecolor(1200,800); imagefill($image,0,0,imagecolorallocate($image,32,96,160)); imagejpeg($image,"/tmp/upload-test.jpg",85);'\''
php -d display_errors=1 -d error_reporting=24575 -d disable_functions=checkdnsrr,mail,curl_init,fsockopen -S 127.0.0.1:8080 -t /app >/tmp/vend-upload-server.log 2>&1 &
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
php -r '\''$rows=file("vend-proofing-data/storage/875c/image.table", FILE_IGNORE_NEW_LINES); $categories=file("vend-proofing-data/storage/875c/set.category.table", FILE_IGNORE_NEW_LINES); $page=file("vend-proofing-data/storage/set.page.table", FILE_IGNORE_NEW_LINES); if(count($rows)!==2||count($categories)!==2||!str_ends_with($page[0],"\t2")) exit(1); echo "PASS two image rows, two folder categories, page count 2\n";'\''
filename=$(cut -f1 vend-proofing-data/storage/875c/image.table | head -1)
curl -fsS --get --data-urlencode "q=875c:$filename:300:200:1,50,50:jpg:90,1,0:1:0::50:50:50:0:ffffff:100" -o /tmp/upload-resized.jpg http://127.0.0.1:8080/vend-proofing-resample.php
php -r '\''$size=getimagesize("/tmp/upload-resized.jpg"); if($size[0]!==300||$size[1]!==200) exit(1); echo "PASS uploaded image resizes to 300x200\n";'\''
printf "private record" > vend-proofing-data/storage/875c/unlisted.jpg
[ "$(curl -s -o /dev/null -w "%{http_code}" --get --data-urlencode "q=875c:unlisted.jpg:300:200:1:jpg" http://127.0.0.1:8080/vend-proofing-resample.php)" = 404 ]
[ "$(curl -s -o /dev/null -w "%{http_code}" --get --data-urlencode "q=../auth:vend.sqlite:300:200:1:jpg" http://127.0.0.1:8080/vend-proofing-resample.php)" = 404 ]
echo "PASS unlisted and traversal image sources rejected"
if grep -Eiq "Fatal error|Parse error|Uncaught|Warning:" /tmp/vend-upload-server.log; then cat /tmp/vend-upload-server.log; exit 1; fi
'
