#!/usr/bin/env bash
set -euo pipefail

# Fresh installation: page and image records exist only in SQLite.
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_dir="$(mktemp -d /tmp/vend-basic-set.XXXXXX)"
trap 'rm -rf "$fixture_dir"' EXIT

cp -a "$project_dir/vend-proofing-core" "$fixture_dir/"
cp "$project_dir"/index.php "$project_dir"/vend-proofing-{config,gateway,index,resample}.php "$project_dir/vend-proofing-config.xml" "$fixture_dir/"
mkdir -p "$fixture_dir/vend-proofing-data"/{storage,auth,temp,cache,uploads}
mkdir -p "$fixture_dir/scripts"
cp "$project_dir/scripts/install.php" "$project_dir/scripts/admin-account.php" "$project_dir/scripts/dev-router.php" "$fixture_dir/scripts/"
cp "$project_dir/vend-proofing-core/defaults/contact.xml" "$fixture_dir/vend-proofing-data/storage/contact.xml"
sed -i 's#<your_email href=""></your_email>#<your_email href="owner@example.invalid">Owner</your_email>#' "$fixture_dir/vend-proofing-data/storage/contact.xml"

docker run --rm --network none -v "$fixture_dir":/app -w /app devwithlando/php:8.4-apache-7 sh -lc '
set -eu
php scripts/install.php
printf "%s\n" "SyntheticAdminPassword123!" | php scripts/admin-account.php create testadmin owner@example.invalid
php -r '\''$image=imagecreatetruecolor(640,480); imagefill($image,0,0,imagecolorallocate($image,32,96,160)); imagejpeg($image,"/tmp/basic-set.jpg",85);'\''
php -d display_errors=1 -d error_reporting=24575 -d disable_functions=checkdnsrr,mail,curl_init,fsockopen -S 127.0.0.1:8080 -t /app /app/scripts/dev-router.php >/tmp/vend-basic-server.log 2>&1 &
server_pid=$!
trap "kill \$server_pid 2>/dev/null || true; chmod -R a+rwX /app/vend-proofing-data" EXIT
sleep 1
gateway=http://127.0.0.1:8080/vend-proofing-gateway.php
login=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=login" --data-urlencode "username=testadmin" --data-urlencode "password=SyntheticAdminPassword123!" "$gateway")
case "$login" in *"s=true"*) ;; *) echo "FAIL login"; exit 1 ;; esac
token="${login#*r=}"
created=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_create" --data-urlencode "name=page" --data-urlencode "data=Basic Gallery	UploadSet	0" --data-urlencode "token=$token" "$gateway")
case "$created" in s=true*) ;; *) echo "FAIL create: $created"; exit 1 ;; esac
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); $row=$db->query("SELECT suid, title FROM pages")->fetch(PDO::FETCH_ASSOC); if(!$row || $row["title"]!=="Basic Gallery") exit(1); file_put_contents("/tmp/basic-suid",$row["suid"]);'\''
suid=$(cat /tmp/basic-suid)
test ! -e vend-proofing-data/storage/set.page.table
list=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_list" --data-urlencode "name=page" --data-urlencode "token=$token" "$gateway")
case "$list" in *"Basic%20Gallery"*) ;; *) echo "FAIL page list: $list"; exit 1 ;; esac
echo "PASS create and list a relational upload set"
uploaded=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies -F action=image_upload -F "token=$token" -F name=page -F "suid=$suid" -F "Filedata=@/tmp/basic-set.jpg;filename=basic-set.jpg;type=image/jpeg" "$gateway")
case "$uploaded" in s=true*) ;; *) echo "FAIL upload: $uploaded"; exit 1 ;; esac
test ! -e "vend-proofing-data/storage/$suid/image.table"
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); if($db->query("SELECT COUNT(*) FROM gallery_images")->fetchColumn()!=1 || $db->query("SELECT image_count FROM pages")->fetchColumn()!=1) exit(1);'\''
filename=$(find "vend-proofing-data/storage/$suid" -maxdepth 1 -name "*.jpg" -printf "%f\n" | head -1)
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
php -d display_errors=1 -d error_reporting=24575 -d disable_functions=checkdnsrr,mail,curl_init,fsockopen -S 127.0.0.1:8080 -t /app /app/scripts/dev-router.php >/tmp/vend-basic-restart.log 2>&1 &
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
echo "PASS edit and delete set image records"
deleted=$(curl -fsS -c /tmp/basic-cookies -b /tmp/basic-cookies --data-urlencode "action=set_delete" --data-urlencode "name=page" --data-urlencode "suid=$suid" --data-urlencode "token=$token" "$gateway")
case "$deleted" in s=true*) ;; *) echo "FAIL delete set: $deleted"; exit 1 ;; esac
php -r '\''$db=new PDO("sqlite:vend-proofing-data/auth/vend.sqlite"); if($db->query("SELECT COUNT(*) FROM pages")->fetchColumn()!=0) exit(1);'\''
echo "PASS delete relational set"
if grep -Eiq "Fatal error|Parse error|Uncaught|Warning:" /tmp/vend-basic-server.log /tmp/vend-basic-restart.log; then cat /tmp/vend-basic-server.log /tmp/vend-basic-restart.log; exit 1; fi
'
