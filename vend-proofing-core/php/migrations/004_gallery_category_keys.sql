ALTER TABLE gallery_categories ADD COLUMN public_key TEXT;
CREATE UNIQUE INDEX gallery_categories_public_key ON gallery_categories(gallery_id, public_key);
