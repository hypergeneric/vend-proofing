ALTER TABLE download_profiles ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

ALTER TABLE discounts ADD COLUMN suid TEXT;
ALTER TABLE discounts ADD COLUMN minimum_text TEXT NOT NULL DEFAULT '0';
ALTER TABLE discounts ADD COLUMN free_shipping INTEGER NOT NULL DEFAULT 0 CHECK (free_shipping IN (0, 1));
ALTER TABLE discounts ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX discounts_suid ON discounts(suid);

ALTER TABLE tax_rates ADD COLUMN hst_text TEXT NOT NULL DEFAULT '0';
ALTER TABLE tax_rates ADD COLUMN gst_text TEXT NOT NULL DEFAULT '0';
ALTER TABLE tax_rates ADD COLUMN pst_text TEXT NOT NULL DEFAULT '0';
ALTER TABLE tax_rates ADD COLUMN unused_text TEXT NOT NULL DEFAULT '';
ALTER TABLE tax_rates ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX tax_rates_code ON tax_rates(country_code, subdivision_code);

ALTER TABLE form_fields ADD COLUMN suid TEXT;
ALTER TABLE form_fields ADD COLUMN defaults_text TEXT NOT NULL DEFAULT '';
ALTER TABLE form_fields ADD COLUMN options_text TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX form_fields_suid ON form_fields(suid);
