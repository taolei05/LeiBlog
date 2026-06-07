import { hashPassword } from "../shared/auth";
import { clearAllArticleCache, clearSiteCache } from "../shared/cache/content";
import { encryptSecret } from "../shared/crypto";
import { closeDb, db, withTransaction, type DbClient } from "../shared/db";
import { closeRedis } from "../shared/redis";

process.env.TZ ??= "Asia/Shanghai";

type UserRole = "admin" | "user";
type MediaType = "document" | "image" | "video";

type IdRow = {
  id: string;
};

type SeedUser = {
  avatarUrl: string | null;
  blogUrl: string | null;
  description: string;
  email: string;
  name: string;
  password: string;
  role: UserRole;
  socialLinks: Record<string, string>;
  tags: string[];
  username: string;
};

type SeedCategory = {
  name: string;
  slug: string;
};

type SeedTag = {
  color: string;
  name: string;
  slug: string;
};

type SeedContributor = {
  avatarUrl: string | null;
  linkUrl: string | null;
  name: string;
};

type SeedArticle = {
  categorySlugs: string[];
  contentMdx: string;
  contributorNames: string[];
  coverImageUrl: string;
  isPinned: boolean;
  publishedAt: string;
  readCount: number;
  slug: string;
  summary: string;
  tagSlugs: string[];
  title: string;
};

type SeedMedia = {
  accessUrl: string;
  fileFormat: string;
  fileName: string;
  fileSizeBytes: number;
  fileType: MediaType;
  folderSlug: string;
};

const deprecatedArticleSlugs = [
  "elysia-backend-rebuild",
  "heroui-theme-tokens",
  "city-night-lights",
  "redis-cache-keys",
  "setup-checklist",
  "content-model-notes",
] as const;

const seedUsers: SeedUser[] = [
  {
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
    blogUrl: "https://leiblog.local",
    description: "负责站点内容、工程实现和长期维护。",
    email: "lei.admin@example.com",
    name: "Lei",
    password: "LeiBlog@2026",
    role: "admin",
    socialLinks: {
      github: "https://github.com/leiblog",
    },
    tags: ["作者", "管理员"],
    username: "lei-admin",
  },
  {
    avatarUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
    blogUrl: "https://example.com/river",
    description: "喜欢阅读、城市漫步和慢速记录。",
    email: "river.reader@example.com",
    name: "溪边读者",
    password: "Reader@2026",
    role: "user",
    socialLinks: {},
    tags: ["读者", "写作"],
    username: "river-reader",
  },
  {
    avatarUrl:
      "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=400&q=80",
    blogUrl: "https://example.com/weekend",
    description: "周末出门拍照，偶尔写器材笔记。",
    email: "weekend.viewer@example.com",
    name: "周末观察员",
    password: "Reader@2026",
    role: "user",
    socialLinks: {},
    tags: ["摄影", "小可爱"],
    username: "weekend-viewer",
  },
];

const seedCategories: SeedCategory[] = [
  { name: "生活观察", slug: "life-observations" },
  { name: "阅读笔记", slug: "reading-notes" },
  { name: "摄影手记", slug: "photo-journal" },
  { name: "工程实践", slug: "engineering-practice" },
];

const seedTags: SeedTag[] = [
  { color: "#ec4899", name: "城市", slug: "city" },
  { color: "#14b8a6", name: "写作", slug: "writing" },
  { color: "#f97316", name: "阅读", slug: "reading" },
  { color: "#6366f1", name: "摄影", slug: "photography" },
  { color: "#0ea5e9", name: "发布", slug: "release" },
  { color: "#84cc16", name: "工具", slug: "tools" },
  { color: "#a855f7", name: "器材", slug: "gear" },
  { color: "#22c55e", name: "PostgreSQL", slug: "postgresql" },
  { color: "#f43f5e", name: "Bun", slug: "bun" },
];

