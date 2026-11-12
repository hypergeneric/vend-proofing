# Payment modernization: audit and implementation plan

Date: 2026-11-12. Phase 1 audit of the pre-change implementation. Implementation progress and qualification are recorded in the [modernization log](VEND-MODERNIZATION.md). This records the payment-specific review of the current SQLite application, rather than repeating the historical [product audit](VEND-PRODUCT-DISCOVERY-AND-TECHNICAL-AUDIT.md). Follow [development rules](DEVELOPMENT.md) and the [modernization log](VEND-MODERNIZATION.md).

The intended scale is a photographer's independently hosted proofing store. Keep Vend's storefront, checkout, JavaScript application, pricing editors, invoices, and manual production workflow. Use each photographer's own Stripe and PayPal accounts. No platform accounts, Connect, commissions, frontend framework, or general commerce framework.

The developer clarified that **server verification is sufficient**: retain browser price calculation for the existing interaction, independently verify it against trusted pricing rules at order submission, and freeze the verified result. Comparing submitted totals with prices previously submitted by the same browser is insufficient. Do not silently charge a corrected amount that the customer did not approve.

## Current flow and what to retain

| Area | Current implementation | Disposition |
|---|---|---|
| Print pricing | `js/vend/overlay/Sidebar.js` evaluates configured format, paper, and modifier expressions using `A` (area), `Q` (quantity), `P` (format price), and JavaScript math. Selections include crop, toning, comments, component prices and shipping. | Keep interaction and pricing rules. Add independent verification; never execute submitted expressions as PHP. |
| Packages/products | Package definitions and component quantities/dimensions live in SQLite; customer package instances and image allocations live in carts and order snapshots. | Retain definitions, customer nicknames, allocations, and existing surcharge behavior. Verify definition ownership and allocation quantities server-side. |
| Digital selections | Individual high/low prices and bulk flat/per-image prices come from download settings. `add_all_of_type` also accepts a browser price and flat flag. | Retain offerings and bulk selection UX. Select authorized prices/settings on the server; validate the complete bulk selection when flat pricing applies. |
| Checkout | `overlay/Cart.js` checks minimums and package completeness; `overlay/Checkout.js` calculates discounts, shipping, handling and location taxes. | Keep existing controls and live totals. Mirror required validation at submission, including minimums, enabled methods, pickup/international policy, and paid-download restrictions. |
| Proofing storage | `Proofing` stores selections in `cart_items`, links gallery images and parent allocations, and projects existing positional rows. | Retain SQLite and response contracts. Browser-originated `quoted_*` fields are advisory until independently verified. |
| Discounts | `OrderRecords` shares local/global scope, expiry, minimum, and usage rules between verification and reservation. Migration 011 reserves a use before payment. | Reuse these rules and transactions. Preserve the documented abandoned-claim policy; do not introduce reservation expiry as an unrelated behavior change. |
| Order storage | `OrderRecords::create()` atomically snapshots cart items/favorites, redeems a reserved discount, creates a payment row, and clears purchased cart items. | Retain projections and snapshots. Separate pending-order submission from verified payment completion. Freeze before the provider call. |
| Invoices/admin | `1.page.order.tmpl` renders invoice/production views; admin `Orders`, `OrderSearch`, and `OrderStats` use existing rows and Gateway actions. | Retain views, identifiers, search and production workflows. Expose payment status separately from fulfillment and support pending/retry information. |
| Email | `Order::sendMails()` sends customer and owner receipts after order creation using existing templates. | Retain templates/recipients. Persist notification work and failure independently of payment; retries must not rerun paid transitions. |
| Digital fulfillment | `Dropboxer` copies purchased selections into order folders and supplies shared links; progress/download flags are remote, with a local temporary work list. | Retain Dropbox workflow. Add payment and order-access checks before every delivery operation; record entitlement/fulfillment in SQLite. Live Dropbox qualification remains separate. |
| Configuration | Ordering JSON defaults and saved `configuration_documents` drive the existing `Ordering` / `XMLTabs` settings editor through authenticated `setup_*` actions. | Extend this editor and persistence. Replace old payment fields outright; preserve separate Dropbox settings. |

## Findings that must be addressed

### 1. Prices remain browser-controlled — confirmed in an isolated PHP 8.4 probe

`Proofing::save()` accepts `subtotal`, `shipping`, labels, and package descriptions from a selection row. It writes these to `quoted_unit_minor`, `quoted_shipping_minor`, and `selection_json`. It does not establish that the selected format/package belongs to the gallery's configured groups or evaluate its configured price.

`OrderRecords::prequalify()` and `validateBeforePayment()` compare the submitted subtotal with those stored quotes. An attacker can change both. A synthetic invented product at $0.01 passed prequalification and order validation without any corresponding product definition.

