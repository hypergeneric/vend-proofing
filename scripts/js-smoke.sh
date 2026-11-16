#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
npm run check:js
node scripts/js-assets-test.js
node scripts/language-test.js
docker run --rm --network none -v "$project_dir":/app:ro -w /app \
  devwithlando/php:8.4-apache-7 php scripts/js-config-test.php

docker run --rm --network none -v "$project_dir":/app:ro -w /app \
  devwithlando/php:8.4-apache-7 php scripts/language-test.php

node scripts/payment-ui-test.js
