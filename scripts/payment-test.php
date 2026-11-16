<?php

// Run only in the disposable, network-disabled payment-smoke.sh fixture.
if (PHP_SAPI!=='cli' || getcwd()!=='/app/dist' || !is_dir('/app/dist/vend-proofing-data/auth')) exit(2);
define('SA_DIR_AUTH', '/app/dist/vend-proofing-data/auth');
define('SA_DIR_STORAGE', '/app/dist/vend-proofing-data/storage');
define('SA_DIR_DEFAULTS', '/app/dist/vend-proofing-core/defaults');
define('SA_DIR_LANG', '/app/dist/vend-proofing-core/lang');
define('SA_DIR_CACHE', '/app/dist/vend-proofing-data/cache');
define('SA_DIR_INDEXPATH', '');
define('SA_NAMESPACE', 'vend-proofing');
define('SA_BASE_URL', 'https://vend.example.invalid');
require '/app/dist/vend-proofing-core/php/vendor/autoload.php';
spl_autoload_register(function ($name) { require '/app/dist/vend-proofing-core/php/classes/simpleadmin/' . $name . '.php'; });

function checkPayment (bool $condition, string $message): void {
	if (!$condition) throw new RuntimeException($message);
}
function rejectsPayment (callable $work, string $message): void {
	try { $work(); } catch (Throwable $error) { return; }
	throw new RuntimeException($message);
}
function setting (string $key, string $value, string $group='ordering'): void {
	$doc = Configuration::getDocument('ordering');
	$doc->editNode('data.' . $group . '.' . $key, $value);
	Configuration::save('ordering', null, $doc->toString());
}
function countPayment (string $table, string $where='1'): int {
	return (int) Database::connection()->query("SELECT COUNT(*) FROM $table WHERE $where")->fetchColumn();
}
Database::install();
Database::migrate();
checkPayment(countPayment('schema_migrations')===14, 'Migration did not apply once.');
foreach (array(array('A * .125 + Q', 80, 2, 0, 12), array('Q >= 3 ? P * .8 : P', 0, 4, 10, 8),
	array('max(2, Math.round(P / 3))', 0, 0, 10, 3), array('2 ** 3 ** 2', 0, 0, 0, 512), array('P > 0 ? 10/P : 0', 0, 1, 0, 0), array('Q && 1/Q', 0, 0, 0, 0), array('Q || 1/2', 0, 2, 0, 2)) as [$formula, $area, $quantity, $price, $expected]) {
	checkPayment(PriceExpression::evaluate($formula, $area, $quantity, $price)===$expected * 1.0, 'Pricing expression changed: ' . $formula);
}
foreach (array('system("id")', 'file_get_contents("x")', 'function(){return 1}', 'random()', '1 / 0', '1e999', 'Math.constructor(1)') as $formula) rejectsPayment(fn () => PriceExpression::evaluate($formula), 'Unsafe formula accepted.');
echo "PASS deterministic pricing formulas and rejection of executable/invalid expressions\n";

$gallery = 'a1';
Records::savePage($gallery, array('Payment fixture', 'UploadSet', '0'));
Records::addImage($gallery, array('photo.jpg', 'Photo.jpg', '640x480', '', '100'));
$groups = array();
foreach (array('format', 'paper', 'modifier', 'package', 'product') as $kind) {
	$groups[$kind] = Database::allocateSuid();
	Records::savePricingGroup($kind . 'set', $groups[$kind], array(ucfirst($kind)));
}
$format = Database::allocateSuid();
Records::savePricingItem('format', $format, $groups['format'], array('Eight by Ten', '8', '10', 'A / 8', '1'));
Records::savePricingItem('paper', Database::allocateSuid(), $groups['paper'], array('Matte', 'P / 5', '.25'));
Records::savePricingItem('modifier', Database::allocateSuid(), $groups['modifier'], array('Retouch', 'Q / 2', '0'));
$packageId = Database::allocateSuid();
Records::saveSetRow('package', $packageId, $groups['package'], array('Print Package', '', '50', '5', ''));
Records::saveSetRow('lineitem', Database::allocateSuid(), $packageId, array('Eight by Ten', '2', '8', '10'));
Records::saveSetRow('product', Database::allocateSuid(), $groups['product'], array('Canvas', '', '30', '2', ''));
$config = Configuration::getDocument('uploadset');
foreach ($groups as $kind => $id) $config->editNode('data.settings.' . $kind . '_set', $id);
Configuration::save('uploadset', $gallery, $config->toString());
Configuration::save('contact', null, file_get_contents(SA_DIR_DEFAULTS . '/contact.json'));
$session = Proofing::open($gallery, 'buyer@example.invalid');
$print = array('print', $gallery, 'photo.jpg', 'Photo.jpg', '2', 'color', 'Eight by Ten', '.8', '10', '1',
	'portrait', '0', '0', 'Matte', '2', '.25', 'Retouch', '1', '0', '13', '1.25', '');
Proofing::save($gallery, $session, 'cart', $print);
$cart = CheckoutQuote::cart($gallery, $session);
checkPayment($cart['subtotal']===26.0 && $cart['shipping']===2.5 && $cart['count']===2, 'Catalog-backed print totals incorrect.');
$bad = $print; $bad[19] = '.01';
Proofing::save($gallery, $session, 'cart', $bad);
rejectsPayment(fn () => OrderRecords::prequalify($gallery, $session, '', '', '.02'), 'Matching browser cart/order price bypassed verification.');
Proofing::save($gallery, $session, 'cart', $print);
$discountId = Database::allocateSuid();
Records::saveDiscount($discountId, $gallery, array($gallery, 'Save10', '10', 'percentage', '0', '2', '', '0', '0'));
checkPayment(OrderRecords::verifyDiscountCode($gallery, 'sAvE10', '26')[0], 'Discount lookup remains case sensitive.');
rejectsPayment(fn () => Records::saveDiscount(Database::allocateSuid(), $gallery, array($gallery, 'SAVE10', '10', 'percentage')), 'Case-only duplicate discount accepted.');
setting('shipping_flat_fee_num', '3'); setting('shipping_flat_rate_num', '10'); setting('handling_flat_fee_num', '2');
setting('shipping_taxable_bool', 'true'); setting('handling_taxable_bool', 'true');
Records::saveSetRow('ustaxchart', 'CA', null, array('California', '', '10'));
$id = OrderRecords::prequalify($gallery, $session, '', 'save10', '26');
checkPayment(OrderRecords::prequalify($gallery, $session, $id, 'SAVE10', '26')===$id, 'Case-only retry consumed another discount.');
checkPayment((int) Database::connection()->query("SELECT use_count FROM discounts WHERE code = 'Save10'")->fetchColumn()===1, 'Discount counted twice.');
$row = array($id, $gallery, '0', 'offline', '', 'ship', 'sAvE10', 'Buyer', 'buyer@example.invalid', '555', '123 Test St', 'US', '90000', 'CA',
	'36.56', '26.00', '2.60', '7.84', '2.00', '3.32', '10', 'false', 'true', 'true', '');
