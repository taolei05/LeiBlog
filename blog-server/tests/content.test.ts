import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  createArticle,
  createCategory,
  createContributor,
  createTag,
  createTags,
  deleteArticle,
  listArticles,
  listCategories,
  listContributors,
  listTags,
  publishDueScheduledArticles,
  updateArticle,
} from "../src/admin/content/service";
import { listPublishedArticles } from "../src/public/articles/service";
import { hashPassword, type AuthUser } from "../src/shared/auth";
import { encryptSecret } from "../src/shared/crypto";

const POSTGRES_ADMIN_URL =
  process.env.TEST_POSTGRES_ADMIN_URL ??
  "postgres://taolei:12345678@localhost:5432/postgres";

const dbName = `lei_blog_content_test_${Date.now()}`;
const adminDb = new Bun.SQL(POSTGRES_ADMIN_URL, { max: 1 });
let testDb: Bun.SQL;
let currentAdmin: AuthUser;

beforeAll(async () => {
  await adminDb.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await adminDb.unsafe(`CREATE DATABASE ${dbName}`);

  testDb = new Bun.SQL(
    `postgres://taolei:12345678@localhost:5432/${dbName}`,
    { max: 1 }
  );

  const migration = readFileSync(
    join(import.meta.dir, "../src/db/migrations/001_initial_schema.sql"),
    "utf8"
  );
  await testDb.unsafe(migration);

  const [admin] = await testDb<{ id: string }[]>`
    INSERT INTO users (username, password_hash, email, role)
    VALUES ('admin', ${await hashPassword("admin-password")}, 'admin@example.com', 'admin')
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
});

afterAll(async () => {
  await testDb?.close({ timeout: 1 });
  await adminDb.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await adminDb.close({ timeout: 1 });
});

describe("admin content service", () => {
  test("manages taxonomies, contributors, articles, filters, and revisions", async () => {
    const category = await createCategory(
      currentAdmin,
      { name: "技术文章" },
      testDb
    );
    const duplicateCategory = await createCategory(
      currentAdmin,
      { name: "技术文章" },
      testDb
    );
    expect(category.slug).toBe("ji-shu-wen-zhang");
    expect(duplicateCategory.slug).toBe("ji-shu-wen-zhang-2");

    const tag = await createTag(
      currentAdmin,
      { name: "React", slug: "react", color: "#22c55e" },
      testDb
    );
    const contributor = await createContributor(
      currentAdmin,
      {
        name: "Contributor",
        avatarUrl: "https://example.com/avatar.png",
        linkUrl: "https://github.com/example",
      },
      testDb
    );

    const article = await createArticle(
      currentAdmin,
      {
        title: "你好 Elysia",
        contentMdx: "# 你好\n\n这是一篇测试文章。",
        status: "draft",
        isPinned: true,
        categoryIds: [category.id, duplicateCategory.id],
        tagIds: [tag.id],
        contributorIds: [contributor.id],
      },
      testDb
    );

    expect(article.slug).toBe("ni-hao-elysia");
    expect(article.authorName).toBe("admin");
    expect(article.summary).toBe("你好 这是一篇测试文章。");
    expect(article.categories).toHaveLength(1);
    expect(article.categories[0]?.id).toBe(category.id);
    expect(article.tags[0]?.id).toBe(tag.id);
    expect(article.contributors[0]?.id).toBe(contributor.id);

    const published = await updateArticle(
      currentAdmin,
      article.id,
      {
        status: "published",
        title: "你好 Elysia",
        contentMdx: "# 你好\n\n更新后的内容。",
      },
      testDb
    );
    expect(published.status).toBe("published");
    expect(typeof published.publishedAt).toBe("string");

    const filtered = await listArticles(
      currentAdmin,
      {
        status: "published",
        categoryId: category.id,
        tagId: tag.id,
        contributorId: contributor.id,
        isPinned: true,
        page: 1,
        pageSize: 10,
      },
      testDb
    );
    expect(filtered.total).toBe(1);
    expect(filtered.items[0]?.authorName).toBe("admin");
    expect(filtered.items[0]?.id).toBe(article.id);

    const publicByCategory = await listPublishedArticles(
      { search: "技术文章", page: 1, pageSize: 10 },
      testDb
    );
    const publicByTag = await listPublishedArticles(
      { search: "react", page: 1, pageSize: 10 },
      testDb
    );
    const publicByBody = await listPublishedArticles(
      { search: "更新后", page: 1, pageSize: 10 },
      testDb
    );
    expect(publicByCategory.total).toBe(1);
    expect(publicByCategory.items[0]?.id).toBe(article.id);
    expect(publicByTag.total).toBe(1);
    expect(publicByTag.items[0]?.id).toBe(article.id);
    expect(publicByBody.total).toBe(1);
    expect(publicByBody.items[0]?.searchExcerpt).toContain("更新后的内容");

    const [revisionCount] = await testDb<{ count: string }[]>`
      SELECT count(*) AS count
      FROM article_revisions
      WHERE article_id = ${article.id}
    `;
    expect(Number(revisionCount.count)).toBe(1);

    const categories = await listCategories(currentAdmin, { search: "技术" }, testDb);
    const tags = await listTags(currentAdmin, { search: "react" }, testDb);
    const contributors = await listContributors(
      currentAdmin,
      { search: "contributor" },
      testDb
    );
    expect(categories.total).toBe(2);
    expect(tags.total).toBe(1);
    expect(contributors.total).toBe(1);
    expect(contributors.items[0]?.articleCount).toBe(1);

    await deleteArticle(currentAdmin, article.id, testDb);
    const afterDelete = await listArticles(currentAdmin, { page: 1 }, testDb);
    expect(afterDelete.total).toBe(0);
  });

  test("blocks ordinary users from admin operations", async () => {
    await expect(
      createCategory(
        {
          ...currentAdmin,
          role: "user",
        },
        { name: "权限测试" },
        testDb
      )
    ).rejects.toThrow("需要管理员权限");
  });

  test("uses DeepL for generated category and tag slugs when configured", async () => {
    const encryptedDeepLApiKey = encryptSecret("deepl-secret");
    const originalFetch = globalThis.fetch;
    const translatedTexts: string[] = [];
    const translations = new Map([
      ["部署运维", "deployment operations"],
      ["云服务器", "cloud server"],
      ["LeiBlog 部署指南", "LeiBlog deployment guide"],
    ]);

    await testDb`
      INSERT INTO site_config (id, deepl_api_key_encrypted)
      VALUES (1, ${JSON.stringify(encryptedDeepLApiKey)}::jsonb)
      ON CONFLICT (id) DO UPDATE
      SET deepl_api_key_encrypted = EXCLUDED.deepl_api_key_encrypted
    `;

    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("api-free.deepl.com") || url.includes("api.deepl.com")) {
          const body = JSON.parse(String(init?.body)) as { target_lang: string; text: string[] };
          expect(body.target_lang).toBe("EN");
          translatedTexts.push(body.text[0] ?? "");

          return Response.json({
            translations: [{ text: translations.get(body.text[0] ?? "") ?? body.text[0] }],
          });
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      },
      originalFetch,
    );

    try {
      const category = await createCategory(currentAdmin, { name: "部署运维" }, testDb);
      const tag = await createTag(currentAdmin, { name: "云服务器" }, testDb);
      const article = await createArticle(
        currentAdmin,
        {
          contentMdx: "部署正文",
          status: "draft",
          title: "LeiBlog 部署指南",
        },
        testDb,
      );

      expect(category.slug).toBe("deployment-operations");
      expect(tag.slug).toBe("cloud-server");
      expect(article.slug).toBe("leiblog-deployment-guide");
      expect(translatedTexts).toEqual(["部署运维", "云服务器", "LeiBlog 部署指南"]);
    } finally {
      globalThis.fetch = originalFetch;
      await testDb`
        UPDATE site_config
        SET deepl_api_key_encrypted = null
        WHERE id = 1
      `;
    }
  });

  test("creates multiple tags with server-assigned colors", async () => {
    const singleTag = await createTag(currentAdmin, { name: "单个随机标签" }, testDb);

    expect(singleTag.color).toMatch(/^#[0-9a-f]{6}$/i);

    const result = await createTags(
      currentAdmin,
      {
        items: [
          { name: "批量标签一" },
          { name: "批量标签二" },
        ],
      },
      testDb,
    );

    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.name)).toEqual(["批量标签一", "批量标签二"]);
    for (const item of result.items) {
      expect(item.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  test("keeps future scheduled articles private until the publisher promotes them", async () => {
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const scheduledArticle = await createArticle(
      currentAdmin,
      {
        contentMdx: "这是一篇定时发布文章。",
        scheduledPublishAt: scheduledAt,
        status: "published",
        title: "定时发布文章",
      },
      testDb
    );

    expect(scheduledArticle.status).toBe("draft");
    expect(scheduledArticle.publishedAt).toBeNull();
    expect(scheduledArticle.scheduledPublishAt).toBe(scheduledAt);

    const beforePublish = await listPublishedArticles(
      { search: "定时发布文章", page: 1, pageSize: 10 },
      testDb
    );
    expect(beforePublish.total).toBe(0);

    await testDb`
      UPDATE articles
      SET scheduled_publish_at = now() - interval '1 minute'
      WHERE id = ${scheduledArticle.id}
    `;

    const result = await publishDueScheduledArticles(testDb);
    const [publishedRow] = await testDb<{
      published_at: Date | null;
      scheduled_publish_at: Date | null;
      status: string;
    }[]>`
      SELECT status, published_at, scheduled_publish_at
      FROM articles
      WHERE id = ${scheduledArticle.id}
    `;
    const afterPublish = await listPublishedArticles(
      { search: "定时发布文章", page: 1, pageSize: 10 },
      testDb
    );

    expect(result.publishedCount).toBe(1);
    expect(publishedRow.status).toBe("published");
    expect(publishedRow.published_at).toBeInstanceOf(Date);
    expect(publishedRow.scheduled_publish_at).toBeNull();
    expect(afterPublish.total).toBe(1);
    expect(afterPublish.items[0]?.id).toBe(scheduledArticle.id);
  });
});
