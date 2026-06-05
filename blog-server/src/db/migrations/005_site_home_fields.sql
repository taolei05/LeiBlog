SET TIME ZONE 'Asia/Shanghai';

ALTER TABLE site_info
  ADD COLUMN IF NOT EXISTS home_cover_url text,
  ADD COLUMN IF NOT EXISTS home_slogan text NOT NULL DEFAULT '';
