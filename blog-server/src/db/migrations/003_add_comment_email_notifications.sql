ALTER TABLE users ADD COLUMN IF NOT EXISTS comment_email_notifications_enabled boolean NOT NULL DEFAULT true;
