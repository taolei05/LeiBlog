ALTER TABLE site_filing
  ADD COLUMN IF NOT EXISTS icp_records jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE site_filing
SET icp_records = jsonb_build_array(
  jsonb_build_object('number', icp_number, 'url', icp_url)
)
WHERE icp_number IS NOT NULL
  AND jsonb_array_length(icp_records) = 0;
