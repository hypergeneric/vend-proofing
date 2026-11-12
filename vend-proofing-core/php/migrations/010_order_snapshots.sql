ALTER TABLE orders ADD COLUMN placed_at_ms INTEGER;
ALTER TABLE orders ADD COLUMN payment_type TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN transaction_reference TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN discount_code TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN country_code TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN postal_code TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN subdivision_code TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN tax_rate_text TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN prices_include_tax TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN shipping_taxable TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN handling_taxable TEXT NOT NULL DEFAULT '';

ALTER TABLE order_items ADD COLUMN public_key TEXT;
CREATE UNIQUE INDEX order_items_public_key ON order_items(order_id, public_key);

CREATE TABLE payment_logs (
	id INTEGER PRIMARY KEY,
	order_suid TEXT NOT NULL,
	body TEXT NOT NULL,
	created_at INTEGER NOT NULL
);
CREATE INDEX payment_logs_order ON payment_logs(order_suid, id);
