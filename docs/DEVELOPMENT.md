# Developing Vend

Vend is a PHP application with a customer storefront and a separate JavaScript administration interface. Preserve its established UI and behavior while modernizing the runtime and security boundaries. The [audit](VEND-PRODUCT-DISCOVERY-AND-TECHNICAL-AUDIT.md) maps the architecture; the [modernization log](VEND-MODERNIZATION.md) records current phase decisions and results.

## Local runtime

The main Lando app is configured in `.lando.yml`. Run `lando start`, then use the HTTPS URLs reported by `lando info`. Application data lives under `vend-proofing-data/`; keep existing data and credentials out of commits. The Lando `lamp` recipe includes a database service, but Vend's current application records remain flat files.

Lando loads `.lando/php.ini` for development diagnostics. PHP errors go to the ignored `vend-proofing-data/storage/php-debug.log`; they are not printed in HTTP responses. Follow the file locally with `tail -f vend-proofing-data/storage/php-debug.log`. The storage `.htaccess` blocks HTTP access to the log. A new or cleared local installation needs a writable `vend-proofing-data/storage/` directory before PHP can create the log.

For an isolated PHP 8.4 smoke check, run `bash scripts/phase1-smoke.sh`. It creates synthetic records under `/tmp`, runs the cached PHP 8.4 container without network access, and removes the fixture afterward. For a disposable interactive site, run `bash scripts/phase1-dev.sh` and open `http://127.0.0.1:8048/`; it disables PHP mail and network client functions. Neither script uses the live data directory.

For Phase 2A, `scripts/phase2a-stage-demo.py SOURCE_DATA NEW_FIXTURE_DIRECTORY` makes a sanitized local copy of the historical demo. It refuses to overwrite an existing fixture. It excludes customer orders and sessions, removes service credentials, and disables mail, payment, and cron settings. Media and public gallery metadata are copied unchanged; keep both the source and fixture private. The local Lando `vend-proofing-data/storage/` and `uploads/` currently hold this staged copy. Run `bash scripts/phase2a-demo-smoke.sh` to check representative storefront, admin, upload-gallery, ZIP-gallery, and category-gallery pages. The script makes only local read requests and does not test interactive flows or external services.

The current local Lando demo data is disposable test data. Use it directly for Phase 2A interaction tests and reset or replace it when useful. Historical deployment compatibility is not a requirement; preserve current behavior and identifiers where they help the product, not to accommodate old PHP installations.

Run `bash scripts/phase2a-upload-smoke.sh` for a disposable PHP 8.4 test of multipart uploads, folder categories, flat-file records, and image resizing. It uses synthetic JPEG media and Docker with no external network access; it does not alter the Lando demo data.

## Development rules

- Keep changes small and test the contract of the affected subsystem.
- Preserve gallery SUIDs, public URL structure, row formats, visual design, and low-friction email proofing unless a specific defect requires change.
- Do not treat order totals, payment status, or delivery eligibility supplied by a browser as authoritative.
- Do not run mail, payment, Dropbox, or destructive migration operations against live data during tests.
- Update [VEND-MODERNIZATION.md](VEND-MODERNIZATION.md) with decisions, tests, limitations, and the next step when a phase changes.
- Keep user-facing instructions in the [manual](MANUAL.md); agent workflow belongs in [AGENTS.md](../AGENTS.md).

## Current sequence

Phase 1 established a PHP 8.4 smoke runtime and focused first-party fixes. Phase 2A established a representative real-world baseline using demo data. Phase 2B is administrative authentication and access control. SQLite migration is reserved for Phase 3 after a tested persistence call graph and behavioral baseline exist. The modernization log is the source of truth for progress within each phase.
