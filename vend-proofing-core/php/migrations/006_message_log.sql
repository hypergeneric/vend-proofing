ALTER TABLE messages ADD COLUMN suid TEXT;
ALTER TABLE messages ADD COLUMN sender_name TEXT NOT NULL DEFAULT '';
ALTER TABLE messages ADD COLUMN sender_email TEXT NOT NULL DEFAULT '';
ALTER TABLE messages ADD COLUMN recipient_name TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX messages_suid ON messages(suid);
CREATE INDEX messages_created_at ON messages(created_at);
