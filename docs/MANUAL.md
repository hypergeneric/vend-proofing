# Vend manual

Vend helps photographers present galleries, collect favorites and print choices, and take orders. It is designed to be independently hosted and owned by the site operator.

## For photographers and site operators

Open the installation URL to start setup. Confirm the language and suggested paths/public HTTPS URL, choose your first administrator username/email/password (at least 12 characters), then enter Vend’s primary business email and any website, phone, or address details. Finish setup and sign in. The primary business email is separate from your administrator’s account email and can be changed in Contact later. Removing it will not lock you out of admin.

For local password recovery, run `lando php scripts/admin-account.php reset USERNAME`. Without Lando, use `php` instead. The login screen also offers **Forgot password?**: enter your account email address to send a single-use, 30-minute reset link to your account email address. A successful reset signs that account out everywhere. If email is unavailable or you cannot access the saved address, use the local CLI reset command.

Use **Dashboard → Users** to list and create users, change their user type, or delete another account. **Edit my account** changes your own username, email, and password; enter your current password, and leave the new password blank to keep it. Saving signs you out of all sessions for that account. You cannot edit another user’s credentials or delete your own account. Deleted users lose access immediately. User types **Admin** and **Manager** currently have the same access; different permissions will be defined later.

Email recovery uses **Contact → Mailer Settings**. Confirm the installation’s canonical HTTPS address during setup, including a subdirectory if applicable. This shared site URL is required even when online payments are disabled; reset links never use the incoming request’s hostname. The screen always gives the same request confirmation, including for unknown email addresses or delivery failures. Check spam folders and contact the site operator if the email does not arrive. Repeated requests are limited, and only the latest link works. Reset emails are excluded from the administrator message log because they contain sign-in credentials.

In the administration interface, create a gallery set and add photographs. Upload sets store photographs on the Vend server; category sets accept folders of photographs. Dropbox sets use a separate ingestion path. A gallery can have a password, expiration date, cover image, welcome text, and assigned pricing groups.

Create formats, papers, modifiers, packages, and products in pricing before offering them in a gallery. A package bundles chosen photographs into specified print formats; a product is package-like without format allocations. Orders provide invoices and production instructions. Physical prints are fulfilled manually by the photographer or their chosen lab.

Digital orders historically use Dropbox: Vend displays browsing previews, then arranges purchased files in Dropbox order folders and supplies shared download links. Current Dropbox and payment integrations are under modernization; confirm their status in the [modernization log](VEND-MODERNIZATION.md) before using them for real orders.

## For gallery visitors

Open the shared gallery link, enter its password if the photographer supplied one, and enter an email address to start or resume selections. The email is a convenient proofing identifier; it is not a verified customer account. You can select favorites, choose print formats and options, add comments, and build a cart. Checkout asks for the information needed to place an order.

This is a brief orientation. Installation, payment setup, backups, and detailed operating procedures will be added as their modernized behavior is verified.

## Payment setup

Vend supports Stripe payments in a modal, PayPal with eligible Venmo, and manual/offline orders. Each photographer supplies credentials for their own provider accounts. Vend does not collect card numbers, operate a payment account, or take a commission.

Apply database updates with `lando php scripts/migrate.php` (or `php scripts/migrate.php` without Lando). Payment migration 013 adds checkout/retry identities, provider references, payment/receipt tracking and discount-code uniqueness without case sensitivity. It does not import historical payment configurations. Back up the private SQLite database before deployment.

Confirm the shared installation URL during setup, including any installation subdirectory and excluding query parameters. For example, `https://proofs.example.com` or `https://example.com/proofs`. This trusted URL is required for online payments and receipt-email links. Offline orders can still be submitted before it is configured; failed receipts can be retried after configuration.

Each gateway has an enable switch and a sandbox/test or live mode. Fill the credentials for the chosen environment, save, then use **Test saved stripe/paypal credentials**. These checks authenticate without making a charge; they do not prove webhook delivery. A method appears at checkout only when enabled and its active credentials, webhook settings and public URL are present.

Secrets are write-only: a saved field displays a configured placeholder rather than its value. Leave it blank to retain the saved secret, enter a replacement, or use **Clear saved secret**. Vend stores secrets in its private SQLite settings, so protect database access and backups. The PayPal client ID and webhook ID are identifiers, not private API secrets.

