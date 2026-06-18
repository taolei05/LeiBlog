ALTER TABLE users
  ADD COLUMN IF NOT EXISTS new_article_email_notifications_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz;

CREATE INDEX IF NOT EXISTS articles_scheduled_publish_at_idx
  ON articles (scheduled_publish_at)
  WHERE status = 'draft' AND scheduled_publish_at IS NOT NULL;