Shipping, handling, tax, tax flags and address-dependent policy are not independently verified. The current arithmetic check accepts negative shipping: a synthetic $10 cart with -$9.99 shipping passed validation at a $0.01 final amount. Numeric checks accept scientific notation and round through floats; `minor()` assumes two decimal places for every configured currency.

`Cart.js` minimums/package completeness and `Checkout.js` paid-download/offline restrictions are client checks. They need matching server checks. Verify every selected option, quantity, component and final amount; validating only the final sum leaves cheap-option substitution and invalid allocations possible.

### 2. Payment type/reference can be forged — confirmed in an isolated PHP 8.4 probe

The public `finalize_order` action puts `Order` in offline-processing mode but retains the submitted row's `payment_type` and transaction reference. `OrderRecords::create()` assigns `pending` only to the literal provider `offline`; every other string becomes `succeeded` without independently checking a provider.

A synthetic row naming `stripe` and an invented transaction reference created a succeeded payment through this persistence path with no provider request. The Gateway path uses the same row and method; its exploitability is established by source tracing, not an HTTP attack against the local application. The server must choose payment state and references exclusively from the action and verified provider response.

There is another success-by-default path: `Order::processCreditCard()` invokes Stripe only when the merchant selector is `stripe`. Other selector values leave `flag_success` true. Enabled/configured methods must be enforced on the server, not only in rendered checkout controls.

### 3. Stripe requires replacement

`Order::processStripe()` uses Omnipay Stripe 2 (`omnipay/stripe` in Composer). The storefront collects card number, expiry and CVV and posts them to Vend. There is no Checkout Session, webhook signature verification, explicit test/live separation, asynchronous completion, or provider idempotency key. Full provider response data is exported into payment logs.

The charge occurs **before** the durable order snapshot. A successful charge followed by an order-write failure can leave payment without an order. Concurrent requests can both pass preflight before either writes the order. Order uniqueness after a charge does not prevent duplicate charges.

Replace the Omnipay integration and raw-card controls with Stripe-hosted Checkout through the official `stripe/stripe-php` SDK. Keep normal customer/shipping inputs in Vend and charge the single frozen Vend total; Stripe should not recalculate Vend's discounts, shipping or tax.

### 4. PayPal requires replacement

`Checkout.js::processPayment()` builds a PayPal Standard `_xclick` form with browser-supplied amount, discount, shipping, tax, invoice and custom fields. `Order::doPaypalIPN()` posts back to Classic `webscr` and reconstructs the order from those fields.

It does not independently compare receiver/merchant identity, currency and paid amount with a pre-existing trusted quote. The primary socket path inherits `flag_success = true`; if it opens but never reads a recognized verification result, that flag is not explicitly reset before interpreting `Completed`. Raw submitted IPN fields are logged. Duplicate handling compares an existing order's gallery/reference but does not provide a complete reconciliation lifecycle.

Remove Classic, its form construction and IPN endpoint. Use Orders v2 `CAPTURE` with server creation/capture, JavaScript SDK v6 approval UI, and verified webhooks. Verify exact order ownership, capture status, amount, currency, provider ID and merchant/environment association. Approval alone is not payment.

### 5. Digital delivery is not protected by payment state

In `1.page.order.tmpl`, the `process` branch executes before the normal order/email access check. `start`, `next`, and `download` call Dropbox operations without a paid-state check. `Dropboxer::getImageData()` reads cached PHP session order data, while subsequent work paths and share-link calls use the requested order ID. The methods do not independently authorize that order or its payment.

Reset approval uses predictable `md5(orderid)`. Move all process operations behind order-specific authorization and payment/entitlement checks, including direct requests. A paid flag cached in a browser or PHP session is not authoritative. Free verified orders may receive digital entitlement; unpaid manual orders must not. Keep the accepted low-friction email proofing model; it is separate from delivery authorization.

### 6. Persistence is useful but payment behavior is incomplete

Migration 001 already supplies `orders`, `order_items`, `payments`, `payment_events`, `fulfillments`, `fulfillment_items` and `messages`. Migrations 010/011 add order-row projections, payment logs and discount claims. `Database::migrate()` applies numbered SQL transactionally; `Database::transaction()` uses `BEGIN IMMEDIATE` and nested savepoints.

The current `pricing_snapshot_json` records amount strings; `formula_snapshot_json` is not populated by order creation. There is no frozen pre-provider quote, provider-order/session versus capture/transaction distinction, environment-specific reference, persistent submission key or notification completion claim. The existing payment event/fulfillment tables are not wired into gateway completion. Order status is always `placed`; it is not a meaningful payment status.

