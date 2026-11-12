#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
npm run check:css
node scripts/css-assets-test.js
docker run --rm --network none -v "$project_dir":/app:ro -w /app \
  devwithlando/php:8.4-apache-7 php scripts/css-theme-test.php
