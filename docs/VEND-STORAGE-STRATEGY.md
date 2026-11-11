# Vend storage strategy and migration review

**Status:** historical source review and superseded path-based document-store proposal, November 2026. Vend's clean-break relational direction and implemented foundation are recorded in [the modernization log](VEND-MODERNIZATION.md). Keep this review as dependency evidence, not an implementation plan.

## Decision and boundary

Use one private SQLite database for mutable application data: administrator accounts, administrator sessions, customer proofing records, gallery and commerce tables, saved XML configuration, orders, and the SUID counter. Preserve existing identifiers, public URLs, row shapes, ordering, and visible behavior. Keep photographs, ZIP archives, media assets, generated derivatives, caches, temporary files, logs, and source/default templates as files. “One database” means one durable *record* store; it does not mean putting photographs into BLOB columns.

The current `auth/admin.sqlite`, PHP session files in `runtime/admin-sessions/`, and flat-file tables are an interim state. The goal is one database and one coherent persistence migration, executed in small, independently tested cutovers. The existing JavaScript applications should continue to receive their current Gateway responses.

## Current storage contract

[`common.php`](../vend-proofing-core/php/common.php#L11) defines `SA_DIR_DATAPATH`, `SA_DIR_STORAGE`, `SA_DIR_AUTH`, `SA_DIR_TEMP`, and `SA_DIR_CACHE`. `storage/` contains both records and physical media. In the disposable Lando demo snapshot inspected for this review, it held 74 `.table` files, 25 XML files, 2,712 JPEGs, and a `suid.index`. These counts describe the local fixture, not a production installation. The fixture also contains a `set..table` path; import should report unusual names rather than silently normalize them.

[`Flatfile::getTablePath()`](../vend-proofing-core/php/classes/simpleadmin/Flatfile.php#L426) constructs logical paths such as `storage/set.page.table` and `storage/<suid>/set.session.table`. [`getTableArray()`](../vend-proofing-core/php/classes/simpleadmin/Flatfile.php#L434) reads a whole file, splits nonempty lines on tabs, and returns an array keyed by column zero. File line order becomes PHP array iteration order. Duplicate row keys would collapse to the last parsed row; import verification must check the parsed representation as well as file bytes.

[`updateTableRow()`](../vend-proofing-core/php/classes/simpleadmin/Flatfile.php#L482) merges non-null incoming fields with the prior row and returns the *entire* revised array. The caller generally invokes [`saveTableArray()`](../vend-proofing-core/php/classes/simpleadmin/Flatfile.php#L476) afterward, which serializes and rewrites the whole document. [`reIndexRow()`](../vend-proofing-core/php/classes/simpleadmin/Flatfile.php#L546) changes physical row order. Empty strings, null merge semantics, row order, missing-file behavior, and exact tab-delimited Gateway responses are part of the contract to test.

[`createUID()`](../vend-proofing-core/php/classes/simpleadmin/Flatfile.php#L7) increments the decimal value in `suid.index` and returns its hexadecimal form. Existing SUIDs should remain untouched. The allocator needs a single atomic database operation so concurrent requests cannot receive the same ID.

Saved XML has a two-level lookup: [`getTrueXmlPath()`](../vend-proofing-core/php/classes/simpleadmin/Flatfile.php#L590) selects a saved document if present, otherwise a source default. The `required` argument changes how a missing saved override is reported. [`SimpleXML4::load()` and `save()`](../vend-proofing-core/php/classes/simpleadmin/SimpleXML4.php#L7) use file paths directly, so changing only `Flatfile::getXmlString()` would be incomplete. Source defaults can stay in the repository; saved overrides belong in SQLite.

## Touch points and migration consequences

| Area | Current path through storage | Consequence for the new store |
|---|---|---|
| Storefront | [`Page`](../vend-proofing-core/php/classes/simpleadmin/Page.php#L309) loads global XML, page rows, and assets. [Gallery rendering](../vend-proofing-core/tmpl/html/2.content.display.tmpl#L115) follows SUID references to format, paper, modifier, package, product, and download data. | Preserve relationships and raw output. The storefront should require little business-logic change. |
| Admin Gateway | [Generic `set` and file actions](../vend-proofing-core/php/classes/simpleadmin/Gateway.php#L742) list, create, update, delete, sort, and upload through `Flatfile`. | Keep request/response contracts. Wrap complete read/modify/save operations in transactions; an atomic `saveTableArray()` alone is insufficient. |
| Customer proofing | [`open_session`](../vend-proofing-core/php/gateway.php#L941) derives a session key from `md5(email)`. `set.session.table` holds summary rows; `set.<hash>.table` holds favorites and cart selections. | These are durable application documents, distinct from PHP admin sessions. Preserve the email-only flow and existing keys. Update detail and summary together. |
| Orders and discounts | [`Order::createOrder()`](../vend-proofing-core/php/classes/simpleadmin/Order.php#L518) copies selections into a dated order document, leaves favorites in the customer session, and writes a daily order row. [`applyDiscountCode()`](../vend-proofing-core/php/classes/simpleadmin/Order.php#L245) increments a use counter separately. | Keep the purchased snapshot. Order creation, discount use, and eventual payment state need transaction and retry semantics; storage migration alone does not make checkout authoritative. |
| Order lookup/reporting | [`getOrderById()` and `search()`](../vend-proofing-core/php/classes/simpleadmin/Order.php#L61) traverse dated directories or test dated file paths. | Provide logical path listing/existence checks or an order lookup index before making SQLite authoritative. Otherwise existing orders disappear from admin views. |
| ZIP verification and duplication | [Application Gateway](../vend-proofing-core/php/gateway.php#L142) writes indexes directly, copies set directories, and deletes session files on re-verification. | Route record writes, copies, and deletes through the record store while preserving media operations. Reconsider destructive session resets instead of reproducing them automatically. |
| Dropbox synchronization | [`Dropboxer::syncFolder()`](../vend-proofing-core/php/classes/simpleadmin/Dropboxer.php#L119) rewrites image/category indexes and deletes customer sessions; transfer scratch files and thumbnails are also files. | Records move to SQLite; thumbnails and temporary transfer files remain physical. Synchronization must not silently lose customer selections. |
| Saved XML and installation | [Admin setup](../vend-proofing-core/tmpl/html/1.page.admin.tmpl#L101) calls `SimpleXML4::save()` directly. [`refreshTemplateFiles()`](../vend-proofing-core/php/classes/simpleadmin/Gateway.php#L127) scans and rewrites XML files. | Migrate these bypasses and preserve default fallback. The small root bootstrap config loaded by [`common.php`](../vend-proofing-core/php/common.php#L34) needs a deliberate decision because it is read before application storage is initialized. |
| Admin auth | [`AdminAccount`](../vend-proofing-core/php/classes/simpleadmin/AdminAccount.php#L5) owns a separate SQLite file; [`Auth`](../vend-proofing-core/php/classes/simpleadmin/Auth.php#L7) uses PHP session files. | Move account and server-side session state into the common database. An existing database file must not be mistaken for an existing administrator account. Preserve cookie and SPA request-token behavior. |
| Media and caches | [`Graphic`](../vend-proofing-core/php/classes/simpleadmin/Graphic.php#L486), [`Page`](../vend-proofing-core/php/classes/simpleadmin/Page.php#L579), uploads, ZIP extraction, and Dropbox transfers use physical files. | Keep file operations. [`Filesystem`](../vend-proofing-core/php/classes/simpleadmin/Filesystem.php#L4) handles binaries as well as records, so redirecting it wholesale would be incorrect. |

The source also contains direct `file_exists`, `file_get_contents`, `Filesystem::makeFile`, `copy`, `unlink`, and directory traversal against record paths. The table above identifies the consequential branches, not an exhaustive call graph. Before cutover, classify every direct use by **durable record**, **media**, **cache**, **temporary work**, or **log**, and route only durable record operations through the new boundary. Templates are part of that search, not just PHP classes.

## Smallest practical database design

Begin with a `documents` table keyed by **relative logical path**, storing the exact contents and a revision. This preserves the current path/name/value model and allows existing parsers to keep returning arrays and tab-delimited strings. Add dedicated tables for the administrator, administrator sessions, and the SUID sequence. Give the store a small API for read, write, delete, exists, list by prefix, and transactions. Avoid routing media through this API.

Whole-document storage is a compatibility bridge, not a commitment to opaque BLOBs forever. It does **not** fix lost updates if two requests each read the same document, modify a copy, and save it. Transaction boundaries must cover the entire operation; revision checks or targeted atomic row updates may help where holding a write transaction is undesirable. Order lookup may justify an indexed projection later, but there is no need to normalize every historical table before the application works against SQLite.

Example caller contract:

```php
$rows = Flatfile::updateSetTable('package', $data, $packageSetId);
$response = Flatfile::saveSetTable($rows, 'package', $packageSetId);
```

The PHP array and response can remain the same. The implementation behind this call must ensure the read, merge, and write are one consistent operation, including any related records changed by the same Gateway request.

## Gotchas and decisions to revisit

1. **Order snapshots and payment integrity.** Existing orders preserve selections in a copied document. Preserve that durability, then handle server-authoritative totals and payment callbacks in their payment phase. SQLite transactions cannot substitute for payment validation.
2. **Database/filesystem split.** SQLite cannot atomically commit a photograph or ZIP alongside its metadata. Upload, deletion, ZIP verification, and Dropbox synchronization need explicit recovery rules for interrupted operations.
3. **Backup and restore.** Existing [backup actions](../vend-proofing-core/php/classes/simpleadmin/Gateway.php#L250) archive `storage/`; they omit the separate admin database and would omit the future unified database. Backups need a consistent SQLite snapshot plus retained media and ZIPs. SQLite documents the [online backup API and `VACUUM INTO`](https://www.sqlite.org/backup.html); copying just the main database file while it is live is not a safe general procedure, especially in WAL mode.
4. **Hosting topology.** SQLite WAL supports concurrent readers with a writer, but only one writer at a time and no WAL database shared across hosts on a network filesystem. This fits the intended single-host installation; a later multi-host deployment would need a different database topology. See [SQLite WAL documentation](https://www.sqlite.org/wal.html).
5. **Configuration bootstrap.** `vend-proofing-config.xml` is loaded before the record store. Decide whether it remains a minimal installation file, while mutable settings move to SQLite. The application must still find the database on first install or recovery.
6. **File-path behavior.** Order lookup, XML fallback, set duplication, public SUID validation, ZIP type detection, and template refresh use path existence or directory structure as data. A key/value table must offer equivalent logical operations or these call sites must change.
7. **Data exposure.** A unified database holds password hashes, customer records, orders, and possibly service credentials. It needs a private location and HTTP denial. A copied database backup needs the same treatment.
8. **Fixture limits.** The local staged demo omits private orders and sessions. It can prove gallery rendering but cannot alone qualify order import, customer-session restoration, or payment records. Use synthetic fixtures for those paths and a private copied legacy installation if one is available.

## Suggested implementation and acceptance sequence

1. Capture contract tests for document reads/writes, null-field merge, ordering, XML fallback, SUID allocation, admin login/reset, proofing resume, package pricing, and order snapshot creation. Inventory remaining direct record-file access.
2. Build an importer that reads a copied legacy data directory without changing it and writes only to a new database. Record counts, unusual paths, hashes, parsed row counts, IDs, and references.
3. Introduce the record-store boundary and move durable record reads/writes, including direct Gateway, order, XML, and synchronization bypasses. Keep the flat-file source available until behavior matches.
4. Move the existing admin account and server-side sessions into the same database. Preserve the browser login contract; prior file-backed admin sessions may need a one-time sign-in.
5. Add transactions around compound writes and repeat representative storefront, admin, upload, ZIP, proofing, package, and order tests. Test interruption and concurrent requests where the operation warrants it.
6. Switch SQLite to the authoritative store only after import verification and behavioral checks pass. Provide a documented backup/restore path before considering removal of legacy write code.

**Not yet decided:** exact database filename/location; whether saved root configuration moves fully into SQLite; whether order lookup gets an indexed projection immediately; and whether a PHP session save handler or a small explicit admin-session table is the simpler implementation. These are implementation choices, not reasons to retain three permanent storage mechanisms.
