# Vend modernization log

## ZIP gallery retirement (implemented)

**Decision:** The photographer can drag a folder into CategorySet, so the FTP-delivered ZIP gallery no longer justifies a separate ingestion, index, and image-serving pipeline in the new release. The user created the `legacy-checkpoint/pre-zip-removal` branch to preserve the old implementation. This is a product retirement, not a data migration.

- Removed ZipFile from the set type chooser and relational page type allowlist, removed its admin panel and XML default, and removed its verification and metadata Gateway actions. General gallery-type validation remains; no ZIP-specific request compatibility branches were added.
- Removed ZIP gallery reads from storefront and order templates, ZIP entry resampling and access checks from `Graphic`, and the ZIP-specific storefront image URL branches. Retained PclZip for separate font and application archive operations.
- Migration `005_remove_zip_gallery.sql` drops the unused `gallery_archives` and `archive_entries` tables. Existing migration files remain immutable. No ZIP gallery data is imported into the new release.

**Tested:** PHP 8.4 foundation, basic upload-set, and category-set smokes passed on disposable installations. Listed JPEG resampling and both supported gallery storefronts still work. The local Lando archive tables were empty before migration `005` was applied; the migration completed without changing the existing set records.

**Left open:** The historical audit and staged-demo smoke remain records of the older release. They are not current ZIP gallery acceptance tests. The next persistence slice should be chosen from supported features; Dropbox ingestion and saved XML configuration remain candidates.

## Relational catalog — category set slice (implemented)

**Decision:** CategorySet images and folder categories are authoritative in SQLite. Preserve category hashes, image row column 7, Gateway responses, folder-upload behavior, storefront layout, and media files. No category or image table fallback was added.

- Migration `004_gallery_category_keys.sql` adds a per-gallery public key to `gallery_categories`. The existing `gallery_images.category_id` relationship links each uploaded image to a category. Folder uploads create or reuse the category and image record in one database transaction; uploads without a folder remain ungrouped.
- `Catalog` now lists, saves, reorders, and deletes categories and projects CategorySet image rows with their category hash. `CatalogGateway` handles category requests and CategorySet image actions. The storefront, proofing image lookup, public resampling authorization, and order image lookup read these relational rows. Physical JPEGs and derivatives remain files.
- The disposable category smoke creates two folders, uploads two JPEGs, checks the Gateway rows and storefront, plants decoy table files to prove they are ignored, restarts PHP, resizes a listed image, rejects unlisted/traversal sources, then reorders and deletes records. It checks that normal uploads created no `image.table` or `set.category.table`. The category smoke, basic upload-set smoke, and foundation/Gateway smoke passed on PHP 8.4. The additive migration was applied to the local Lando database without changing its existing set or images.

**Left open:** CategorySet XML settings and the broader XML-to-JSON interface, Dropbox records, commerce and proofing records, media cleanup after interrupted SQL/file operations, and backup of SQLite with media remain separate phases. ZIP galleries were retired in the subsequent product decision above.

## Development tooling — VS Code template association

- Added project workspace settings mapping `.tmpl` files under `tmpl/` folders to PHP for editor language support.
- Validated the settings as JSON and checked whitespace with `git diff --check`. No application behavior changed; no outstanding work for this tooling change.

## Relational catalog — basic upload set slice (implemented)

**Decision:** Prove the shared display path used by `2.content.uploadset.tmpl`: create an upload set, upload an image, render it, and reload it after a server restart. Page rows and upload-set image metadata are authoritative in SQLite. The physical JPEG and generated resize remain files. No flat-file page or upload-set image fallback was added.

- Added a `pages.image_count` migration and `Catalog.php`, which writes page/gallery and image/asset relationships through transactions and projects the existing tab-delimited Gateway rows for the JavaScript admin. `CatalogGateway.php` owns the admin request routing for `page` and basic `UploadSet` images; `LocalGateway` delegates through one dispatch call. Public page lookup, basic-set rendering, proofing image selection, resampling, and order image lookup read the same relational records. Other set image sources still use their current files until their bounded extensions.
- `scripts/basic-set-smoke.sh` creates a disposable empty installation, logs in, creates an upload set, uploads and resizes a JPEG, renders the storefront, restarts PHP, edits the set and image, then deletes them. It verifies SQL row counts and that no `set.page.table` or upload-set `image.table` is created. It also plants decoy flat-file records temporarily and confirms the admin lists ignore them. Passed on PHP 8.4.22. The foundation and synthetic CategorySet upload smokes passed after their fixtures were updated to put pages in SQLite. `scripts/phase1-dev.sh` now starts with an empty page catalog for interactive QA.
- Applied the additive migration to the disposable local Lando database. Existing staged-demo page rows remain on disk for reference but are no longer read as the page catalog; that site starts with an empty set list until sets are created in admin. No historical data importer was introduced.
- After author feedback, expanded the new catalog classes and their touched call sites into the project's tab-indented, step-by-step PHP style. The request dispatch remains in `CatalogGateway.php`; no catalog behavior changed. The basic-set, foundation, and synthetic CategorySet smoke checks passed again.

