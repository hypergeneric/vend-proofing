CREATE TABLE download_jobs (
	order_suid TEXT PRIMARY KEY REFERENCES orders(suid) ON DELETE CASCADE,
	state_json TEXT NOT NULL,
	updated_at INTEGER NOT NULL
);
