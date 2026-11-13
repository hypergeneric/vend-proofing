CREATE TABLE configuration_documents (
	type TEXT NOT NULL,
	scope_id TEXT NOT NULL DEFAULT '',
	json_text TEXT NOT NULL CHECK (json_valid(json_text)),
	updated_at INTEGER NOT NULL,
	PRIMARY KEY (type, scope_id)
);

CREATE TABLE installation_secrets (
	name TEXT PRIMARY KEY,
	secret TEXT NOT NULL CHECK (length(secret) = 64)
);
