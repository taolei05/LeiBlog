ALTER TABLE site_config
ADD COLUMN IF NOT EXISTS r2_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS r2_account_id text,
ADD COLUMN IF NOT EXISTS r2_bucket text,
ADD COLUMN IF NOT EXISTS r2_access_key_id text,
ADD COLUMN IF NOT EXISTS r2_secret_access_key_encrypted jsonb,
ADD COLUMN IF NOT EXISTS r2_public_base_url text;

ALTER TABLE media_assets
ADD COLUMN IF NOT EXISTS storage_provider varchar(20) NOT NULL DEFAULT 'local',
ADD COLUMN IF NOT EXISTS storage_key text,
ADD COLUMN IF NOT EXISTS storage_bucket text;

ALTER TABLE media_assets
DROP CONSTRAINT IF EXISTS media_assets_storage_provider_check;

ALTER TABLE media_assets
ADD CONSTRAINT media_assets_storage_provider_check
CHECK (storage_provider IN ('local', 'r2'));

CREATE INDEX IF NOT EXISTS media_assets_storage_provider_created_at_idx
ON media_assets (storage_provider, created_at DESC);