// Taxable 23.40 + 7.84 + 2 = 33.24; tax rounds to 3.32.
$verified = CheckoutQuote::verify($gallery, $session, $row);
checkPayment($verified['row'][14]==='36.56', 'Shipping/handling/tax verification incorrect.');
$bad = $row; $bad[17] = '-9.99'; $bad[14] = '10.00';
rejectsPayment(fn () => CheckoutQuote::verify($gallery, $session, $bad), 'Negative shipping accepted.');
$bad = $row; $bad[19] = '0'; $bad[14] = '33.24';
rejectsPayment(fn () => CheckoutQuote::verify($gallery, $session, $bad), 'Forged tax accepted.');
checkPayment(OrderRecords::create($gallery, $session, $row, 'BAD'), 'Offline order not created.');
checkPayment(!OrderRecords::create($gallery, $session, $row, 'USD'), 'Offline retry duplicated order.');
$payment = Payments::get($id);
checkPayment($payment['status']==='pending' && $payment['currency']==='USD' && !Payments::canDownload($id), 'Offline payment was paid or caller currency was trusted.');
checkPayment(countPayment('order_items')===1 && countPayment('messages', 'purpose IS NOT NULL')===2, 'Order/receipt work duplicated.');
$bad = $row; $bad[3] = 'stripe';
rejectsPayment(fn () => OrderRecords::create($gallery, $session, $bad, 'USD'), 'Retry changed provider.');
checkPayment(countPayment('discount_redemptions')===1, 'Discount redemption missing.');
checkPayment(str_contains(OrderRecords::search(date('Y/n/j'), date('Y/n/j'), array()), $id), 'Order search changed.');
checkPayment(str_contains(OrderRecords::stats(date('Y/n/j'), date('Y/n/j')), '36.56'), 'Order statistics changed.');
Records::savePricingItem('format', $format, $groups['format'], array(null, null, null, '999', null));
checkPayment(!OrderRecords::create($gallery, $session, $row, 'USD') && OrderRecords::get($id)[14]==='36.56', 'Frozen quote changed after catalog update.');
Records::savePricingItem('format', $format, $groups['format'], array(null, null, null, 'A / 8', null));
echo "PASS verified print totals, discounts without case sensitivity, shipping/tax, offline snapshot and retries\n";

// Packages preserve base price plus the existing paper/modifier allocation surcharges.
foreach (array('shipping_flat_fee_num', 'shipping_flat_rate_num', 'handling_flat_fee_num') as $key) setting($key, '0');
setting('calculate_and_display_sales_tax_bool', 'false');
$package = array('pkg-p', 'package', 'For Mom', 'Print Package', '1', '50', '5', '%:Eight%20by%20Ten', '2', '.8', '80');
Proofing::save($gallery, $session, 'package', $package);
$allocation = $print; $allocation[0] = 'allocation:pkg'; $allocation[8] = '0'; $allocation[9] = '0'; $allocation[14] = '0'; $allocation[19] = '1'; $allocation[20] = '.25';
Proofing::save($gallery, $session, 'cart', $allocation);
$cart = CheckoutQuote::cart($gallery, $session);
checkPayment($cart['subtotal']===52.0 && $cart['shipping']===5.5, 'Package/surcharge behavior changed.');
$bad = $allocation; $bad[4] = '3'; $bad[17] = '1.5'; $bad[19] = '1.5';
Proofing::save($gallery, $session, 'cart', $bad);
rejectsPayment(fn () => CheckoutQuote::cart($gallery, $session), 'Package overallocation accepted.');
Proofing::clear($gallery, $session, 'cart');
Proofing::save($gallery, $session, 'package', array('fake-p', 'product', 'Fake', 'Invented product', '1', '.01', '0', '', '', '', ''));
rejectsPayment(fn () => CheckoutQuote::cart($gallery, $session), 'Invented one-cent product accepted.');
Proofing::clear($gallery, $session, 'cart');
echo "PASS package allocations, surcharges and rejection of invented products\n";

// Provider test configuration is synthetic and never used on a network.
foreach (array('stripe_enabled_bool' => 'true', 'stripe_mode' => 'test',
	'stripe_test_publishable_key' => 'pk_test_synthetic', 'stripe_test_secret' => 'sk_test_synthetic', 'stripe_test_webhook' => 'whsec_synthetic', 'paypal_enabled_bool' => 'true', 'paypal_mode' => 'test',
	'paypal_test_client_id' => 'synthetic-client', 'paypal_test_secret' => 'synthetic-secret', 'paypal_test_webhook_id' => 'synthetic-hook') as $key => $value) setting($key, $value, 'payment_gateway');
$admin = PaymentSettings::forAdmin(Configuration::getJson('ordering'));
checkPayment(!str_contains($admin, 'sk_test_synthetic') && !str_contains($admin, 'synthetic-secret') && !str_contains($admin, 'whsec_synthetic'), 'Admin read disclosed secrets.');
Configuration::save('ordering', null, PaymentSettings::merge($admin));
checkPayment(PaymentSettings::get('stripe_test_secret')==='sk_test_synthetic', 'Unrelated save erased secret.');

