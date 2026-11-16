# Developing Vend

Vend is a PHP application with a customer storefront and a separate JavaScript administration interface. Preserve its established UI and behavior while modernizing the runtime and security boundaries. The [audit](VEND-PRODUCT-DISCOVERY-AND-TECHNICAL-AUDIT.md) maps the architecture; the [storage strategy](VEND-STORAGE-STRATEGY.md) records the superseded document-store proposal; the [modernization log](VEND-MODERNIZATION.md) records current phase decisions and results.

Vend is currently greenfield: there are no deployed users or legacy-data migration requirements. Define new account structures directly in the fresh-install schema; do not maintain superseded development endpoints or upgrade paths. The numbered SQL files are installation scaffolding, not a deployed compatibility contract.

## Repository and distribution layout

`dist/` is the web document root and contains the deployable PHP entry points, core assets/templates/vendor libraries, and private application data directory. Deploy its contents at the installation URL; `/dist` is not part of public URLs. Source assets, build tools, scripts, and documentation remain at the repository root. Run npm and CLI installation commands from that root. Lando serves `dist/`; run `lando rebuild -y` after changing an existing checkout to this layout. Restart asset watchers after the move.

Administrator language catalogs live in `dist/vend-proofing-core/lang/`. `data.setup.language` in the saved SQLite `installation` configuration document selects a two-letter catalog such as `en.json` or `es.json`; unavailable catalogs fall back to English. Missing labels still derive from their slugs. Customer-editable copy remains in `defaults/language.json`. The setup wizard lists the shipped two-letter catalogs.

## Canonical installation URL

Set `data.setup.baseurl._value` in the saved SQLite `installation` configuration document to the installation’s canonical HTTPS URL, including any subdirectory (for example, `https://proofs.example.com/vend`). `common.php` normalizes it into the shared `SA_BASE_URL` constant. `Func::getPublicBaseUrl()` validates this URL for password recovery, payment returns/webhooks, and invoice email links. Credentials, query strings, fragments, and non-HTTPS URLs are rejected. Request Host/forwarded-host headers never supply it. An unset URL leaves local browsing available but disables features that require absolute public links. Browser-only return links can remain relative. Web and CLI bootstraps use the same configuration.

For local Lando use `https://vend-proofing.lndo.site`. `setup.basepath` remains the relative asset/request path (`./`); `setup.baseurl` is the absolute canonical URL. The setup wizard suggests this installation field and requires confirmation before saving. Use a synthetic hostname in isolated tests.

## Local runtime

The main Lando app is configured in `.lando.yml`. Run `lando start`, then use the HTTPS URLs reported by `lando info`. Application data lives under `dist/vend-proofing-data/`; keep existing data and credentials out of commits. The Lando `lamp` recipe includes a database service, but Vend uses its own SQLite database for administrators, PHP sessions, galleries, media metadata, pricing, discounts, customer proofing, carts, orders, payments, fulfillment records, contacts, and message logs. The Lando MySQL service is incidental. `Records` owns ordinary relational lists; `Proofing` owns customer selections; `OrderRecords` owns purchase snapshots. The main `Gateway` switch handles set-list, image, and media actions. Physical media files remain on disk.

`MediaFiles` handles physical uploads, sideloads, snapshots, and file deletion. `Gateway` routes the admin request and `Records` owns its SQLite metadata. `Configuration` stores compact JSON settings in SQLite and reads source defaults from `dist/vend-proofing-core/defaults/`; empty `_value` and `_attributes` fields are supplied when the admin loads a document; `Flatfile` and `SimpleXML4` have been removed. The Vend admin layout and identity live in `src/js/admin/classes/Admin.js`; `AppConfig` reads the saved `installation` document through `Configuration`. Fresh installs seed it from `dist/vend-proofing-core/defaults/installation.json`; before installation, the same defaults allow the initial screen to render. Lando loads `.lando/php.ini` for development diagnostics. PHP errors go to the ignored `dist/vend-proofing-data/storage/php-debug.log`; they are not printed in HTTP responses. Follow the file locally with `tail -f dist/vend-proofing-data/storage/php-debug.log`. The storage `.htaccess` blocks HTTP access to the log. A new or cleared local installation needs a writable `dist/vend-proofing-data/storage/` directory before PHP can create the log.