**Left open:** ZIP, Dropbox, and CategorySet image lists, categories, set duplication, remote image sideloading, gallery XML settings, proofing records, and commerce are later slices. Admin duplicate-set and upload-set sideload actions currently return clear failures rather than writing invisible flat-file records. Set deletion commits the relational deletion before removing its media directory, so interrupted cleanup can leave orphan files; recovery/cleanup needs a later media lifecycle pass. The historical staged-demo gallery smoke is now a reference baseline, not an acceptance test for the fresh SQL catalog. Next bounded step: move CategorySet image/category records to relational tables while retaining the shared display and Gateway response contracts.

## Phase 2B — Public Gateway and media access boundary (implemented)

**Decision:** Complete a narrow public-access pass before moving page/gallery records to SQLite. Public image and asset requests must refer to listed gallery or global media. This pass keeps the existing Gateway response shapes and storefront URLs; it does not move gallery, proofing, or commerce records.

- Required an authenticated administrator and request token for the previously public `system_phpinfo`, `get_xml`, `get_files`, and `get_set` Gateway actions. The existing admin XML read still works with a valid session token.
- Restricted `get_public_asset` to global asset/audio folders or a listed gallery SUID, a listed asset/track/audio row, a simple filename, and a non-symlink file. `validate_suid` now checks a listed gallery rather than directory existence. Public proofing actions reject malformed gallery and email-hash identifiers before building table paths; the gallery password route rejects malformed or unknown gallery IDs.
- Restricted direct resampling to media listed in gallery/global file tables or a listed ZIP file index. Unlisted files, traversal paths, and symlink sources return 404. A requested watermark must be a listed global asset. Media and generated derivatives remain on disk.
- Passed PHP 8.4 synthetic foundation/Gateway smoke and upload/resample smoke, including negative traversal and unlisted-file checks. The read-only staged-demo storefront smoke passed its eight checks, including a listed gallery asset. A ZIP-gallery resample on the disposable staged demo returned HTTP 200 with a JPEG. `git diff --check` passed.

**Left open:** Public checkout and PayPal callback validation, proofing authorization and transactional writes, admin actions that still accept storage names, and server-specific private-data rules need their own bounded reviews. The historical `?/html/font/`, video, and mview templates still embed filesystem paths and need a direct-route audit before production exposure. The next persistence slice is page/gallery catalog reads and writes through relational repositories, with synthetic fresh-install fixtures and stable Gateway row responses.

## Persistence foundation — relational SQLite (implemented)

**Decision:** Vend's new release uses a fresh, unified relational SQLite database at `vend-proofing-data/auth/vend.sqlite`. No historical data importer, path-keyed document table, or flat-file compatibility layer is planned. The old path-based [storage strategy](VEND-STORAGE-STRATEGY.md) remains background source analysis and is superseded. This foundation slice changes administrator storage and SUID allocation; gallery, XML configuration, customer proofing, and commerce consumers still use their current files until later bounded cutovers. Physical media and generated assets remain files.

