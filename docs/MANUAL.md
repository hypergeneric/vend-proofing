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