For an isolated PHP 8.4 smoke check, run `bash scripts/phase1-smoke.sh`. It creates synthetic records and a synthetic admin account under `/tmp`, runs the cached PHP 8.4 container without network access, and removes the fixture afterward. It tests login, session, Gateway access, CLI reset, and logout as well as the older storefront checks. It also runs Node syntax checks on the static storefront/admin bundles and inline page configuration, so Node must be available on the host. Run `npm run build` before the smoke scripts after changing asset sources. Run `bash scripts/basic-set-smoke.sh` for a fresh-install upload-set test with no flat-file page/image records; it also checks relational proofing, cart, offline checkout, invoice, pricing, and Dropbox image metadata. For a disposable interactive site, run `bash scripts/phase1-dev.sh` and open `http://127.0.0.1:8048/`; it starts with an empty page catalog, disables PHP mail and network client functions, and prints its synthetic admin login. Create an Upload Set and upload a JPEG in admin to test the SQLite path. The PHP development server uses `scripts/dev-router.php` to keep private data inaccessible. Neither script uses the live data directory.

### Browser setup

`1.page.setup.tmpl` serves the public three-step installer using `SetupWizard`; `1.page.admin.tmpl` only renders the admin SPA. Both use the main `admin.css`, as does recovery. There is no shell stylesheet or init template. Readiness requires a database, a saved installation configuration document, and at least one administrator; contact-email removal does not block admin access.

Step 1 validates the shipped language choice, local index/base paths, and a confirmed canonical HTTPS URL, then creates/seeds SQLite and saves installation settings. Request-host guesses are suggestions only, never a silent source of trusted public URLs. Step 2 validates the first administrator and retains only a password hash in a private, one-hour setup session. Step 3 requires the primary business email and commits contact settings and the first administrator together in a transaction. This delays readiness until the full flow is finished. Setup writes are serialized and recheck completion; competing forms cannot add an administrator after completion. An existing administrator must sign in before repairing a missing installation document. No email is sent during setup.

Setup uses CSRF-protected POSTs and private filesystem sessions under `auth/setup-sessions/` because SQLite may not yet exist. These are temporary wizard state, not another durable record store. Run `bash scripts/setup-smoke.sh` for empty-install HTTP validation, redirects, CSRF, saved settings, password-hash-only drafts, competing completion, and missing-contact behavior. Tests use disposable data. The web server must deny the entire private `auth/` directory.

### Fresh-install reset

Visiting an uninstalled site opens setup; the database is created only after a valid first-step POST. For a disposable local reset, stop Lando before removing `dist/vend-proofing-data/auth/vend.sqlite` and any matching `-wal`/`-shm` files. Restart Lando and open `?/setup/` to install through the browser. Remove any disposable `auth/setup-sessions/` state as well when starting an entirely new test. This resets all database records, including users, sessions, configuration, galleries, and commerce records; physical media and generated files remain on disk. A fully empty installation also needs a clean application data directory. Never run this against data you need to retain.

### Administrator accounts

For a fresh installation, open the site or `?/setup/`. The three-step wizard confirms installation settings, collects the first administrator, and saves business contact details. CLI installation remains available with `lando php scripts/install.php`, followed by `lando php scripts/admin-account.php create USERNAME EMAIL`. The login screen supports emailed recovery links; the local fallback is `lando php scripts/admin-account.php reset USERNAME`. Both account commands prompt for a password of at least 12 characters; terminal echo is disabled when possible. The unified database lives at `dist/vend-proofing-data/auth/vend.sqlite` and holds the account, administrator sessions, PHP order-session state, saved JSON configuration, and an installation secret for gallery access. Back up the database with application data. The web server must deny HTTP requests into `auth/`; the current Lando Apache setup does this through `dist/vend-proofing-data/.htaccess`.

