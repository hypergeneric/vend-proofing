# Vend manual

Vend helps photographers present galleries, collect favorites and print choices, and take orders. It is designed to be independently hosted and owned by the site operator.

## For photographers and site operators

To create the first administrator, run `lando php scripts/admin-account.php create USERNAME EMAIL` on the host and enter a password of at least 12 characters. Open `?/admin/` and sign in with that username and password. If the password is lost, run `lando php scripts/admin-account.php reset USERNAME` locally. If Vend is installed without Lando, use `php` in the same commands. The login screen also offers **Forgot password?**: enter your username to send a single-use, 30-minute reset link to your account email address. A successful reset signs that account out everywhere. If email is unavailable or you cannot access the saved address, use the local CLI reset command.

Use **Dashboard → Users** to list and create users, change their user type, or delete another account. **Edit my account** changes your own username, email, and password; enter your current password, and leave the new password blank to keep it. Saving signs you out of all sessions for that account. You cannot edit another user’s credentials or delete your own account. Deleted users lose access immediately. User types **Admin** and **Manager** currently have the same access; different permissions will be defined later.

Email recovery uses **Contact → Mailer Settings**. Set `setup.baseurl._value` in `dist/vend-proofing-core/defaults/admin.json` to the installation’s canonical HTTPS address, including a subdirectory if applicable. This shared site URL is required even when online payments are disabled; reset links never use the incoming request’s hostname. The screen always gives the same request confirmation, including for unknown usernames or delivery failures. Check spam folders and contact the site operator if the email does not arrive. Repeated requests are limited, and only the latest link works. Reset emails are excluded from the administrator message log because they contain sign-in credentials.

In the administration interface, create a gallery set and add photographs. Upload sets store photographs on the Vend server; category sets accept folders of photographs. Dropbox sets use a separate ingestion path. A gallery can have a password, expiration date, cover image, welcome text, and assigned pricing groups.

Create formats, papers, modifiers, packages, and products in pricing before offering them in a gallery. A package bundles chosen photographs into specified print formats; a product is package-like without format allocations. Orders provide invoices and production instructions. Physical prints are fulfilled manually by the photographer or their chosen lab.

Digital orders historically use Dropbox: Vend displays browsing previews, then arranges purchased files in Dropbox order folders and supplies shared download links. Current Dropbox and payment integrations are under modernization; confirm their status in the [modernization log](VEND-MODERNIZATION.md) before using them for real orders.

## For gallery visitors

Open the shared gallery link, enter its password if the photographer supplied one, and enter an email address to start or resume selections. The email is a convenient proofing identifier; it is not a verified customer account. You can select favorites, choose print formats and options, add comments, and build a cart. Checkout asks for the information needed to place an order.

This is a brief orientation. Installation, payment setup, backups, and detailed operating procedures will be added as their modernized behavior is verified.

## Payment setup

Vend supports Stripe Checkout, PayPal and manual/offline orders. Each photographer supplies credentials for their own provider accounts. Vend does not collect card numbers, operate a payment account, or take a commission.

Apply database updates with `lando php scripts/migrate.php` (or `php scripts/migrate.php` without Lando). Payment migration 013 adds checkout/retry identities, provider references, payment/receipt tracking and discount-code uniqueness without case sensitivity. It does not import historical payment configurations. Back up the private SQLite database before deployment.

Configure the shared installation URL in `setup.baseurl._value` in `dist/vend-proofing-core/defaults/admin.json`, including any installation subdirectory and excluding query parameters. For example, `https://proofs.example.com` or `https://example.com/proofs`. This trusted URL is required for online payments and receipt-email links. Offline orders can still be submitted before it is configured; failed receipts can be retried after configuration.

Each gateway has an enable switch and a sandbox/test or live mode. Fill the credentials for the chosen environment, save, then use **Test saved stripe/paypal credentials**. These checks authenticate without making a charge; they do not prove webhook delivery. A method appears at checkout only when enabled and its active credentials, webhook settings and public URL are present.

Secrets are write-only: a saved field displays a configured placeholder rather than its value. Leave it blank to retain the saved secret, enter a replacement, or use **Clear saved secret**. Vend stores secrets in its private SQLite settings, so protect database access and backups. The PayPal client ID and webhook ID are identifiers, not private API secrets.

### Stripe test and live configuration

