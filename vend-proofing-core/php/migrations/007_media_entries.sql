CREATE TABLE media_entries (
	id INTEGER PRIMARY KEY,
	asset_id INTEGER NOT NULL UNIQUE REFERENCES media_assets(id) ON DELETE CASCADE,
	page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
	kind TEXT NOT NULL CHECK (kind IN ('asset', 'audio', 'track', 'package', 'product')),
	description TEXT NOT NULL DEFAULT '',
	position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX media_entries_scope ON media_entries(kind, page_id, position);
