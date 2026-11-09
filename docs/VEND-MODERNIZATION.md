# Vend modernization log

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

### SQLite feasibility assessment (no migration implemented)

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
