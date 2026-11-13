# Vend — Product Discovery and Technical Audit

Date: 2026-11-09  
Repository: `hypergeneric/vend-proofing`  
Scope: read-only product archaeology and preliminary technical/security assessment, followed by this requested documentation file.

This report preserves the findings of the initial audit and incorporates the original developer's subsequent clarifications. Where those clarifications change a recommendation, the revised interpretation is stated explicitly. It is an assessment and proposed roadmap, not authorization to implement changes.

> Asset source paths and PHP assembly routes below describe the original audit snapshot. For current source locations, static builds, and runtime configuration, use [Front-end asset build](DEVELOPMENT.md#front-end-asset-build).

## Evidence and scope

- **Source verified:** established by inspecting code, configuration, or record structure.
- **Developer confirmed:** historical behavior or product intent supplied by the original developer.
- **Uncertain:** requires runtime testing, representative examples, or a product decision.
- **Recommendation:** proposed future work, not something already implemented.

No application files were changed, dependencies installed, application requests executed, payments submitted, email sent, or exploits tested during this investigation. PHP was unavailable directly on the host; compatibility conclusions are static findings, not execution results. The only new deliverable is this Markdown report.

The inspected working tree already contained modifications to:

- `vend-proofing-core/js/vend/Overlay.js`
- `vend-proofing-core/js/vend/content/Display.js`
- `vend-proofing-core/js/vend/overlay/Browser.js`
- `vend-proofing-core/php/classes/getid3/demos/demo.mysqli.php`
- `vend-proofing-core/php/classes/simpleadmin/Order.php`
- `vend-proofing-core/php/vendor/mobiledetect/mobiledetectlib/docs/KNOWN_LIMITATIONS.md`

Those changes were left untouched. Findings refer to the current working copy; they should not all be attributed automatically to the shipped 2018 code.

The developer identifies **`e5e12a63afa31e05d85024b4a11f49b6452227f4` as the code shipped in 2018**, and reports a recreational PHP 7 update in 2023. Git records that baseline as an initial import dated 2022-03-23; the import date does not contradict the developer's shipping history. A detailed baseline-versus-current diff was not part of this follow-up.

Source links below are repository-relative. Line references describe the working copy at the time of inspection and may move with future changes.

## 1. Executive assessment

**Vend is a substantial photography proofing and sales application whose product behavior is worth preserving. It is not ready for public deployment in its present form.**

The repository contains a coherent storefront, a separate administration application, reusable PHP infrastructure, persistent proofing sessions, sophisticated print configuration, packages, discounts, order records, invoices, communications tools, and Dropbox digital fulfillment. Its age does not justify replacing the interface, JavaScript architecture, or commerce model wholesale.

The original developer confirms that this was commercially used software, with some installations operating for a decade or more. It was designed around shared hosting, including inode and memory limits. That operating history is important context; this should not be treated as an unfinished prototype simply because its infrastructure is custom.

The strongest reasons to change it are specific:

- Administrative authentication and public request authorization have serious defects.
- The server accepts browser-supplied monetary values rather than independently establishing an authorized price.
- Image delivery does not enforce gallery access or watermark policy.
- File persistence is vulnerable to concurrent updates and interrupted writes.
- Payment and Dropbox integrations need modernization.
- Deployment, recovery, and maintenance need a reproducible, documented operating model.

**The smallest sensible path is to preserve the product and repair its boundaries:** authentication, filesystem access, price authority, payment confirmation, and delivery authorization.

### Developer clarifications that constrain modernization

1. Physical print fulfillment was intentionally mostly manual. Automated lab submission and production-file generation are not missing promised features.
2. Dropbox digital downloads worked historically and were deliberately simple. Dropbox was the chosen digital fulfillment provider, not an accidental dependency.
3. Wedding photographers commonly supplied **20–50 MB JPEG originals**. The historical Dropbox “huge” thumbnail was a browsing derivative, not a replacement for the original.
4. Packages bundle selected photographs into defined format quantities. Products are packages without formats—for example, a boxed canvas.
5. Email-only proofing sessions are intentional. They lower barriers and let photographers see what customers select. More information is needed at ordering, not necessarily at browsing.
6. Prices and options were intended to be durable. The developer believes they were frozen in time, but does not recall the exact policy. Current row snapshots support that interpretation; complete behavior still needs testing.
7. The developer believes offline/unpaid orders should not release digital files. This remains a requirement to verify, not a confirmed server guarantee.
8. Membership/hub integrations should be removed where unnecessary or no longer viable.
9. The developer owns the first-party code. Third-party dependencies and their licenses remain separate distribution considerations.

**Correction to the initial security framing:** email-only session discovery is an accepted product tradeoff, not by itself a reason to require customer accounts or email verification. It does not justify unrestricted table/file access, forgeable administrator access, exposure of order information, or unpaid digital delivery. Those boundaries can be repaired while retaining the low-friction proofing experience.

## 2. Feature inventory

Status terminology:

- **Implemented:** substantial supporting code exists; present operation has not necessarily been tested.
- **Partially implemented:** a meaningful part exists, but the inspected path has gaps.
- **Uncertain:** completeness or present operation needs confirmation.
- **Legacy/broken:** a specific obsolete dependency or incompatible behavior affects the feature.

| Subsystem | Features found | Assessment |
|---|---|---|
| Gallery organization | Upload sets, category sets, Dropbox sets, ZIP-backed sets; cover images; sorting; duplication; gallery-wall inclusion; pinned sets | **Implemented.** Distinct content types, not merely navigation labels. |
| Gallery access | Shared passwords, expiration dates, welcome messages, set contact lists | **Implemented.** Access-token/password handling needs repair. |
| Bulk upload | Multiple files, directory drag-and-drop traversal, queued uploads, progress and size checking | **Implemented.** Recursively reads directory entries, including repeated `readEntries` calls. |
| Folder organization | Automatic categories from uploaded file paths | **Implemented with limitation.** Uses the immediate parent directory name rather than preserving arbitrary nested hierarchy. Repeated leaf names can collapse together. |
| ZIP galleries | Archive inspection, category/file indexes, entry-index extraction for previews | **Implemented; edge cases uncertain.** Folder entries and root-level photographs need representative tests. |
| Media | JPEG, PNG, GIF and other image types; video/audio entries; documents/fonts/assets; remote-media helpers | **Implemented framework support.** Extension acceptance does not prove full storefront behavior for each format. ZIP/Dropbox photograph import specifically filters JPEG/PNG. |
| Image processing | GD and optional Imagick; resize; thumbnail crop and offsets; sharpening; JPEG quality; asset watermarks; crosshairs; density variants; cached derivatives | **Implemented.** Delivery authorization and resource limits need repair. |
| Color treatment | Black-and-white and sepia previews | **Implemented in browser canvas.** Does not imply finished production-file export. |
| Proofing | Email-associated sessions, favorites, cart persistence, return/resume, admin session inspection | **Implemented; email-only identity intentional.** Arbitrary cross-record access is a separate defect. |
| Comments | Per-cart-item production comments and order comments | **Implemented.** A separate threaded discussion or image-annotation system was not established. |
| Physical prints | Format/aspect selection, quantity, paper, modifiers, crop orientation/position, toning, per-item shipping | **Implemented.** |
| Pricing | Reusable groups, gallery assignments, expressions based on area/quantity/base price | **Implemented.** Browser expression evaluation cannot remain the price authority. |
| Packages | Defined format quantities, allocation of chosen photographs, customer-named package instances, package totals | **Implemented and developer confirmed.** |
| Products | Package-like offerings without format allocations, such as boxed canvas | **Implemented and developer confirmed.** |
| Discounts | Global/gallery-specific codes, expiration, usage limits, minimum subtotal | **Implemented with correctness/security defects.** Usage is consumed during prequalification rather than confirmed payment. |
| Digital pricing | Individual original/web versions, all-image pricing, flat-fee versus per-image all-image pricing, favorites selection | **Implemented.** Download pricing groups are assigned to Dropbox sets. |
| Digital delivery | Dropbox original copies, lower-resolution uploads, order folders, shared links, progress, count reset, purge | **Implemented; historically worked.** Current authentication and authorization need modernization. |
| Local digital delivery | Authorized direct file delivery or locally generated download ZIPs | **Not established.** Inspected paid digital fulfillment is Dropbox-based. |
| Checkout | Customer/address collection, pickup, shipping/handling, international settings, minimums, tax options, policies/clickwrap | **Implemented.** Server enforcement needs work. |
| Payments | Offline ordering, PayPal redirect/IPN, Stripe through Omnipay | **Implemented; unsuitable as-is for release.** |
| Orders | Daily records, line-item snapshots, search, statistics, payment logs, deletion, invoices, production output | **Implemented.** |
| Print fulfillment | Instructions, image lists, previews, order output | **Implemented for manual fulfillment by design.** Automated lab submission is not a prerequisite. |
| Communications | Contact form builder, autoresponder, set invitations/sharing, bulk mail, message logs, expiration reminders, order email | **Implemented.** |
| Contacts | Set contact lists, session emails, internal mailing list, Mailchimp subscription | **Implemented.** Lightweight contact management, not a full CRM. |
| Localization | Admin language lookup, storefront language XML, editable labels/email templates, currency/date/country settings | **Implemented.** Translation completeness unverified. |
| Branding/design | XML-driven design, fonts/assets, splash content, policies, gallery presentation, soundtrack/music | **Implemented.** |
| Maintenance | Cache clearing, system/PHP information, backup archive, template refresh, update UI, scheduled reminders/purge | **Implemented, mixed readiness.** Backup is incomplete for recovery; some tools expose unsafe surfaces or historical services. |
| Historical integrations | Membership hub, WordPress authentication hooks, YouTube/Vimeo/Sketchfab helpers, Flash media | **Uncertain or legacy.** Remove unnecessary integration paths from the supported product. |

Key evidence: [content configuration](../dist/vend-proofing-config.xml), [gallery settings](../dist/vend-proofing-core/defaults/uploadset.xml), [ordering settings](../dist/vend-proofing-core/defaults/ordering.xml), [download settings](../dist/vend-proofing-core/defaults/downloads.xml).

Less-visible capabilities include folder-derived categories, formula pricing, session inspection, production output, download resets, expiration mail, custom contact forms, and order statistics.

### Package/product examples supplied by the developer

The supplied screenshots establish the intended workflow:

- A package definition has a title, optional image, price, flat shipping cost, and Markdown/HTML description.
- “High School Senior” is shown as a $300 package containing five 5×7 prints and one 8×10 print.
- The customer names an instance (“My Package”), adds it, and allocates photographs to its available formats.
- The image sidebar switches between that package and à-la-carte shopping and displays remaining format quantities.
- Color/tone and comments remain available during selection.

Products use the package concept without format allocations. These screenshots are evidence of product behavior supplied by the developer, not a new runtime test. They are described here rather than linked to temporary clipboard files that may disappear.

## 3. Architecture summary

### Entry points and request lifecycle

The public wrappers are `index.php` → `vend-proofing-index.php`, `vend-proofing-gateway.php`, and `vend-proofing-resample.php`.

[common.php](../dist/vend-proofing-core/php/common.php) defines paths/permissions, includes getID3/PclZip/Composer dependencies, registers the framework autoloader, loads configuration XML, and initializes language/server handling.

`Page` parses query-path routes such as `?/order/...`, chooses HTML/JS/CSS/XML output, loads configuration/tables, and includes templates. `LocalPage` supplies Vend-specific gallery identification, password, expiration, and homepage behavior. Evidence: [Page.php:292](../dist/vend-proofing-core/php/classes/simpleadmin/Page.php#L292), [render.page.php:90](../dist/vend-proofing-core/php/render.page.php#L90).

### Generic Gateway versus LocalGateway

`Gateway` supplies authentication, generic XML/table/file CRUD, uploads, account management, and system tools. `LocalGateway extends Gateway` adds sessions, cart changes, discounts, orders, ZIP indexing, Dropbox operations, and communications.

Execution:

1. Construct Gateway and merge GET/POST parameters.
2. Authenticate.
3. Dispatch private actions if authenticated.
4. Dispatch public actions.
5. Return XML, tabular text, raw text, or file content.

Subclass handlers fall back to the parent. Responses generally terminate execution, explaining switch cases that deliberately omit `break`. Private/public classification is a useful seam, but public business actions still need narrowly defined permissions. See [Gateway.php:11](../dist/vend-proofing-core/php/classes/simpleadmin/Gateway.php#L11) and [gateway.php:496](../dist/vend-proofing-core/php/gateway.php#L496).

### Flat-file storage and formats

| Record | Representation |
|---|---|
| Global/gallery configuration | XML |
| Collections | `set.<name>.table` |
| Image metadata | `<gallery>/image.table` |
| Gallery categories | `<gallery>/set.category.table` |
| Session directory | `<gallery>/set.session.table` |
| Session contents | `<gallery>/set.<email-hash>.table` |
| Orders | `orders/<year>/<month>/<day>/set.order.table` |
| Order line items | Same dated directory, `set.<order-id>.table` |
| ID allocator | `suid.index` |
| Payment history | Per-order `.payment.log` |
| Media | Files alongside metadata, or archives under `uploads` |
| Derivatives/page cache | `temp` and `cache` |

Tables are newline-separated rows and tab-separated fields, keyed by the first column. Indexes are application-maintained tables and a sequential hexadecimal ID allocator rather than database indexes. XML falls back to default files when local configuration does not exist.

[Flatfile.php:426](../dist/vend-proofing-core/php/classes/simpleadmin/Flatfile.php#L426) is a plausible preservation boundary. It reads and rewrites entire tables. `Filesystem::makeFile()` locks after opening the target in truncating mode; the earlier read and later write are not one transaction. Lost updates and interrupted writes remain risks despite the existing `flock`. See [Filesystem.php:56](../dist/vend-proofing-core/php/classes/simpleadmin/Filesystem.php#L56).

### PHP/JavaScript communication

This is not a JSON REST application. Templates emit HTML, JavaScript configuration, localized strings, and pricing. JavaScript posts named Gateway actions. Responses include XML envelopes and compact tabular strings. Positional commerce records are shared by JavaScript, PHP, invoice output, and delivery code.

That record contract is tightly coupled and should be documented before changing it. [Session.js:34](../dist/vend-proofing-core/js/vend/Session.js#L34) explicitly lists cart/download/favorite/package fields.

### Customer application

The storefront uses constructor functions, closures, prototypes, custom `EventDispatcher`, and shared application objects:

- `Shell` and `StageProxy`: application shell/stage concerns.
- `Display`: gallery and session entry.
- `Overlay`, `Browser`, `Sidebar`: browsing and print configuration.
- `Session`: favorites/cart/package/download state.
- `Checkout`: totals and checkout interaction.

Session responses are parsed into lookup arrays and hashes, then notify components through events. Browser state, server session records, and DOM state cooperate rather than using a centralized modern state library.

### Administration lifecycle

Administration is a separate SPA with applications, panels, dialogs, XML-driven controls, and hash navigation. `Admin` destroys the previous application and initializes the next. Components register/unregister DOM and custom event handlers. See [Admin.js:296](../dist/vend-proofing-core/admin/js/classes/Admin.js#L296) and [History.js](../dist/vend-proofing-core/admin/js/classes/helpers/History.js).

This is comprehensible architecture. It has no inherent need for replacement with a current frontend framework.

### Assets, localization, configuration

- Admin scripts are concatenated using PHP `readfile()` and directory iteration.
- Storefront JS generation writes `vend-core.js` and `vend.js` into the application source tree.
- Admin assembly includes the panels directory twice.
- XML attributes describe control types, options, encoding, privacy, and editor behavior.
- Admin language lookup is separate from editable storefront language XML and template-generated JavaScript localization.

Evidence: [storefront assembly](../dist/vend-proofing-core/tmpl/js/1.page.vend.tmpl), [admin assembly](../dist/vend-proofing-core/tmpl/js/1.page.admin.tmpl), [Lang.php](../dist/vend-proofing-core/php/classes/simpleadmin/Lang.php), [language defaults](../dist/vend-proofing-core/defaults/language.xml).

Build-time asset generation would permit immutable application containers without changing the interface.

### Images and caching

`Graphic` generates derivatives using GD or optional Imagick. Its parameter-derived hash identifies cached output; it does not authenticate the request. ZIP-backed photographs can be extracted by archive index for transformation. Existing derivatives can be served directly. Source replacement/cache invalidation behavior needs regression testing because cache identity is primarily based on transformation parameters.

### Boundaries and coupling

Relatively independent subsystems: image engine, email transport, payment adapter, deployment packaging, asset assembly, low-level persistence.

More tightly coupled subsystems: positional commerce records; client pricing and checkout; Dropbox metadata and fulfillment; XML schemas/admin controls; authentication tokens/frontend helpers.

The `simpleadmin` directory is not exclusively reusable framework code: `Order` and `Dropboxer` contain Vend-specific behavior.

## 4. Six workflow traces

### 4.1 Upload a folder of hundreds of photographs

1. Admin `Upload.js` recursively walks dropped directory entries.
2. Entries are appended in batches and enter the upload queue.
3. `Auth.upload()` submits each file with `action=image_upload`, gallery `suid`, and original `path`.
4. Generic Gateway routes to `Flatfile::uploadFile()`.
5. Extension checks run; a normalized filename plus generated ID is stored.
6. Image dimensions/media metadata are collected.
7. Vend hooks attach a category derived from the immediate parent directory.
8. `image.table`, `set.category.table`, and the global page image count are updated.
9. Subsequent viewing generates derivatives on demand.

Evidence: [Upload.js:70](../dist/vend-proofing-core/admin/js/classes/dialogs/Upload.js#L70), [Upload.js:343](../dist/vend-proofing-core/admin/js/classes/dialogs/Upload.js#L343), [Flatfile.php:233](../dist/vend-proofing-core/php/classes/simpleadmin/Flatfile.php#L233), [gateway.php:1203](../dist/vend-proofing-core/php/gateway.php#L1203).

Arbitrary depth is traversed but flattened into categories; repeated leaf names can collide. The upload path retains originals. A resumable byte-chunk upload protocol was not found.

ZIP sets have a separate pipeline: `verify_zip_file` inspects `uploads/<suid>.zip`, writes category/archive-entry indexes, and later extracts individual entries for previews. Removing archive paths is a real mitigation against ordinary ZIP traversal. Expansion/file-count/pixel limits still need attention. Root-level files and archives with unusual directory entries require fixtures. See [gateway.php:142](../dist/vend-proofing-core/php/gateway.php#L142).

The 20–50 MB original size supplied by the developer makes memory and upload behavior a release concern. Compressed file size is not a reliable bound on decoded image memory. Test dimensions, processing peak memory, timeout behavior, derivative count, and inode growth—not just total disk capacity.

### 4.2 Open a gallery, favorite images, and return

1. Page rendering checks gallery password/expiration.
2. `Display` asks for an email address.
3. `open_session` validates syntax and derives `md5(email)`.
4. The gallery's `set.session.table` is created/updated.
5. `Session.setHash()` establishes the session key.
6. Favorite changes use `update_session_item`; favorite rows end in `-f`.
7. The same email resumes the same session.
8. `list_session_table` restores favorites/cart data.

Evidence: [Display.js:447](../dist/vend-proofing-core/js/vend/content/Display.js#L447), [gateway.php:941](../dist/vend-proofing-core/php/gateway.php#L941), [Session.js:253](../dist/vend-proofing-core/js/vend/Session.js#L253).

**Preserve email-only entry unless the developer chooses otherwise.** It is intentionally a convenient proofing identity, not a verified customer account. Restrict requests to permitted session operations and gallery context; do not allow arbitrary table names/paths. Ordering and download authorization need their own stronger boundaries.

### 4.3 Choose print format, crop, and treatment

1. The page loads the gallery's assigned format, paper, modifier, product, and package groups.
2. `Sidebar` computes selections and preview prices.
3. Pricing substitutes `A` for area, `Q` for quantity, and `P` for base price.
4. `Browser` positions a crop overlay and converts position into percentage offsets.
5. Canvas applies mono/sepia preview matrices.
6. Cart rows retain format/aspect, orientation, offsets, toning, paper, modifiers, comments, quantity, and monetary values.

Evidence: [Sidebar.js:104](../dist/vend-proofing-core/js/vend/overlay/Sidebar.js#L104), [Browser.js:77](../dist/vend-proofing-core/js/vend/overlay/Browser.js#L77), [Func.js:20](../dist/vend-proofing-core/js/vend/helpers/Func.js#L20).

**The selection records production instructions.** PHP generates resized/cropped preview derivatives and order output presents the selections. No complete export pipeline producing final print-resolution cropped/toned files was found. The developer confirms that manual fulfillment was intended; automatic export is optional future work.

### 4.4 Purchase physical prints

1. Cart rows persist through session actions.
2. `Checkout` gathers customer/shipping information and calculates totals.
3. `prequalify_order` checks email/discount eligibility and allocates an order ID.
4. Payment follows offline `finalize_order`, Stripe `process_credit_card`, or PayPal/IPN.
5. `Order::process()` invokes the payment path and records successful orders.
6. `createOrder()` copies line items into dated order storage and leaves favorites in the active session.
7. Email, invoice, and production output use those saved records.
8. The photographer fulfills prints manually.

Evidence: [gateway.php:523](../dist/vend-proofing-core/php/gateway.php#L523), [Order.php:301](../dist/vend-proofing-core/php/classes/simpleadmin/Order.php#L301), [Order.php:518](../dist/vend-proofing-core/php/classes/simpleadmin/Order.php#L518).

The critical gap is authoritative pricing/payment state, not the absence of a print lab. Server-created, durable quotes can preserve the intended frozen-price behavior. Offline order acceptance must remain distinguishable from payment confirmation.

### 4.5 Purchase digital photographs through Dropbox

1. Dropbox synchronization lists remote images and creates local image/category records.
2. `next_dropbox_chunk` fetches “huge” JPEG thumbnails for browsing.
3. Original Dropbox paths remain in image metadata.
4. Download choices produce `-d` session rows with quality and price.
5. Checkout creates an order.
6. Invoice processing calls `start`, `next`, and `download` order routes.
7. `getImageData()` creates an order-copy list.
8. High-resolution items copy within Dropbox; low-resolution items upload the local preview file.
9. Files enter order folders, with approximately 1 GB grouping logic.
10. Shared links are returned; flags retain progress and link issuance count.
11. Reset/notification and purge paths manage later delivery.

Evidence: [Dropboxer.php:145](../dist/vend-proofing-core/php/classes/simpleadmin/Dropboxer.php#L145), [Dropboxer.php:191](../dist/vend-proofing-core/php/classes/simpleadmin/Dropboxer.php#L191), [Dropboxer.php:283](../dist/vend-proofing-core/php/classes/simpleadmin/Dropboxer.php#L283), [order processing:106](../dist/vend-proofing-core/tmpl/html/1.page.order.tmpl#L106).

**Actual files are delivered here:** originals are copied, and local previews provide lower-resolution delivery. Physical-print crop/toning selections are not applied by this path. The developer confirms historical success; present API operation remains untested.

Synchronization also recreates image records and deletes existing session records. That destructive refresh behavior needs explicit tests and a decision about preserving in-progress customer selections. See [Dropboxer.php:51](../dist/vend-proofing-core/php/classes/simpleadmin/Dropboxer.php#L51).

#### What download limits were found?

This is a specific implementation detail, not a proposed requirement:

- [2.order.invoice.tmpl:341](../dist/vend-proofing-core/tmpl/html/2.order.invoice.tmpl#L341) checks whether the first order flag is less than **3**.
- After that threshold, the UI offers a reset path instead of the ordinary download-link action.
- [Dropboxer::getShareLinks():335](../dist/vend-proofing-core/php/classes/simpleadmin/Dropboxer.php#L335) increments that flag when it returns shared links.
- `resetDownloadCount()` sets the flag back to zero.
- Flags are stored in the Dropbox order folder's `info.txt`.

This counts requests to show/issue shared links, **not actual Dropbox file downloads**. It does not revoke previously issued public shared links. The developer does not recall the intended policy. Do not carry this limit forward automatically; decide whether it served an operational purpose worth preserving.

The initial audit treated weak download enforcement as a security issue in broad terms. The more important release requirements are that unpaid/unauthorized visitors cannot obtain delivery links and that retention behavior is predictable. A strict consumption count is optional.

### 4.6 Change pricing, discounts, or packages

1. Admin applications open specialized editors or XML panels.
2. `set_create`/`set_update` saves format/paper/modifier/package/product/discount tables.
3. Download settings use `setup_save`.
4. Gallery XML references pricing-group IDs.
5. Storefront rendering reads those groups and emits browser configuration.
6. Discount validation reads current local/global discount tables.

Evidence: [Gateway.php:886](../dist/vend-proofing-core/php/classes/simpleadmin/Gateway.php#L886), [2.content.display.tmpl:114](../dist/vend-proofing-core/tmpl/html/2.content.display.tmpl#L114), [Order.php:203](../dist/vend-proofing-core/php/classes/simpleadmin/Order.php#L203).

Newly rendered pages receive current definitions. Open browsers and saved cart rows can retain earlier values. The developer intended durable prices/options, probably frozen in time. **Do not automatically replace that behavior with checkout repricing.** Instead, test the historical behavior and select a server-authorized quote/version policy that preserves the chosen durability guarantee. Arbitrary client-supplied price snapshots remain unsafe regardless of the policy.

## 5. Dependencies and compatibility

### PHP 8.4+

The repository is not uniformly frozen in 2018: later dependency versions and getID3 1.9.22 from 2022 are present. `.lando.yml` targets PHP 7.4. The developer reports a PHP 7 modernization in 2023.

| Finding | Significance |
|---|---|
| Cron calls `count($recipients)` on a string | Concrete PHP 8 failure on that path. |
| Optional parameters before required parameters in `Flatfile`/`Dropboxer` | Compatibility cleanup; omitted-argument behavior requires call-site review. |
| Missing XML values return `null`, often passed into string operations | Deprecation noise and stricter-type failure risks require systematic checking. |
| PHPMailer extras contain removed curly-brace offset syntax | Those files cannot parse on PHP 8; does not prove ordinary sending loads them. |
| PHPMailer contains `get_magic_quotes_runtime()` | The inspected call is version-guarded, not an unconditional blocker. |
| Order code mixes millisecond timestamps and second-based date operations | Existing correctness concern independent of PHP age. |
| Extensive `@` suppression | Can obscure filesystem failures and cannot suppress all modern exceptions. |

A full syntax and execution matrix remains necessary. Static inspection supports neither “PHP 8 cannot run this” nor “only a version bump is needed.” Dynamic-property creation, null arguments, signatures, numeric conversions, and dependency code should be checked against the supported runtime.

References: [PHP 8 migration](https://www.php.net/manual/en/migration80.incompatible.php), [PHP 8.1 deprecations](https://www.php.net/manual/en/migration81.deprecated.php), [PHP 8.2 deprecations](https://www.php.net/manual/en/migration82.deprecated.php), [PHP 8.4 deprecations](https://www.php.net/manual/en/migration84.deprecated.php).

### PHP libraries and services

| Dependency | Inspected version/state | Treatment |
|---|---|---|
| PHPMailer | 5.2.28 | Upgrade while retaining `Email` behavior; this branch no longer receives security updates. |
| Omnipay Stripe/common | 2.4.7 / 2.5.2 | Replace raw-card payment boundary with modern payment lifecycle/hosted or tokenized collection. |
| Guzzle | Both 3.9.3 and 7.5.0 | Remove old dependency chain through adapter updates; not all requests use Guzzle 3. |
| Dropbox SDK | 0.4.1 | Update authentication/token lifecycle and verify endpoints. |
| Symfony | HTTP Foundation 3.4.47; Event Dispatcher 2.8.52 | Re-resolve supported dependency versions and test active paths. |
| Mailchimp wrapper | 2.5.4 | Wrapper version is not API version; lists/member endpoint code exists. Verify rather than label dead. |
| Markdown/Mobile Detect | 1.9.1 / 2.8.39 | Update as needed with rendering/device regression tests. |
| getID3/PclZip | Bundled source | Review parser limits and active paths; exclude demos/helper executables from runtime distribution. |

Evidence: [composer.json](../dist/vend-proofing-core/php/composer.json), [composer.lock](../dist/vend-proofing-core/php/composer.lock). External references: [PHPMailer support policy](https://github.com/PHPMailer/PHPMailer), [Stripe integration guidance](https://support.stripe.com/questions/check-your-integration-for-strong-customer-authentication-%28sca%29-compliance?locale=en-GB).

**Dropbox:** the application exchanges a code once and reuses its stored access token indefinitely. No refresh lifecycle exists. New installations need current short-lived access tokens and offline refresh handling. This is not an API-v1-only implementation: several calls already use API-v2-style endpoints. See [Dropbox authorization](https://docs.dropboxapi.com/dropbox-api/docs/get-started/authorization).

**PayPal:** IPN is legacy but not automatically unavailable. Vend's verification/reconciliation defects matter more than age alone. PayPal still documents IPN: [official documentation](https://developer.paypal.com/api/nvp-soap/ipn/IPNIntro).

### Browser compatibility

Both jQuery copies identify as 2.0.3. Browser detection, hashchange, drag handlers, jPlayer, Bootstrap/jQuery UI, and bundled plugins need measured review/updates.

Prototype functions, closures, canvas, and hash navigation remain viable primitives. Test directory drag-and-drop, touch gestures, viewport sizing, audio autoplay, canvas origin restrictions, keyboard operation, and component destruction. Flash-dependent media paths are historical baggage, not evidence that the main storefront requires Flash.

### Server, container, HTTPS, and mail concerns

- Apache `.htaccess` protections must be implemented explicitly under another server.
- Source-tree writes for generated JavaScript conflict with immutable containers.
- Apache permission defaults include `0666`/`0777`; use explicit ownership and narrow permissions instead.
- URL/protocol detection includes historical server-variable assumptions; reverse-proxy HTTPS needs verification.
- SMTP is already implemented. A container need not run a local mail server.
- Credentials in XML are sometimes base64-encoded; that is not encryption.
- The application needs filesystem persistence, image/XML processing, HTTP/TLS support, and appropriate PHP extensions. Determine exact required extensions from the supported feature subset during packaging.
- Standalone mode does not inherently need the old hub. Remove unnecessary membership/update/support dependencies rather than recreating a central Vend service.

## 6. Prioritized preliminary security findings

“Confirmed” means the unsafe source behavior is established; exploits were not executed. Severity estimates assume a public deployment and are not formal CVSS scores.

| Severity | Finding and source evidence | Confidence/qualification |
|---|---|---|
| **Critical** | Standalone admin token validation compares a client cookie to `md5(product_key)` and `sha1(client-supplied token)` without a server-side authenticated session. Supplied config has an empty key. [Auth.php:114](../dist/vend-proofing-core/php/classes/simpleadmin/Auth.php#L114) | **Confirmed design flaw.** An unknown deployment key changes prerequisites, not the underlying design. |
| **Critical** | Public `get_public_asset` applies `basename()` to filename but interpolates unchecked `folder`, then streams any existing file. [gateway.php:500](../dist/vend-proofing-core/php/gateway.php#L500) | **Confirmed traversal/file read.** Filesystem permissions bound exposure; web directory rules do not constrain PHP reads. |
| **Critical** | Public session actions interpolate gallery/table identifiers without ownership or session-table restrictions. [gateway.php:598](../dist/vend-proofing-core/php/gateway.php#L598), [792](../dist/vend-proofing-core/php/gateway.php#L792) | **Confirmed disclosure/tampering/path exposure.** Distinct from intentional email-only proofing. |
| **Critical** | Browser supplies monetary session/order fields; Stripe charges submitted `gross`. [Order.php:294](../dist/vend-proofing-core/php/classes/simpleadmin/Order.php#L294), [584](../dist/vend-proofing-core/php/classes/simpleadmin/Order.php#L584) | **Confirmed.** Server-created durable quotes can preserve frozen pricing safely. |
| **High** | Image requests control dimensions/watermark/cache; hex `hash` is not a signature; original output is possible. [Graphic.php:70](../dist/vend-proofing-core/php/classes/simpleadmin/Graphic.php#L70), [540](../dist/vend-proofing-core/php/classes/simpleadmin/Graphic.php#L540) | **Confirmed.** Endpoint does not enforce gallery access. |
| **High** | Dropbox processing executes before invoice access checks; `next`/`download` use URL order IDs; reset uses `md5(orderid)`. [1.page.order.tmpl:106](../dist/vend-proofing-core/tmpl/html/1.page.order.tmpl#L106) | **Confirmed missing checks.** Impact depends on configuration/existing order folders. |
| **High** | PayPal success defaults true; an established socket with neither recognized reply can leave it true. No authoritative recipient/amount/currency reconciliation or transaction deduplication is evident. [Order.php:653](../dist/vend-proofing-core/php/classes/simpleadmin/Order.php#L653) | **Confirmed logic defects.** Specific network/provider exploitation conditions untested. |
| **High** | Admin passwords use fast unsalted hash composition; gallery passwords are base64; invoice access uses email MD5. [Gateway.php:82](../dist/vend-proofing-core/php/classes/simpleadmin/Gateway.php#L82), [invoice check:248](../dist/vend-proofing-core/tmpl/html/1.page.order.tmpl#L248) | **Confirmed.** Separate administrator/order security from intentionally convenient proofing identity. |
| **High** | Persisted comment is inserted unescaped into constructed `<textarea>` HTML. [Sidebar.js:227](../dist/vend-proofing-core/js/vend/overlay/Sidebar.js#L227) | **Confirmed unsafe sink.** Browser exploit not executed; some invoice fields are correctly escaped. |
| **High operational risk** | Table/ID read–modify–write lacks transaction-wide locking; files truncate before locking. [Flatfile.php:7](../dist/vend-proofing-core/php/classes/simpleadmin/Flatfile.php#L7), [Filesystem.php:56](../dist/vend-proofing-core/php/classes/simpleadmin/Filesystem.php#L56) | **Confirmed correctness defect.** Can affect orders, sessions, identifiers, discount usage. |
| **Medium–High** | Public image work, contact mail, sessions, and enabled cron lack evident rate/work limits. | **Confirmed missing safeguards; capacity impact unmeasured.** Cron sends reminders and purges Dropbox order folders. |
| **Medium** | Public `system_phpinfo` exposes `phpinfo()` in non-hub installations. [Gateway.php:193](../dist/vend-proofing-core/php/classes/simpleadmin/Gateway.php#L193) | **Confirmed information disclosure.** |
| **Medium–High, conditional** | Sideload fetches follow redirects without destination restrictions/finite connect timeout; custom JSON conversion uses `eval`. [SideLoad.php:122](../dist/vend-proofing-core/php/classes/simpleadmin/SideLoad.php#L122) | Unsafe primitives verified. SSRF/code-execution exploitability depends on reachable branches and attacker influence; not proven. |

### Additional boundaries

- **Email-only proofing:** intentional product tradeoff. Do not label the absence of verified email as a release blocker in itself. Clarify that anyone knowing an address and having appropriate gallery access may resume its selections. Prevent arbitrary storage access and keep sensitive order/delivery authority separate.
- **CSRF:** admin requests have a token mechanism; “no protection anywhere” would be inaccurate. Its authentication foundation is flawed, public mutations lack meaningful scope checks, and GET/POST merging permits mutation through GET parameters.
- **Uploads/ZIPs:** allowlists exist, but include active HTML/JS assets; `checkFileSize` has commented-out rejection paths. Add per-type MIME/content validation, non-executable storage, expansion/file-count limits, and pixel budgets. Arbitrary PHP upload was not established as an independent vulnerability. ZIP path removal is a meaningful mitigation already present.
- **Secrets:** XML privacy filtering exists, but file reads bypass it. No live credentials are reproduced in this report.
- **Cards:** PAN/CVV reach Vend PHP. Ordinary order records were not shown deliberately storing PAN/CVV, but accepting raw card data unnecessarily expands the sensitive processing boundary.
- **Injection:** there is no primary SQL database, so filesystem/record/HTML injection matters more than generic SQL-injection concerns. TSV serialization also needs field validation and delimiter-safe handling.
- **Cookies:** authentication cookies lack explicit modern security attributes; logout removes a browser cookie rather than revoking a server session.
- **Dependencies:** old versions justify an advisory review, not invented claims that every historical vulnerability is reachable.

## 7. Preservation, deployment, and ownership

### What should remain intact

| Preserve | Conditions |
|---|---|
| Visual design and interaction model | Capture baseline screens and workflows before browser/library changes. |
| JavaScript component architecture | Retain lifecycle/events; repair unsafe sinks and brittle dependency behavior. |
| Gallery/catalog concepts | Preserve categories, pricing groups, packages/products, favorites, comments, production instructions. |
| Email-only proofing | Keep low-friction entry; constrain permissible records/actions and separate ordering authority. |
| Durable prices/options | Establish server-authorized snapshots/quotes rather than silently repricing or trusting browser values. |
| Flat-file persistence initially | Add path confinement, schemas, atomic replacement, transaction locks, versioning, recovery tests. |
| GD/Imagick engine | Enforce policy/authorization, bounded workloads, and cache correctness. |
| XML-driven configuration | Document schemas and separate secrets from renderable configuration. |
| Manual print fulfillment | Preserve production output; automatic lab integration is optional. |
| Small standalone footprint | No evidence justifies mandatory Redis, database server, or hosted control plane. |

Replace custom administrative authentication, raw-card collection, unrestricted public storage actions, and indefinite Dropbox-token reuse. Each has a specific benefit independent of coding style.

Flat files are reasonable for an initial single-host product. If safe transactional order/payment behavior becomes awkward, SQLite is a narrowly scoped alternative without a remote database service. Do not migrate storage solely because it is unusual.

### Smallest practical modern deployment

- One application container using PHP/Apache, or PHP-FPM with an explicitly configured web server.
- HTTPS termination and trusted-proxy handling.
- Local persistent volumes for originals, records, secrets, and required session state.
- Separate disposable derivative/cache storage.
- Customer-owned SMTP and payment accounts.
- A small scheduled task for maintenance/reminders.
- No central Vend authentication, licensing, or mandatory subscription.
- Immutable code/assets built during release packaging.

Local storage is sufficient for initial gallery hosting and manual print fulfillment. Local digital delivery would require a new authorized path; it is not established as an existing feature. Dropbox can remain an optional adapter if retained digital delivery is modernized. S3-compatible storage is another optional extension, not an initial infrastructure requirement.

The historical Dropbox split between browsing derivatives and large originals is valuable. Avoid a design that repeatedly decodes every 20–50 MB original during normal browsing or creates uncontrolled numbers of derivatives/inodes.

AI-assisted installation can validate DNS, permissions, volumes, SMTP, and backups. It should produce an ordinary documented installation that the customer can run without an agent or a service operated by the original developer.

### Backup and recovery

The existing backup action is **not a complete disaster-recovery backup**. It largely includes XML/tables/indexes/logs and selected asset/audio files, excluding gallery photographs. It archives storage rather than all deployment state. Evidence: [gateway.php:1157](../dist/vend-proofing-core/php/gateway.php#L1157).

A complete recovery set includes:

- Original media and uploaded ZIP archives.
- Catalog/configuration, sessions, orders, and ID allocator.
- Authentication state and separately protected secrets.
- Deployment version and configuration.
- Remote-storage mappings and recovery instructions.
- A consistent snapshot or temporarily quiesced writer.
- A tested restore onto a fresh installation.

Derivatives can usually be regenerated. Dropbox previews cannot replace remote originals. Backup retention, disk-full handling, and inode consumption should be evaluated as part of the product's operating model.

### Ownership and distribution

The developer confirms ownership of all first-party code. A first-party ownership investigation is therefore not an unresolved blocker. Review licenses/notices for third-party code and packaged assets, and update the historical EULA for the chosen redistribution terms. No central license-checking service is required by the proposed model.

## 8. Commercial readiness and modernization roadmap

| Phase | Work | Exit condition |
|---|---|---|
| 1. Establish baseline | Preserve current changes; compare historical baseline; use sanitized representative data; run isolated baseline; document schemas/screens | Six workflows have reproducible fixtures and observed outcomes |
| 2. Repair trust boundaries | Server-backed admin sessions, password hashing, scoped action/record access, confined files, protected originals, safe HTML, remove diagnostics | Negative authorization tests prevent access to unrelated records/files |
| 3. Make persistence reliable | Atomic writes, transaction locks, safe IDs, explicit order/payment state, backup/restore | Concurrent/interrupted work does not lose or duplicate orders |
| 4. Establish authoritative durable commerce | Server-authorized quote snapshots, validated choices, money rounding, tax/shipping rules, discount accounting | Client changes cannot alter authorized prices; documented durability policy survives catalog edits |
| 5. Modernize integrations | Maintained mail dependencies, hosted/tokenized payment collection, verified idempotent callbacks, Dropbox refresh if retained | Sandbox success/failure/retry scenarios pass |
| 6. Qualify supported fulfillment | Validate manual print output; secure retained Dropbox and/or choose local delivery; enforce unpaid/refund rules | Every advertised delivery path works end to end |
| 7. Package and qualify | PHP 8.4+, browser updates, build-time assets, immutable container, install/update/recovery documentation | Fresh installation and restore succeed without developer intervention |

**Critical blockers:** administrator authentication; scoped public actions; file/image protection; authoritative prices/payment state; reliable order persistence; secure delivery for advertised digital features.

**Important compatibility work:** PHP behavior, dependencies, browser regression, SMTP, HTTPS/proxies, deterministic assets, installation/recovery, large-image resource limits.

**Optional improvements:** S3, lab integration, finished print-file export, broader media, framework migration, hosted administration, distributed infrastructure, strict download-consumption limits.

**Likely low-change features:** gallery organization, pricing concepts, package interaction, favorites UX, design controls, localization editing, order search, manual production views. They still need regression testing.

No feature expansion is required simply to resemble hosted proofing competitors. A secure independently hosted release of the existing product is a coherent objective.

## 9. First 48 hours of a future implementation engagement

These are proposals, not actions performed during this audit.

1. **Hours 0–4:** preserve current modifications; identify intentional changes; establish the developer-specified 2018 baseline; choose sanitized demo records and expected visual examples.
2. **Hours 4–12:** run an isolated baseline with outbound email/payments disabled. Exercise the six workflows and record errors, screenshots, record changes, memory, and timings.
3. **Hours 12–20:** run PHP 8.4 syntax/compatibility checks and dependency advisory review; distinguish active failures from unused examples.
4. **Hours 20–30:** construct negative fixtures for administrative authentication, record/path scoping, image policy, price tampering, callback retries, and delivery authorization. Keep email-only proofing as the accepted baseline.
5. **Hours 30–40:** test concurrent writes, interrupted writes, restore, 20–50 MB images, ZIP limits, and cache/inode growth. Document price snapshots and payment states.
6. **Hours 40–48:** review evidence against intended behavior and select the first bounded implementation slice: administrative authentication plus filesystem/action authorization.

Do not spend the first two days redesigning screens or choosing a replacement frontend framework.

## 10. Sample data and remaining questions

### Demo data discovered

Developer-supplied location:

```text
/mnt/Data/Projects/Development/intothedarkroom/demos/en/application/vend-proofing/vend-proofing-data
```

A read-only structural inventory found:

| Item | Count/detail |
|---|---|
| Files | 2,989 |
| Total file bytes | 432,240,834 (about 432 MB decimal) |
| JPEGs | 2,731 |
| PNGs | 4 |
| XML documents | 25 |
| Table files | 197 |
| Logs | 22 |
| MP3s | 3 |
| Archives | One `.zip` and one `.zip.old` |
| Gallery rows | 16: 11 DropboxSet, 3 UploadSet, 1 ZipFile, 1 CategorySet |
| Pricing-group rows | 2 format groups, 1 paper group, 1 modifier group, 3 package groups, 1 product group, 4 download groups |
| Order tables | 16 dated `set.order.table` files, plus separate order line-item tables |

The data also contains image/category indexes, session tables, discounts, package line items, product definitions, tax charts, configuration, authentication files, and cached derivatives.

**This is useful fixture material:** it covers every gallery type and real persistence relationships. No authentication contents, service secrets, customer identities, or payment-log contents were copied into this report. Counts establish structure, not data integrity, archive integrity, or current availability of remote Dropbox originals. A sanitized copy should be used for runtime tests; do not enable old integrations against the original demo data accidentally.

### Resolved questions from the initial audit

| Original question | Developer answer / consequence |
|---|---|
| Which code shipped? | `e5e12a63afa31e05d85024b4a11f49b6452227f4` represents 2018 shipment; PHP 7 update followed in 2023. |
| Was print fulfillment manual? | Yes, mostly. Preserve that operating model. |
| Were downloads deliberately Dropbox-only? | Yes. Historical digital delivery worked. |
| Packages versus products? | Packages allocate photos to format quantities; products are packages without formats. |
| Is email-only proofing intentional? | Yes. Preserve low friction; collect more information at ordering. |
| Frozen prices? | Probably; durability was an explicit goal. Exact behavior still needs testing. |
| Unpaid digital delivery? | Developer believes it should not occur. Verify/enforce before release. |
| Intended infrastructure? | Shared hosting with inode/memory limits; some installations lasted a decade or more. |
| Representative data? | Demo dataset above exists and is useful structurally. |
| Hub integrations? | Membership infrastructure; remove unnecessary/non-viable paths. |
| Download limits? | Developer does not recall. Code contains a three-link-issuance UI threshold, described above. |
| First-party ownership? | Developer wrote and owns first-party code; third-party components remain separately licensed. |

### Remaining questions worth answering

1. Which current working-tree modifications are intentional and should become the modernization baseline?
2. Does durable pricing begin when an item is added, when a package instance is created, or when checkout is submitted? What should happen when an old option is removed from the catalog?
3. How should offline payment be marked confirmed, and who authorizes digital release? The current record/payment lifecycle needs verification against that rule.
4. Should retained digital delivery initially remain Dropbox, or should local delivery be the first additional capability? Either can be independently hosted; local delivery is implementation work.
5. Can the demo's remote originals still be accessed, and are all demo records safe to use in testing after sanitization?
6. Should resynchronizing a Dropbox gallery preserve existing customer selections, or was replacing them intentional?
7. Do the historical three-link UI threshold and order-folder purge interval still serve a useful purpose? They need not become product requirements.
8. Which nonessential features, such as music or remote video, should be supported in the first modern release rather than simply retained as dormant historical code?

The initial capacity question was about practical test targets—not whether storage was expensive. Exact historical numbers are unnecessary. Start with the supplied data, 20–50 MB originals, and shared-host-style memory/inode constraints; measure before choosing limits or replacing storage.

**Recommendation:** proceed with preservation-led modernization. Keep the interface, low-friction proofing, durable commercial selections, and manual fulfillment model. Repair administrative and financial authority, filesystem boundaries, persistence, and delivery before adding features.
