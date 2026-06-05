ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS comment_ip inet,
  ADD COLUMN IF NOT EXISTS comment_location jsonb,
  ADD COLUMN IF NOT EXISTS comment_device jsonb;