1. In your Stripe account's test environment, obtain a test **secret API key**. Enter it as the Stripe test API secret. Hosted Checkout needs no publishable key in Vend.
2. Register the displayed Stripe test webhook URL in Stripe Workbench. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, and `charge.refunded`.
3. Copy that endpoint's signing secret (`whsec_...`) into the Stripe test webhook signing secret field. Save and test the credentials.
4. Place a test order from a gallery. Stripe hosts the payment page and offers cards, eligible Apple Pay/Google Pay and Link. Availability depends on the merchant account, customer and browser. Use Stripe's [test payment methods](https://docs.stripe.com/testing); no live card is needed.
5. Confirm the invoice says paid and the administrative order/payment details contain the Stripe Session and PaymentIntent references. Close the browser after payment in a second test and verify that the webhook still records payment.
6. To go live after sandbox qualification, enter the separate live secret key, register the live-mode webhook URL, enter its signing secret, and select live mode. Keep the test credentials for reconciliation and future tests.

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
5. Place a sandbox order through the existing checkout. Vend uses PayPal JavaScript SDK v6 for approval and captures on the server immediately. PayPal controls the eligible funding choices inside its checkout. Approval alone does not mark an order paid.
6. Verify the Vend order is paid, with the PayPal order and capture IDs in admin. Test cancellation, a pending/declined capture, browser abandonment and webhook retries before switching to live.
7. For live operation, select/create the live REST app for the photographer's merchant account, enter its live credentials, register the live webhook URL on that app, enter its webhook ID and select live mode. Sandbox and live settings are independent.

```text
https://proofs.example.com/vend-proofing-gateway.php?action=payment_webhook&provider=paypal&mode=test
https://proofs.example.com/vend-proofing-gateway.php?action=payment_webhook&provider=paypal&mode=live
```

PayPal webhooks need a publicly reachable HTTPS URL; use a sandbox tunnel or a test deployment rather than expecting PayPal to reach Lando directly. See [Orders v2](https://developer.paypal.com/api/orders/v2), [SDK v6 setup](https://developer.paypal.com/sdk/js/set-up/) and [webhook verification](https://developer.paypal.com/api/webhooks/v1).

### Orders, recovery and manual payments

The browser continues to display Vend's prices. Submission independently verifies the configured selections, quantities, packages, discounts, shipping and tax. A changed or unverifiable price is rejected before payment. Accepted selections and prices are frozen with the order; catalog edits do not change that invoice or an already-submitted payment attempt.

Discount codes ignore A–Z letter case: `SAVE10`, `save10` and `Save10` select the same code. Codes cannot differ only by case within one gallery/global scope. Existing local/global precedence, expiration, usage limits and discount claims are retained. An abandoned checkout continues to consume its reserved use; retrying the same cart does not consume another use.

Payment state is **pending**, **paid**, **failed**, **cancelled** or **refunded**; it is separate from production/fulfillment. The storefront's invoice shows payment state and offers a retry for unpaid online orders. Retry the saved order instead of creating another order. An independently confirmed expired Stripe session or terminal failed PayPal attempt can be replaced while retaining the original Vend order and quote. A browser cancellation is advisory until provider reconciliation; it cannot reverse a successful payment.

Payment attempts stay with their original provider and environment. Vend does not switch an outstanding order between Stripe and PayPal, which could leave two payable attempts. An ambiguous provider timeout is retried with its existing idempotency key. If an unconfirmed creation exceeds the safe retry window, Vend requests photographer review instead of risking a second charge; check the provider dashboard before taking further payment.

For offline orders, the photographer can use **Record manual payment** in the existing order list after receiving payment. Unpaid manual orders do not release digital files. Verified free digital orders receive entitlement immediately. Paid digital access is checked in SQLite on every Vend processing/download request; refund reconciliation revokes future Vend access on a full refund. Existing external Dropbox shared links/files already delivered are not recalled by a payment-state change.

Click the payment icon in the admin order list for sanitized payment and receipt details. **Retry failed receipts** retries known failed messages; ordinary payment/webhook retries do not resend successful receipts. An interrupted send remains `sending`, because Vend cannot tell whether the mail server accepted it before the interruption; inspect mail logs before deciding to resend. A mail failure does not change a paid payment. Online-order deletion archives it from the normal list while retaining provider references needed for later reconciliation.

Refunds are initiated in Stripe or PayPal, not from a new Vend refund interface. Verified full refunds become refunded; partial refunds retain paid state and record the refunded amount. Product fulfillment and any physical refunds remain the photographer's workflow.

### Qualification and current limits

The network-disabled `bash scripts/payment-smoke.sh` suite uses synthetic data and provider fixtures. It covers trusted totals, case-insensitive discount policy, packages, individual/bulk downloads, tax/shipping, offline/free orders, signed Stripe events, PayPal verification/create/capture, duplicate/out-of-order events, failed/pending/cancelled/expired attempts, retries, concurrency, refunds, entitlement and receipt failures. Real account credentials are unnecessary for this suite.

Before accepting real orders, complete the sandbox procedures above and verify actual webhook delivery, mobile/wallet eligibility, PayPal popup/redirect behavior, order email and Dropbox delivery. Automated provider fixtures do not establish those external integrations. Live charges have not been used for qualification.

Vend retains its existing hundredth-unit price granularity. Stripe amounts are converted to provider currency units; currencies/methods that require whole units reject fractional totals. Pricing supports deterministic arithmetic, `A`, `Q`, `P`, comparisons/conditions and standard supported math helpers. JavaScript function bodies and random pricing are rejected. Give differently priced options distinct labels within an assigned group; ambiguous duplicate labels are rejected rather than guessed. Prices changed since a cart was saved require the customer to reselect the affected options.