const seedContributors: SeedContributor[] = [
  {
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
    linkUrl: "https://github.com/leiblog",
    name: "Lei",
  },
  {
    avatarUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
    linkUrl: "https://example.com/river",
    name: "溪边读者",
  },
];

const seedArticles: SeedArticle[] = [
  {
    categorySlugs: ["life-observations"],
    contentMdx: `---
title: 春日城市漫步札记
---

## 从地铁口开始

周六早上先从地铁口往河边走，路边的早餐摊还冒着热气。这个路线没有复杂目的，只把声音、气味和转角的光记下来。

- 第一段路适合观察店铺开门。
- 第二段路会经过两处树荫。
- 回程最好留给咖啡店和整理照片。

## 一张照片的停顿

![河边步道上的春日树影](https://images.unsplash.com/photo-1494783367193-149034c05e8f?auto=format&fit=crop&w=1200&q=80)

拍照时没有追求满屏信息，只留下树影和行人的间距。这样的画面更像给文章留出的呼吸。

## 回到书桌

回家以后把照片、语音备忘和路线整理成三栏笔记，下一次出门就不用从空白开始。`,
    contributorNames: ["Lei"],
    coverImageUrl:
      "https://images.unsplash.com/photo-1494783367193-149034c05e8f?auto=format&fit=crop&w=1400&q=80",
    isPinned: true,
    publishedAt: "2026-05-16 09:30:00+08",
    readCount: 328,
    slug: "spring-city-walk-notes",
    summary: "一次春日城市漫步留下的路线、照片和回到书桌后的整理方法。",
    tagSlugs: ["city", "writing", "photography"],
    title: "春日城市漫步札记",
  },
  {
    categorySlugs: ["reading-notes"],
    contentMdx: `## 夜读前的三分钟

夜读最难的不是打开书，而是把桌面从白天的工作状态切换出来。关掉主灯，留下低角度台灯，纸页会更安静。

## 记录流程

| 步骤 | 做法 |
| --- | --- |
| 摘录 | 只抄一句真正想回看的话 |
| 提问 | 写下一个还没想明白的问题 |
| 回访 | 第二天早上补一句回应 |

## 一个小脚本

\`\`\`ts
const readingTimer = {
  focusMinutes: 25,
  restMinutes: 5,
};
\`\`\`

这个流程不追求读得多，而是让第二天还能接住前一晚的想法。`,
    contributorNames: ["Lei", "溪边读者"],
    coverImageUrl:
      "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=1400&q=80",
    isPinned: false,
    publishedAt: "2026-05-13 21:10:00+08",
    readCount: 214,
    slug: "desk-light-reading-routine",
    summary: "用灯光、摘录和回访三件小事，把夜读变成稳定的日常流程。",
    tagSlugs: ["reading", "tools", "writing"],
    title: "书桌灯光与夜读流程",
  },
  {
    categorySlugs: ["photo-journal"],
    contentMdx: `## 先减重

相机包越轻，出门越容易。周末只带一机一镜、一块备用电池和一张擦镜布，反而更容易把注意力放回街道。

## 清单

- 35mm 定焦镜头
- 备用电池
- 轻薄肩带
- 小号防水袋

## 留给意外

多出的空间留给路上买到的小册子、明信片或者一杯外带咖啡。包里有余量，散步才不会变成搬运。`,
    contributorNames: ["Lei"],
    coverImageUrl:
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1400&q=80",
    isPinned: false,
    publishedAt: "2026-05-09 10:45:00+08",
    readCount: 176,
    slug: "weekend-camera-bag-list",
    summary: "一份更轻的周末相机包清单，让散步、拍照和记录都更容易发生。",
    tagSlugs: ["photography", "gear", "city"],
    title: "周末相机包清单",
  },
  {
    categorySlugs: ["engineering-practice"],
    contentMdx: `## 发布前先看三件事

小型站点发布不需要复杂仪式，但需要稳定的顺序：迁移、缓存、健康检查。顺序固定下来，临时紧张就会少很多。

## 检查表

| 检查项 | 目标 |
| --- | --- |
| 数据库迁移 | schema_migrations 没有遗漏 |
| Redis | 可连接且允许缓存失效 |
| API | 公开文章接口返回 200 |

## 命令

\`\`\`bash
bun run db:migrate
bun run db:seed
bun run check
\`\`\`

真正有用的发布检查表，应该能在半夜也被照着执行。`,
    contributorNames: ["Lei"],
    coverImageUrl:
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1400&q=80",
    isPinned: false,
    publishedAt: "2026-05-06 18:20:00+08",
    readCount: 142,
    slug: "small-site-release-checklist",
    summary: "把迁移、缓存和健康检查固定成一个轻量发布顺序。",
    tagSlugs: ["release", "bun", "postgresql"],
    title: "小型站点发布检查表",
  },
];