function newOnlineOrder (string $provider, string $funding='paypal'): array {
	global $gallery, $session, $print;
	$session = Proofing::open($gallery, 'buyer-' . bin2hex(random_bytes(5)) . '@example.invalid');
	Proofing::save($gallery, $session, 'cart', $print);
	$id = OrderRecords::prequalify($gallery, $session, '', '', '26');
	$row = array($id, $gallery, '0', $provider, 'forged-reference', 'local', '', 'Buyer', 'buyer@example.invalid', '', '', 'US', '', 'CA', '26', '26', '0', '0', '0', '0', '0', 'false', 'true', 'true', '');
	OrderRecords::create($gallery, $session, $row, 'USD', $funding);
	return Payments::get($id);
}
// Checkout remains editable and reloadable until payment is independently confirmed.
$draft = newOnlineOrder('stripe');
$draftSession = $session;
checkPayment(OrderRecords::get($draft['suid'])===null, 'Unpaid checkout exposed an invoice.');
checkPayment(!str_contains(OrderRecords::search(date('Y/n/j'), date('Y/n/j'), array()), $draft['suid'] . "\t"), 'Unpaid checkout exposed an admin order.');
checkPayment(CheckoutQuote::cart($gallery, $session)['subtotal']===26.0, 'Opening payment emptied the cart.');
checkPayment(OrderRecords::prequalify($gallery, $session, '', '', '26')===$draft['suid'], 'Refresh lost the payment attempt.');
$draftRow = array($draft['suid'], $gallery, '0', 'stripe', '', 'local', '', 'Buyer', 'buyer@example.invalid', '', '', 'US', '', 'CA', '26', '26', '0', '0', '0', '0', '0', 'false', 'true', 'true', '');
checkPayment(!OrderRecords::create($gallery, $session, $draftRow, 'USD'), 'Repeat submission created another attempt.');
$draftRow[9] = 'new phone';
$draftRow[0] = OrderRecords::prequalify($gallery, $session, $draft['suid'], '', '26', 'new phone');
$editedId = $draftRow[0];
OrderRecords::create($gallery, $session, $draftRow, 'USD');
checkPayment($editedId!==$draft['suid'] && CheckoutQuote::cart($gallery, $session)['subtotal']===26.0, 'Editing checkout locked or emptied cart.');
$added = $print; $added[0] = 'extra';
Proofing::save($gallery, $session, 'cart', $added);
Payments::attach($draft['suid'], 'cs_cart_first');
Payments::reconcile($draft['suid'], 'stripe', 'cs_cart_first', 'pi_cart_first', 2600, 'USD', 'paid', 'cart-paid', 'verified_test');
checkPayment(OrderRecords::get($draft['suid'])[14]==='26.00', 'Payment did not place the order.');
checkPayment(count(CheckoutQuote::cart($gallery, $session)['items'])===1, 'Payment removed later cart additions.');
Payments::reconcile($draft['suid'], 'stripe', 'cs_cart_first', 'pi_cart_first', 2600, 'USD', 'paid', 'cart-paid-again', 'verified_test');
checkPayment(count(CheckoutQuote::cart($gallery, $session)['items'])===1, 'Duplicate confirmation cleared cart again.');
checkPayment(countPayment('messages', 'order_id = ' . $draft['order_id'])===2, 'Completion did not queue receipts once.');
$modified = newOnlineOrder('stripe');
$changed = $print; $changed[4] = '1'; $changed[17] = '.5'; $changed[19] = '12.5';
Proofing::save($gallery, $session, 'cart', $changed);
Payments::attach($modified['suid'], 'cs_modified');
Payments::reconcile($modified['suid'], 'stripe', 'cs_modified', 'pi_modified', 2600, 'USD', 'paid', 'modified-paid', 'verified_test');
checkPayment(count(CheckoutQuote::cart($gallery, $session)['items'])===1, 'Payment removed an edited cart selection.');
echo "PASS cart survives close/refresh, edits remain possible, order appears only after payment, selective cart clearing and replay\n";

foreach (array(false, true) as $editPackage) {
	$session = Proofing::open($gallery, 'package-' . (int) $editPackage . '@example.invalid');
	Proofing::save($gallery, $session, 'package', $package);
	Proofing::save($gallery, $session, 'cart', $allocation);
	$packageRow = $draftRow;
	$packageRow[0] = OrderRecords::prequalify($gallery, $session, '', '', '52');
	$packageRow[14] = $packageRow[15] = '52';
	OrderRecords::create($gallery, $session, $packageRow, 'USD');
	$attempt = Payments::get($packageRow[0]);
	if ($editPackage) {
		$editedAllocation = $allocation; $editedAllocation[5] = 'sepia';
		Proofing::save($gallery, $session, 'cart', $editedAllocation);
	}
	Payments::attach($attempt['suid'], 'cs_package_' . (int) $editPackage);
	Payments::reconcile($attempt['suid'], 'stripe', 'cs_package_' . (int) $editPackage, 'pi_package_' . (int) $editPackage,
		5200, 'USD', 'paid', 'package-paid-' . (int) $editPackage, 'verified_test');
	$remaining = Database::connection()->prepare('SELECT COUNT(*) FROM cart_items JOIN carts ON carts.id = cart_items.cart_id WHERE carts.session_id = ?');
	$remaining->execute(array($attempt['proofing_session_id']));
	checkPayment((int) $remaining->fetchColumn()===($editPackage ? 2 : 0), 'Package and allocation were separated or not removed after payment.');
	$remaining->closeCursor();
}
echo "PASS paid packages clear together; edited packages remain intact\n";

