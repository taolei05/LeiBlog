import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";

import {
  createArticle,
  createCategory,
  publishDueScheduledArticles,
} from "../src/admin/content/service";
import { renderArticleNotificationEmailHtml } from "../src/auth/service";
import {
  mergeArticleNotificationRecipients,
  resolveArticleNotifications,
  sendArticleEmailNotifications,
} from "../src/public/articles/notification";
import type { AuthUser } from "../src/shared/auth";
import { encryptSecret } from "../src/shared/crypto";
import type { TestDatabase } from "./helpers/database";
import { createMigratedTestDatabase } from "./helpers/database";

let testDatabase: TestDatabase;
let testDb: Bun.SQL;
let currentAdmin: AuthUser;
let categoryId = "";

type CreateUserParameters = {
  email?: string | null;
  enabled?: boolean;
  name?: string | null;
  role?: "admin" | "user";
  username: string;
};

async function createUser({
  email,
  enabled = true,
  name,
  role = "user",
  username,
}: CreateUserParameters) {
  const [user] = await testDb<{ id: string }[]>`
    INSERT INTO users (
      username, password_hash, email, name, role, new_article_email_notifications_enabled
    )
    VALUES (${username}, 'password-hash', ${email ?? null}, ${name ?? null}, ${role}, ${enabled})
    RETURNING id
  `;

  return user.id;
}

beforeAll(async () => {
  testDatabase = await createMigratedTestDatabase("lei_blog_article_notifications_test");
  testDb = new Bun.SQL(testDatabase.databaseUrl, { max: 1 });

  const adminId = await createUser({
    email: "admin@example.com",
    role: "admin",
    username: "admin",
  });
  currentAdmin = {
    avatarUrl: null,
    email: "admin@example.com",
    id: adminId,
    name: null,
    role: "admin",
    username: "admin",
  };

  await testDb`
    INSERT INTO site_config (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING
  `;

  const category = await createCategory(currentAdmin, { name: "文章通知" }, testDb);
  categoryId = category.id;
});

beforeEach(async () => {
  await testDb`DELETE FROM article_contributor_links`;
  await testDb`DELETE FROM article_tag_links`;
  await testDb`DELETE FROM article_category_links`;
  await testDb`DELETE FROM article_revisions`;
  await testDb`DELETE FROM articles`;
  await testDb`DELETE FROM users WHERE id <> ${currentAdmin.id}`;
  await testDb`
    UPDATE site_config
    SET resend_domain = null,
        resend_api_key_encrypted = null
    WHERE id = 1
  `;
});

afterAll(async () => {
  await testDb?.close({ timeout: 1 });
  await testDatabase?.drop();
});