const seedMedia: SeedMedia[] = [
  {
    accessUrl:
      "https://images.unsplash.com/photo-1494783367193-149034c05e8f?auto=format&fit=crop&w=1400&q=80",
    fileFormat: "webp",
    fileName: "spring-city-walk-cover.webp",
    fileSizeBytes: 742_400,
    fileType: "image",
    folderSlug: "article-covers",
  },
  {
    accessUrl:
      "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=1400&q=80",
    fileFormat: "webp",
    fileName: "desk-light-reading-cover.webp",
    fileSizeBytes: 681_200,
    fileType: "image",
    folderSlug: "article-covers",
  },
  {
    accessUrl: "/uploads/seed/release-checklist.pdf",
    fileFormat: "pdf",
    fileName: "release-checklist.pdf",
    fileSizeBytes: 512_000,
    fileType: "document",
    folderSlug: "site",
  },
];

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

async function findUserId(username: string, client: DbClient) {
  const [row] = await client<IdRow[]>`
    SELECT id
    FROM users
    WHERE lower(username) = ${normalizeKey(username)}
    LIMIT 1
  `;

  return row?.id ?? null;
}

async function upsertUser(user: SeedUser, client: DbClient) {
  const existingId = await findUserId(user.username, client);
  const passwordHash = await hashPassword(user.password);

  if (existingId) {
    await client`
      UPDATE users
      SET password_hash = ${passwordHash},
          email = ${user.email},
          name = ${user.name},
          description = ${user.description},
          tags = ${client.array(user.tags, "TEXT")},
          role = ${user.role},
          avatar_url = ${user.avatarUrl},
          social_links = ${JSON.stringify(user.socialLinks)}::jsonb,
          blog_url = ${user.blogUrl}
      WHERE id = ${existingId}
    `;

    return existingId;
  }

  const [created] = await client<IdRow[]>`
    INSERT INTO users (
      username, password_hash, email, name, description, tags, role,
      avatar_url, social_links, blog_url
    )
    VALUES (
      ${user.username},
      ${passwordHash},
      ${user.email},
      ${user.name},
      ${user.description},
      ${client.array(user.tags, "TEXT")},
      ${user.role},
      ${user.avatarUrl},
      ${JSON.stringify(user.socialLinks)}::jsonb,
      ${user.blogUrl}
    )
    RETURNING id
  `;

  return created.id;
}

async function upsertCategory(category: SeedCategory, client: DbClient) {
  const [existing] = await client<IdRow[]>`
    SELECT id
    FROM article_categories
    WHERE lower(slug) = ${normalizeKey(category.slug)}
    LIMIT 1
  `;

  if (existing) {
    await client`
      UPDATE article_categories
      SET name = ${category.name}, slug = ${category.slug}
      WHERE id = ${existing.id}
    `;

    return existing.id;
  }

  const [created] = await client<IdRow[]>`
    INSERT INTO article_categories (name, slug)
    VALUES (${category.name}, ${category.slug})
    RETURNING id
  `;

  return created.id;
}