$stripeData = array(); $stripeCreates = 0; $stripeKeys = array();
$sessions = new class {
	public function create ($params, $options) {
		global $stripeData, $stripeCreates, $stripeKeys;
		checkPayment($params['ui_mode']==='custom' && !isset($params['redirect_on_completion']) && isset($params['return_url']) && !isset($params['success_url'], $params['cancel_url']), 'Stripe must create Elements Checkout.');
		$key = $options['idempotency_key'];
		if (!isset($stripeKeys[$key])) {
			$id = 'cs_mock_' . ++$stripeCreates; $stripeKeys[$key] = $id;
			$stripeData[$id] = array('id' => $id, 'client_reference_id' => $params['client_reference_id'], 'metadata' => $params['metadata'], 'mode' => 'payment',
				'livemode' => false, 'amount_total' => $params['line_items'][0]['price_data']['unit_amount'], 'currency' => $params['line_items'][0]['price_data']['currency'],
				'payment_intent' => null, 'payment_status' => 'unpaid', 'status' => 'open', 'client_secret' => 'cs_secret_' . $id, 'url' => 'https://checkout.stripe.com/mock/' . $id);
		}
		return \Stripe\StripeObject::constructFrom($stripeData[$stripeKeys[$key]]);
	}
	public function retrieve ($id, $options) { global $stripeData; return \Stripe\StripeObject::constructFrom($stripeData[$id]); }
};
$charges = new class {
	public function retrieve ($id, $options) {
		global $stripeData;
		$sid = substr($id, 3); $session = $stripeData[$sid];
		return \Stripe\StripeObject::constructFrom(array('id' => $id, 'payment_intent' => $session['payment_intent']['id'], 'amount' => $session['amount_total'],
			'amount_refunded' => $session['_refunded'] ?? 0, 'currency' => $session['currency'], 'status' => 'succeeded'));
	}
};
$intents = new class {
	public function retrieve ($id, $options=array()) {
		global $stripeData;
		foreach ($stripeData as $session) if (($session['payment_intent']['id'] ?? '')===$id) return \Stripe\StripeObject::constructFrom($session['payment_intent'] + array('metadata' => $session['metadata']));
		throw new RuntimeException('Unknown intent fixture.');
	}
	public function cancel ($id, $params, $options) {
		global $stripeData;
		foreach ($stripeData as &$session) if (($session['payment_intent']['id'] ?? '')===$id) $session['payment_intent']['status'] = 'canceled';
		return \Stripe\StripeObject::constructFrom(array('id' => $id, 'status' => 'canceled'));
	}
};
StripePayment::$clientFactory = fn ($mode) => (object) array('checkout' => (object) array('sessions' => $sessions), 'charges' => $charges, 'paymentIntents' => $intents);
$payment = newOnlineOrder('stripe');
checkPayment($payment['status']==='pending' && $payment['provider_reference']===null, 'Browser claimed online payment.');
StripePayment::start($payment); StripePayment::start(Payments::get($payment['suid']));
checkPayment($stripeCreates===1, 'Stripe retry created another session.');
$payment = Payments::get($payment['suid']); $sid = $payment['provider_reference'];
$stripeData[$sid]['payment_status'] = 'paid'; $stripeData[$sid]['status'] = 'complete';
$stripeData[$sid]['payment_intent'] = array('id' => 'pi_mock_' . $sid, 'status' => 'succeeded', 'amount_received' => 2600, 'currency' => 'usd', 'latest_charge' => 'ch_' . $sid);
$body = json_encode(array('id' => 'evt_mock_paid', 'type' => 'checkout.session.completed', 'livemode' => false, 'data' => array('object' => $stripeData[$sid])));
$stamp = time();
$signature = 't=' . $stamp . ',v1=' . hash_hmac('sha256', $stamp . '.' . $body, 'whsec_synthetic');
rejectsPayment(fn () => StripePayment::webhook($body, 't=1,v1=bad', 'test'), 'Invalid Stripe signature accepted.');
StripePayment::webhook($body, $signature, 'test'); StripePayment::webhook($body, $signature, 'test');
checkPayment(Payments::get($payment['suid'])['status']==='paid', 'Signed Stripe event did not settle abandoned checkout.');
checkPayment(countPayment('messages', 'order_id = ' . $payment['order_id'] . ' AND purpose IS NOT NULL')===2, 'Stripe webhook duplicated receipts.');
Payments::reconcile($payment['suid'], 'stripe', $sid, '', 2600, 'USD', 'cancelled', 'evt_late_cancel', 'expired');
checkPayment(Payments::get($payment['suid'])['status']==='paid', 'Late cancellation demoted paid order.');
foreach (array(array(2500, 'USD', $sid), array(2600, 'EUR', $sid), array(2600, 'USD', 'wrong_session')) as [$amount, $currency, $reference]) {
	rejectsPayment(fn () => Payments::reconcile($payment['suid'], 'stripe', $reference, '', $amount, $currency, 'paid', uniqid(), 'invalid'), 'Mismatched payment accepted.');
}
$original = $stripeData[$sid]['amount_total']; $stripeData[$sid]['amount_total'] = 1;
rejectsPayment(fn () => StripePayment::refresh($payment, 'bad_amount', 'retrieve'), 'Mismatched Stripe API amount accepted.');
$stripeData[$sid]['amount_total'] = $original;
echo "PASS Stripe SDK signature verification, API reconciliation, abandonment, retries and mismatches\n";