`OrderRecords::create()` handles an already-persisted SUID without duplicating rows, but `Order::process()` rejects that retry before creation. A refreshed offline submission therefore reports failure rather than returning the existing order. Online retries have the additional charge-before-order problem.

### 7. Configuration and logs need a narrower secret boundary

The current Stripe key is base64-encoded in ordering settings. Encoding is not encryption. `setup_load` returns the full configuration to the authenticated admin editor, and its `Input` control decodes/render values into ordinary inputs. A `private` metadata flag alone does not make a credential write-only. Public storefront rendering inspected here emits the PayPal email, not the Stripe secret; this is not a claim that a public secret leak was reproduced.

Use write-only credential inputs in the existing settings screen: status/presence on load, explicit replacement/clear on save. Preserve saved secrets when unrelated ordering settings are saved. Return only public PayPal SDK configuration. Keep secrets and raw provider payloads out of diagnostic exports and payment logs; store selected identifiers, status, amount, currency, event type and safe error codes.

Checkout visibility currently follows booleans rather than complete configuration. Safe connection tests and explicit configuration status are absent. Tests must exercise both method visibility and direct server submission.

### 8. Email and fulfillment need retry boundaries

Order creation commits before sending mail, which is a useful starting point: an email failure must never erase a payment. However there is no durable per-recipient receipt claim/status; a process interruption can lose the second message. Digital delivery is browser-driven, so payment success while the browser is abandoned does not establish delivery work.

Use SQLite uniqueness/transactions for one payment transition, invoice identity, digital entitlement, and notification job per recipient/purpose. Send outside the database write transaction. Mark failures independently and expose a retry path. Do not promise exactly-once SMTP delivery across a crash after a mail server accepts a message but before Vend records it; external delivery needs an idempotent provider or a visible ambiguous-send state. Ordinary webhook retries must never resend successful receipts.

## Proposed implementation stages

These are sequential bounded changes. Each stage gets synthetic regression tests before the next integration is added.

1. **Verified submission and common lifecycle.** Add a small pricing verifier over existing records/configuration. Resolve trusted option identifiers (add identifiers to selection metadata where current label-only rows are ambiguous), verify expressions/quantities/allocations and checkout totals, enforce configured checkout policies, and snapshot selections, evaluated prices, relevant rules and currency. Use a constrained deterministic arithmetic evaluator for `A`, `Q`, `P` and supported math rather than PHP `eval`. Reject unsupported formulas explicitly in admin/checkout; test rounding and existing formulas. Atomically create/reuse a pending order and payment attempt before network calls. Force offline submissions to pending/manual, and make free-order entitlement explicit. Preserve discount claims and existing order/invoice projections. Harden delivery authorization in this stage.
2. **Stripe.** Replace Omnipay and raw-card UI with hosted Checkout. Create with a stable attempt idempotency key, Vend order metadata and fixed amount/currency. Verify signed raw webhook bodies using the SDK; retrieve and reconcile the recorded Session/PaymentIntent. Handle completed, asynchronous success/failure, expiry, refunds and out-of-order events. A return route can retrieve/reconcile for prompt feedback but cannot itself assert payment.
3. **PayPal.** Replace Classic/IPN with server OAuth and Orders v2 REST calls, immediate capture and stable `PayPal-Request-Id` values. Use SDK v6 eligibility/approval/cancel/error callbacks within the current checkout. Retrieve/reconcile the stored provider order on approval and webhook recovery. Verify webhook signatures using PayPal's verification API and the configured webhook ID; never fetch an arbitrary certificate URL supplied in an event. Reconcile capture/refund events through the same completion method as Stripe.
4. **Settings and operations.** Extend existing ordering settings for both environments, write-only credentials, connection checks, status and webhook instructions. Include webhook URL/status, safe errors, pending/retry and payment/fulfillment distinctions in the existing order workflow. Prevent method switching from leaving two independently payable attempts; reconcile/expire outstanding provider sessions before replacing them. Handle an ambiguous provider timeout by reusing/retrieving the same attempt, not issuing another charge.
5. **Qualification and manual.** Run deterministic lifecycle/provider fixtures and existing smokes; perform browser checkout tests against mocks. Document Stripe test and PayPal sandbox setup and real end-to-end scenarios, including abandonment, duplicate events and email failure. Production charges are unnecessary for qualification.

### Small persistence changes, not another framework

Extend existing tables in a new numbered migration after 012. Likely additions: provider mode, separate provider session/order and transaction/capture references, sanitized error code, attempt/submission identity, notification claim/status, and fulfillment uniqueness. Reuse `payment_events` for deduplication and existing `messages`/fulfillment records where their contract fits. Do not introduce a generic event bus, queue service, middleware stack, or replacement catalog.