async function upsertTag(tag: SeedTag, client: DbClient) {
  const [existing] = await client<IdRow[]>`
    SELECT id
    FROM article_tags
    WHERE lower(slug) = ${normalizeKey(tag.slug)}
    LIMIT 1
  `;

  if (existing) {
    await client`
      UPDATE article_tags
      SET name = ${tag.name}, slug = ${tag.slug}, color = ${tag.color}
      WHERE id = ${existing.id}
    `;

    return existing.id;
  }

  const [created] = await client<IdRow[]>`
    INSERT INTO article_tags (name, slug, color)
    VALUES (${tag.name}, ${tag.slug}, ${tag.color})
    RETURNING id
  `;

  return created.id;
}

async function createContributor(contributor: SeedContributor, client: DbClient) {
  const [created] = await client<IdRow[]>`
    INSERT INTO article_contributors (name, avatar_url, link_url)
    VALUES (${contributor.name}, ${contributor.avatarUrl}, ${contributor.linkUrl})
    RETURNING id
  `;

  return created.id;
}

async function upsertArticle(article: SeedArticle, authorId: string, client: DbClient) {
  const [existing] = await client<IdRow[]>`
    SELECT id
    FROM articles
    WHERE lower(slug) = ${normalizeKey(article.slug)}
    LIMIT 1
  `;

  if (existing) {
    await client`
      UPDATE articles
      SET author_id = ${authorId},
          title = ${article.title},
          slug = ${article.slug},
          summary = ${article.summary},
          content_mdx = ${article.contentMdx},
          cover_image_url = ${article.coverImageUrl},
          status = 'published',
          read_count = ${article.readCount},
          is_pinned = ${article.isPinned},
          published_at = ${article.publishedAt}::timestamptz
      WHERE id = ${existing.id}
    `;

    return existing.id;
  }

  const [created] = await client<IdRow[]>`
    INSERT INTO articles (
      author_id, title, slug, summary, content_mdx, cover_image_url,
      status, read_count, is_pinned, published_at
    )
    VALUES (
      ${authorId},
      ${article.title},
      ${article.slug},
      ${article.summary},
      ${article.contentMdx},
      ${article.coverImageUrl},
      'published',
      ${article.readCount},
      ${article.isPinned},
      ${article.publishedAt}::timestamptz
    )
    RETURNING id
  `;

  return created.id;
}

async function seedSite(client: DbClient) {
  const resendApiKey = encryptSecret(null);
  const deeplApiKey = encryptSecret(null);
  const ipgeolocationApiKey = encryptSecret(null);

  await client`
    INSERT INTO site_info (
      id, site_name, description, logo_dark_url, logo_light_url, favicon_url,
      home_cover_urls, home_slogan, established_at
    )
    VALUES (
      1,
      'LeiBlog',
      '记录工程实践、阅读笔记、摄影手记和生活观察。',
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=320&q=80',
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=320&q=80',
      '/favicon.svg',
      ${client.array([], "TEXT")},
      '',
      '2026-05-01 09:00:00+08'::timestamptz
    )
    ON CONFLICT (id) DO UPDATE
    SET site_name = EXCLUDED.site_name,
        description = EXCLUDED.description,
        logo_dark_url = EXCLUDED.logo_dark_url,
        logo_light_url = EXCLUDED.logo_light_url,
        favicon_url = EXCLUDED.favicon_url,
        home_cover_urls = EXCLUDED.home_cover_urls,
        home_slogan = EXCLUDED.home_slogan,
        established_at = EXCLUDED.established_at
  `;

  await client`
    INSERT INTO site_config (
      id, seo_title, seo_description, seo_keywords, copyright, resend_domain,
      resend_api_key_encrypted, deepl_api_key_encrypted, ipgeolocation_api_key_encrypted,
      comments_enabled
    )
    VALUES (
      1,
      'LeiBlog - 工程、阅读与生活记录',
      '一个使用 Bun、Elysia、PostgreSQL 和 React 构建的中文个人博客。',
      ${client.array(["LeiBlog", "工程实践", "阅读笔记", "摄影"], "TEXT")},
      'Copyright © 2026 LeiBlog. All rights reserved.',
      null,
      ${resendApiKey ? JSON.stringify(resendApiKey) : null}::jsonb,
      ${deeplApiKey ? JSON.stringify(deeplApiKey) : null}::jsonb,
      ${ipgeolocationApiKey ? JSON.stringify(ipgeolocationApiKey) : null}::jsonb,
      true
    )
    ON CONFLICT (id) DO UPDATE
    SET seo_title = EXCLUDED.seo_title,
        seo_description = EXCLUDED.seo_description,
        seo_keywords = EXCLUDED.seo_keywords,
        copyright = EXCLUDED.copyright,
        resend_domain = EXCLUDED.resend_domain,
        resend_api_key_encrypted = EXCLUDED.resend_api_key_encrypted,
        deepl_api_key_encrypted = EXCLUDED.deepl_api_key_encrypted,
        ipgeolocation_api_key_encrypted = EXCLUDED.ipgeolocation_api_key_encrypted,
        comments_enabled = EXCLUDED.comments_enabled
  `;

  await client`
    INSERT INTO site_filing (id, icp_records, police_number, police_url)
    VALUES (1, '[]'::jsonb, null, null)
    ON CONFLICT (id) DO UPDATE
    SET icp_records = EXCLUDED.icp_records,
        police_number = EXCLUDED.police_number,
        police_url = EXCLUDED.police_url
  `;
}

