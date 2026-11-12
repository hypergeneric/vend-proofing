ALTER TABLE favorites ADD COLUMN public_key TEXT;
ALTER TABLE favorites ADD COLUMN selection_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(selection_json));
CREATE UNIQUE INDEX favorites_session_key ON favorites(session_id, public_key);

ALTER TABLE cart_items ADD COLUMN public_key TEXT;
CREATE UNIQUE INDEX cart_items_cart_key ON cart_items(cart_id, public_key);
