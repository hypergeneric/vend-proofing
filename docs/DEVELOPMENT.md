# Developing Vend

Vend is a PHP application with a customer storefront and a separate JavaScript administration interface. Preserve its established UI and behavior while modernizing the runtime and security boundaries. The [audit](VEND-PRODUCT-DISCOVERY-AND-TECHNICAL-AUDIT.md) maps the architecture; the [storage strategy](VEND-STORAGE-STRATEGY.md) records the superseded document-store proposal; the [modernization log](VEND-MODERNIZATION.md) records current phase decisions and results.

## Local runtime

The main Lando app is configured in `.lando.yml`. Run `lando start`, then use the HTTPS URLs reported by `lando info`. Application data lives under `vend-proofing-data/`; keep existing data and credentials out of commits. The Lando `lamp` recipe includes a database service, but Vend uses its own SQLite database for administrators, PHP sessions, galleries, media metadata, pricing, discounts, customer proofing, carts, orders, payments, fulfillment records, contacts, and message logs. The Lando MySQL service is incidental. `Records` owns ordinary relational lists; `Proofing` owns customer selections; `OrderRecords` owns purchase snapshots. The main `Gateway` switch handles set-list, image, and media actions. Physical media files remain on disk.

`MediaFiles` handles physical uploads, sideloads, snapshots, and file deletion. `Gateway` routes the admin request and `Records` owns its SQLite metadata. `Flatfile` is now limited to saved XML access. Lando loads `.lando/php.ini` for development diagnostics. PHP errors go to the ignored `vend-proofing-data/storage/php-debug.log`; they are not printed in HTTP responses. Follow the file locally with `tail -f vend-proofing-data/storage/php-debug.log`. The storage `.htaccess` blocks HTTP access to the log. A new or cleared local installation needs a writable `vend-proofing-data/storage/` directory before PHP can create the log.

For an isolated PHP 8.4 smoke check, run `bash scripts/phase1-smoke.sh`. It creates synthetic records and a synthetic admin account under `/tmp`, runs the cached PHP 8.4 container without network access, and removes the fixture afterward. It tests login, session, Gateway access, CLI reset, and logout as well as the older storefront checks. Run `bash scripts/basic-set-smoke.sh` for a fresh-install upload-set test with no flat-file page/image records; it also checks relational proofing, cart, offline checkout, invoice, pricing, and Dropbox image metadata. For a disposable interactive site, run `bash scripts/phase1-dev.sh` and open `http://127.0.0.1:8048/`; it starts with an empty page catalog, disables PHP mail and network client functions, and prints its synthetic admin login. Create an Upload Set and upload a JPEG in admin to test the SQLite path. The PHP development server uses `scripts/dev-router.php` to keep private data inaccessible. Neither script uses the live data directory.

### Administrator account

For a fresh installation, run `lando php scripts/install.php`, then create the first administrator with `lando php scripts/admin-account.php create USERNAME EMAIL`. Apply later schema migrations with `lando php scripts/migrate.php`. Reset a forgotten password with `lando php scripts/admin-account.php reset USERNAME`. Both account commands prompt for a password of at least 12 characters; terminal echo is disabled when possible. The unified database lives at `vend-proofing-data/auth/vend.sqlite` and holds the account, administrator sessions, and PHP order-session state. Back up the database with application data. The web server must deny HTTP requests into `auth/`; the current Lando Apache setup does this through `vend-proofing-data/.htaccess`. The former `admin.sqlite` and PHP session files are not read by the new runtime.

This step supports one full administrator. The customer email proofing session is separate. The admin SPA still posts to the Gateway with a `token` field, now a session-bound request token. Keep it on new admin actions, including uploads and auxiliary forms. Do not add a browser-accessible setup path or send passwords by email.

The retired `get_xml`, `get_files`, and `get_set` Gateway actions have no application callers. Admin XML controls use `setup_load` and `setup_defaults`; admin tables use the typed `set_list` and media `*_list` actions. The storefront reads its tax rules directly while rendering the gallery.

Limited-use discounts are claimed by `prequalify_order` before payment. A retry with the same order ID and quote keeps the claim; abandoned checkouts keep it counted. A completed order converts the claim to a redemption. The photographer can extend the code limit in admin when needed. See the [modernization log](VEND-MODERNIZATION.md) for the payment qualification still open.

Checkout Gateway failures send stable keys such as `discount_expired` and `invalid_order`. Storefront copy for these keys belongs in `defaults/language.xml` and is read through `L10N`; PHP exception prose must not become customer-facing text.

For Phase 2A, `scripts/phase2a-stage-demo.py SOURCE_DATA NEW_FIXTURE_DIRECTORY` made a sanitized local copy of the historical demo. It refuses to overwrite an existing fixture. It excludes customer orders and sessions, removes service credentials, and disables mail, payment, and cron settings. Media and public gallery metadata were copied unchanged; keep both the source and fixture private. The local Lando `vend-proofing-data/storage/` and `uploads/` currently hold this staged copy. `scripts/phase2a-demo-smoke.sh` captured the pre-cutover storefront, admin, upload-gallery, ZIP-gallery, and category-gallery baseline. Its gallery checks are historical reference checks; ZIP galleries are retired in the new release.

The current local Lando demo data is disposable reference data. Its old page table is no longer read by the relational catalog, so the current set list is empty until new sets are created. Use the isolated fresh-install smoke or development site for the new catalog acceptance test. Historical deployment compatibility is not a requirement; preserve current behavior and identifiers where they help the product, not to accommodate old PHP installations.

Run `bash scripts/phase2a-upload-smoke.sh` for a disposable PHP 8.4 test of category-set multipart uploads, folder categories, relational records, storefront rendering, restart persistence, and image resizing. It verifies that category and image table files are absent and ignored if planted. It uses synthetic JPEG media and Docker with no external network access; it does not alter the Lando data.

## Development rules

- Keep changes small and test the contract of the affected subsystem.
- Edit `vend-proofing-core/js/vend/` source files, then visit `https://vend-proofing.lndo.site/?/js/vend/` in the local Lando app to regenerate `vend.js` and `vend-core.js` through `tmpl/js/1.page.vend.tmpl`. Do not hand-edit the generated bundles. The route rewrites both bundles on each visit; deleting them first is optional.
- Match the tab-indented PHP style in touched files. Use named intermediate values and readable method bodies for new persistence code; keep SQL and multi-step writes easy to follow.
- Preserve gallery SUIDs, public URL structure, row formats, visual design, and low-friction email proofing unless a specific defect requires change.
- Do not treat order totals, payment status, or delivery eligibility supplied by a browser as authoritative.
- Do not run mail, payment, Dropbox, or destructive migration operations against live data during tests.
- Update [VEND-MODERNIZATION.md](VEND-MODERNIZATION.md) with decisions, tests, limitations, and the next step when a phase changes.
- Keep user-facing instructions in the [manual](MANUAL.md); agent workflow belongs in [AGENTS.md](../AGENTS.md).

## Current sequence

Phase 1 established a PHP 8.4 smoke runtime and focused first-party fixes. Phase 2A established a representative real-world baseline using demo data. Phase 2B introduced single-admin authentication and a first public Gateway/media access boundary; the remaining direct routes and commerce actions still need review. The persistence foundation installs one SQLite schema. All application table records now use it, including customer proofing selections and orders; ZIP galleries are retired. Existing media files and disposable derivatives remain on disk, and saved configuration still uses XML. Payment providers and server-side pricing validation require their own qualification before release. The modernization log is the source of truth for progress within each phase.
