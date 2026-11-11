CREATE TABLE php_sessions (
	id_hash TEXT PRIMARY KEY,
	session_data BLOB NOT NULL,
	expires_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);
CREATE INDEX php_sessions_expiry ON php_sessions(expires_at);