- Added `Database.php` with a private PDO connection, foreign keys, busy timeout, WAL, `BEGIN IMMEDIATE` transactions, nested savepoints, versioned SQL migrations, and atomic hexadecimal SUID allocation. The database is created only by the CLI installation command; `scripts/migrate.php` applies later migrations. `Flatfile::createUID()` now delegates to the database sequence; no request writes `suid.index`.
- Added `scripts/install.php` for an empty database. `scripts/admin-account.php` now creates or resets the single administrator in that database. `Auth` uses an opaque `VEND_ADMIN` cookie whose ID is hashed in `admin_sessions`; the existing 12-hour and 14-day lifetimes, HttpOnly/SameSite/Secure cookie behavior, request token, reset invalidation, and login/logout Gateway responses remain. The order/Dropbox PHP session path uses `PhpSessionStore` and `php_sessions` in the same database. PHP session files and `auth/admin.sqlite` are no longer used by the runtime.
- Added a relational schema for pages/galleries, media references, categories, pricing groups, formats, papers, modifiers, packages/products and their components, proofing, favorites, carts, orders, discounts, tax, payments, fulfillment, messages, forms, and JSON settings. These tables are not yet wired into the respective product features. Foreign keys, uniqueness, JSON validity, basic status/quantity checks, and lookup indexes establish the foundation; workflow-specific constraints will be added when each domain is implemented.
- Verified the pricing shape before freezing the schema: storefront `Sidebar.js` evaluates format, paper, and modifier price/shipping expressions with `A` (format area), `Q` (quantity), and `P` (evaluated format price), including math expressions. Package/product line items have independent labels, quantities, and dimensions; zero dimensions are meaningful. Cart allocations select specific images, and purchased selections need immutable evaluated amounts and formula/selection snapshots. The schema stores expressions as text, explicit component rows, image-linked cart allocation rows, and order item snapshots. **Pricing evaluation and server-authoritative checkout are not implemented in this slice.**
- Updated the disposable PHP 8.4 smoke fixture to install the empty database before creating its synthetic administrator. Tests passed for migration replay, foreign keys, committed and nested rolled-back transactions, sequence rollback, 24 concurrent SUID allocations, PHP order-session read/write/expiry/cleanup and order login page, admin login, token rejection, session expiry, remembered login, reset invalidation, logout, cookie attributes, private database HTTP denial, and representative storefront/Gateway output. The existing read-only Lando demo smoke passed all seven checks. The first local Lando smoke attempt could not resolve the Lando hostname inside the network sandbox; the same read-only check passed outside it. The synthetic folder-upload smoke initially rejected its obsolete anonymous token; after using the current admin login, both uploads, category rows, and image resize passed.
- Initialized the **disposable local staged demo** with the new database and copied its existing local test administrator hash into the new table once, without adding migration code or changing historical customer records. This keeps that local admin route usable. New installations start empty and create their own administrator.

**Left open:** Phase 2B Gateway/file-access review and production web-server rules; JSON configuration and admin control conversion; gallery/media/catalog repositories; proofing, checkout, payment, fulfillment, and backup/restore cutovers. Existing browser sessions from the PHP-file session implementation sign out once. Next bounded step: move page/gallery catalog reads and writes to relational repositories in an isolated fresh-install fixture, preserving public SUID URLs and current Gateway row responses; defer XML control conversion and commerce.

## Phase 2B — Authentication and access (single-admin step complete)

**Goal for this step:** replace the single legacy admin login with a password-hashed account and server-backed session while keeping the existing admin interface and Gateway request shape. Gallery/customer storage is unchanged. Multiple administrators remain a later extension.