async function removeDeprecatedArticles(client: DbClient) {
  for (const slug of deprecatedArticleSlugs) {
    await client`
      DELETE FROM articles
      WHERE lower(slug) = ${slug}
    `;
  }
}

async function linkArticleTaxonomy({
  article,
  articleId,
  categoryIds,
  client,
  contributorIds,
  tagIds,
}: {
  article: SeedArticle;
  articleId: string;
  categoryIds: Map<string, string>;
  client: DbClient;
  contributorIds: Map<string, string>;
  tagIds: Map<string, string>;
}) {
  await client`DELETE FROM article_category_links WHERE article_id = ${articleId}`;
  await client`DELETE FROM article_tag_links WHERE article_id = ${articleId}`;
  await client`DELETE FROM article_contributor_links WHERE article_id = ${articleId}`;

  for (const slug of article.categorySlugs) {
    const categoryId = categoryIds.get(slug);
    if (!categoryId) continue;

    await client`
      INSERT INTO article_category_links (article_id, category_id)
      VALUES (${articleId}, ${categoryId})
      ON CONFLICT DO NOTHING
    `;
  }

  for (const slug of article.tagSlugs) {
    const tagId = tagIds.get(slug);
    if (!tagId) continue;

    await client`
      INSERT INTO article_tag_links (article_id, tag_id)
      VALUES (${articleId}, ${tagId})
      ON CONFLICT DO NOTHING
    `;
  }

  for (const name of article.contributorNames) {
    const contributorId = contributorIds.get(name);
    if (!contributorId) continue;

    await client`
      INSERT INTO article_contributor_links (article_id, contributor_id)
      VALUES (${articleId}, ${contributorId})
      ON CONFLICT DO NOTHING
    `;
  }
}

async function seedMediaAssets(
  mediaItems: SeedMedia[],
  uploadedBy: string,
  client: DbClient
) {
  for (const item of mediaItems) {
    const [folder] = await client<IdRow[]>`
      SELECT id
      FROM media_folders
      WHERE slug = ${item.folderSlug}
      LIMIT 1
    `;
    await client`
      INSERT INTO media_assets (
        file_name, file_format, file_type, file_size_bytes, access_url, folder_id, uploaded_by
      )
      VALUES (
        ${item.fileName},
        ${item.fileFormat},
        ${item.fileType},
        ${item.fileSizeBytes},
        ${item.accessUrl},
        ${folder?.id ?? null},
        ${uploadedBy}
      )
      ON CONFLICT (access_url) DO UPDATE
      SET file_name = EXCLUDED.file_name,
          file_format = EXCLUDED.file_format,
          file_type = EXCLUDED.file_type,
          file_size_bytes = EXCLUDED.file_size_bytes,
          folder_id = EXCLUDED.folder_id,
          uploaded_by = EXCLUDED.uploaded_by
    `;
  }
}