Dashboard → Users manages multiple administrator accounts through the existing table/dialog UI. The fresh-install schema defines multiple accounts and their sessions directly. The `admin` and `manager` user types are stored labels with identical access for now; permission differences are deferred. Every signed-in user can create accounts, change types, and delete other accounts, but only edit their own username/email/password. Self-edits require the current password and invalidate all sessions for that account. Self-deletion is blocked; deleting another account cascades its sessions. The customer email proofing session is separate. The admin SPA still posts to the Gateway with a `token` field, now a session-bound request token. Keep it on new admin actions, including uploads and auxiliary forms. Public setup is available only until the database, saved installation document, and an administrator exist. Never send passwords by email.

Password recovery uses `classes.dialogs.PasswordRecovery` in the admin SPA at `?/admin/&recover=1`, the existing `Email` transport/settings, and the shared canonical installation URL (`SA_BASE_URL`, validated through `Func::getPublicBaseUrl()`). The fresh-install schema stores only SHA-256 reset-token hashes, account versions, expiry, and hashed rate-limit buckets in the private database. Tokens expire in 30 minutes, are replaced on another request, and are consumed with the password/session changes in one transaction. Account edits and CLI resets invalidate issued links through `account_version`. The initial credential is in the email URL fragment, then removed from browser history and posted through CSRF-protected Gateway actions. `recovery_form` issues a separate HttpOnly/SameSite CSRF cookie and returns its token; `recovery_request` and `recovery_reset` require a matching POST token. GET requests do not consume reset credentials. The admin entry and recovery responses use no-store/no-referrer headers. Recovery takes precedence over authentication and navigation events, including links opened while another account is signed in. There is no separate recovery template. Delivery is synchronous; do not claim timing-resistant account enumeration protection. Responses are generic and requests are limited to 3 per email address, 10 per client IP, and 60 globally per hour. Expired buckets are cleaned on requests. Failures log only a static operational message; reset email bodies must never go to the message log or SMTP debug output. Use the CLI fallback if mail or the public URL is unavailable.

Use `classes.data.Lang.lookup()` in JavaScript and `$LANG->lookup()` in PHP for user-facing text. Missing keys automatically become title-cased labels from their slugs. Add entries to `dist/vend-proofing-core/lang/en.json` only when the wording, punctuation, formatting, or placeholders need to differ from that fallback; do not add entries for ordinary labels such as Users, Username, or Create User. Catalog placeholders use braces, such as `{USERNAME}` or `{TOTAL}`; adapt them at a library boundary when its syntax differs. The account layer returns stable message keys; the UI translates them. Recovery email uses the existing `setSubjectTemplate()`, `setBodyTemplate()`, and `addPreTags()` pipeline. Its `language.json` templates wrap localized `SUBJECT` and `MESSAGE` values from the admin catalog. `scripts/password-recovery-test.php` tests the mail composer with a fake transport; `scripts/password-recovery-http-test.php` exercises the public Gateway actions and SPA entry. Both run in the disposable foundation smoke. Never send a test recovery message to an existing administrator account; use a synthetic account and an explicitly chosen test inbox or local catcher.

The retired `get_xml`, `get_files`, and `get_set` Gateway actions have no application callers. Admin XML controls use `setup_load` and `setup_defaults`; admin tables use the typed `set_list` and media `*_list` actions. The storefront reads its tax rules directly while rendering the gallery.

Limited-use discounts are claimed by `prequalify_order` before payment. A retry with the same order ID and quote keeps the claim; abandoned checkouts keep it counted. A completed order converts the claim to a redemption. The photographer can extend the code limit in admin when needed. See the [modernization log](VEND-MODERNIZATION.md) for the payment qualification still open.

Checkout Gateway failures send stable keys such as `discount_expired` and `invalid_order`. Storefront copy for these keys belongs in `defaults/language.json` and is read through `L10N`; PHP exception prose must not become customer-facing text.