- Added a small `admin.sqlite` account database under `vend-proofing-data/auth/`, using PHP's built-in PDO SQLite. It holds one username, email, password hash, and session-invalidating version. This is isolated from the planned Phase 3 migration of application tables.
- Added `scripts/admin-account.php create USERNAME EMAIL` for first setup and `reset USERNAME` for local password recovery. Passwords are read from standard input, with terminal echo disabled when available. No public account-creation or secret-question reset remains. The old credential files in a copied demo are ignored; the new database is authoritative.
- Admin login now verifies the plaintext password over HTTPS with `password_verify()`. PHP's `VEND_ADMIN` session cookie is HttpOnly and SameSite=Lax; it is Secure when the request is HTTPS (including the Lando HTTPS proxy). Login regenerates the session ID. A random request token bound to the server session travels through the SPA's existing `token` field. Password changes and CLI resets increment the account version, invalidating prior sessions. The remembered-login option lasts 14 days; ordinary sessions last 12 hours.
- Preserved the admin SPA's login, logout, request, upload, and account-settings interactions. Removed the browser-generated credential hash, readable auth-token cookie, public setup form, secret-question dialog, and active hub/membership authentication branch. Pruned their English language entries and updated the installation message. Remaining membership/product-update hooks elsewhere are dead code to remove in a separate pass.
- `vend-proofing-data/.htaccess` now denies HTTP access to `auth/`. The PHP development server ignores `.htaccess`, so its new `scripts/dev-router.php` denies direct requests into `vend-proofing-data/`. A future deployment recipe must enforce the same private-data boundary in its web-server configuration.
- Updated the PHP 8.4 synthetic smoke test to create an account, exercise incorrect and correct passwords, session restore, rejection of a forged token, an authorized Gateway read, CLI reset invalidation, logout, and HTTP denial of the account database. **Passed** on PHP 8.4.22. The existing Lando representative gallery smoke also passed after the change: storefront, admin bootstrap, upload, ZIP, category, and package markers.
- Created a disposable local Lando demo admin account through the new CLI. HTTPS login and session checks passed at creation, and Apache returned **403** for direct access to `auth/admin.sqlite`. The original generated test password was kept outside the repository at `/tmp/vend-demo-admin-password`; it may be stale after a local reset.
- The no-admin branch in `1.page.admin.tmpl` now includes the existing `1.page.init.tmpl` instead of emitting a separate page. Its setup text comes from the English language catalog through `$LANG`, and the isolated smoke test checks that route before creating an account.
- Follow-up: the first auth pass placed PHP session files beside `admin.sqlite`. They are disposable runtime state, so admin sessions now use `vend-proofing-data/runtime/admin-sessions/` and are excluded from backups; only the account database remains under `auth/`. Anonymous admin-page/status requests with no admin cookie do not start a PHP session. Lando's `.htaccess` and the PHP development router block direct HTTP access to runtime files. Existing browser sessions using the old path sign out once when this change is applied.

**Outstanding in Phase 2B:** browser click-through of login and account settings; a review of every public Gateway action and direct file endpoint; upload paths with the new session check; limiting requests to intended resources; and a production web-server configuration for private data. This step does not claim that all administrator or file-access vulnerabilities have been resolved. The old hub/membership code outside authentication can be pruned in a small follow-up.

## Phase 2A — Real-world compatibility (representative baseline complete)

**Goal:** exercise sanitized copies of actual gallery data on PHP 8.4, including uploads, resizing, ZIP galleries, admin navigation, pricing, and packages. Repair demonstrated compatibility issues and active dependencies. Phase 2B authentication/access and Phase 3 SQLite remain separate work.

### Current step: sanitized demo baseline on Lando

