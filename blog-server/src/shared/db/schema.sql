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
  comment_email_notifications boolean NOT NULL DEFAULT true,
  new_post_email_notifications boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  last_login_time_zone text,
  last_login_time_zone_offset_minutes integer,
  last_login_ip inet,
  last_login_location jsonb,
  last_login_device jsonb,
  last_login_method varchar(40),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'))
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE users ALTER COLUMN comment_email_notifications SET DEFAULT true;
ALTER TABLE users ALTER COLUMN new_post_email_notifications SET DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_time_zone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_time_zone_offset_minutes integer;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip inet;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_location jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_device jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_method varchar(40);

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

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_last_login_method_check;
ALTER TABLE users
  ADD CONSTRAINT users_last_login_method_check
  CHECK (last_login_method IS NULL OR last_login_method IN ('password', 'github', 'google', 'apple'));

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
  time_zone text NOT NULL DEFAULT 'Asia/Shanghai',
  r2_enabled boolean NOT NULL DEFAULT false,
  r2_account_id text,
  r2_bucket text,
  r2_access_key_id text,
  r2_public_base_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'Asia/Shanghai';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS r2_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS r2_account_id text;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS r2_bucket text;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS r2_access_key_id text;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS r2_public_base_url text;

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
    key IN ('resend_api_key', 'deepl_api_key', 'ip_geolocation_api_key', 'r2_secret_access_key', 'exchange_rate_api_key')
  )
);

ALTER TABLE encrypted_settings DROP CONSTRAINT IF EXISTS encrypted_settings_known_key;
ALTER TABLE encrypted_settings
  ADD CONSTRAINT encrypted_settings_known_key CHECK (
    key IN ('resend_api_key', 'deepl_api_key', 'ip_geolocation_api_key', 'r2_secret_access_key', 'exchange_rate_api_key')
  );

DROP TRIGGER IF EXISTS encrypted_settings_set_updated_at ON encrypted_settings;
CREATE TRIGGER encrypted_settings_set_updated_at
  BEFORE UPDATE ON encrypted_settings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS auth_provider_settings (
  provider text PRIMARY KEY,
  display_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  client_id text,
  client_secret_encrypted text,
  redirect_uri text,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_provider_settings_provider_check CHECK (provider IN ('github', 'google'))
);

ALTER TABLE auth_provider_settings ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE auth_provider_settings ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false;
ALTER TABLE auth_provider_settings ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE auth_provider_settings ADD COLUMN IF NOT EXISTS client_secret_encrypted text;
ALTER TABLE auth_provider_settings ADD COLUMN IF NOT EXISTS redirect_uri text;
ALTER TABLE auth_provider_settings ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE auth_provider_settings DROP CONSTRAINT IF EXISTS auth_provider_settings_provider_check;
ALTER TABLE auth_provider_settings
  ADD CONSTRAINT auth_provider_settings_provider_check CHECK (provider IN ('github', 'google'));

UPDATE auth_provider_settings
SET display_name = CASE provider
  WHEN 'github' THEN 'GitHub'
  WHEN 'google' THEN 'Google'
  ELSE provider
END
WHERE display_name IS NULL;

ALTER TABLE auth_provider_settings ALTER COLUMN display_name SET NOT NULL;

DROP TRIGGER IF EXISTS auth_provider_settings_set_updated_at ON auth_provider_settings;
CREATE TRIGGER auth_provider_settings_set_updated_at
  BEFORE UPDATE ON auth_provider_settings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS user_oauth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_user_id text NOT NULL,
  provider_username text,
  provider_email text,
  avatar_url text,
  profile_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_oauth_accounts_provider_check CHECK (provider IN ('github', 'google'))
);

ALTER TABLE user_oauth_accounts DROP CONSTRAINT IF EXISTS user_oauth_accounts_provider_check;
ALTER TABLE user_oauth_accounts
  ADD CONSTRAINT user_oauth_accounts_provider_check CHECK (provider IN ('github', 'google'));

CREATE UNIQUE INDEX IF NOT EXISTS user_oauth_accounts_provider_user_unique
  ON user_oauth_accounts (provider, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS user_oauth_accounts_provider_user_id_unique
  ON user_oauth_accounts (provider, provider_user_id);

CREATE INDEX IF NOT EXISTS user_oauth_accounts_user_id_idx
  ON user_oauth_accounts (user_id);

DROP TRIGGER IF EXISTS user_oauth_accounts_set_updated_at ON user_oauth_accounts;
CREATE TRIGGER user_oauth_accounts_set_updated_at
  BEFORE UPDATE ON user_oauth_accounts
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS oauth_login_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  state_hash text NOT NULL,
  code_verifier text NOT NULL,
  return_to text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oauth_login_states_provider_check CHECK (provider IN ('github', 'google'))
);