$paypalData = array(); $paypalRefunds = array(); $paypalCreates = 0; $paypalCaptures = 0; $paypalValid = true;
PayPalPayment::$transport = function ($url, $method, $body, $headers, $basic) use (&$paypalData, &$paypalRefunds, &$paypalCreates, &$paypalCaptures, &$paypalValid) {
	if (str_ends_with($url, '/v1/oauth2/token')) return array('access_token' => 'synthetic-token');
	if (str_ends_with($url, '/verify-webhook-signature')) return array('verification_status' => $paypalValid ? 'SUCCESS' : 'FAILURE');
	if (str_ends_with($url, '/v2/checkout/orders') && $method==='POST') {
		$params = json_decode($body, true); $id = 'PP_MOCK_' . ++$paypalCreates;
		$paypalData[$id] = array('id' => $id, 'intent' => 'CAPTURE', 'status' => 'CREATED', 'purchase_units' => $params['purchase_units'], 'payment_source' => $params['payment_source']);
		return $paypalData[$id];
	}
	if (preg_match('~/v2/payments/refunds/([A-Za-z0-9_-]+)$~', $url, $matches)) return $paypalRefunds[$matches[1]];
	if (preg_match('~/v2/payments/captures/(CAP_PP_MOCK_\d+)$~', $url, $matches)) {
		$id = substr($matches[1], 4); return $paypalData[$id]['purchase_units'][0]['payments']['captures'][0];
	}
	if (preg_match('~/v2/checkout/orders/(PP_MOCK_\d+)(/capture)?$~', $url, $matches)) {
		$id = $matches[1];
		if (($matches[2] ?? '')==='/capture') {
			$paypalCaptures++; $paypalData[$id]['status'] = 'COMPLETED';
			$paypalData[$id]['purchase_units'][0]['payments']['captures'] = array(array('id' => 'CAP_' . $id, 'status' => 'COMPLETED', 'final_capture' => true, 'amount' => $paypalData[$id]['purchase_units'][0]['amount']));
		}
		return $paypalData[$id];
	}
	throw new RuntimeException('Unexpected mocked PayPal request.');
};
$payment = newOnlineOrder('paypal'); $ppid = PayPalPayment::start($payment);
PayPalPayment::start(Payments::get($payment['suid']));
checkPayment($paypalCreates===1, 'PayPal retry created another order.');
$paypalData[$ppid]['status'] = 'APPROVED';
$event = json_encode(array('id' => 'PP_EVENT_APPROVED', 'event_type' => 'CHECKOUT.ORDER.APPROVED', 'resource' => array('id' => $ppid)));
$headers = array(); foreach (array('AUTH_ALGO', 'CERT_URL', 'TRANSMISSION_ID', 'TRANSMISSION_SIG', 'TRANSMISSION_TIME') as $key) $headers['HTTP_PAYPAL_' . $key] = 'synthetic';
$paypalValid = false; rejectsPayment(fn () => PayPalPayment::webhook($event, $headers, 'test'), 'Invalid PayPal signature accepted.'); $paypalValid = true;
PayPalPayment::webhook($event, $headers, 'test'); PayPalPayment::webhook($event, $headers, 'test');
checkPayment($paypalCaptures===1 && Payments::get($payment['suid'])['status']==='paid', 'PayPal approval webhook did not capture exactly once.');
$paypalData[$ppid]['purchase_units'][0]['custom_id'] = 'other_order';
rejectsPayment(fn () => PayPalPayment::refresh(Payments::get($payment['suid']), true, 'wrong_owner', 'capture'), 'Wrong PayPal order ownership accepted.');
$paypalData[$ppid]['purchase_units'][0]['custom_id'] = $payment['suid'];
echo "PASS PayPal mocked create/capture, signature verification, browser abandonment, duplicates and ownership\n";

// SMTP failure must not change a successful financial result.
class Email {
	public static int $sent = 0;
	public static bool $fail = true;
	public function __call ($name, $args) { return null; }
	public function send () { self::$sent++; }
	public function success () { return !self::$fail; }
}
PaymentGateway::sendReceipts($payment['suid']);
checkPayment(Email::$sent===2 && Payments::get($payment['suid'])['status']==='paid', 'Receipt failure damaged payment.');
PaymentGateway::sendReceipts($payment['suid']);
checkPayment(Email::$sent===2, 'Failed receipts were retried without explicit recovery.');
Database::connection()->prepare("UPDATE messages SET delivery_status = 'queued' WHERE order_id = ? AND purpose IS NOT NULL AND delivery_status = 'failed'")->execute(array($payment['order_id']));
Email::$fail = false; PaymentGateway::sendReceipts($payment['suid']); PaymentGateway::sendReceipts($payment['suid']);
checkPayment(Email::$sent===4 && countPayment('messages', "order_id = " . $payment['order_id'] . " AND purpose IS NOT NULL AND delivery_status = 'sent'")===2, 'Receipt recovery duplicated sends.');
echo "PASS receipt failures preserve payment; explicit recovery and ordinary retries do not duplicate sends\n";

// Pending/declined/expired attempts cannot create entitlement or repeat a paid transition.
foreach (array('failed', 'cancelled', 'pending') as $state) {
	$trial = newOnlineOrder('stripe'); Payments::attach($trial['suid'], 'cs_' . $trial['suid']);
	Payments::reconcile($trial['suid'], 'stripe', 'cs_' . $trial['suid'], '', 2600, 'USD', $state, 'state:' . $trial['suid'], $state);
	checkPayment(OrderRecords::get($trial['suid'])===null && CheckoutQuote::cart($gallery, $session)['subtotal']===26.0, 'Unpaid attempt consumed the cart or placed an order.');
	checkPayment(Payments::get($trial['suid'])['status']===$state && countPayment('messages', 'order_id = ' . $trial['order_id'] . ' AND purpose IS NOT NULL')===0, 'Unpaid attempt caused downstream effects.');
}
$trial = newOnlineOrder('stripe'); StripePayment::start($trial); $trial = Payments::get($trial['suid']);
$stripeData[$trial['provider_reference']]['status'] = 'expired';
StripePayment::refresh($trial, 'expired_api', 'checkout.session.expired');
checkPayment(Payments::get($trial['suid'])['status']==='cancelled', 'Expired Stripe session was not cancelled.');
checkPayment(StripePayment::providerAmount(1000, 'JPY')===10 && StripePayment::providerAmount(1000, 'KWD')===10000, 'Provider currency conversion wrong.');
rejectsPayment(fn () => StripePayment::providerAmount(1050, 'JPY'), 'Fractional yen accepted.');
echo "PASS pending, failed, cancelled and expired attempts; currency conversion\n";

// Discount expiry/minimum/exhaustion still share the established eligibility rules.
foreach (array(array('EXPIRED', '0', (string) ((time() - 86400) * 1000), '0', 'discount_expired'),
	array('MINIMUM', '0', '', '100', 'discount_cart_minimum_not_fulfilled'),
	array('USED', '1', '', '0', 'discount_maximum_uses_filled')) as [$code, $uses, $expiry, $minimum, $errorKey]) {
	Records::saveDiscount(Database::allocateSuid(), $gallery, array($gallery, $code, '10', 'percentage', $uses, '1', $expiry, $minimum, '0'));
	checkPayment(OrderRecords::verifyDiscountCode($gallery, strtolower($code), '26')===array(false, $errorKey), 'Discount policy changed.');
}

