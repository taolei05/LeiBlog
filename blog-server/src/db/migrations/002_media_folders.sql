CREATE TABLE media_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(80) NOT NULL,
  slug varchar(100) NOT NULL,
  description text NOT NULL DEFAULT '',
  system_key varchar(40),
  is_protected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX media_folders_slug_unique ON media_folders (lower(slug));
CREATE UNIQUE INDEX media_folders_system_key_unique ON media_folders (system_key) WHERE system_key IS NOT NULL;

CREATE TRIGGER media_folders_set_updated_at
BEFORE UPDATE ON media_folders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO media_folders (name, slug, description, system_key, is_protected)
VALUES
  ('文章封面', 'article-covers', '文章封面只能存储到这里。', 'article-covers', true),
  ('头像', 'avatars', '所有用户头像只能存储到这里。', 'avatars', true),
  ('评论', 'comments', '评论图片只能存储到这里。', 'comments', true),
  ('站点', 'site', '站点深浅色 Logo 和 favicon 只能存储到这里。', 'site', true)
ON CONFLICT DO NOTHING;

ALTER TABLE media_assets
ADD COLUMN folder_id uuid REFERENCES media_folders(id) ON DELETE SET NULL;

CREATE INDEX media_assets_folder_created_at_idx ON media_assets (folder_id, created_at DESC);