### Stripe test and live configuration

1. In your Stripe account's test environment, obtain a test **secret API key**. Enter it as the Stripe test API secret. Also enter the matching **publishable key** (`pk_test_…`) in Stripe test publishable key. Both must belong to the same test account/environment.
2. Register the displayed Stripe test webhook URL in Stripe Workbench. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, and `charge.refunded`.
3. Copy that endpoint's signing secret (`whsec_...`) into the Stripe test webhook signing secret field. Save and test the credentials.
4. Place a test order from a gallery. Vend opens a compact payment dialog with cards and eligible Apple Pay/Google Pay and Link wallet buttons. Close or Escape returns to the editable cart. You can refresh, come back later, or try payment again. Successful payment creates the order and continues to its invoice. Availability depends on the merchant account, customer and browser. Use Stripe's [test payment methods](https://docs.stripe.com/testing); no live card is needed.
5. Confirm the invoice says paid and the administrative order/payment details contain the Stripe Session and PaymentIntent references. Close the browser after payment in a second test and verify that the webhook still records payment.
6. To go live after sandbox qualification, enter the separate live secret and publishable keys, register the live-mode webhook URL, enter its signing secret, and select live mode. Keep the test credentials for reconciliation and future tests.

Stripe wallet buttons require registering the actual checkout hostname in Stripe Dashboard → Settings → Payment methods → Domains for wallets and Link, in the matching test/live environment. Register `vend-proofing.lndo.site` for local testing; register the public production hostname before release. Wallet display still depends on account, browser and device eligibility. See [payment-method domain registration](https://docs.stripe.com/payments/payment-methods/pmd-registration). The Stripe frame handles card details; Vend never reads them.

Endpoints have this form, with the installation's actual base URL:

```text
https://proofs.example.com/vend-proofing-gateway.php?action=payment_webhook&provider=stripe&mode=test
https://proofs.example.com/vend-proofing-gateway.php?action=payment_webhook&provider=stripe&mode=live
```

A local `.lndo.site` URL is not reachable by Stripe's servers. Use the [Stripe CLI local listener](https://docs.stripe.com/webhooks#local-listener) or a temporary HTTPS tunnel for sandbox work. A CLI listener has its own signing secret; use that secret while forwarding events and follow the CLI's local certificate instructions. A deployed endpoint has a different secret. Never copy a live secret into a shared test fixture.

### PayPal sandbox and live configuration

1. In the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/), create/select a REST app associated with your sandbox business/merchant account. Use a separate sandbox personal/buyer account to purchase from it.
2. Enter the app's sandbox **client ID** and **secret** into Vend's PayPal test fields.
3. Register the displayed PayPal test webhook URL on that same sandbox app. Subscribe to `CHECKOUT.ORDER.APPROVED`, `CHECKOUT.ORDER.COMPLETED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`, and `PAYMENT.CAPTURE.REVERSED`.
4. Enter the webhook's **ID** into Vend's PayPal test webhook ID field. This is the subscription ID from PayPal, not the client ID or a Stripe-style signing secret. Save, enable test mode and test the credentials.
5. Place a sandbox order through the existing checkout. Vend uses PayPal JavaScript SDK v6 for approval and captures on the server immediately. PayPal controls the eligible funding choices inside its checkout. Venmo appears as a separate choice when the SDK reports it eligible, for US buyers paying in USD; it uses the same PayPal account, capture verification and webhooks. The selected funding source stays with that payment attempt for retries. Enable Venmo for the merchant app/account where PayPal requires it. Test the Venmo app/QR handoff separately; a passing PayPal account payment does not qualify Venmo. Approval alone does not mark an order paid.
6. Verify the Vend order is paid, with the PayPal order and capture IDs in admin. Test cancellation, a pending/declined capture, browser abandonment and webhook retries before switching to live.
7. For live operation, select/create the live REST app for the photographer's merchant account, enter its live credentials, register the live webhook URL on that app, enter its webhook ID and select live mode. Sandbox and live settings are independent.

```text
https://proofs.example.com/vend-proofing-gateway.php?action=payment_webhook&provider=paypal&mode=test
https://proofs.example.com/vend-proofing-gateway.php?action=payment_webhook&provider=paypal&mode=live
```

