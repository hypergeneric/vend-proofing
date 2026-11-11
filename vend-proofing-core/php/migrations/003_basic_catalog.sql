ALTER TABLE pages ADD COLUMN image_count INTEGER NOT NULL DEFAULT 0 CHECK (image_count >= 0);
