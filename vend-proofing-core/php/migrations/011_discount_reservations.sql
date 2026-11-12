CREATE TABLE discount_reservations (
	order_suid TEXT PRIMARY KEY,
	discount_id INTEGER NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
	gallery_id INTEGER NOT NULL REFERENCES galleries(page_id) ON DELETE CASCADE,
	session_key TEXT NOT NULL,
	code TEXT NOT NULL,
	subtotal_minor INTEGER NOT NULL,
	discount_minor INTEGER NOT NULL,
	created_at INTEGER NOT NULL
);

CREATE INDEX discount_reservations_discount ON discount_reservations(discount_id);