PayPal webhooks need a publicly reachable HTTPS URL; use a sandbox tunnel or a test deployment rather than expecting PayPal to reach Lando directly. See [Orders v2](https://developer.paypal.com/api/orders/v2), [SDK v6 setup](https://developer.paypal.com/sdk/js/set-up/) and [webhook verification](https://developer.paypal.com/api/webhooks/v1).

### Orders, recovery and manual payments

The browser continues to display Vend's prices. Submission independently verifies the configured selections, quantities, packages, discounts, shipping and tax. A changed or unverifiable price is rejected before payment. Accepted selections and prices are saved privately for that payment; catalog edits do not change that invoice or an already-submitted payment attempt.

Discount codes ignore A–Z letter case: `SAVE10`, `save10` and `Save10` select the same code. Codes cannot differ only by case within one gallery/global scope. Existing local/global precedence, expiration, usage limits and discount claims are retained. An abandoned checkout continues to consume its reserved use; retrying the same cart does not consume another use.

The cart stays available until payment succeeds. Closing the payment window, a decline or a refresh does not place an order or empty the cart. Retrying unchanged checkout details reuses the payment attempt. After verified payment, Vend places the order, sends the receipts and removes the purchased selections from the cart. Additions or edits made while payment was open remain in the cart. Manual submission places the order immediately.

Payment state is **pending**, **paid**, **failed**, **cancelled** or **refunded**, separate from fulfillment. Unpaid online checkout details are internal bookkeeping, absent from the order list and invoices. Provider callbacks can finish a successful order even when the customer has closed the browser. Each attempt keeps its original prices, provider and environment; editing checkout details starts a separate attempt. Failed/expired attempts can be replaced after provider verification. An ambiguous older provider timeout requires photographer review rather than risking a duplicate charge.

For offline orders, the photographer can use **Record manual payment** in the existing order list after receiving payment. Unpaid manual orders do not release digital files. Verified free digital orders receive entitlement immediately. Paid digital access is checked in SQLite on every Vend processing/download request; refund reconciliation revokes future Vend access on a full refund. Existing external Dropbox shared links/files already delivered are not recalled by a payment-state change.

Click the payment icon in the admin order list for sanitized payment and receipt details. **Retry failed receipts** retries known failed messages; ordinary payment/webhook retries do not resend successful receipts. An interrupted send remains `sending`, because Vend cannot tell whether the mail server accepted it before the interruption; inspect mail logs before deciding to resend. A mail failure does not change a paid payment. Online-order deletion archives it from the normal list while retaining provider references needed for later reconciliation.

Refunds are initiated in Stripe or PayPal, not from a new Vend refund interface. Verified full refunds become refunded; partial refunds retain paid state and record the refunded amount. Product fulfillment and any physical refunds remain the photographer's workflow.

### Qualification and current limits

The network-disabled `bash scripts/payment-smoke.sh` suite uses synthetic data and provider fixtures. It covers trusted totals, case-insensitive discount policy, packages, individual/bulk downloads, tax/shipping, offline/free orders, signed Stripe events, PayPal verification/create/capture, duplicate/out-of-order events, failed/pending/cancelled/expired attempts, retries, concurrency, refunds, entitlement and receipt failures. Real account credentials are unnecessary for this suite.

Before accepting real orders, complete the sandbox procedures above and verify actual webhook delivery, mobile/wallet eligibility, PayPal popup/redirect behavior, order email and Dropbox delivery. Automated provider fixtures do not establish those external integrations. Live charges have not been used for qualification.

Vend retains its existing hundredth-unit price granularity. Stripe amounts are converted to provider currency units; currencies/methods that require whole units reject fractional totals. Pricing supports deterministic arithmetic, `A`, `Q`, `P`, comparisons/conditions and standard supported math helpers. JavaScript function bodies and random pricing are rejected. Give differently priced options distinct labels within an assigned group; ambiguous duplicate labels are rejected rather than guessed. Prices changed since a cart was saved require the customer to reselect the affected options.

## Dropbox connection and gallery sync

The connection and gallery-sync implementation is ready for local account testing. Invoice download preparation is still the older implementation and remains a separate restoration step.

1. For development, select your app in the [Dropbox App Console](https://www.dropbox.com/developers/apps). Use **App folder** access. Enable `files.metadata.read` and `files.content.read` for gallery sync. If creating a new app, Dropbox gives it its own app folder; it does not automatically adopt the historical Vend folder.
2. In Vend's ordering settings, under **3rd Party Integrations**, enter the app key and secret and save. The secret becomes a write-only field.
3. Click **Authorize Dropbox**, approve access, and copy the displayed authorization code into Vend's **Dropbox Authorization Code** field. Save again. The code clears and status becomes **Connected**. No redirect URL or public tunnel is required for this copy/paste flow. Vend refreshes access automatically. Clearing the saved app secret disconnects Vend locally; Dropbox's connected-app settings can revoke the grant itself.
4. Create a new Dropbox Set. Inside the app folder, create the gallery folder shown in Vend. For the first test, use a few synthetic JPEG/PNG files. Put images directly in that folder, or organize them into subfolders; do not mix both layouts. Nested category labels include their relative folder path.
5. Click **Sync Files** and keep the tab open while previews download. Vend retains originals in Dropbox and stores 1024×768-bounded JPEG previews locally. Sync again after changes or to resume an interrupted preview transfer. Unchanged previews are reused.

Renaming or moving a file inside the gallery preserves its Vend identity and customer selections. Removing a file hides it from the gallery but retains its record and previous selections. Returning the same Dropbox file restores its gallery identity. Uploading a different file at the same path is a new image. Sync preserves existing image/category ordering and appends new entries. Changing a file's contents refreshes its preview; fulfillment of previously purchased versions is not yet implemented.

Dropbox's thumbnail API documents a **20 MB original-image limit**. Vend reports oversized originals instead of downloading and decoding them in PHP. The preview shown on Dropbox's own website is not evidence that its API will deliver a preview for that file. Use smaller originals for this first qualification; large-original/alternate-preview support is still open. [Dropbox's API specification](https://github.com/dropbox/dropbox-api-spec/blob/main/files.stone).

Connection errors keep the previous saved settings. A failed folder listing leaves gallery records unchanged; a failed preview keeps the previously saved preview. Check the connection, folder and indicated image-size limit, then retry Sync Files. The surviving historical Dropbox archive is reference material; use a new gallery folder for qualification.

### Dropbox invoice downloads

For a new order, Vend saves the Dropbox file identity and revision with each purchased original/web-size selection. On the paid or free order's invoice, choose **Prepare Downloads**, leave the tab open while it processes, then show the download links. Closing the tab pauses preparation; reopen the invoice and continue. A failed request stops and lets you retry. Missing purchased content is an error, not an omitted image. Existing development orders without source snapshots need to be recreated.

Originals are copied within Dropbox without decoding them in PHP. Web-size files are JPEG previews bounded by 1024 × 768 pixels, without purchased crop/color transformations; they are not full-resolution photographs. Keep originals available: Dropbox's revision retention is finite. The same Dropbox app must remain connected. The existing 20 MB thumbnail-source limit still applies to web-size delivery and gallery previews.

Prepared files go into a new `/vend-deliveries/<order>-<random>/` folder inside the app's Dropbox folder. Vend divides purchases into convenient parts at roughly 1 GB or 1,000 images; a larger individual original gets its own part. Output names include the order item number to prevent duplicate filenames from colliding. Dropbox creates the ZIP when the customer downloads a shared folder. The old `/orders` archive and `info.txt` files are not read, imported or purged.

The invoice allows three successful **link issuances**, then offers the existing emailed reset request. The approval link resets that count without requiring the photographer to have the customer's invoice session. This is not a count of completed transfers: shared links can be reused, and a refund prevents further issuance through Vend but does not invalidate links already shared. Delete the prepared delivery folder through the order controls to remove those copies/links. Configured cron cleanup deletes only Vend's tracked delivery folders after the configured period without preparation or link activity. Opening an invoice alone does not extend that period or contact Dropbox.

First live check: use a new order containing one original and one web-size image from your test gallery. A zero-priced download order avoids a payment charge; otherwise use your configured payment sandbox. Confirm both images appear in the downloaded ZIP, the original matches your source file, and the web version is a JPEG. Refresh during preparation and confirm Continue works. Keep the historic archive out of this test.

### Uploaded gallery downloads

Basic/upload and category sets now use the same **Download Set** profile as Dropbox sets. Choose a profile in the set settings, enable original and/or web-size purchases in that profile, and create a new order. With no assigned profile, the global download settings apply. JPEG and PNG photographs are eligible; other uploaded media remain available in the gallery but are excluded from digital-download purchases and Download All pricing/counts. Categories can contain repeated filenames; each purchased file receives an order-item prefix in the ZIP to keep names distinct.

Paid or free invoices use the existing prepare → show links flow. Local preparation processes one photograph or one ZIP part per request. Keep the invoice tab open; closing it pauses work and reopening it allows you to continue. Originals are delivered byte-for-byte. Web versions are clean JPEGs bounded by 1024 × 768 pixels, without upscaling, watermarking, purchased crops or tone effects. EXIF orientation is applied and transparent PNG areas become white. Original metadata is unchanged; web-rendition metadata may differ by image library.

Local ZIP parts target approximately 250 MB or 1,000 files; a larger single original occupies its own part. These are packaging targets, not upload restrictions. Packages are kept in private storage and streamed through the invoice's authorized customer session. Open the invoice first if using another browser. Links require paid/free entitlement on every request, including after the links have already been issued. Refunding/revoking the order therefore blocks further local downloads. The existing three-link-issuance/reset workflow applies; it does not count completed transfers.

Removing an image or gallery retains files referenced by orders privately, allowing those purchases to be prepared later. Unpurchased files are deleted normally. Prepared ZIP cleanup does not delete retained originals. Retained originals are released when the last referencing order is permanently deleted and no gallery uses them. Online-payment orders are archived rather than permanently deleted, so their source references remain. Include these retained files in storage planning and backups. Changing/removing files directly on disk can invalidate a purchased source; Vend reports a missing/changed file instead of silently substituting it.

The cron screen's **Auto-delete Prepared Downloads** and age setting apply to local packages and Dropbox delivery folders. Cleanup uses tracked packages only. Preparation and link issuance update package activity; simply viewing an invoice or transferring a previously issued local link does not extend the cleanup period. After cleanup, an authorized invoice can rebuild from its retained sources. Local staging plus ZIP files uses additional disk space beyond the originals.

**Hosting matters.** Vend imposes no new image-dimension or file-size upload cap. PHP, the web server and your hosting plan still impose upload, memory, execution-time, disk and bandwidth limits. A successful upload does not mean that hosting can resize that image. A compressed 50 MB JPEG may require much more memory when decoded. Test representative files on the actual host; this developer workstation is not a useful hosting-performance baseline. Local ZIP creation prefers PHP ZIP (ZipArchive) and otherwise uses the bundled PclZip with zlib. The fallback holds one whole file in memory and cannot create ZIP64 archives (roughly 4 GB or larger); those packages require PHP ZIP. This affects download packaging, not upload acceptance. Web-size generation uses Imagick when installed, otherwise GD (with EXIF support for JPEG orientation). Processing failures stop preparation for a retry; a fatal memory/time limit may appear as a failed request. Hosting limits can also interrupt large ZIP creation or transfers. Download transfers restart from the beginning; HTTP byte-range resume is not implemented.

**Setup → Max Image Dimension** controls the largest dimension, in pixels, that Graphic serves (default 2048). Choose the preview resolution you are comfortable sharing. The server applies this ceiling after fitting/cropping and retina scaling, including requests with omitted dimensions; browser zoom uses the same setting. Smaller requested sizes remain smaller, and images already within the ceiling may be served unchanged. This is a display-size limit, not an upload restriction or a limit on purchased originals. Purchased web-size downloads still use their separate 1024 × 768 bounds. ZIPs and retained original paths are not public image sources. Changing the setting creates new server cache entries; it cannot recall images already saved or cached by visitors.

For a first test, use a new free order containing an original JPEG, a PNG and a web-size rendition. Check the ZIP contents, orientation and original bytes; repeat with a category set and duplicate filenames. Then test representative large files on the intended host before promising a maximum size to customers.