ALTER TABLE oauth_login_states DROP CONSTRAINT IF EXISTS oauth_login_states_provider_check;
ALTER TABLE oauth_login_states
  ADD CONSTRAINT oauth_login_states_provider_check CHECK (provider IN ('github', 'google'));

CREATE UNIQUE INDEX IF NOT EXISTS oauth_login_states_hash_unique
  ON oauth_login_states (state_hash);

CREATE INDEX IF NOT EXISTS oauth_login_states_expires_at_idx
  ON oauth_login_states (expires_at);

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

CREATE TABLE IF NOT EXISTS media_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(80) NOT NULL,
  slug varchar(100) NOT NULL,
  description text NOT NULL DEFAULT '',
  system_key varchar(40),
  is_protected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS media_folders_slug_unique
  ON media_folders (lower(slug));

CREATE UNIQUE INDEX IF NOT EXISTS media_folders_system_key_unique
  ON media_folders (system_key)
  WHERE system_key IS NOT NULL;

DROP TRIGGER IF EXISTS media_folders_set_updated_at ON media_folders;
CREATE TRIGGER media_folders_set_updated_at
  BEFORE UPDATE ON media_folders
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

UPDATE media_folders
SET
  name = '文章',
  description = '文章封面和正文插图可以集中存储到这里。'
WHERE system_key = 'article-covers'
  AND (
    name = '文章封面'
    OR description = '文章封面可以集中存储到这里。'
  );

CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name varchar(255) NOT NULL,
  file_format varchar(20) NOT NULL,
  file_type text NOT NULL,
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes >= 0),
  access_url text NOT NULL,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  folder_id uuid REFERENCES media_folders(id) ON DELETE SET NULL,
  storage_provider varchar(20) NOT NULL DEFAULT 'local',
  storage_key text,
  storage_bucket text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_assets_file_type_check CHECK (file_type IN ('image', 'video', 'document')),
  CONSTRAINT media_assets_storage_provider_check CHECK (storage_provider IN ('local', 'r2'))
);

CREATE UNIQUE INDEX IF NOT EXISTS media_assets_access_url_unique
  ON media_assets (access_url);

CREATE INDEX IF NOT EXISTS media_assets_type_created_at_idx
  ON media_assets (file_type, created_at DESC);

CREATE INDEX IF NOT EXISTS media_assets_uploaded_by_idx
  ON media_assets (uploaded_by);

CREATE INDEX IF NOT EXISTS media_assets_folder_created_at_idx
  ON media_assets (folder_id, created_at DESC);

CREATE INDEX IF NOT EXISTS media_assets_storage_provider_created_at_idx
  ON media_assets (storage_provider, created_at DESC);

DROP TRIGGER IF EXISTS media_assets_set_updated_at ON media_assets;
CREATE TRIGGER media_assets_set_updated_at
  BEFORE UPDATE ON media_assets
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS article_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  slug varchar(140) NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS article_categories_slug_unique
  ON article_categories (lower(slug));

CREATE INDEX IF NOT EXISTS article_categories_sort_idx
  ON article_categories (sort_order, created_at);

