-- Payment state is separate from order/production state. No historical provider import.
ALTER TABLE orders ADD COLUMN submission_hash TEXT;
ALTER TABLE orders ADD COLUMN access_token TEXT;
CREATE UNIQUE INDEX orders_submission ON orders(proofing_session_id, submission_hash);
ALTER TABLE payments ADD COLUMN provider_mode TEXT NOT NULL DEFAULT 'test';
ALTER TABLE payments ADD COLUMN transaction_id TEXT;
ALTER TABLE payments ADD COLUMN refunded_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN error_code TEXT NOT NULL DEFAULT '';
CREATE INDEX payments_order ON payments(order_id, id);
CREATE UNIQUE INDEX fulfillments_order_method ON fulfillments(order_id, method);
ALTER TABLE messages ADD COLUMN purpose TEXT;
CREATE UNIQUE INDEX messages_order_purpose ON messages(order_id, purpose);

-- SQLite NOCASE matches the ASCII codes used by Vend. Reject case-only duplicates.
DROP INDEX discounts_scope_code;
CREATE UNIQUE INDEX discounts_scope_code ON discounts(COALESCE(gallery_id, 0), code COLLATE NOCASE);

ALTER TABLE carts ADD COLUMN checkout_suid TEXT;
ALTER TABLE carts ADD COLUMN checkout_hash TEXT;