// Canadian compound tax, VAT, pickup and international shipping use the existing rules.
Proofing::save($gallery, $session, 'cart', $print);
$id = OrderRecords::prequalify($gallery, $session, '', '', '26');
$taxRow = array($id, $gallery, '0', 'offline', '', 'local', '', 'Buyer', 'buyer@example.invalid', '', '', 'CA', '', 'QC', '29.90', '26', '0', '0', '0', '3.90', '0', 'false', 'false', 'false', '');
setting('default_country', 'CA'); setting('calculate_and_display_sales_tax_bool', 'true');
Records::saveSetRow('cataxchart', 'QC', null, array('Quebec', '0', '5', '10', ''));
// Legacy Quebec calculation taxes PST on the taxable amount plus GST: 15.5%.
$taxRow[14] = '30.03'; $taxRow[19] = '4.03';
CheckoutQuote::verify($gallery, $session, $taxRow);
setting('default_country', 'GB');
Records::saveSetRow('vattaxchart', 'GB', null, array('United Kingdom', '20'));
$taxRow[11] = 'GB'; $taxRow[13] = ''; $taxRow[14] = '31.20'; $taxRow[19] = '5.20';
CheckoutQuote::verify($gallery, $session, $taxRow);
setting('default_country', 'US'); setting('allow_international_purchases_bool', 'true'); setting('calculate_and_display_sales_tax_bool', 'false');
setting('international_handling_flat_fee_num', '4');
$taxRow[5] = 'ship'; $taxRow[11] = 'CA'; $taxRow[13] = 'ON'; $taxRow[17] = '2.50'; $taxRow[18] = '4'; $taxRow[19] = '0'; $taxRow[14] = '32.50';
CheckoutQuote::verify($gallery, $session, $taxRow);
setting('allow_local_pickup_bool', 'false'); $taxRow[5] = 'local';
rejectsPayment(fn () => CheckoutQuote::verify($gallery, $session, $taxRow), 'Disabled pickup accepted.');
setting('allow_local_pickup_bool', 'true'); setting('allow_international_purchases_bool', 'false'); setting('international_handling_flat_fee_num', '0');
Proofing::clear($gallery, $session, 'cart');
echo "PASS discount eligibility, Canadian compound tax, VAT, pickup and international handling\n";

$digitalGallery = 'b1'; Records::savePage($digitalGallery, array('Digital fixture', 'DropboxSet', '0'));
Records::syncDropboxImages($digitalGallery, array(
	array('id' => 'id:digital-a', 'name' => 'a.jpg', 'path_lower' => '/b1/a.jpg', 'path_display' => '/b1/a.jpg', 'rev' => 'abcdef123', 'size' => 1),
	array('id' => 'id:digital-b', 'name' => 'b.jpg', 'path_lower' => '/b1/b.jpg', 'path_display' => '/b1/b.jpg', 'rev' => 'abcdef123', 'size' => 1)
));
$digitalKey = array_key_first(Records::imageRows($digitalGallery));
$download = Configuration::getDocument('downloads');
foreach (array('allow_single_downloads_bool' => 'true', 'allow_web_version_bool' => 'true', 'allow_download_all_bool' => 'true', 'download_all_flatfee_bool' => 'true', 'single_download_price' => '4.25', 'web_version_download_price' => '1.50', 'single_download_all_price' => '6.50') as $key => $value) $download->editNode('data.settings.' . $key, $value);
Configuration::save('downloads', null, $download->toString());
$digitalSession = Proofing::open($digitalGallery, 'digital@example.invalid');
Proofing::addDownloads($digitalGallery, $digitalSession, 'cart', 'high', 6.50, true);
checkPayment(CheckoutQuote::cart($digitalGallery, $digitalSession)['subtotal']===6.5, 'Bulk flat price changed.');
$keys = array_keys(Proofing::responseRows($digitalGallery, $digitalSession, 'download'));
Proofing::deleteItem($digitalGallery, $digitalSession, 'download', $keys[0]);
rejectsPayment(fn () => CheckoutQuote::cart($digitalGallery, $digitalSession), 'Incomplete flat-price bundle accepted.');
Proofing::clear($digitalGallery, $digitalSession, 'cart');
Proofing::save($digitalGallery, $digitalSession, 'download', array('digital-d', $digitalGallery, $digitalKey, 'a.jpg', '640x480', 'high', '4.25', '0'));
$id = OrderRecords::prequalify($digitalGallery, $digitalSession, '', '', '4.25');
$digitalRow = array($id, $digitalGallery, '0', 'offline', '', 'local', '', 'Digital Buyer', 'digital@example.invalid', '', '', 'US', '', 'CA', '4.25', '4.25', '0', '0', '0', '0', '0', 'false', 'false', 'false', '');
rejectsPayment(fn () => OrderRecords::create($digitalGallery, $digitalSession, $digitalRow, 'USD'), 'Unpaid manual digital purchase accepted.');
$digitalRow[3] = 'stripe'; OrderRecords::create($digitalGallery, $digitalSession, $digitalRow, 'USD');
Payments::attach($id, 'cs_digital');
checkPayment(!Payments::canDownload($id), 'Pending order authorized digital delivery.');
Payments::reconcile($id, 'stripe', 'cs_digital', 'pi_digital', 425, 'USD', 'paid', 'digital_paid', 'completed');
Payments::reconcile($id, 'stripe', 'cs_digital', 'pi_digital', 425, 'USD', 'paid', 'digital_paid', 'completed');
checkPayment(Payments::canDownload($id) && countPayment('fulfillments', "method = 'digital'")===1, 'Digital entitlement not created exactly once.');
(static function ($id, $digitalGallery) { require __DIR__ . '/download-test.php'; })($id, $digitalGallery);
Payments::refund($id, 'stripe', 'pi_digital', 'refund_a', 100, 'USD'); Payments::refund($id, 'stripe', 'pi_digital', 'refund_a', 100, 'USD');
checkPayment(Payments::get($id)['status']==='paid' && (int) Payments::get($id)['refunded_minor']===100, 'Partial refund duplicated or declared full refund.');
Payments::refund($id, 'stripe', 'pi_digital', 'refund_b', 325, 'USD');
checkPayment(Payments::get($id)['status']==='refunded' && !Payments::canDownload($id), 'Full refund did not revoke digital entitlement.');
rejectsPayment(fn () => Downloads::prepare($id), 'Refunded order prepared downloads.');
rejectsPayment(fn () => Downloads::links($id), 'Refunded order obtained links.');
Payments::reconcile($id, 'stripe', 'cs_digital', 'pi_digital', 425, 'USD', 'paid', 'late_digital_success', 'completed');
checkPayment(!Payments::canDownload($id), 'Late success restored refunded entitlement.');
$download->editNode('data.settings.single_download_price', '0'); Configuration::save('downloads', null, $download->toString());
Proofing::save($digitalGallery, $digitalSession, 'download', array('free-d', $digitalGallery, $digitalKey, 'a.jpg', '640x480', 'high', '0', '0'));
$id = OrderRecords::prequalify($digitalGallery, $digitalSession, '', '', '0'); $digitalRow[0] = $id; $digitalRow[3] = 'offline'; $digitalRow[14] = '0'; $digitalRow[15] = '0';
// The download-only UI hides the address when downloads are not taxable.
setting('calculate_and_display_sales_tax_bool', 'true');
$digitalRow[13] = '--';
setting('downloads_taxable_bool', 'true');
rejectsPayment(fn () => CheckoutQuote::verify($digitalGallery, $digitalSession, $digitalRow), 'Taxable downloads accepted a missing tax location.');
setting('downloads_taxable_bool', 'false');
OrderRecords::create($digitalGallery, $digitalSession, $digitalRow, 'USD');
checkPayment(Payments::canDownload($id), 'Non-taxable free download with hidden/unset state was rejected.');
setting('calculate_and_display_sales_tax_bool', 'false');
rejectsPayment(fn () => Payments::authorize($id, 'wrong-token'), 'Order access token not enforced.');
checkPayment(!str_contains(Payments::summary($id), Payments::get($id)['access_token']), 'Diagnostic output disclosed order access token.');
echo "PASS digital individual/bulk pricing, paid-only entitlement, duplicate/full/partial refunds and free orders\n";