DROP TRIGGER IF EXISTS article_categories_set_updated_at ON article_categories;
CREATE TRIGGER article_categories_set_updated_at
  BEFORE UPDATE ON article_categories
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS article_categories_en (
  category_id uuid PRIMARY KEY REFERENCES article_categories(id) ON DELETE CASCADE,
  name varchar(120),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS article_categories_en_set_updated_at ON article_categories_en;
CREATE TRIGGER article_categories_en_set_updated_at
  BEFORE UPDATE ON article_categories_en
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS article_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  slug varchar(140) NOT NULL,
  color varchar(40),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS article_tags_slug_unique
  ON article_tags (lower(slug));

CREATE INDEX IF NOT EXISTS article_tags_created_at_idx
  ON article_tags (created_at DESC);

DROP TRIGGER IF EXISTS article_tags_set_updated_at ON article_tags;
CREATE TRIGGER article_tags_set_updated_at
  BEFORE UPDATE ON article_tags
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS article_tags_en (
  tag_id uuid PRIMARY KEY REFERENCES article_tags(id) ON DELETE CASCADE,
  name varchar(120),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS article_tags_en_set_updated_at ON article_tags_en;
CREATE TRIGGER article_tags_en_set_updated_at
  BEFORE UPDATE ON article_tags_en
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS article_contributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  avatar_url text,
  link_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS article_contributors_name_idx
  ON article_contributors (lower(name), created_at DESC);

DROP TRIGGER IF EXISTS article_contributors_set_updated_at ON article_contributors;
CREATE TRIGGER article_contributors_set_updated_at
  BEFORE UPDATE ON article_contributors
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  title varchar(220) NOT NULL,
  slug varchar(240) NOT NULL,
  summary text,
  content_mdx text NOT NULL DEFAULT '',
  cover_image_url text,
  status varchar(24) NOT NULL DEFAULT 'draft',
  read_count integer NOT NULL DEFAULT 0,
  is_pinned boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  scheduled_publish_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT articles_status_check CHECK (status IN ('draft', 'published', 'scheduled'))
);

ALTER TABLE articles ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS content_mdx text NOT NULL DEFAULT '';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cover_image_url text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS read_count integer NOT NULL DEFAULT 0;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz;
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_status_check;
ALTER TABLE articles
  ADD CONSTRAINT articles_status_check CHECK (status IN ('draft', 'published', 'scheduled'));

CREATE UNIQUE INDEX IF NOT EXISTS articles_slug_unique
  ON articles (lower(slug));

CREATE INDEX IF NOT EXISTS articles_status_published_at_idx
  ON articles (status, published_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS articles_created_at_idx
  ON articles (created_at DESC);

DROP TRIGGER IF EXISTS articles_set_updated_at ON articles;
CREATE TRIGGER articles_set_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS articles_en (
  article_id uuid PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  title varchar(220),
  summary text,
  content_mdx text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS articles_en_set_updated_at ON articles_en;
CREATE TRIGGER articles_en_set_updated_at
  BEFORE UPDATE ON articles_en
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS article_category_links (
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES article_categories(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, category_id)
);

CREATE INDEX IF NOT EXISTS article_category_links_category_idx
  ON article_category_links (category_id, article_id);

CREATE TABLE IF NOT EXISTS article_tag_links (
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES article_tags(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, tag_id)
);

CREATE INDEX IF NOT EXISTS article_tag_links_tag_idx
  ON article_tag_links (tag_id, article_id);

CREATE TABLE IF NOT EXISTS article_contributor_links (
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  contributor_id uuid NOT NULL REFERENCES article_contributors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, contributor_id)
);

CREATE INDEX IF NOT EXISTS article_contributor_links_contributor_idx
  ON article_contributor_links (contributor_id, article_id);

CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type varchar(24) NOT NULL DEFAULT 'article',
  article_id uuid REFERENCES articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES comments(id) ON DELETE SET NULL,
  content text NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  comment_ip inet,
  comment_location jsonb,
  comment_device jsonb,
  CONSTRAINT comments_target_type_check CHECK (target_type IN ('article', 'guestbook')),
  CONSTRAINT comments_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT comments_target_ref_check CHECK (
    (target_type = 'article' AND article_id IS NOT NULL)
    OR (target_type = 'guestbook' AND article_id IS NULL)
  )
);

ALTER TABLE comments ADD COLUMN IF NOT EXISTS target_type varchar(24) NOT NULL DEFAULT 'article';
ALTER TABLE comments ADD COLUMN IF NOT EXISTS article_id uuid REFERENCES articles(id) ON DELETE CASCADE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES comments(id) ON DELETE SET NULL;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS content text NOT NULL DEFAULT '';
ALTER TABLE comments ADD COLUMN IF NOT EXISTS status varchar(24) NOT NULL DEFAULT 'approved';
ALTER TABLE comments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS comment_ip inet;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS comment_location jsonb;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS comment_device jsonb;
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_target_type_check;
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_status_check;
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_target_ref_check;
ALTER TABLE comments
  ADD CONSTRAINT comments_target_type_check CHECK (target_type IN ('article', 'guestbook'));
ALTER TABLE comments
  ADD CONSTRAINT comments_status_check CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE comments
  ADD CONSTRAINT comments_target_ref_check CHECK (
    (target_type = 'article' AND article_id IS NOT NULL)
    OR (target_type = 'guestbook' AND article_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS comments_article_created_at_idx
  ON comments (article_id, created_at DESC);

CREATE INDEX IF NOT EXISTS comments_target_created_at_idx
  ON comments (target_type, created_at DESC);

CREATE INDEX IF NOT EXISTS comments_user_idx
  ON comments (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS comments_parent_idx
  ON comments (parent_id, created_at);

CREATE INDEX IF NOT EXISTS comments_status_idx
  ON comments (status, deleted_at);

DROP TRIGGER IF EXISTS comments_set_updated_at ON comments;
CREATE TRIGGER comments_set_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS navigation_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  name_en varchar(100),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE navigation_groups
  ADD COLUMN IF NOT EXISTS name_en varchar(100);

CREATE UNIQUE INDEX IF NOT EXISTS navigation_groups_name_unique
  ON navigation_groups (lower(name));

CREATE INDEX IF NOT EXISTS navigation_groups_sort_order_idx
  ON navigation_groups (sort_order, created_at);

DROP TRIGGER IF EXISTS navigation_groups_set_updated_at ON navigation_groups;
CREATE TRIGGER navigation_groups_set_updated_at
  BEFORE UPDATE ON navigation_groups
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS navigation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES navigation_groups(id) ON DELETE RESTRICT,
  name varchar(160) NOT NULL,
  url varchar(2048) NOT NULL,
  note varchar(500),
  icon_url varchar(2048),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS navigation_items_group_sort_order_idx
  ON navigation_items (group_id, sort_order, created_at);

DROP TRIGGER IF EXISTS navigation_items_set_updated_at ON navigation_items;
CREATE TRIGGER navigation_items_set_updated_at
  BEFORE UPDATE ON navigation_items
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  token_hash text NOT NULL,
  user_agent text,
  ip inet,
  login_method varchar(40) NOT NULL DEFAULT 'password',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT auth_sessions_login_method_check CHECK (
    login_method IN ('password', 'oauth', 'github', 'google', 'apple')
  )
);

ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS ip inet;
ALTER TABLE auth_sessions DROP CONSTRAINT IF EXISTS auth_sessions_login_method_check;
ALTER TABLE auth_sessions
  ADD CONSTRAINT auth_sessions_login_method_check CHECK (
    login_method IN ('password', 'oauth', 'github', 'google', 'apple')
  );

CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_session_id_unique
  ON auth_sessions (session_id);

CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_token_hash_unique
  ON auth_sessions (token_hash);

CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx
  ON auth_sessions (user_id);

CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx
  ON auth_sessions (expires_at);

CREATE INDEX IF NOT EXISTS auth_sessions_ip_created_at_idx
  ON auth_sessions (ip, created_at DESC);

CREATE TABLE IF NOT EXISTS login_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ip inet,
  location jsonb,
  device jsonb,
  user_agent text,
  login_method varchar(40) NOT NULL DEFAULT 'password',
  time_zone text,
  time_zone_offset_minutes integer,
  success boolean NOT NULL,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT login_audit_logs_login_method_check CHECK (
    login_method IN ('password', 'github', 'google', 'apple')
  )
);

ALTER TABLE login_audit_logs ADD COLUMN IF NOT EXISTS login_method varchar(40) NOT NULL DEFAULT 'password';
ALTER TABLE login_audit_logs ADD COLUMN IF NOT EXISTS time_zone text;
ALTER TABLE login_audit_logs ADD COLUMN IF NOT EXISTS time_zone_offset_minutes integer;
ALTER TABLE login_audit_logs DROP CONSTRAINT IF EXISTS login_audit_logs_login_method_check;
ALTER TABLE login_audit_logs
  ADD CONSTRAINT login_audit_logs_login_method_check CHECK (
    login_method IN ('password', 'github', 'google', 'apple')
  );

CREATE INDEX IF NOT EXISTS login_audit_logs_user_created_at_idx
  ON login_audit_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS login_audit_logs_created_at_idx
  ON login_audit_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS email_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(254) NOT NULL,
  code_hash text NOT NULL,
  purpose varchar(40) NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_verification_codes_purpose_check CHECK (
	    purpose IN (
	      'register',
	      'password_reset',
	      'email_change_current',
	      'email_change_new',
	      'password_change',
	      'admin_api_key_reveal',
	      'admin_auth_provider_secret_reveal'
	    )
	  )
	);

ALTER TABLE email_verification_codes
  DROP CONSTRAINT IF EXISTS email_verification_codes_purpose_check;

ALTER TABLE email_verification_codes
  ADD CONSTRAINT email_verification_codes_purpose_check CHECK (
	    purpose IN (
	      'register',
	      'password_reset',
	      'email_change_current',
	      'email_change_new',
	      'password_change',
	      'admin_api_key_reveal',
	      'admin_auth_provider_secret_reveal'
	    )
	  );

CREATE INDEX IF NOT EXISTS email_verification_codes_email_purpose_idx
  ON email_verification_codes (lower(email), purpose, created_at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_email_locale text NOT NULL DEFAULT 'zh-CN'
  CHECK (notification_email_locale IN ('zh-CN', 'en'));

-- Existing public content must not generate a historical notification blast on upgrade.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'articles' AND column_name = 'notification_enqueued_at') THEN
    ALTER TABLE articles ADD COLUMN notification_enqueued_at timestamptz;
    UPDATE articles SET notification_enqueued_at = now() WHERE status = 'published';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'comments' AND column_name = 'notification_enqueued_at') THEN
    ALTER TABLE comments ADD COLUMN notification_enqueued_at timestamptz;
    UPDATE comments SET notification_enqueued_at = now() WHERE status = 'approved';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS email_notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('new_article', 'comment_reply', 'comment_admin')),
  recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id uuid REFERENCES articles(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  message jsonb,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  lock_token uuid,
  first_attempt_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'new_article' AND article_id IS NOT NULL AND comment_id IS NULL)
    OR (kind IN ('comment_reply', 'comment_admin') AND comment_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS email_notification_jobs_article_recipient_unique
  ON email_notification_jobs (article_id, recipient_id) WHERE kind = 'new_article';
CREATE UNIQUE INDEX IF NOT EXISTS email_notification_jobs_comment_recipient_unique
  ON email_notification_jobs (comment_id, recipient_id) WHERE comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_notification_jobs_pending_idx
  ON email_notification_jobs (available_at, created_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  service_url text NOT NULL DEFAULT '',
  category text NOT NULL CHECK (category IN ('domain','server','membership','software','other')),
  details text NOT NULL DEFAULT '',
  start_date date NOT NULL,
  expiry_date date,
  initial_price numeric(12,2) NOT NULL CHECK (initial_price >= 0),
  renewal_price numeric(12,2) NOT NULL CHECK (renewal_price >= 0),
  currency text NOT NULL CHECK (currency IN ('CNY','HKD','USD','EUR','GBP','JPY')),
  renewal_type text NOT NULL CHECK (renewal_type IN ('automatic','manual','perpetual')),
  notes text NOT NULL DEFAULT '',
  reminder_enabled boolean NOT NULL DEFAULT true,
  reminder_days integer NOT NULL DEFAULT 7 CHECK (reminder_days BETWEEN 0 AND 365),
  reminder_time time NOT NULL DEFAULT '09:00',
  reminder_recipient_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reminder_revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((renewal_type = 'perpetual' AND expiry_date IS NULL AND NOT reminder_enabled)
    OR (renewal_type <> 'perpetual' AND expiry_date IS NOT NULL AND expiry_date >= start_date))
);
-- Preserve the original currency for legacy clients and backups.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS initial_currency text
  CHECK (initial_currency IN ('CNY','HKD','USD','EUR','GBP','JPY'));
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS renewal_currency text
  CHECK (renewal_currency IN ('CNY','HKD','USD','EUR','GBP','JPY'));
UPDATE subscriptions SET initial_currency = COALESCE(initial_currency, currency),
  renewal_currency = COALESCE(renewal_currency, currency)
  WHERE initial_currency IS NULL OR renewal_currency IS NULL;
ALTER TABLE subscriptions ALTER COLUMN initial_currency SET NOT NULL;
ALTER TABLE subscriptions ALTER COLUMN renewal_currency SET NOT NULL;
CREATE INDEX IF NOT EXISTS subscriptions_expiry_idx ON subscriptions (expiry_date);
DROP TRIGGER IF EXISTS subscriptions_set_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS subscription_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  content_type text NOT NULL,
  file_size integer NOT NULL CHECK (file_size BETWEEN 1 AND 5242880),
  content bytea NOT NULL CHECK (octet_length(content) = file_size),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscription_attachments_parent_idx ON subscription_attachments (subscription_id);

ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS subscription_attachment_id uuid
  REFERENCES subscription_attachments(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS media_assets_subscription_attachment_unique
  ON media_assets (subscription_attachment_id) WHERE subscription_attachment_id IS NOT NULL;
UPDATE media_folders SET system_key = 'subscription-attachments', is_protected = true
  WHERE lower(slug) = 'subscription-attachments'
    AND (system_key IS DISTINCT FROM 'subscription-attachments' OR NOT is_protected);

CREATE OR REPLACE FUNCTION sync_subscription_attachment_media() RETURNS trigger AS $$
BEGIN
  INSERT INTO media_folders (name, slug, system_key, description, is_protected)
    VALUES ('订阅附件', 'subscription-attachments', 'subscription-attachments',
      '订阅发票、合同和图片，仅管理员可访问。', true)
    ON CONFLICT (lower(slug)) DO UPDATE SET system_key = EXCLUDED.system_key, is_protected = true
      WHERE media_folders.system_key IS DISTINCT FROM EXCLUDED.system_key OR NOT media_folders.is_protected;
  INSERT INTO media_assets (id, file_name, file_format, file_type, file_size_bytes,
    access_url, folder_id, storage_provider, subscription_attachment_id, uploaded_by, created_at)
  SELECT NEW.id, NEW.file_name, lower(substring(NEW.file_name FROM '\.([^.]+)$')),
    CASE WHEN lower(substring(NEW.file_name FROM '\.([^.]+)$')) IN ('jpg','jpeg','png','gif','webp','ico')
      THEN 'image' ELSE 'document' END,
    NEW.file_size, '/api/admin/media/' || NEW.id || '/download', mf.id, 'local', NEW.id,
    s.reminder_recipient_id, NEW.created_at
  FROM media_folders mf, subscriptions s
  WHERE mf.system_key = 'subscription-attachments' AND s.id = NEW.subscription_id
  ON CONFLICT (id) DO UPDATE SET file_name = EXCLUDED.file_name, file_size_bytes = EXCLUDED.file_size_bytes;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS subscription_attachment_media_sync ON subscription_attachments;
CREATE TRIGGER subscription_attachment_media_sync AFTER INSERT OR UPDATE OF file_name
  ON subscription_attachments FOR EACH ROW EXECUTE FUNCTION sync_subscription_attachment_media();
UPDATE subscription_attachments a SET file_name = a.file_name
  WHERE NOT EXISTS (SELECT 1 FROM media_assets m WHERE m.subscription_attachment_id = a.id);

ALTER TABLE email_notification_jobs ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE;
ALTER TABLE email_notification_jobs ADD COLUMN IF NOT EXISTS subscription_revision integer;
ALTER TABLE email_notification_jobs ADD COLUMN IF NOT EXISTS subscription_expiry date;
ALTER TABLE email_notification_jobs DROP CONSTRAINT IF EXISTS email_notification_jobs_kind_check;
ALTER TABLE email_notification_jobs ADD CONSTRAINT email_notification_jobs_kind_check
  CHECK (kind IN ('new_article','comment_reply','comment_admin','subscription_expiry'));
ALTER TABLE email_notification_jobs DROP CONSTRAINT IF EXISTS email_notification_jobs_check;
ALTER TABLE email_notification_jobs ADD CONSTRAINT email_notification_jobs_check
  CHECK ((kind = 'new_article' AND article_id IS NOT NULL AND comment_id IS NULL AND subscription_id IS NULL)
    OR (kind IN ('comment_reply','comment_admin') AND comment_id IS NOT NULL AND subscription_id IS NULL)
    OR (kind = 'subscription_expiry' AND subscription_id IS NOT NULL AND subscription_revision IS NOT NULL
      AND subscription_expiry IS NOT NULL AND article_id IS NULL AND comment_id IS NULL));
CREATE UNIQUE INDEX IF NOT EXISTS email_notification_jobs_subscription_expiry_unique
  ON email_notification_jobs (subscription_id, subscription_expiry) WHERE kind = 'subscription_expiry' AND status IN ('pending','sent');
CREATE INDEX IF NOT EXISTS email_notification_jobs_subscription_history_idx
  ON email_notification_jobs (subscription_id, subscription_expiry, created_at DESC) WHERE subscription_id IS NOT NULL;
