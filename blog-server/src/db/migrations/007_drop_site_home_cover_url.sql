SET TIME ZONE 'Asia/Shanghai';

UPDATE site_info
SET home_cover_urls = ARRAY[home_cover_url]
WHERE home_cover_url IS NOT NULL
  AND btrim(home_cover_url) <> ''
  AND coalesce(array_length(home_cover_urls, 1), 0) = 0;

ALTER TABLE site_info
  DROP COLUMN IF EXISTS home_cover_url;