// Expiry recovery keeps the Vend order and quote, while retaining the expired provider attempt.
$trial = newOnlineOrder('stripe'); StripePayment::start($trial); $trial = Payments::get($trial['suid']);
$stripeData[$trial['provider_reference']]['status'] = 'expired';
$url = StripePayment::start($trial);
$retry = Payments::get($trial['suid']);
checkPayment($retry['id']!==$trial['id'] && $retry['provider_reference']!==$trial['provider_reference']
	&& countPayment('payments', 'order_id = ' . $trial['order_id'])===2 && str_starts_with($url['clientSecret'], 'cs_secret_'), 'Expired checkout not recoverable on original order.');

function paymentWorkers (string $mode): void {
	$workers = array();
	for ($i=0; $i<8; $i++) {
		$process = proc_open(array(PHP_BINARY, '../scripts/payment-worker.php', $mode), array(1 => array('pipe', 'w'), 2 => array('pipe', 'w')), $pipes);
		$workers[] = array($process, $pipes);
	}
	foreach ($workers as [$process, $pipes]) {
		$out = stream_get_contents($pipes[1]); $error = stream_get_contents($pipes[2]); fclose($pipes[1]); fclose($pipes[2]);
		checkPayment(proc_close($process)===0 && trim($out)==='ok', 'Concurrent payment worker failed: ' . $error . $out);
	}
}
$session = Proofing::open($gallery, 'concurrent@example.invalid');
Proofing::save($gallery, $session, 'cart', $print);
$id = OrderRecords::prequalify($gallery, $session, '', '', '26');
$row = array($id, $gallery, '0', 'stripe', '', 'local', '', 'Concurrent Buyer', 'buyer@example.invalid', '', '', 'US', '', 'CA', '26', '26', '0', '0', '0', '0', '0', 'false', 'true', 'true', '');
file_put_contents('/tmp/payment-worker.json', json_encode(array($gallery, $session, $row, 'USD')));
paymentWorkers('submit');
$payment = Payments::get($id); Payments::attach($id, 'cs_concurrent');
file_put_contents('/tmp/payment-worker.json', json_encode(array($id, 'stripe', 'cs_concurrent', 'pi_concurrent', 2600, 'USD', 'paid', 'concurrent_paid', 'completed')));
paymentWorkers('event');
checkPayment(countPayment('orders', "suid = '$id'")===1 && countPayment('payments', 'order_id = ' . $payment['order_id'])===1
	&& countPayment('messages', 'order_id = ' . $payment['order_id'] . ' AND purpose IS NOT NULL')===2
	&& countPayment('payment_events', 'payment_id = ' . $payment['id'])===1, 'Concurrent submissions/events duplicated effects.');
echo "PASS expired-session recovery and eight concurrent order submissions/webhook events\n";

// Refund-before-completion events must not briefly release a fully refunded order.
$trial = newOnlineOrder('stripe'); StripePayment::start($trial); $trial = Payments::get($trial['suid']); $sid = $trial['provider_reference'];
$stripeData[$sid]['payment_status'] = 'paid'; $stripeData[$sid]['status'] = 'complete'; $stripeData[$sid]['_refunded'] = 2600;
$stripeData[$sid]['payment_intent'] = array('id' => 'pi_' . $sid, 'status' => 'succeeded', 'amount_received' => 2600, 'currency' => 'usd', 'latest_charge' => 'ch_' . $sid);
$event = json_encode(array('id' => 'evt_refund_first', 'type' => 'charge.refunded', 'livemode' => false, 'data' => array('object' => array('id' => 'ch_' . $sid, 'payment_intent' => 'pi_' . $sid, 'metadata' => array()))));
$stamp = time();
$sig = 't=' . $stamp . ',v1=' . hash_hmac('sha256', $stamp . '.' . $event, 'whsec_synthetic');
StripePayment::webhook($event, $sig, 'test'); StripePayment::refresh(Payments::get($trial['suid']), 'late_completion', 'checkout.session.completed');
checkPayment(Payments::get($trial['suid'])['status']==='refunded' && countPayment('messages', 'order_id = ' . $trial['order_id'] . ' AND purpose IS NOT NULL')===0, 'Stripe refund-first events triggered paid effects.');
$trial = newOnlineOrder('stripe'); StripePayment::start($trial); $trial = Payments::get($trial['suid']); $sid = $trial['provider_reference'];
$stripeData[$sid]['status'] = 'complete';
$stripeData[$sid]['payment_intent'] = array('id' => 'pi_failed_' . $sid, 'status' => 'requires_payment_method');
StripePayment::start($trial);
checkPayment(Payments::get($trial['suid'])['id']!==$trial['id'], 'Failed completed Stripe checkout was not safely replaced after intent cancellation.');
$trial = newOnlineOrder('paypal'); $ppid = PayPalPayment::start($trial); $captureId = 'CAP_' . $ppid;
$paypalData[$ppid]['status'] = 'COMPLETED';
$paypalData[$ppid]['purchase_units'][0]['payments']['captures'] = array(array('id' => $captureId, 'status' => 'PARTIALLY_REFUNDED', 'final_capture' => true,
	'amount' => array('value' => '26.00', 'currency_code' => 'USD'), 'invoice_id' => $trial['suid'], 'supplementary_data' => array('related_ids' => array('order_id' => $ppid))));
