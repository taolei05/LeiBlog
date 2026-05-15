SET TIME ZONE 'Asia/Shanghai';

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('admin', 'user', 'demo');
CREATE TYPE article_status AS ENUM ('draft', 'published', 'offline');
CREATE TYPE comment_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE media_type AS ENUM ('image', 'video', 'document');
CREATE TYPE email_code_purpose AS ENUM ('register', 'password_reset');

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE site_info (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  site_name varchar(120) NOT NULL,
  description text NOT NULL DEFAULT '',
  logo_dark_url text,
  logo_light_url text,
  favicon_url text,
  established_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER site_info_set_updated_at
BEFORE UPDATE ON site_info
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE site_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  seo_title varchar(160) NOT NULL DEFAULT '',
  seo_description varchar(300) NOT NULL DEFAULT '',
  seo_keywords text[] NOT NULL DEFAULT '{}',
  copyright text NOT NULL DEFAULT '',
  resend_domain text,
  resend_api_key_encrypted jsonb,
  deepl_api_key_encrypted jsonb,
  ipgeolocation_api_key_encrypted jsonb,
  comments_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER site_config_set_updated_at
BEFORE UPDATE ON site_config
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE site_filing (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  icp_number varchar(120),
  icp_url text,
  police_number varchar(120),
  police_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER site_filing_set_updated_at
BEFORE UPDATE ON site_filing
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE setup_state (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_completed boolean NOT NULL DEFAULT false,
  current_step varchar(40) NOT NULL DEFAULT 'admin',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER setup_state_set_updated_at
BEFORE UPDATE ON setup_state
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(60) NOT NULL,
  password_hash text NOT NULL,
  email varchar(254),
  name varchar(80),
  description text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  role user_role NOT NULL DEFAULT 'user',
  avatar_url text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  blog_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  last_login_ip inet,
  last_login_location jsonb,
  last_login_device jsonb
);

CREATE UNIQUE INDEX users_username_unique ON users (lower(username));
CREATE UNIQUE INDEX users_email_unique ON users (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX users_role_idx ON users (role);

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE article_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(80) NOT NULL,
  slug varchar(160) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX article_categories_slug_unique ON article_categories (lower(slug));

CREATE TRIGGER article_categories_set_updated_at
BEFORE UPDATE ON article_categories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE article_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(80) NOT NULL,
  slug varchar(160) NOT NULL,
  color varchar(32),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX article_tags_slug_unique ON article_tags (lower(slug));

CREATE TRIGGER article_tags_set_updated_at
BEFORE UPDATE ON article_tags
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  title varchar(180) NOT NULL,
  slug varchar(200) NOT NULL,
  summary varchar(500),
  content_mdx text NOT NULL DEFAULT '',
  cover_image_url text,
  status article_status NOT NULL DEFAULT 'draft',
  read_count bigint NOT NULL DEFAULT 0 CHECK (read_count >= 0),
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE UNIQUE INDEX articles_slug_unique ON articles (lower(slug));
CREATE INDEX articles_status_published_at_idx ON articles (status, published_at DESC);
CREATE INDEX articles_pinned_published_at_idx ON articles (is_pinned DESC, published_at DESC);
CREATE INDEX articles_author_id_idx ON articles (author_id);

CREATE TRIGGER articles_set_updated_at
BEFORE UPDATE ON articles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE article_category_links (
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES article_categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, category_id)
);

CREATE INDEX article_category_links_category_id_idx ON article_category_links (category_id);

CREATE TABLE article_tag_links (
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES article_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, tag_id)
);

CREATE INDEX article_tag_links_tag_id_idx ON article_tag_links (tag_id);

CREATE TABLE article_contributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  avatar_url text,
  link_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER article_contributors_set_updated_at
BEFORE UPDATE ON article_contributors
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE article_contributor_links (
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  contributor_id uuid NOT NULL REFERENCES article_contributors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, contributor_id)
);

CREATE INDEX article_contributor_links_contributor_id_idx
ON article_contributor_links (contributor_id);

CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES comments(id) ON DELETE SET NULL,
  content text NOT NULL,
  status comment_status NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX comments_article_created_at_idx ON comments (article_id, created_at DESC);
CREATE INDEX comments_user_id_idx ON comments (user_id);
CREATE INDEX comments_parent_id_idx ON comments (parent_id);
CREATE INDEX comments_status_idx ON comments (status);

CREATE TRIGGER comments_set_updated_at
BEFORE UPDATE ON comments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name varchar(255) NOT NULL,
  file_format varchar(20) NOT NULL,
  file_type media_type NOT NULL,
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes >= 0),
  access_url text NOT NULL,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX media_assets_access_url_unique ON media_assets (access_url);
CREATE INDEX media_assets_type_created_at_idx ON media_assets (file_type, created_at DESC);
CREATE INDEX media_assets_uploaded_by_idx ON media_assets (uploaded_by);

CREATE TRIGGER media_assets_set_updated_at
BEFORE UPDATE ON media_assets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  user_agent text,
  ip inet,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE UNIQUE INDEX auth_sessions_token_hash_unique ON auth_sessions (token_hash);
CREATE INDEX auth_sessions_user_id_idx ON auth_sessions (user_id);
CREATE INDEX auth_sessions_expires_at_idx ON auth_sessions (expires_at);

CREATE TABLE email_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(254) NOT NULL,
  code_hash text NOT NULL,
  purpose email_code_purpose NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_verification_codes_email_purpose_idx
ON email_verification_codes (lower(email), purpose, created_at DESC);

CREATE TABLE password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX password_reset_tokens_hash_unique ON password_reset_tokens (token_hash);
CREATE INDEX password_reset_tokens_user_id_idx ON password_reset_tokens (user_id);

CREATE TABLE login_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ip inet,
  location jsonb,
  device jsonb,
  user_agent text,
  success boolean NOT NULL,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX login_audit_logs_user_created_at_idx ON login_audit_logs (user_id, created_at DESC);
CREATE INDEX login_audit_logs_created_at_idx ON login_audit_logs (created_at DESC);

CREATE TABLE article_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  editor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  title varchar(180) NOT NULL,
  slug varchar(200) NOT NULL,
  summary varchar(500),
  content_mdx text NOT NULL,
  cover_image_url text,
  status article_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX article_revisions_article_created_at_idx
ON article_revisions (article_id, created_at DESC);

INSERT INTO setup_state (id, is_completed, current_step)
VALUES (1, false, 'admin')
ON CONFLICT (id) DO NOTHING;
