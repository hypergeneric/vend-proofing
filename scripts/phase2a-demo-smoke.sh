#!/usr/bin/env bash
set -euo pipefail

# Read-only checks against the sanitized demo copy in the local Lando app.
base_url="${VEND_BASE_URL:-https://vend-proofing.lndo.site}"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

check_page() {
  local name="$1" path="$2" marker="$3" status
  status="$(curl -ksSL --connect-timeout 10 --max-time 60 -o "$work_dir/$name.html" -w '%{http_code}' "$base_url/$path")"
  if [[ "$status" != 200 ]] || ! grep -Fq "$marker" "$work_dir/$name.html"; then
    echo "FAIL $name: HTTP $status or missing $marker" >&2
    exit 1
  fi
  if grep -Eiq 'Fatal error|Warning:|Deprecated:|Parse error' "$work_dir/$name.html"; then
    echo "FAIL $name: PHP diagnostic in response" >&2
    exit 1
  fi
  echo "PASS $name: HTTP $status"
}

check_page storefront '' 'vend-proofing-core/js/'
check_page admin '?/admin/' 'admin'
check_page upload '?/set/775c/' '775c'
check_page zip '?/set/992c/' '992c'
check_page category '?/set/9afe/' '9afe'
grep -Fq 'aspect: ""' "$work_dir/upload.html" || { echo 'FAIL upload: dimensionless product aspect' >&2; exit 1; }
echo 'PASS upload: dimensionless product renders without division by zero'
grep -Fq 'classes.overlay.Package.add("7642"' "$work_dir/upload.html" || { echo 'FAIL upload: assigned package missing' >&2; exit 1; }
grep -Fq '16 x 16 canvas' "$work_dir/upload.html" || { echo 'FAIL upload: package format missing' >&2; exit 1; }
echo 'PASS upload: assigned package and format allocation render'