For Phase 2A, `scripts/phase2a-stage-demo.py SOURCE_DATA NEW_FIXTURE_DIRECTORY` made a sanitized local copy of the historical demo. It refuses to overwrite an existing fixture. It excludes customer orders and sessions, removes service credentials, and disables mail, payment, and cron settings. Media and public gallery metadata were copied unchanged; keep both the source and fixture private. The local Lando `dist/vend-proofing-data/storage/` and `uploads/` currently hold this staged copy. `scripts/phase2a-demo-smoke.sh` captured the pre-cutover storefront, admin, upload-gallery, ZIP-gallery, and category-gallery baseline. Its gallery checks are historical reference checks; ZIP galleries are retired in the new release.

The current local Lando demo data is disposable reference data. Its old page table is no longer read by the relational catalog, so the current set list is empty until new sets are created. Use the isolated fresh-install smoke or development site for the new catalog acceptance test. Historical deployment compatibility is not a requirement; preserve current behavior and identifiers where they help the product, not to accommodate old PHP installations.

Run `bash scripts/phase2a-upload-smoke.sh` for a disposable PHP 8.4 test of category-set multipart uploads, folder categories, relational records, storefront rendering, restart persistence, and image resizing. It verifies that category and image table files are absent and ignored if planted. It uses synthetic JPEG media and Docker with no external network access; it does not alter the Lando data.

## Front-end asset build

Use Node 22 or newer and npm on the host. Run these commands from the repository root:

```sh
npm ci
lando start
npm run dev
```

For a one-time build of both styles and scripts, run `npm run build`.

| Command | Purpose |
|---|---|
| `npm run build` | Build CSS, JavaScript, source maps, and the invoice jQuery copy |
| `npm run build:css` / `npm run build:js` | Build one asset type |
| `npm run dev` | Build both, start BrowserSync, and watch sources/templates |
| `npm run watch:css` / `npm run watch:js` | Watch and rebuild one asset type without starting a proxy |
| `npm run check:css` / `npm run check:js` | Verify generated files match current sources; do not write output |
| `npm run test:css` / `npm run test:js` | Run asset checks and synthetic PHP configuration tests |