async function ensureSeedCompatibleSchema(client: DbClient) {
  await client.unsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'comment_target_type'
      ) THEN
        CREATE TYPE comment_target_type AS ENUM ('article', 'guestbook');
      END IF;
    END
    $$;
  `);

  await client.unsafe(`
    ALTER TABLE comments
    ADD COLUMN IF NOT EXISTS target_type comment_target_type
  `);
  await client.unsafe(`
    ALTER TABLE comments
    ADD COLUMN IF NOT EXISTS comment_ip inet,
    ADD COLUMN IF NOT EXISTS comment_location jsonb,
    ADD COLUMN IF NOT EXISTS comment_device jsonb
  `);
  await client.unsafe(`
    UPDATE comments
    SET target_type = 'article'
    WHERE target_type IS NULL
  `);
  await client.unsafe(`
    ALTER TABLE comments
    ALTER COLUMN target_type SET DEFAULT 'article',
    ALTER COLUMN target_type SET NOT NULL,
    ALTER COLUMN article_id DROP NOT NULL
  `);
  await client.unsafe(`
    ALTER TABLE comments
    DROP CONSTRAINT IF EXISTS comments_target_ref_check
  `);
  await client.unsafe(`
    ALTER TABLE comments
    ADD CONSTRAINT comments_target_ref_check CHECK (
      (target_type = 'article' AND article_id IS NOT NULL)
      OR (target_type = 'guestbook' AND article_id IS NULL)
    )
  `);
  await client.unsafe(`
    CREATE INDEX IF NOT EXISTS comments_target_created_at_idx
    ON comments (target_type, created_at DESC)
  `);

  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS email_change_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      new_email varchar(254) NOT NULL,
      code_hash text NOT NULL,
      expires_at timestamptz NOT NULL,
      consumed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.unsafe(`
    CREATE INDEX IF NOT EXISTS email_change_requests_user_created_at_idx
    ON email_change_requests (user_id, created_at DESC)
  `);
  await client.unsafe(`
    CREATE INDEX IF NOT EXISTS email_change_requests_email_created_at_idx
    ON email_change_requests (lower(new_email), created_at DESC)
  `);

  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS media_folders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(80) NOT NULL,
      slug varchar(100) NOT NULL,
      description text NOT NULL DEFAULT '',
      system_key varchar(40),
      is_protected boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS media_folders_slug_unique
    ON media_folders (lower(slug))
  `);
  await client.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS media_folders_system_key_unique
    ON media_folders (system_key)
    WHERE system_key IS NOT NULL
  `);
  await client.unsafe(`
    ALTER TABLE media_assets
    ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES media_folders(id) ON DELETE SET NULL
  `);
  await client.unsafe(`
    CREATE INDEX IF NOT EXISTS media_assets_folder_created_at_idx
    ON media_assets (folder_id, created_at DESC)
  `);
  await client`
    INSERT INTO media_folders (name, slug, description, system_key, is_protected)
    VALUES
      ('文章封面', 'article-covers', '文章封面只能存储到这里。', 'article-covers', true),
      ('头像', 'avatars', '所有用户头像只能存储到这里。', 'avatars', true),
      ('评论', 'comments', '评论图片只能存储到这里。', 'comments', true),
      ('站点', 'site', '站点深浅色 Logo 和 favicon 只能存储到这里。', 'site', true)
    ON CONFLICT DO NOTHING
  `;
  await client.unsafe(`
    UPDATE media_folders
    SET is_protected = true
    WHERE slug IN ('article-covers', 'avatars', 'comments', 'site')
  `);
}

async function seedComments({
  articleIds,
  client,
  userIds,
}: {
  articleIds: Map<string, string>;
  client: DbClient;
  userIds: Map<string, string>;
}) {
  const scopedUserIds = [...userIds.values()];
  const scopedArticleIds = [...articleIds.values()];

  if (scopedUserIds.length > 0) {
    await client`
      DELETE FROM comments
      WHERE user_id = ANY(${client.array(scopedUserIds, "UUID")})
        AND (
          target_type = 'guestbook'
          OR article_id = ANY(${client.array(scopedArticleIds, "UUID")})
        )
    `;
  }

  const cityArticleId = articleIds.get("spring-city-walk-notes");
  const readingArticleId = articleIds.get("desk-light-reading-routine");
  const authorId = userIds.get("lei-admin");
  const riverReaderId = userIds.get("river-reader");
  const weekendViewerId = userIds.get("weekend-viewer");

  if (cityArticleId && riverReaderId) {
    await client`
      INSERT INTO comments (target_type, article_id, user_id, content, status, created_at)
      VALUES (
        'article',
        ${cityArticleId},
        ${riverReaderId},
        '这条路线很适合周末早上照着走，尤其喜欢最后回到书桌整理的部分。',
        'approved',
        '2026-05-16 12:08:00+08'::timestamptz
      )
    `;
  }

  if (readingArticleId && weekendViewerId) {
    await client`
      INSERT INTO comments (target_type, article_id, user_id, content, status, created_at)
      VALUES (
        'article',
        ${readingArticleId},
        ${weekendViewerId},
        '夜读流程里的回访步骤很实用，第二天补一句回应这个动作我会试试。',
        'approved',
        '2026-05-14 08:22:00+08'::timestamptz
      )
    `;
  }

  if (authorId) {
    await client`
      INSERT INTO comments (target_type, article_id, user_id, content, status, created_at)
      VALUES (
        'guestbook',
        null,
        ${authorId},
        '欢迎把想看的主题留在这里，我会优先补成完整文章。',
        'approved',
        '2026-05-16 10:20:00+08'::timestamptz
      )
    `;
  }
}

async function main() {
  const userIds = new Map<string, string>();
  const categoryIds = new Map<string, string>();
  const tagIds = new Map<string, string>();
  const contributorIds = new Map<string, string>();
  const articleIds = new Map<string, string>();

  await ensureSeedCompatibleSchema(db);

  await withTransaction(async (tx) => {
    await seedSite(tx);
    await removeDeprecatedArticles(tx);

    for (const contributor of seedContributors) {
      await tx`
        DELETE FROM article_contributors
        WHERE lower(name) = ${normalizeKey(contributor.name)}
      `;
      const contributorId = await createContributor(contributor, tx);
      contributorIds.set(contributor.name, contributorId);
    }

    for (const user of seedUsers) {
      const userId = await upsertUser(user, tx);
      userIds.set(user.username, userId);
    }

    for (const category of seedCategories) {
      const categoryId = await upsertCategory(category, tx);
      categoryIds.set(category.slug, categoryId);
    }

    for (const tag of seedTags) {
      const tagId = await upsertTag(tag, tx);
      tagIds.set(tag.slug, tagId);
    }

    const authorId = userIds.get("lei-admin");
    if (!authorId) throw new Error("Seed author was not created");

    for (const article of seedArticles) {
      const articleId = await upsertArticle(article, authorId, tx);
      articleIds.set(article.slug, articleId);
      await linkArticleTaxonomy({
        article,
        articleId,
        categoryIds,
        client: tx,
        contributorIds,
        tagIds,
      });
    }

    await seedComments({ articleIds, client: tx, userIds });
    await seedMediaAssets(seedMedia, authorId, tx);
  });

  await clearAllArticleCache();
  await clearSiteCache();

  console.log("数据库种子数据已写入：4 篇文章、4 个分类、9 个标签、3 个用户。");
}

try {
  await main();
} finally {
  await closeRedis();
  await closeDb();
}