- Moved the source audit into `docs/`; added a documentation index, developer guide, short operator manual, and root `AGENTS.md`. The existing `.agents/` directory is reserved for stable, tested agent workflows; no skill is warranted yet. In this workspace it is mounted read-only, so no file was placed inside it.
- Updated `.lando.yml` from PHP 7.4 to PHP 8.4 and rebuilt the active Lando app without changing its data. `lando php -v` reports **PHP 8.4.22**; `lando info` reports appserver version **8.4**.
- After rebuild, the existing home, admin, and `?/set/875c/test-upload/` pages returned HTTP 200. Their responses contained no displayed PHP warnings, deprecations, or fatal errors. The gallery response retained its SUID marker. These are read-only HTTP checks, not UI or upload qualification.
- Lando's included MySQL service remains incidental; Vend still stores application records as files. The rebuild reported a transient MySQL healthcheck retry before startup completed. No application database migration occurred.
- Added [`scripts/phase2a-stage-demo.py`](../scripts/phase2a-stage-demo.py) to copy the historical demo into a new fixture directory without changing the source. It omits orders, sessions, message/mailing records, and logs; clears stored service credentials; and disables mail, payment gateway, and cron settings. The photographed media and public gallery metadata are copied as-is, so this is a local test fixture, not a public redistributable dataset.
- With the developer's explicit confirmation that the current local storage held nothing important, staged the demo and copied its `storage/` and `uploads/` into the ignored `vend-proofing-data/` directories. The staged copy contains 16 gallery records and 25 parseable XML files. No original demo files were modified.
- The upload gallery `775c` exposed a real PHP 8 `DivisionByZeroError`: a formatless product has a line item with width and height zero. Both package and product template branches now emit an empty aspect value for a zero denominator. Existing JavaScript parses that as `NaN` and treats the item as uncropped; nonzero dimensions retain their prior ratio.
- [`scripts/phase2a-demo-smoke.sh`](../scripts/phase2a-demo-smoke.sh) now checks the local storefront, admin bootstrap, upload gallery `775c`, ZIP gallery `992c`, and category gallery `9afe` for HTTP 200, expected markers, and displayed PHP diagnostics. It also checks the formatless product output. Latest run: **all six checks passed** on Lando PHP 8.4.22. These are read-only HTTP checks; they do not establish that uploads, ZIP extraction, image resizing, admin interactions, checkout, mail, payment, or Dropbox work.
- Real-world ZIP testing exposed a PclZip 2.8.2 PHP 8.4 warning while re-verifying `992c`: its memory-limit parser multiplied strings such as `1G` directly. The server returned `s=true` after writing the index, but the warning prefixed the response and the admin UI reported failure. Casting the numeric part before applying the unit multiplier removes the warning. A PHP 8.4 `1G` memory-limit check listed all 436 archive entries without a warning; the saved 430 image indexes match `992c.zip` exactly. `992c.zip.old` is a different archive and does not match those indexes. The developer subsequently confirmed the verifier and image wall work in the browser.
- Added a local Lando PHP configuration at [`.lando/php.ini`](../.lando/php.ini): full error reporting, errors logged to the ignored `vend-proofing-data/storage/php-debug.log`, and no errors printed into HTTP responses. Rebuilt Lando; PHP reports logging enabled and display disabled. A test `error_log()` entry appeared in the file, and an HTTP request for the log returned **403** because storage is protected by `.htaccess`. This is a development setting, not a production logging policy. Historical dependency deprecations are now visible in the log and still need focused dependency work.
- [`scripts/phase2a-upload-smoke.sh`](../scripts/phase2a-upload-smoke.sh) exercises the PHP 8.4 multipart upload path in a disposable, network-isolated Docker fixture. Two JPEG uploads with different folder paths produced two image rows, two category rows, and a page count of two; resampling one uploaded image produced a valid 300×200 JPEG. The latest run passed. This covers the server-side upload contract with small synthetic media. It does not cover the browser folder picker, hundreds of files, interrupted uploads, or 20–50 MB originals.
- The developer confirmed the local Lando demo data is disposable and requested a faster testing pace. Continue Phase 2A interaction tests directly against it; use isolated fixtures where they make a regression check repeatable. No historical deployment compatibility is required.
- The developer asked us to assume basic upload, category, and ZIP gallery behavior works for now and return to defects found during ordinary iteration. The pricing/package check uses group `7640` and its assigned gallery `775c`. The admin editor uses `set_update`; the storefront reads `set.package.table` and each package's `set.lineitem.table`. Keep payment and order integrity work in their later phase.
- Package round trip passed on the disposable Lando demo: `set_update` changed package `7642` from 500 to 501.23, its stored row and assigned storefront gallery `775c` showed 501.23, and its four format allocations were byte-identical. The original price was restored through the same Gateway action and appeared again in the storefront. The served admin JavaScript bundle includes `PackageEditor` and the `set_update` action. This tested the Gateway and storefront contract, not a browser click through the editor. The read-only demo smoke script now asserts that the assigned package and a format allocation render.
- Browser check completed in headless Chrome: the PHP 8.4 admin pricing page loaded package group `7640`; the Silver Package editor opened with its saved fields; changing its price through the editor updated the admin table and assigned storefront gallery; saving 500 through the same editor restored the original value and closed the dialog. Formats group `7626` displayed seven format rows, and Products group `7678` displayed its products. No JavaScript exception was captured during these interactions. The existing read-only smoke script covers storefront package serialization; this browser interaction was a one-off exploratory check. The browser used a locally constructed legacy token/cookie against the demo's empty product key, which reinforces the need for Phase 2B authentication replacement; it was not a login-flow test.
- This is a representative compatibility baseline, not a release qualification. Large original uploads, interrupted transfers, email, payment, Dropbox, and every administration screen remain unverified. Known historical dependencies, including Guzzle Promise and PHPMailer, remain tracked for the phases that exercise them. Proceed to Phase 2B authentication and access rather than expanding Phase 2A into an exhaustive UI audit.

### Later option: shared operations and CLI

The developer wants a command-line interface for operations such as creating packages, with an agent skill able to translate natural-language requests into those commands. The smallest sound path is to extract the relevant business operation from the HTTP Gateway into a shared PHP service, then have both Gateway and CLI call it. CLI commands should support validation, dry runs where useful, clear output, and repeatable tests. Add a skill only after the CLI contract is stable. This is a later capability, not part of the current Phase 2A compatibility step.

## Phase 1 — PHP 8.4 foundation

