import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  createArticle,
  updateArticle,
} from "../src/admin/content/service";
import { createPublicComment } from "../src/public/comments/service";
import {
  getPublishedArticleBySlug,
  listPublishedArticles,
} from "../src/public/articles/service";
import { getPublicSiteInfo } from "../src/public/site/service";
import { hashPassword, type AuthUser } from "../src/shared/auth";
import {
  clearAllArticleCache,
  clearSiteCache,
} from "../src/shared/cache/content";
import { closeRedis, getRedis, redisKeys } from "../src/shared/redis";
import { createMigratedTestDatabase, type TestDatabase } from "./helpers/database";

let testDatabase: TestDatabase;
let testDb: Bun.SQL;
let redisAvailable = false;
let currentAdmin: AuthUser;
let currentUser: AuthUser;

beforeAll(async () => {
  testDatabase = await createMigratedTestDatabase("lei_blog_cache_test");
  testDb = new Bun.SQL(testDatabase.databaseUrl, { max: 1 });

  const [admin] = await testDb<{ id: string }[]>`
    INSERT INTO users (username, password_hash, email, role)
    VALUES ('admin', ${await hashPassword("admin-password")}, 'admin@example.com', 'admin')
    RETURNING id
  `;
  const [user] = await testDb<{ id: string }[]>`
    INSERT INTO users (username, password_hash, email, role)
    VALUES ('cache-user', ${await hashPassword("user-password")}, 'cache-user@example.com', 'user')
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
  currentUser = {
    id: user.id,
    username: "cache-user",
    email: "cache-user@example.com",
    name: null,
    role: "user",
    avatarUrl: null,
  };

  await testDb`
    INSERT INTO site_info (
      id, site_name, description, established_at
    )
    VALUES (1, 'LeiBlog Cache', '缓存测试站点', now())
  `;
  await testDb`
    INSERT INTO site_config (
      id, seo_title, seo_description, seo_keywords, copyright, comments_enabled
    )
    VALUES (
      1,
      'LeiBlog Cache',
      '缓存测试',
      ${testDb.array(["LeiBlog", "Cache"], "TEXT")},
      'Copyright',
      true
    )
  `;

  try {
    const redis = await getRedis();
    redisAvailable = (await redis.ping()) === "PONG";
    await clearSiteCache();
    await clearAllArticleCache();
  } catch {
    redisAvailable = false;
  }
});

afterAll(async () => {
  await clearSiteCache();
  await clearAllArticleCache();
  await closeRedis();
  await testDb?.close({ timeout: 1 });
  await testDatabase?.drop();
});

describe("cache layer", () => {
  test("caches public site info and refreshes after invalidation", async () => {
    if (!redisAvailable) return;

    const first = await getPublicSiteInfo(testDb);
    expect(first.siteName).toBe("LeiBlog Cache");

    await testDb`
      UPDATE site_info
      SET site_name = 'LeiBlog Cache Updated'
      WHERE id = 1
    `;

    const cached = await getPublicSiteInfo(testDb);
    expect(cached.siteName).toBe("LeiBlog Cache");

    await clearSiteCache();
    const refreshed = await getPublicSiteInfo(testDb);
    expect(refreshed.siteName).toBe("LeiBlog Cache Updated");
  });

  test("caches public article list/detail and clears them on writes", async () => {
    if (!redisAvailable) return;

    const slug = `cache-post-${Date.now()}`;
    const article = await createArticle(
      currentAdmin,
      {
        title: "缓存文章",
        slug,
        contentMdx: "# 缓存文章\n\n缓存详情。",
        status: "published",
      },
      testDb
    );
    await clearAllArticleCache();

    const firstDetail = await getPublishedArticleBySlug(article.slug, testDb);
    expect(firstDetail.commentCount).toBe(0);

    const redis = await getRedis();
    expect(await redis.exists(redisKeys.post(article.slug))).toBe(1);

    await createPublicComment(
      currentUser,
      article.id,
      { content: "缓存需要刷新" },
      testDb
    );
    expect(await redis.exists(redisKeys.post(article.slug))).toBe(0);

    const refreshedDetail = await getPublishedArticleBySlug(article.slug, testDb);
    expect(refreshedDetail.commentCount).toBe(1);

    const list = await listPublishedArticles(
      { search: article.slug, page: 1, pageSize: 10 },
      testDb
    );
    expect(list.total).toBe(1);
    expect(list.items[0]?.commentCount).toBe(1);
    expect((await redis.keys(redisKeys.postListPattern)).length).toBeGreaterThan(0);

    await updateArticle(
      currentAdmin,
      article.id,
      { status: "offline" },
      testDb
    );

    expect(await redis.exists(redisKeys.post(article.slug))).toBe(0);
    expect((await redis.keys(redisKeys.postListPattern)).length).toBe(0);
  });
});