$paypalRefunds['RF_FIRST'] = array('id' => 'RF_FIRST', 'status' => 'COMPLETED', 'invoice_id' => $trial['suid'],
	'amount' => array('value' => '1.00', 'currency_code' => 'USD'), 'links' => array(array('rel' => 'up', 'href' => 'https://api-m.sandbox.paypal.com/v2/payments/captures/' . $captureId)));
$event = json_encode(array('id' => 'PP_REFUND_FIRST', 'event_type' => 'PAYMENT.CAPTURE.REFUNDED', 'resource' => array('id' => 'RF_FIRST')));
PayPalPayment::webhook($event, $headers, 'test'); PayPalPayment::webhook($event, $headers, 'test');
checkPayment(Payments::get($trial['suid'])['status']==='paid' && (int) Payments::get($trial['suid'])['refunded_minor']===100, 'PayPal refund before completion was lost or duplicated.');
$paypalData[$ppid]['purchase_units'][0]['payments']['captures'][0]['status'] = 'REFUNDED';
PayPalPayment::refresh(Payments::get($trial['suid']), false, 'PP_FULL_REFUND', 'PAYMENT.CAPTURE.REFUNDED');
checkPayment(Payments::get($trial['suid'])['status']==='refunded', 'Current PayPal capture refund state was not reconciled.');
echo "PASS adapter reconciliation of refund-first events and safe failed-Stripe recovery\n";

$trial = newOnlineOrder('paypal'); $ppid = PayPalPayment::start($trial);
$paypalData[$ppid]['status'] = 'COMPLETED';
$paypalData[$ppid]['purchase_units'][0]['payments']['captures'] = array(array('id' => 'CAP_' . $ppid, 'status' => 'PENDING', 'final_capture' => true, 'amount' => array('value' => '26.00', 'currency_code' => 'USD')));
PayPalPayment::refresh(Payments::get($trial['suid']), false, 'pp_pending_api', 'PAYMENT.CAPTURE.PENDING');
checkPayment(Payments::get($trial['suid'])['status']==='pending', 'Pending PayPal API capture was paid.');
$paypalData[$ppid]['purchase_units'][0]['payments']['captures'][0]['status'] = 'DECLINED';
PayPalPayment::refresh(Payments::get($trial['suid']), false, 'pp_declined_api', 'PAYMENT.CAPTURE.DENIED');
checkPayment(Payments::get($trial['suid'])['status']==='failed', 'Declined PayPal API capture was not failed.');
$retryOrder = PayPalPayment::start(Payments::get($trial['suid']));
checkPayment($retryOrder!==$ppid && Payments::get($trial['suid'])['status']==='pending', 'Declined PayPal attempt could not recover on same order.');
$trial = newOnlineOrder('stripe');
Database::connection()->prepare('UPDATE payments SET created_at = ? WHERE id = ?')->execute(array(time() - 86400, $trial['id']));
$creates = $stripeCreates;
rejectsPayment(fn () => StripePayment::start(Payments::get($trial['suid'])), 'Ambiguous Stripe creation retried beyond safe idempotency window.');
checkPayment($stripeCreates===$creates, 'Stale retry created a possible duplicate charge.');
setting('stripe_enabled_bool', 'false', 'payment_gateway');
rejectsPayment(fn () => newOnlineOrder('stripe'), 'Disabled provider accepted a new checkout.');
setting('stripe_enabled_bool', 'true', 'payment_gateway');
echo "PASS PayPal pending/declined capture recovery, safe stale-attempt handling and disabled-method enforcement\n";

// Venmo uses the same order snapshot, PayPal account and reconciliation path.
$venmo = newOnlineOrder('paypal', 'venmo');
$venmoId = PayPalPayment::start($venmo);
checkPayment(isset($paypalData[$venmoId]['payment_source']['venmo']), 'Venmo funding source not passed to PayPal.');
checkPayment(Payments::get($venmo['suid'])['funding']==='venmo', 'Venmo choice not retained for retries.');
$paypalData[$venmoId]['status'] = 'APPROVED';
PayPalPayment::refresh(Payments::get($venmo['suid']), true, 'venmo-approved', 'approved');
PayPalPayment::refresh(Payments::get($venmo['suid']), true, 'venmo-repeat', 'approved');
checkPayment(Payments::get($venmo['suid'])['status']==='paid', 'Venmo capture did not reconcile.');
echo "PASS Elements Stripe sessions and Venmo shared capture/reconciliation\n";

// Funding is fixed with the snapshot and cannot be switched on replay.
rejectsPayment(fn () => newOnlineOrder('stripe', 'venmo'), 'Venmo accepted under Stripe.');
rejectsPayment(fn () => newOnlineOrder('paypal', 'invented'), 'Unknown funding accepted.');
setting('default_currency', 'EUR');
rejectsPayment(fn () => newOnlineOrder('paypal', 'venmo'), 'Venmo accepted outside USD.');
setting('default_currency', 'USD');
setting('stripe_test_publishable_key', '', 'payment_gateway');
checkPayment(!PaymentSettings::configured('stripe'), 'Embedded Stripe enabled without publishable key.');
setting('stripe_test_publishable_key', 'pk_test_synthetic', 'payment_gateway');
checkPayment(PaymentSettings::configured('stripe'), 'Configured Elements Stripe unavailable.');
echo "PASS funding boundaries and Elements publishable-key configuration\n";