Store payment state in payments (`pending`, `paid`, `failed`, `cancelled`, `refunded`) separately from `orders.status` and fulfillment state. A late cancellation/failure must not demote a paid payment. Full confirmed refunds can become refunded; partial refunds need a recorded refunded amount without falsely declaring the whole payment refunded. Validate provider amount/currency against the immutable order snapshot, with currency-specific minor-unit handling. Keep provider calls outside SQLite write transactions.

Use a small payment coordinator plus one Stripe adapter and one PayPal adapter. Pricing/order rules remain in Vend. Both adapters report verified results into the same transactional completion method. Hosted Stripe needs no publishable key for this flow; PayPal's client ID is public, its secret is server-only. Merchant credentials need separate test/live storage and webhook configuration; switching modes must not prevent reconciliation of existing attempts in the other mode.

### Acceptance tests

- Trusted print, dimension/quantity expressions, package allocations and surcharges, product quantities, individual/bulk downloads, global/gallery discounts, free shipping, pickup/international handling, US/Canadian/VAT tax and tax-display conventions; reject invented options, negative amounts, invalid quantities and tampered matching cart/order totals.
- Offline submission and retries; free orders; unpaid digital denial; enabled/configured method enforcement; immutable quote after catalog/cart changes; stable server-generated IDs and concurrent duplicate submissions.
- Stripe and PayPal success, decline, cancellation, expiry and pending; successful capture without browser return; provider timeout recovery; valid/invalid signatures; unknown/unrelated order IDs; wrong merchant/mode, amount or currency.
- Duplicate/concurrent/out-of-order events, paid followed by cancellation/failure, partial/full refunds, API/webhook races, retry after provider success but before local confirmation.
- One invoice/order identity and digital entitlement, no repeat delivery/receipt on ordinary retries, explicit mail failure recovery, credentials absent from public HTML/JavaScript, settings reads and sanitized diagnostic output.

## Evidence and tests performed

Working tree was clean at audit start. Read all six existing documents in `docs/`, the current first-party checkout/pricing/session/order/provider/settings/fulfillment paths, SQLite migrations, Composer requirements, and existing record/smoke tests. No historical-installation compatibility layer is proposed.

`bash scripts/basic-set-smoke.sh` **passed** using PHP 8.4.22 in the existing cached Docker image with networking disabled. It covered SQLite settings, galleries/media, proofing, pricing-definition round trips, discount claims, offline Gateway submission, invoice rendering, search/statistics and persistence after restart. The script emitted existing `curl (23)` messages around truncated storefront pipelines but exited 0 with all assertions passing. This baseline does not prove pricing integrity or payment-provider correctness; its current fixtures intentionally accept arbitrary quoted prices.

An additional temporary fixture under `/tmp/vend-payment-audit-n76bfpwz` installed a fresh database and called `Proofing`/`OrderRecords` directly with synthetic selections. A network-disabled PHP 8.4 container confirmed invented-product/one-cent acceptance, forged succeeded-payment classification, and negative-shipping acceptance. The probe is diagnostic evidence, not a regression test asserting that these defects should remain. No provider API, mail or Dropbox operation ran. No live credentials or customer data were read.

No application code, payment configurations, database migrations or local Vend data were changed in this audit. Actual Stripe/PayPal sandbox operation, browser payment interactions, live Dropbox delivery, email delivery and all proposed new acceptance tests remain unverified.

## Official integration references

Reviewed current official documentation on 2026-11-12. These support the implementation direction, not a claim that integrations have been implemented:

- [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment.md?ui=full-page): server reconciliation, browser abandonment, asynchronous success and once-only fulfillment.
- [Stripe webhooks](https://docs.stripe.com/webhooks): signed payloads, endpoint registration and event handling.
- [Official Stripe PHP SDK](https://github.com/stripe/stripe-php): install and lock a supported release during implementation.
- [PayPal SDK v6 setup](https://developer.paypal.com/sdk/js/set-up/) and [reference](https://developer.paypal.com/sdk/js/reference/): SDK initialization, eligibility and payment callbacks. Use v6 APIs, not the older `paypal.Buttons` integration.
- [PayPal Orders v2](https://developer.paypal.com/api/orders/v2) and [webhook verification](https://developer.paypal.com/api/webhooks/v1): create/capture/retrieve and signature verification.

Sandbox/live setup instructions and the final webhook URLs belong in [the manual](MANUAL.md) when the corresponding routes and settings exist. The developer has a Stripe account and may have a PayPal account; merchant credentials are not needed for fixture-based implementation.