**Goal:** establish an isolated, repeatable PHP 8.4 runtime; identify actual compatibility failures; make focused repairs; retain the storefront, admin, Gateway, and flat-file contracts. SQLite, authentication, payments, and Dropbox redesign are outside this pass.

### Baseline and decisions

- The source audit is in [`VEND-PRODUCT-DISCOVERY-AND-TECHNICAL-AUDIT.md`](VEND-PRODUCT-DISCOVERY-AND-TECHNICAL-AUDIT.md). The developer identifies commit `e5e12a63afa31e05d85024b4a11f49b6452227f4` as the 2018 shipping baseline.
- At phase start, the only untracked file was the audit report. No tracked edits were present. The existing Lando app runs PHP 7.4 and serves the supplied URLs. Its configuration and data were not changed.
- A locally cached `devwithlando/php:8.4-apache-7` image provides PHP 8.4.22 with GD, Imagick, XML, cURL, SQLite, and ZIP. The image tag is fixed for this phase; a production image should be pinned by digest after qualification.
- [`scripts/phase1-smoke.sh`](../scripts/phase1-smoke.sh) makes a disposable source copy and entirely synthetic records under `/tmp`, then runs Docker with `--network none`. The test server also disables mail and network client functions. The original demo dataset was inspected for structure during discovery, but was not copied or mutated for Phase 1.
- [`scripts/phase1-dev.sh`](../scripts/phase1-dev.sh) starts a disposable PHP 8.4 server on local port 8048, with the same synthetic fixture. It has outbound container networking to make the local port available, but disables PHP mail, cURL, and socket functions. It is for local UI inspection, not testing integrations. The old Lando instance remains separate.
- The smoke runtime filters `E_DEPRECATED` only because the committed Guzzle Promise 1.5.2 dependency emits PHP 8.4 signature deprecations during Composer autoload. Warnings, errors, and exceptions stay visible. This filter is a temporary test accommodation, not a compatibility fix.

### Compatibility changes made

1. Removed optional defaults from six parameters that precede required parameters in `Flatfile` and `Dropboxer`. Call shape and method behavior remain otherwise unchanged.
2. `Page` now handles a missing `QUERY_STRING` as an empty query, avoiding a PHP 8 warning and secondary header warnings on `/`.
3. Cron recipient count now counts comma-separated nonempty addresses instead of calling `count()` on a string, which fails on PHP 8.
4. Converted short PHP opening tags in the 404 template to full `<?php` tags, so the fallback is independent of `short_open_tag` settings.

No PHP dependencies were upgraded in this pass. Updating the historical Composer graph as a single large operation without payment/mail/Dropbox contract tests would create a broad regression surface. The known Guzzle deprecations remain an explicit outstanding problem. PHPMailer 5.2, Omnipay Stripe 2, and Dropbox SDK 0.4 also remain unsupported or old; they must be updated in focused integration phases before release.

### Tests performed

Run `bash scripts/phase1-smoke.sh` from the repository root. It needs Docker access and the cached image or permission to obtain that image. It does not contact external services. To inspect the synthetic site manually, run `bash scripts/phase1-dev.sh` and visit `http://127.0.0.1:8048/`.

Latest isolated run on PHP **8.4.22**:

| Check | Result |
|---|---|
| `php -l` on first-party PHP classes and entry implementations | Passed; no first-party signature deprecations after changes |
| Synthetic flat-file/XML load, update, serialization | Passed |
| Storefront `/` | HTTP 200, expected HTML, no runtime warning/error |
| Admin `?/admin/` | HTTP 200, application bootstrap marker present |
| Gallery `?/set/875c/test-gallery/` | HTTP 200, gallery SUID marker present |
| Admin JS assembly `?/js/admin/1.0.00/` | HTTP 200, application class included |
| Enabled cron `?/xml/cronjob/` | HTTP 200, zero recipients counted without PHP 8 error; no mail sent |
| Gateway `get_xml&type=setup` | HTTP 200, XML envelope present |

The test uses a synthetic empty gallery; it does not qualify upload processing, image resizing, checkout, mail, payment, or Dropbox. Browser interaction and a full 2018-baseline comparison remain to be done. The live Lando site was PHP 7.4 during Phase 1 and moved to PHP 8.4 at the start of Phase 2A.

The disposable development server was also started separately and its synthetic gallery returned HTTP 200 with 21,976 bytes through `http://127.0.0.1:8048/`; it was then stopped.

