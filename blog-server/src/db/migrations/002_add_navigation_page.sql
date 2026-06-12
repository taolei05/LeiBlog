INSERT INTO media_folders (name, slug, description, system_key, is_protected)
VALUES (
  '网址图标',
  'website-icons',
  '导航页网站图标只能存储到这里。',
  'website-icons',
  true
)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS navigation_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS navigation_groups_name_unique
ON navigation_groups (lower(name));

CREATE INDEX IF NOT EXISTS navigation_groups_sort_order_idx
ON navigation_groups (sort_order, created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'navigation_groups_set_updated_at'
  ) THEN
    CREATE TRIGGER navigation_groups_set_updated_at
    BEFORE UPDATE ON navigation_groups
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END
$$;

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'navigation_items_set_updated_at'
  ) THEN
    CREATE TRIGGER navigation_items_set_updated_at
    BEFORE UPDATE ON navigation_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END
$$;