The `test:*` commands need Docker and `devwithlando/php:8.4-apache-7`, the PHP 8.4 image used by the application smoke scripts. Their PHP fixtures run without network access and do not load the local application database. They check existing build output; run `npm run build` first after source changes. The broader [local runtime checks](#local-runtime) also consume built assets.

### Source and output ownership

| Location | What belongs there |
|---|---|
| `src/scss/` | First-party stylesheet entry points and component partials |
| `src/scss/shared/_reset.scss` | Reset loaded by admin and storefront before their component modules |
| `src/js/admin/` | Administrator bootstrap, helpers, components, dialogs, applications, and panels |
| `src/js/storefront/` | Storefront bootstrap, language/tracking adapters, and `vend/` application classes |
| `src/vendor/` | Third-party CSS/JS, grouped by package; both former `extend/` trees are removed |
| `dist/vend-proofing-core/css/` | Four generated CSS files and their maps |
| `dist/vend-proofing-core/js/` | Three generated application bundles/maps and the unchanged invoice jQuery copy |
| `dist/vend-proofing-core/graphics/` | Runtime images; admin badge/loader in `admin/`, shared jQuery UI images in `jquery-ui/` |
| `dist/vend-proofing-core/fonts/bootstrap/` | Glyphicons fonts referenced by bundled Bootstrap CSS |

Edit sources and commit generated output alongside them. Do not edit generated CSS/JS directly. Deployment serves these files without Node, and PHP does not build assets during requests. Maps refer back to `../../../src/` from the output directory. Sources remain outside the document root; use local workspace source mapping for browser debugging. No asset output belongs under `dist/vend-proofing-core/build/`.

### Build configuration

[`assets.config.js`](../assets.config.js) owns bundle membership and load order. CSS entries have one SCSS `source` and optional ordered CSS `prepend`/`append` arrays. JavaScript entries have ordered script `prepend`, `source`, and `append` arrays. The sequence is prepend → source → append. Add new application scripts to the appropriate list; creating a file alone does not include it in a bundle.

[`scripts/build-css.js`](../scripts/build-css.js) uses Dart Sass and PostCSS to preserve the cascade, rebase vendor image/font URLs for the output directory, and combine source maps. [`scripts/build-js.js`](../scripts/build-js.js) concatenates plain browser scripts with separators and maps, preserving globals and closures without module conversion, transpilation, or new minification. Existing vendor files are still mostly supplied minified builds. Each builder finishes compiling/parsing its outputs before replacing files and writes only changed contents. HTML uses file modification times for cache invalidation.

The config's `copy` section copies `src/vendor/jquery/jquery.js` unchanged to `dist/vend-proofing-core/js/jquery.js` for invoice pages. Both application bundles also include that shared source. This copy is not a third application bundle and has no generated map. Some other shared vendor sources are Modernizr, Base64, browser detection, hashchange, MD5, and the Spin.js core.

Package boundaries that need care:

- jQuery UI has two distinct 1.12.1 JavaScript component builds: `src/vendor/jquery-ui/jquery-ui.admin.min.js` and `jquery-ui.storefront.min.js`. Its CSS and graphics are shared. Do not collapse the scripts merely because their version numbers match.
- Admin uses `src/vendor/spin/jquery.spin.js` in addition to the shared Spin.js core; storefront uses its own `.progress()` helper at `src/js/storefront/vend/helpers/Progress.js`. That application helper was extracted from the vendor scroll-containment file and retains its prior execution order in the manifest.
- jPlayer core and playlist filenames now match their upstream headers. Core must load before playlist.
- DataTables is a combined build including Responsive, RowReorder, Select, and Bootstrap styling. Upgrade its components together rather than swapping the core file alone.
- Bootstrap retains the used `bootstrap.min.js` and `bootstrap.min.css` in `src/vendor/bootstrap/`; its referenced fonts remain under `dist/vend-proofing-core/fonts/bootstrap/`.

### BrowserSync and stale watchers

[`gulpfile.js`](../gulpfile.js) proxies `https://vend-proofing.lndo.site` by default. Open the local HTTPS URL it prints; do not assume a fixed port. It starts at 3000 and chooses a free port when necessary. The listener is loopback-only, the BrowserSync UI is disabled, and mirrored clicks/forms are disabled.

SCSS/vendor CSS saves rebuild and inject styles without resetting page state. JavaScript saves rebuild and reload the page. HTML template saves reload the page. Configuration and build-helper edits reload the relevant code and rebuild assets; editing the Gulpfile or changing dependencies requires restarting `npm run dev`. Stop the project watcher with Ctrl-C before starting another.

Override the target/initial port when needed:

```sh
VEND_PROXY=https://another-local-site VEND_DEV_PORT=3010 npm run dev
```

An older watcher once recreated `dist/vend-proofing-core/build/css/` because it retained the old builder in memory. If that directory reappears, stop stale watchers for this checkout, restart the current `npm run dev`, run `npm run build`, and verify both `check:*` commands. Confirm a process belongs to this checkout before stopping it. Remove only the obsolete generated output after its writer is stopped; do not change the current output path or delete unrelated build files.

The disposable `scripts/phase1-dev.sh` site copies the application into a temporary fixture at startup. It does not mirror later source/build edits; use Lando for this live asset workflow, or restart that disposable fixture when testing a new build.

### CSS development

| Entry point | Purpose | Generated file under `dist/vend-proofing-core/css/` |
|---|---|---|
| `src/scss/storefront.scss` | Storefront components | `storefront.css` |
| `src/scss/admin.scss` | Administration interface | `admin.css` |
| `src/scss/invoice.scss` | Invoice screen | `invoice.css` |
| `src/scss/invoice-print.scss` | Invoice printing | `invoice-print.css` |

Each file has a generated `.css.map`. Component `@use` order preserves the original cascade; both main entry points use the shared reset. Storefront-only invalid-input coloring lives in its component SCSS. Pages use these bundled styles directly; the old PHP CSS assembly templates and `2.styles-admin.tmpl` are removed.

[`tmpl/html/2.theme.tmpl`](../dist/vend-proofing-core/tmpl/html/2.theme.tmpl) emits configured colors, font family/scaled sizes, spacing, logo dimensions, print visibility, and sprite URLs as inline `:root` custom properties. It also emits the existing custom-font `@font-face` declarations. Use `var(--vend-...)` in SCSS; keep PHP configuration logic in the HTML template. URL-valued properties contain the complete `url(...)` expression, not a `var(...)` inside a quoted URL. CSS custom-property support is required.

### JavaScript development

| Entry | Purpose | Generated file under `dist/vend-proofing-core/js/` |
|---|---|---|
| `js.admin` | Admin vendor dependencies and application classes | `admin.js` |
| `js.storefront` | Storefront vendor dependencies and application classes | `storefront.js` |
| `js.payments` | Shared Stripe/PayPal/Venmo UI for checkout and invoice retries | `payments.js` |
| `copy['jquery.js']` | Unchanged vendor dependency for invoice pages | `jquery.js` |

The three application bundles have `.js.map` files. Every admin panel is included once; the old PHP assembler accidentally included panels twice. The former `vend.js`/`vend-core.js` generated files are removed, and `dist/vend-proofing-core/admin/` no longer contains application sources.

`Admin.js` owns a compact configuration object with plain tab/content-type arrays, title, and badge properties. Its consumers use ordinary properties and boolean flags. The bootstrap supplies the fixed namespace and class scaffolding; there is no global admin configuration object. The admin page passes only installation language/basepath/indexpath through one escaped JSON `data-config` attribute. There is no admin configuration script template, hub mode, or embedded-admin mode; navigation always uses browser history and logout is always available.

For the storefront, PHP emits `window.VEND_CONFIG` before loading its bundle. [`2.config-storefront.tmpl`](../dist/vend-proofing-core/tmpl/html/2.config-storefront.tmpl) supplies the namespace, base URL, URI labels, graphic settings, and processed public translations. JSON encoding protects script boundaries. Its static bootstrap maps these values to existing globals and `classes.helpers.L10N.get()`. Gallery/order startup markup remains rendered in HTML.

The former `?/js/global/`, `?/js/admin/`, `?/js/vend/`, and all `?/css/...` assembly routes return HTTP 404. Do not visit a retired route to regenerate bundles. The historical standalone Video.js page still has its own external runtime and stylesheet, outside the application bundles.

### Paused vendor cleanup

The source/build reorganization is complete. No dependency version was upgraded, and the proposed unused-library removals/native replacements have not been implemented. The user deferred that work until after the next code check-in. Resume it as a separate bounded task; preserve concurrent payment changes.

The [vendor candidate audit](VEND-MODERNIZATION.md#vendor-dependency-candidates--audit-only-2026-11-12) records the evidence. First candidates are standalone SHA1 and Showdown, followed by checking whether Bootstrap JavaScript is needed. Base64 and hashchange are native-replacement candidates, but encoded settings, message logs, format titles, and navigation behavior must keep their contracts. jQuery/UI, DataTables, and the Markdown editor require dedicated interaction qualification.

Readable upstream sources at pinned existing versions are a desired follow-up, not a completed change. Preserve license/provenance information, component selection, and identifiable local patches. Do not combine obtaining readable source with a version upgrade or substitute prettified minified code for verified upstream source.

## Development rules

- Keep changes small and test the contract of the affected subsystem.
- Edit JavaScript in `src/js/admin/` or `src/js/storefront/`, then run `npm run build:js` or use `npm run dev`. Edit styles in `src/scss/`. Do not hand-edit the generated files under `dist/vend-proofing-core/js/` or `dist/vend-proofing-core/css/`; see the asset-development sections above.
- Match the tab-indented PHP style in touched files. Use named intermediate values and readable method bodies for new persistence code; keep SQL and multi-step writes easy to follow.
- Preserve gallery SUIDs, public URL structure, row formats, visual design, and low-friction email proofing unless a specific defect requires change.
- Do not treat order totals, payment status, or delivery eligibility supplied by a browser as authoritative.
- Do not run mail, payment, Dropbox, or destructive migration operations against live data during tests.
- Update [VEND-MODERNIZATION.md](VEND-MODERNIZATION.md) with decisions, tests, limitations, and the next step when a phase changes.
- Keep user-facing instructions in the [manual](MANUAL.md); agent workflow belongs in [AGENTS.md](../AGENTS.md).

## Payment development

Run `bash scripts/payment-smoke.sh` for synthetic, network-disabled PHP 8.4 payment tests. It exercises trusted prices, shipping/taxes, discount policy without case sensitivity, packages/downloads, offline/free orders, provider fixtures/signatures, duplicate and out-of-order callbacks, retries, eight concurrent submissions/events, refunds, receipt failures and entitlement. It never requires merchant credentials or makes a charge. The basic-set smoke now uses configured catalog prices for its order fixtures rather than arbitrary browser quotes.

`src/js/payments.js` owns provider SDK loading, the Stripe Elements modal, and shared PayPal/Venmo callbacks. Both storefront and invoice retries load its small `payments.js` bundle. `scripts/payment-ui-test.js` exercises those callbacks without provider traffic. Venmo uses provider `paypal`; its funding selection lives in the existing order snapshot and is retained on retries. No additional table or migration is needed. Stripe uses Checkout Sessions `ui_mode=custom` (the name supported by the pinned PHP SDK/API version) and Clover Stripe.js loaded directly from Stripe. Payment Element and Express Checkout Element share one native dialog; closing destroys its Elements without cancelling the server Session. The storefront submits the cart again after closing; unchanged contents and checkout details reuse the existing attempt, including after refresh. Invoice retries use `payment_start`. Confirmation reads and displays Stripe’s Session total, then retrieves verified server payment state before navigating to the invoice.

`CheckoutQuote` verifies the existing browser calculator against assigned catalog records and configuration. `OrderRecords` saves accepted selections/rules/amounts before a provider call using private `checkout` rows in the existing orders/items tables. These rows are excluded from invoice lookup, order search and statistics. `place()` promotes them only after verified payment (or manual submission), dates the order, redeems the discount and removes only matching purchased cart selections. Repeated events cannot clear the cart again. Packages and allocations stay together if edited. This reuses existing storage without new tables or migrations and retains the existing first 25 projected fields. Search rows append payment status, safe error code and refunded amount for admin. `Payments` owns provider attempts, event deduplication and fulfillment/notification claims; `StripePayment` and `PayPalPayment` independently verify remote state before reconciliation. `PaymentGateway` handles only the new checkout/provider actions before the existing Gateway dispatch. New admin payment actions still require `Auth` and its request token.

Migration 013 extends existing tables; no separate commerce database or queue service is introduced. Internal monetary snapshots retain Vend's hundredth-unit contract and adapters explicitly convert provider currency units. Provider calls and email sends stay outside SQLite write transactions. Failed/expired attempts retain their references when a safe replacement is created. An ambiguous creation older than the provider's conservative idempotency window requires review, rather than risking a duplicate charge. Only server-confirmed paid/free orders receive digital entitlement. Existing email-based invoice access remains, while direct processing requires the matching authorized order session and SQLite entitlement.

Use the new asset workflow above for payment UI edits. Sandbox/live credentials, webhook subscriptions, receipt recovery, pricing limits and external qualification procedures belong in the [manual](MANUAL.md#payment-setup). Do not put credentials in source, fixtures, generated JavaScript or diagnostic logs. Account-specific sandbox operations remain a separate verification step from mocks.

## Current sequence

Phase 1 established a PHP 8.4 smoke runtime and focused first-party fixes. Phase 2A established a representative real-world baseline using demo data. Phase 2B introduced single-admin authentication and a first public Gateway/media access boundary; the remaining direct routes and commerce actions still need review. The persistence foundation installs one SQLite schema. All application table records and saved JSON settings now use it, including customer proofing selections and orders; ZIP galleries are retired. Source JSON defaults, physical media, and disposable derivatives remain files. Payment providers and server-side pricing validation require their own qualification before release. The modernization log is the source of truth for progress within each phase.