### Outstanding PHP 8.4 and operational problems

- Composer autoload emits `E_DEPRECATED` from Guzzle Promise 1.5.2 when full reporting is enabled. Audit and upgrade the dependency graph with integration-specific tests. Do not ship with deprecations merely hidden.
- PHPMailer 5.2, Omnipay Stripe 2, Dropbox SDK 0.4, older Symfony components, and bundled media libraries need individual compatibility and security qualification.
- Generated storefront JavaScript writes to the source tree at request time; immutable containers need build-time output or a writable generated-asset path.
- At the end of Phase 1, the root `.lando.yml` still specified PHP 7.4. It was switched to PHP 8.4 at the start of Phase 2A, after the isolated runtime passed smoke checks.
- The synthetic test does not exercise actual uploaded photographs or 20–50 MB original processing. Add sanitized representative media tests before claiming production compatibility.
- Test-server PHP `disable_functions` is a safety boundary only for this synthetic fixture. It is not the future production configuration.

### SQLite feasibility assessment (initial Phase 1 proposal; superseded by the unified database decision above)

The storage abstraction is substantial but incomplete. `Flatfile` centralizes table paths, row parsing, table updates, XML fallback, and upload metadata; `Filesystem` centralizes many basic reads/writes. Higher-level code also reads and writes `set.*.table`, `image.table`, session records, order records, files, and indexes directly. Examples: `LocalGateway` session actions use table paths directly; `Order::createOrder()` moves session rows into dated order files; `Dropboxer::syncFolder()` rewrites image/category tables and unlinks sessions; `Graphic` reads originals and writes derivatives; templates generate JavaScript. These call sites need classification before swapping storage.

**Candidate smallest design:** preserve `Flatfile`'s public methods and return shapes. Put only `.table` rows and the SUID allocator into SQLite. Keep XML configuration, photographs, ZIP archives, assets, logs, caches, and generated media as files initially. A minimal table could be `(table_path TEXT, row_key TEXT, ordinal INTEGER, row_text TEXT, PRIMARY KEY(table_path,row_key))`, with an index on `(table_path,ordinal)`. `row_text` preserves the original tab-delimited field contract; `ordinal` preserves ordering. A separate `meta`/sequence table can hold the next SUID while preserving every existing hexadecimal ID. SQLite transactions should wrap complete read-modify-write operations, including order insertion and discount use.

Representative behavior:

```php
// Before and after: caller contract stays the same.
$rows = Flatfile::getSetTable('package', $packageSetId);
$rows = Flatfile::updateSetTable('package', $updatedRow, $packageSetId);
Flatfile::saveSetTable($rows, 'package', $packageSetId);
```

Today this reads/rewrites `storage/<id>/set.package.table`. The candidate adapter would read/update rows under that logical table path in SQLite and return the same keyed PHP arrays. This example alone is **not** transaction-safe across separate calls. Either expose a narrowly scoped transaction wrapper for compound operations or adapt higher-level operations that currently split reads/writes across calls. Retaining signatures is useful; retaining non-atomic semantics is not.

Direct `file_get_contents`, `file_put_contents`, `unlink`, `copy`, `rename`, `readfile`, `fopen`, and directory traversal sites must be inventoried by data type. Some are physical media and should stay on disk; others are storage bypasses that must be routed through the adapter. Replacing `Filesystem` wholesale with SQLite would be an error.

Migration can import each legacy `.table` file, store the original path, key, ordinal, and exact row text, and preserve `suid.index`. Verify file counts, per-table row counts, key order, sample field arrays, referential relationships (page IDs, assigned pricing groups, session IDs, order IDs), and round-trip serialization. Run import in one transaction, record a manifest/checksum, and keep legacy files read-only until restore and application regression checks pass. Reimport should be deterministic and should not overwrite existing live database state without explicit operator action.

**Assessment:** SQLite would materially improve atomic writes, concurrency, indexing, and consistent backup of tabular records. It will not solve direct filesystem bypasses, record authorization, media storage, or application-level transaction boundaries by itself. Preserve flat-file import support and keep the change in a later bounded phase.

### Next recommended phase

Qualify PHP 8.4 against sanitized representative galleries and active dependency paths, then secure administrator authentication and constrain Gateway/file access. Keep the user-facing interface and email-only proofing model. Defer the SQLite migration until these contracts have tests and the direct-file inventory is complete.
