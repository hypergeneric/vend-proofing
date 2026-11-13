CREATE TABLE id_sequences (name TEXT PRIMARY KEY, next_value INTEGER NOT NULL CHECK (next_value > 0));
INSERT INTO id_sequences (name, next_value) VALUES ('suid', 50000);

CREATE TABLE administrators (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_type TEXT NOT NULL DEFAULT 'admin' CHECK (user_type IN ('admin', 'manager')),
	username TEXT NOT NULL UNIQUE, email TEXT NOT NULL,
	password_hash TEXT NOT NULL, account_version INTEGER NOT NULL DEFAULT 1 CHECK (account_version > 0),
	created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE admin_sessions (
	id_hash TEXT PRIMARY KEY, administrator_id INTEGER NOT NULL REFERENCES administrators(id) ON DELETE CASCADE,
	account_version INTEGER NOT NULL, request_token TEXT NOT NULL, expires_at INTEGER NOT NULL,
	created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL
);
CREATE INDEX admin_sessions_expiry ON admin_sessions(expires_at);

CREATE TABLE administrator_password_resets (
	administrator_id INTEGER PRIMARY KEY REFERENCES administrators(id) ON DELETE CASCADE,
	token_hash TEXT NOT NULL UNIQUE, account_version INTEGER NOT NULL,
	created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE administrator_recovery_limits (
	bucket_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX administrator_recovery_limits_expiry ON administrator_recovery_limits(expires_at);

CREATE TABLE pages (
	id INTEGER PRIMARY KEY, suid TEXT NOT NULL UNIQUE, parent_id INTEGER REFERENCES pages(id) ON DELETE RESTRICT,
	kind TEXT NOT NULL, title TEXT NOT NULL, slug TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL DEFAULT 0,
	published INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0, 1)), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX pages_parent_position ON pages(parent_id, position);
CREATE TABLE galleries (
	page_id INTEGER PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE, gallery_type TEXT NOT NULL,
	expires_at INTEGER, access_password_hash TEXT, settings_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(settings_json)),
	status TEXT NOT NULL DEFAULT 'active'
);
CREATE TABLE media_assets (
	id INTEGER PRIMARY KEY, public_key TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL,
	media_type TEXT NOT NULL, relative_path TEXT, width REAL, height REAL, byte_size INTEGER CHECK (byte_size >= 0),
	duration REAL, source_uri TEXT, metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
	status TEXT NOT NULL DEFAULT 'ready', created_at INTEGER NOT NULL
);
CREATE TABLE gallery_categories (
	id INTEGER PRIMARY KEY, gallery_id INTEGER NOT NULL REFERENCES galleries(page_id) ON DELETE CASCADE,
	parent_id INTEGER REFERENCES gallery_categories(id) ON DELETE RESTRICT, name TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX gallery_categories_order ON gallery_categories(gallery_id, position);
CREATE TABLE gallery_images (
	id INTEGER PRIMARY KEY, gallery_id INTEGER NOT NULL REFERENCES galleries(page_id) ON DELETE CASCADE,
	asset_id INTEGER NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
	category_id INTEGER REFERENCES gallery_categories(id) ON DELETE SET NULL,
	position INTEGER NOT NULL DEFAULT 0, caption TEXT NOT NULL DEFAULT '', source_entry TEXT, status TEXT NOT NULL DEFAULT 'ready',
	UNIQUE (gallery_id, asset_id)
);
CREATE INDEX gallery_images_order ON gallery_images(gallery_id, position);
CREATE TABLE gallery_archives (
	id INTEGER PRIMARY KEY, gallery_id INTEGER NOT NULL REFERENCES galleries(page_id) ON DELETE CASCADE,
	asset_id INTEGER NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
	verification_status TEXT NOT NULL DEFAULT 'pending', verified_at INTEGER
);
CREATE TABLE archive_entries (
	id INTEGER PRIMARY KEY, archive_id INTEGER NOT NULL REFERENCES gallery_archives(id) ON DELETE CASCADE,
	entry_name TEXT NOT NULL, image_id INTEGER REFERENCES gallery_images(id) ON DELETE SET NULL,
	category_id INTEGER REFERENCES gallery_categories(id) ON DELETE SET NULL,
	position INTEGER NOT NULL DEFAULT 0, metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
	UNIQUE (archive_id, entry_name)
);

CREATE TABLE pricing_groups (
	id INTEGER PRIMARY KEY, suid TEXT NOT NULL UNIQUE, kind TEXT NOT NULL CHECK (kind IN ('format', 'paper', 'modifier', 'package', 'product')),
	name TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE formats (
	id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL REFERENCES pricing_groups(id) ON DELETE RESTRICT,
	suid TEXT NOT NULL UNIQUE, name TEXT NOT NULL, width REAL, height REAL,
	price_expression TEXT NOT NULL DEFAULT '0', shipping_expression TEXT NOT NULL DEFAULT '0', position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE papers (
	id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL REFERENCES pricing_groups(id) ON DELETE RESTRICT,
	suid TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
	price_expression TEXT NOT NULL DEFAULT '0', shipping_expression TEXT NOT NULL DEFAULT '0', position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE modifiers (
	id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL REFERENCES pricing_groups(id) ON DELETE RESTRICT,
	suid TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
	price_expression TEXT NOT NULL DEFAULT '0', shipping_expression TEXT NOT NULL DEFAULT '0', position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE packages (
	id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL REFERENCES pricing_groups(id) ON DELETE RESTRICT,
	suid TEXT NOT NULL UNIQUE, name TEXT NOT NULL, image_asset_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL,
	price_expression TEXT NOT NULL DEFAULT '0', shipping_expression TEXT NOT NULL DEFAULT '0',
	description TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE products (
	id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL REFERENCES pricing_groups(id) ON DELETE RESTRICT,
	suid TEXT NOT NULL UNIQUE, name TEXT NOT NULL, image_asset_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL,
	price_expression TEXT NOT NULL DEFAULT '0', shipping_expression TEXT NOT NULL DEFAULT '0',
	description TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE package_components (
	id INTEGER PRIMARY KEY, package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
	suid TEXT NOT NULL UNIQUE, label TEXT NOT NULL, quantity INTEGER NOT NULL CHECK (quantity > 0),
	width REAL, height REAL, position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE product_components (
	id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
	suid TEXT NOT NULL UNIQUE, label TEXT NOT NULL, quantity INTEGER NOT NULL CHECK (quantity > 0),
	width REAL, height REAL, position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE download_profiles (
	id INTEGER PRIMARY KEY, suid TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
	settings_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(settings_json))
);
CREATE TABLE gallery_pricing (
	gallery_id INTEGER PRIMARY KEY REFERENCES galleries(page_id) ON DELETE CASCADE,
	format_group_id INTEGER REFERENCES pricing_groups(id) ON DELETE RESTRICT,
	paper_group_id INTEGER REFERENCES pricing_groups(id) ON DELETE RESTRICT,
	modifier_group_id INTEGER REFERENCES pricing_groups(id) ON DELETE RESTRICT,
	package_group_id INTEGER REFERENCES pricing_groups(id) ON DELETE RESTRICT,
	product_group_id INTEGER REFERENCES pricing_groups(id) ON DELETE RESTRICT,
	download_profile_id INTEGER REFERENCES download_profiles(id) ON DELETE RESTRICT
);

CREATE TABLE proofing_sessions (
	id INTEGER PRIMARY KEY, gallery_id INTEGER NOT NULL REFERENCES galleries(page_id) ON DELETE RESTRICT,
	email TEXT NOT NULL, email_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
	created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE (gallery_id, email_key)
);
CREATE TABLE favorites (
	id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES proofing_sessions(id) ON DELETE CASCADE,
	image_id INTEGER NOT NULL REFERENCES gallery_images(id) ON DELETE RESTRICT,
	position INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, UNIQUE (session_id, image_id)
);
CREATE TABLE carts (
	id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL UNIQUE REFERENCES proofing_sessions(id) ON DELETE CASCADE,
	currency TEXT NOT NULL DEFAULT 'USD', updated_at INTEGER NOT NULL
);
CREATE TABLE cart_items (
	id INTEGER PRIMARY KEY, cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
	item_type TEXT NOT NULL CHECK (item_type IN ('print', 'download', 'package', 'product', 'allocation')),
	image_id INTEGER REFERENCES gallery_images(id) ON DELETE RESTRICT,
	format_id INTEGER REFERENCES formats(id) ON DELETE RESTRICT,
	paper_id INTEGER REFERENCES papers(id) ON DELETE RESTRICT,
	modifier_id INTEGER REFERENCES modifiers(id) ON DELETE RESTRICT,
	package_id INTEGER REFERENCES packages(id) ON DELETE RESTRICT,
	product_id INTEGER REFERENCES products(id) ON DELETE RESTRICT,
	parent_item_id INTEGER REFERENCES cart_items(id) ON DELETE CASCADE,
	package_component_id INTEGER REFERENCES package_components(id) ON DELETE RESTRICT,
	product_component_id INTEGER REFERENCES product_components(id) ON DELETE RESTRICT,
	quantity INTEGER NOT NULL CHECK (quantity > 0),
	selection_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(selection_json)),
	quoted_unit_minor INTEGER, quoted_shipping_minor INTEGER, position INTEGER NOT NULL DEFAULT 0,
	CHECK (package_component_id IS NULL OR product_component_id IS NULL)
);
CREATE INDEX cart_items_order ON cart_items(cart_id, position);

CREATE TABLE discounts (
	id INTEGER PRIMARY KEY, gallery_id INTEGER REFERENCES galleries(page_id) ON DELETE CASCADE,
	code TEXT NOT NULL, kind TEXT NOT NULL, value_text TEXT NOT NULL, minimum_minor INTEGER NOT NULL DEFAULT 0,
	max_uses INTEGER, use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0), expires_at INTEGER,
	active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);
CREATE UNIQUE INDEX discounts_scope_code ON discounts(COALESCE(gallery_id, 0), code);
CREATE TABLE tax_rates (
	id INTEGER PRIMARY KEY, country_code TEXT NOT NULL, subdivision_code TEXT NOT NULL DEFAULT '',
	name TEXT NOT NULL, rate_text TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);
CREATE INDEX tax_rates_location ON tax_rates(country_code, subdivision_code);

CREATE TABLE orders (
	id INTEGER PRIMARY KEY, suid TEXT NOT NULL UNIQUE,
	gallery_id INTEGER REFERENCES galleries(page_id) ON DELETE SET NULL,
	proofing_session_id INTEGER REFERENCES proofing_sessions(id) ON DELETE SET NULL,
	placed_at INTEGER NOT NULL, status TEXT NOT NULL, currency TEXT NOT NULL,
	customer_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
	shipping_address_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(shipping_address_json)),
	shipping_method TEXT NOT NULL DEFAULT '', comments TEXT NOT NULL DEFAULT '',
	subtotal_minor INTEGER NOT NULL, discount_minor INTEGER NOT NULL DEFAULT 0,
	shipping_minor INTEGER NOT NULL DEFAULT 0, handling_minor INTEGER NOT NULL DEFAULT 0,
	tax_minor INTEGER NOT NULL DEFAULT 0, total_minor INTEGER NOT NULL,
	pricing_snapshot_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(pricing_snapshot_json))
);
CREATE INDEX orders_date_status ON orders(placed_at, status);
CREATE INDEX orders_email ON orders(email);
CREATE TABLE order_items (
	id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
	source_cart_item_id INTEGER, parent_item_id INTEGER REFERENCES order_items(id) ON DELETE RESTRICT,
	item_type TEXT NOT NULL, image_asset_id INTEGER REFERENCES media_assets(id) ON DELETE RESTRICT,
	description TEXT NOT NULL, quantity INTEGER NOT NULL CHECK (quantity > 0),
	unit_minor INTEGER NOT NULL, shipping_minor INTEGER NOT NULL DEFAULT 0, tax_minor INTEGER NOT NULL DEFAULT 0,
	selection_snapshot_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(selection_snapshot_json)),
	formula_snapshot_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(formula_snapshot_json)),
	position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX order_items_order ON order_items(order_id, position);
CREATE TABLE discount_redemptions (
	id INTEGER PRIMARY KEY, discount_id INTEGER NOT NULL REFERENCES discounts(id) ON DELETE RESTRICT,
	order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
	amount_minor INTEGER NOT NULL, created_at INTEGER NOT NULL, UNIQUE (discount_id, order_id)
);
CREATE TABLE payments (
	id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
	provider TEXT NOT NULL, provider_reference TEXT, idempotency_key TEXT UNIQUE,
	amount_minor INTEGER NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL,
	created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE (provider, provider_reference)
);
CREATE TABLE payment_events (
	id INTEGER PRIMARY KEY, payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
	provider_event_id TEXT NOT NULL UNIQUE, event_type TEXT NOT NULL, received_at INTEGER NOT NULL,
	payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json))
);
CREATE TABLE fulfillments (
	id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
	status TEXT NOT NULL, method TEXT NOT NULL, tracking_reference TEXT,
	created_at INTEGER NOT NULL, completed_at INTEGER
);
CREATE TABLE fulfillment_items (
	id INTEGER PRIMARY KEY, fulfillment_id INTEGER NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
	order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
	quantity INTEGER NOT NULL CHECK (quantity > 0), delivered_at INTEGER
);
CREATE TABLE messages (
	id INTEGER PRIMARY KEY, gallery_id INTEGER REFERENCES galleries(page_id) ON DELETE SET NULL,
	order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL, recipient TEXT NOT NULL,
	subject TEXT NOT NULL, body TEXT NOT NULL, kind TEXT NOT NULL, delivery_status TEXT NOT NULL,
	created_at INTEGER NOT NULL, sent_at INTEGER
);
CREATE TABLE mailing_contacts (
	id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '',
	created_at INTEGER NOT NULL, consent_state TEXT NOT NULL DEFAULT 'unknown'
);
CREATE TABLE form_fields (
	id INTEGER PRIMARY KEY, field_key TEXT NOT NULL UNIQUE, label TEXT NOT NULL, kind TEXT NOT NULL,
	required INTEGER NOT NULL DEFAULT 0 CHECK (required IN (0, 1)),
	options_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(options_json)), position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE app_settings (
	id INTEGER PRIMARY KEY, scope TEXT NOT NULL CHECK (scope IN ('installation', 'gallery')),
	scope_id INTEGER, settings_key TEXT NOT NULL,
	value_json TEXT NOT NULL CHECK (json_valid(value_json)), updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX app_settings_scope_key ON app_settings(scope, COALESCE(scope_id, 0), settings_key);
