import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  deleteCommentByAdmin,
  listAdminComments,
  reviewComment,
} from "../src/admin/comments/service";
import { createArticle, createCategory } from "../src/admin/content/service";
import { createPublicComment, listPublicComments } from "../src/public/comments/service";
import { deleteMyComment, updateMyComment } from "../src/me/comments/service";
import { hashPassword, type AuthUser } from "../src/shared/auth";

const POSTGRES_ADMIN_URL =
  process.env.TEST_POSTGRES_ADMIN_URL ??
  "postgres://taolei:12345678@localhost:5432/postgres";

const dbName = `lei_blog_comments_test_${Date.now()}`;
const adminDb = new Bun.SQL(POSTGRES_ADMIN_URL, { max: 1 });
let testDb: Bun.SQL;
let currentAdmin: AuthUser;
let currentUser: AuthUser;
let articleId = "";

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
  const [user] = await testDb<{ id: string }[]>`
    INSERT INTO users (username, password_hash, email, name, tags, role, blog_url)
    VALUES ('reader', ${await hashPassword("user-password")}, 'reader@example.com', '读者', ARRAY['小可爱'], 'user', 'https://example.com')
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
    username: "reader",
    email: "reader@example.com",
    name: "读者",
    role: "user",
    avatarUrl: null,
  };

  await testDb`
    INSERT INTO site_config (id, comments_enabled)
    VALUES (1, true)
    ON CONFLICT (id) DO UPDATE SET comments_enabled = EXCLUDED.comments_enabled
  `;

  const category = await createCategory(currentAdmin, { name: "评论测试" }, testDb);
  const article = await createArticle(
    currentAdmin,
    {
      title: "评论文章",
      contentMdx: "正文内容",
      status: "published",
      categoryIds: [category.id],
    },
    testDb
  );
  articleId = article.id;
});

afterAll(async () => {
  await testDb?.close({ timeout: 1 });
  await adminDb.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await adminDb.close({ timeout: 1 });
});

describe("comment services", () => {
  test("creates, replies, lists, updates, reviews, and deletes comments", async () => {
    const root = await createPublicComment(
      currentUser,
      articleId,
      { content: "第一条评论" },
      testDb
    );
    expect(root.status).toBe("approved");
    expect(root.author.tags).toEqual(["小可爱"]);

    const reply = await createPublicComment(
      currentUser,
      articleId,
      { content: "回复评论", parentId: root.id },
      testDb
    );
    expect(reply.parentId).toBe(root.id);

    const publicList = await listPublicComments(
      articleId,
      { page: "1", pageSize: "10" },
      testDb
    );
    expect(publicList.total).toBe(2);

    const updated = await updateMyComment(
      currentUser,
      root.id,
      { content: "更新后的评论" },
      testDb
    );
    expect(updated.content).toBe("更新后的评论");

    const rejected = await reviewComment(currentAdmin, root.id, "rejected", testDb);
    expect(rejected.status).toBe("rejected");

    const afterReview = await listPublicComments(
      articleId,
      { page: "1", pageSize: "10" },
      testDb
    );
    expect(afterReview.total).toBe(1);

    const adminList = await listAdminComments(
      currentAdmin,
      { status: "rejected", search: "更新", page: "1", pageSize: "10" },
      testDb
    );
    expect(adminList.total).toBe(1);

    await deleteMyComment(currentUser, reply.id, testDb);
    const afterUserDelete = await listPublicComments(
      articleId,
      { page: "1", pageSize: "10" },
      testDb
    );
    expect(afterUserDelete.total).toBe(0);

    await deleteCommentByAdmin(currentAdmin, root.id, testDb);
    const withDeleted = await listAdminComments(
      currentAdmin,
      { includeDeleted: "true", page: "1", pageSize: "10" },
      testDb
    );
    expect(withDeleted.total).toBe(2);
  });

  test("blocks comments when site comments are disabled", async () => {
    await testDb`UPDATE site_config SET comments_enabled = false WHERE id = 1`;

    await expect(
      createPublicComment(
        currentUser,
        articleId,
        { content: "不允许发表" },
        testDb
      )
    ).rejects.toThrow("评论系统已关闭");

    await testDb`UPDATE site_config SET comments_enabled = true WHERE id = 1`;
  });

  test("blocks demo moderation writes", async () => {
    const comment = await createPublicComment(
      currentUser,
      articleId,
      { content: "演示权限测试" },
      testDb
    );

    await expect(
      reviewComment({ ...currentAdmin, role: "demo" }, comment.id, "rejected", testDb)
    ).rejects.toThrow("演示账户仅允许读取");
  });
});
