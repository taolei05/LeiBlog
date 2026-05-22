import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  createArticle,
  createCategory,
  createContributor,
  createTag,
  deleteArticle,
  listArticles,
  listCategories,
  listContributors,
  listTags,
  updateArticle,
} from "../src/admin/content/service";
import { hashPassword, type AuthUser } from "../src/shared/auth";

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
        categoryIds: [category.id],
        tagIds: [tag.id],
        contributorIds: [contributor.id],
      },
      testDb
    );

    expect(article.slug).toBe("ni-hao-elysia");
    expect(article.summary).toBe("你好 这是一篇测试文章。");
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
        isPinned: "true",
        page: "1",
        pageSize: "10",
      },
      testDb
    );
    expect(filtered.total).toBe(1);
    expect(filtered.items[0]?.id).toBe(article.id);

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
    const afterDelete = await listArticles(currentAdmin, { page: "1" }, testDb);
    expect(afterDelete.total).toBe(0);
  });

  test("blocks demo write operations", async () => {
    await expect(
      createCategory(
        {
          ...currentAdmin,
          role: "demo",
        },
        { name: "只读测试" },
        testDb
      )
    ).rejects.toThrow("演示账户仅允许读取");
  });
});
