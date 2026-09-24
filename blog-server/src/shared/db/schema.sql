CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF to_regclass('public.admin_users') IS NOT NULL
    AND to_regclass('public.users') IS NULL THEN
    ALTER TABLE admin_users RENAME TO users;
  END IF;

  IF to_regclass('public.admin_social_links') IS NOT NULL
    AND to_regclass('public.user_social_links') IS NULL THEN
    ALTER TABLE admin_social_links RENAME TO user_social_links;
  END IF;

  IF to_regclass('public.user_social_links') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_social_links'
        AND column_name = 'admin_user_id'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_social_links'
        AND column_name = 'user_id'
    ) THEN
    ALTER TABLE user_social_links RENAME COLUMN admin_user_id TO user_id;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL DEFAULT 'user',
  name text,
  username text NOT NULL,
  password_hash text NOT NULL,
  email text NOT NULL,
  avatar_url text,
  bio text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  blog_url text,
  comment_email_notifications boolean NOT NULL DEFAULT false,
  new_post_email_notifications boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'))
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role text;

UPDATE users
SET role = 'admin'
WHERE role IS NULL;

ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';
ALTER TABLE users ALTER COLUMN role SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_check'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'));
  END IF;
END;
$$;

DROP INDEX IF EXISTS admin_users_username_unique;
DROP INDEX IF EXISTS admin_users_email_unique;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique
  ON users (lower(username));

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
  ON users (lower(email));

DROP TRIGGER IF EXISTS admin_users_set_updated_at ON users;
DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS users_en (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name text,
  bio text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS users_en_set_updated_at ON users_en;
CREATE TRIGGER users_en_set_updated_at
  BEFORE UPDATE ON users_en
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DO $$
BEGIN
  IF to_regclass('public.user_profile_tags') IS NOT NULL
    AND to_regclass('public.profile_tag_translations') IS NOT NULL THEN
    INSERT INTO users_en (user_id, tags)
    SELECT
      user_profile_tags.user_id,
      COALESCE(
        array_agg(btrim(profile_tag_translations.name) ORDER BY user_profile_tags.display_order, user_profile_tags.created_at)
          FILTER (
            WHERE profile_tag_translations.locale = 'en'
              AND btrim(profile_tag_translations.name) <> ''
          ),
        ARRAY[]::text[]
      )
    FROM user_profile_tags
    LEFT JOIN profile_tag_translations
      ON profile_tag_translations.tag_id = user_profile_tags.tag_id
    GROUP BY user_profile_tags.user_id
    ON CONFLICT (user_id)
    DO UPDATE SET tags = EXCLUDED.tags
    WHERE cardinality(users_en.tags) = 0;
  END IF;
END;
$$;

DROP TABLE IF EXISTS user_profile_tags;
DROP TABLE IF EXISTS profile_tag_translations;
DROP TABLE IF EXISTS profile_tags;

CREATE TABLE IF NOT EXISTS user_social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label text NOT NULL,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP INDEX IF EXISTS admin_social_links_user_sort_idx;

CREATE INDEX IF NOT EXISTS user_social_links_user_sort_idx
  ON user_social_links (user_id, sort_order, created_at);

DROP TRIGGER IF EXISTS admin_social_links_set_updated_at ON user_social_links;
DROP TRIGGER IF EXISTS user_social_links_set_updated_at ON user_social_links;
CREATE TRIGGER user_social_links_set_updated_at
  BEFORE UPDATE ON user_social_links
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS site_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  site_name text,
  founded_at timestamptz,
  site_description text,
  cover_urls text[] NOT NULL DEFAULT ARRAY[]::text[],
  homepage_copy text,
  light_logo_url text,
  dark_logo_url text,
  favicon_url text,
  seo_title text,
  seo_description text,
  seo_keywords text[] NOT NULL DEFAULT ARRAY[]::text[],
  copyright text,
  comments_enabled boolean NOT NULL DEFAULT true,
  resend_domain text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO site_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS site_settings_set_updated_at ON site_settings;
CREATE TRIGGER site_settings_set_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS site_settings_en (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  site_name text,
  site_description text,
  homepage_copy text,
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_en_id_fk
    FOREIGN KEY (id) REFERENCES site_settings(id) ON DELETE CASCADE
);

DROP TRIGGER IF EXISTS site_settings_en_set_updated_at ON site_settings_en;
CREATE TRIGGER site_settings_en_set_updated_at
  BEFORE UPDATE ON site_settings_en
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS encrypted_settings (
  key text PRIMARY KEY,
  encrypted_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT encrypted_settings_known_key CHECK (
    key IN ('resend_api_key', 'deepl_api_key', 'ip_geolocation_api_key')
  )
);

DROP TRIGGER IF EXISTS encrypted_settings_set_updated_at ON encrypted_settings;
CREATE TRIGGER encrypted_settings_set_updated_at
  BEFORE UPDATE ON encrypted_settings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS filing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  record_number text NOT NULL,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT filing_records_type_check CHECK (type IN ('icp', 'police'))
);

CREATE INDEX IF NOT EXISTS filing_records_type_sort_idx
  ON filing_records (type, sort_order, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS filing_records_single_police_idx
  ON filing_records (type)
  WHERE type = 'police';

DROP TRIGGER IF EXISTS filing_records_set_updated_at ON filing_records;
CREATE TRIGGER filing_records_set_updated_at
  BEFORE UPDATE ON filing_records
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