describe("article notification emails", () => {
  test("renders article notification content inside the LeiBlog email shell", () => {
    const html = renderArticleNotificationEmailHtml({
      articleUrl: "https://example.com/articles/new-post",
      description: '《新文章》已经发布： <script>alert("desc")</script>',
      summary: '<script>alert("summary")</script>\n第二行 & Tom\'s note',
      title: "新文章发布",
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("LeiBlog");
    expect(html).toContain("https://example.com/articles/new-post");
    expect(html).toContain("&lt;script&gt;alert(&quot;desc&quot;)&lt;/script&gt;");
    expect(html).toContain("&lt;script&gt;alert(&quot;summary&quot;)&lt;/script&gt;");
    expect(html).toContain("第二行 &amp; Tom&#39;s note");
    expect(html).not.toContain('<script>alert("desc")</script>');
    expect(html).not.toContain('<script>alert("summary")</script>');
  });

  test("resolves enabled recipients with valid deduplicated email addresses", async () => {
    await createUser({ email: " Reader@Example.COM ", username: "reader-a" });
    await createUser({ email: "reader@example.com", username: "reader-b" });
    await createUser({
      email: "editor@example.com",
      role: "admin",
      username: "editor",
    });
    await createUser({
      email: "disabled@example.com",
      enabled: false,
      username: "disabled-reader",
    });
    await createUser({ email: "invalid email@example.com", username: "invalid-reader" });
    await createUser({ email: null, username: "empty-reader" });
    const article = await createArticle(
      currentAdmin,
      {
        categoryIds: [categoryId],
        contentMdx: "新文章通知正文",
        slug: "article-notification-post",
        status: "published",
        summary: "新文章摘要",
        title: "新文章通知",
      },
      testDb
    );

    const notifications = await resolveArticleNotifications(article.id, testDb);

    expect(notifications.map((notification) => notification.to)).toEqual([
      "reader@example.com",
      "editor@example.com",
    ]);
    expect(notifications[0]?.subject).toBe("新文章发布：新文章通知");
    expect(notifications[0]?.description).toBe("《新文章通知》已经发布：");
    expect(notifications[0]?.summary).toBe("新文章摘要");
  });

  test("merge helper defensively deduplicates normalized recipient emails", () => {
    const merged = mergeArticleNotificationRecipients([
      {
        articleUrl: "https://example.com/a",
        description: "第一封",
        subject: "新文章发布",
        summary: "第一篇",
        to: " User@Example.COM ",
      },
      {
        articleUrl: "https://example.com/b",
        description: "第二封",
        subject: "新文章发布",
        summary: "第二篇",
        to: "user@example.com",
      },
      {
        articleUrl: "https://example.com/c",
        description: "无效邮箱",
        subject: "新文章发布",
        summary: "无效",
        to: "invalid email@example.com",
      },
    ]);

    expect(merged).toEqual([
      {
        articleUrl: "https://example.com/a",
        description: "第一封",
        subject: "新文章发布",
        summary: "第一篇",
        to: "user@example.com",
      },
    ]);
  });

  test("send isolates single-recipient failures and still attempts the remaining recipients", async () => {
    await createUser({ email: "send-reader-a@example.com", username: "send-reader-a" });
    await createUser({ email: "send-reader-b@example.com", username: "send-reader-b" });
    const article = await createArticle(
      currentAdmin,
      {
        categoryIds: [categoryId],
        contentMdx: "发送新文章通知正文",
        slug: "send-article-notification",
        status: "published",
        title: "发送新文章通知",
      },
      testDb
    );
    const originalFetch = globalThis.fetch;
    const fetchCalls: string[] = [];
    const errorLogs: unknown[][] = [];
    const emailErrorSpy = spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errorLogs.push(args);
    });

    await testDb`
      UPDATE site_config
      SET resend_domain = 'mail.example.com',
          resend_api_key_encrypted = ${JSON.stringify(encryptSecret("resend-secret"))}::jsonb
      WHERE id = 1
    `;
    await testDb`
      INSERT INTO site_info (id, site_name, description, established_at, logo_light_url)
      VALUES (1, 'Moon Blog', '', now(), '/uploads/site/mail-logo.png')
      ON CONFLICT (id) DO UPDATE
      SET site_name = EXCLUDED.site_name,
          description = EXCLUDED.description,
          established_at = EXCLUDED.established_at,
          logo_light_url = EXCLUDED.logo_light_url
    `;

    globalThis.fetch = Object.assign(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { from: string; html: string; to: string[] };
        fetchCalls.push(body.to[0] ?? "");
        expect(body.from).toBe("Moon Blog <no-reply@mail.example.com>");
        expect(body.html).toContain("Moon Blog");
        expect(body.html).toContain("http://localhost:3000/uploads/site/mail-logo.png");

        return new Response("{}", {
          status: fetchCalls.length === 1 ? 500 : 200,
        });
      },
      originalFetch
    );

    try {
      await sendArticleEmailNotifications(article.id, testDb);
    } finally {
      globalThis.fetch = originalFetch;
      emailErrorSpy.mockRestore();
    }

    expect(fetchCalls).toContain("send-reader-a@example.com");
    expect(fetchCalls).toContain("send-reader-b@example.com");
    expect(fetchCalls.length).toBeGreaterThanOrEqual(2);
    const firstError = errorLogs[0]?.[0] as
      | {
          articleId?: string;
          error?: unknown;
          subject?: string;
          to?: string;
        }
      | undefined;

    expect(firstError?.articleId).toBe(article.id);
    expect(firstError?.to).toBe(fetchCalls[0]);
    expect(firstError?.subject).toContain("新文章发布");
    expect(firstError?.error).toBeInstanceOf(Error);
  });

  test("scheduled publisher sends new article notifications when due articles publish", async () => {
    await createUser({ email: "scheduled-reader@example.com", username: "scheduled-reader" });
    await testDb`
      UPDATE site_config
      SET resend_domain = 'mail.example.com',
          resend_api_key_encrypted = ${JSON.stringify(encryptSecret("resend-secret"))}::jsonb
      WHERE id = 1
    `;
    const scheduledArticle = await createArticle(
      currentAdmin,
      {
        contentMdx: "定时通知正文",
        scheduledPublishAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        status: "published",
        title: "定时通知文章",
      },
      testDb
    );
    const originalFetch = globalThis.fetch;
    const fetchCalls: string[] = [];

    await testDb`
      UPDATE articles
      SET scheduled_publish_at = now() - interval '1 minute'
      WHERE id = ${scheduledArticle.id}
    `;
    globalThis.fetch = Object.assign(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { subject: string; to: string[] };
        fetchCalls.push(body.to[0] ?? "");
        expect(body.subject).toBe("新文章发布：定时通知文章");

        return new Response("{}", { status: 200 });
      },
      originalFetch
    );

    try {
      const result = await publishDueScheduledArticles(testDb);
      expect(result.publishedCount).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(fetchCalls).toEqual(["scheduled-reader@example.com"]);
  });
});
