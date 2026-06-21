import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { getAdminDashboardOverview } from "../src/admin/dashboard/service";
import { hashPassword } from "../src/shared/auth";
import type { AuthUser } from "../src/shared/auth";

const POSTGRES_ADMIN_URL =
  process.env.TEST_POSTGRES_ADMIN_URL ??
  "postgres://taolei:12345678@localhost:5432/postgres";

const dbName = `lei_blog_dashboard_test_${Date.now()}`;
const adminDb = new Bun.SQL(POSTGRES_ADMIN_URL, { max: 1 });
let testDb: Bun.SQL;
let currentAdmin: AuthUser;

beforeAll(async () => {
  await adminDb.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await adminDb.unsafe(`CREATE DATABASE ${dbName}`);

  testDb = new Bun.SQL(`postgres://taolei:12345678@localhost:5432/${dbName}`, { max: 1 });

  const migration = readFileSync(
    join(import.meta.dir, "../src/db/migrations/001_initial_schema.sql"),
    "utf8",
  );
  await testDb.unsafe(migration);

  const [admin] = await testDb<{ id: string }[]>`
    INSERT INTO users (username, password_hash, email, role)
    VALUES ('admin', ${await hashPassword("admin-password")}, 'admin@example.com', 'admin')
    RETURNING id
  `;
  const [reader] = await testDb<{ id: string }[]>`
    INSERT INTO users (username, password_hash, email, name, role)
    VALUES ('reader', ${await hashPassword("reader-password")}, 'reader@example.com', '读者', 'user')
    RETURNING id
  `;

  currentAdmin = {
    id: admin.id,
    username: "admin",
    email: "admin@example.com",
    name: null,
    role: "admin",
    avatarUrl: null,
  };

  await testDb`
    INSERT INTO site_config (
      id, comments_enabled, resend_domain, resend_api_key_encrypted,
      deepl_api_key_encrypted, ipgeolocation_api_key_encrypted,
      r2_enabled, r2_account_id, r2_bucket, r2_access_key_id,
      r2_secret_access_key_encrypted, r2_public_base_url
    )
    VALUES (
      1, true, 'mail.example.com', '{"value":"resend"}'::jsonb,
      '{"value":"deepl"}'::jsonb, '{"value":"geo"}'::jsonb,
      true, 'account-id', 'leiblog', 'access-key',
      '{"value":"r2"}'::jsonb, 'https://media.example.com/assets'
    )
    ON CONFLICT (id) DO UPDATE
    SET comments_enabled = EXCLUDED.comments_enabled,
        resend_domain = EXCLUDED.resend_domain,
        resend_api_key_encrypted = EXCLUDED.resend_api_key_encrypted,
        deepl_api_key_encrypted = EXCLUDED.deepl_api_key_encrypted,
        ipgeolocation_api_key_encrypted = EXCLUDED.ipgeolocation_api_key_encrypted,
        r2_enabled = EXCLUDED.r2_enabled,
        r2_account_id = EXCLUDED.r2_account_id,
        r2_bucket = EXCLUDED.r2_bucket,
        r2_access_key_id = EXCLUDED.r2_access_key_id,
        r2_secret_access_key_encrypted = EXCLUDED.r2_secret_access_key_encrypted,
        r2_public_base_url = EXCLUDED.r2_public_base_url
  `;
  await testDb`
    UPDATE auth_provider_settings
    SET enabled = true,
        client_id = 'github-client',
        client_secret_encrypted = '{"value":"github"}'::jsonb,
        redirect_uri = 'https://example.com/oauth/github/callback'
    WHERE provider = 'github'
  `;

  const [published] = await testDb<{ id: string }[]>`
    INSERT INTO articles (
      author_id, title, slug, summary, content_mdx, status, read_count,
      published_at, updated_at
    )
    VALUES (
      ${admin.id}, '已发布文章', 'published-article', '摘要', '正文',
      'published', 12, now() - interval '2 days', now() - interval '1 hour'
    )
    RETURNING id
  `;
  await testDb`
    INSERT INTO articles (
      author_id, title, slug, content_mdx, status, scheduled_publish_at, updated_at
    )
    VALUES (
      ${admin.id}, '定时文章', 'scheduled-article', '正文',
      'draft', now() + interval '1 day', now()
    )
  `;
  await testDb`
    INSERT INTO articles (author_id, title, slug, content_mdx, status, updated_at)
    VALUES (${admin.id}, '普通草稿', 'draft-article', '正文', 'draft', now() - interval '3 hours')
  `;
  await testDb`
    INSERT INTO comments (article_id, user_id, content, status, created_at)
    VALUES
      (${published.id}, ${reader.id}, '这是一条待审核评论', 'pending', now()),
      (${published.id}, ${reader.id}, '这是一条已通过评论', 'approved', now() - interval '1 day')
  `;
  await testDb`
    INSERT INTO media_assets (
      file_name, file_format, file_type, file_size_bytes, access_url,
      uploaded_by, storage_provider, storage_key, storage_bucket
    )
    VALUES
      ('cover.png', 'png', 'image', 100, '/uploads/cover.png', ${admin.id}, 'local', null, null),
      ('logo.svg', 'svg', 'image', 200, 'https://media.example.com/logo.svg', ${admin.id}, 'r2', 'logo.svg', 'leiblog')
  `;
});

afterAll(async () => {
  await testDb?.close({ timeout: 1 });
  await adminDb.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await adminDb.close({ timeout: 1 });
});

describe("admin dashboard overview", () => {
  test("aggregates content tasks, recent activity, storage, and integration health", async () => {
    const overview = await getAdminDashboardOverview(currentAdmin, testDb);

    expect(overview.ok).toBe(true);
    expect(overview.item.metrics).toMatchObject({
      draftArticles: 2,
      localMedia: 1,
      pendingComments: 1,
      publishedArticles: 1,
      r2Media: 1,
      scheduledArticles: 1,
      totalComments: 2,
      totalReads: 12,
    });
    expect(overview.item.storage).toMatchObject({
      localCount: 1,
      r2Configured: true,
      r2Count: 1,
      r2Enabled: true,
      totalCount: 2,
      totalSizeBytes: 300,
    });
    expect(overview.item.contentTasks.map((task) => task.label)).toEqual([
      "待审核评论",
      "定时文章",
      "草稿文章",
    ]);
    expect(overview.item.recentArticles[0]?.title).toBe("定时文章");
    expect(overview.item.recentComments[0]).toMatchObject({
      authorName: "读者",
      excerpt: "这是一条待审核评论",
      status: "pending",
      targetTitle: "已发布文章",
    });
    expect(overview.item.integrations).toEqual([
      { key: "comments", label: "评论系统", state: "enabled" },
      { key: "email", label: "邮件通知", state: "configured" },
      { key: "r2", label: "Cloudflare R2", state: "enabled" },
      { key: "deepl", label: "DeepL", state: "configured" },
      { key: "ipgeolocation", label: "IPGeolocation", state: "configured" },
      { key: "oauth", label: "第三方登录", state: "enabled" },
    ]);
  });

  test("blocks ordinary users", async () => {
    await expect(
      getAdminDashboardOverview({ ...currentAdmin, role: "user" }, testDb),
    ).rejects.toThrow("需要管理员权限");
  });
});
