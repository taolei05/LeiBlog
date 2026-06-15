import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";

import { renderCommentNotificationEmailHtml, resolveEmailBranding } from "../src/auth/service";
import { createArticle, createCategory } from "../src/admin/content/service";
import {
  mergeCommentNotificationRecipients,
  resolveCommentNotifications,
  scheduleCommentEmailNotifications,
  sendCommentEmailNotifications,
} from "../src/public/comments/notification";
import { encryptSecret } from "../src/shared/crypto";
import type { AuthUser } from "../src/shared/auth";
import type { TestDatabase } from "./helpers/database";
import { createMigratedTestDatabase } from "./helpers/database";

let testDatabase: TestDatabase;
let testDb: Bun.SQL;
let currentAdmin: AuthUser;
let articleId = "";
let otherArticleId = "";

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
      username, password_hash, email, name, role, comment_email_notifications_enabled
    )
    VALUES (${username}, 'password-hash', ${email ?? null}, ${name ?? null}, ${role}, ${enabled})
    RETURNING id
  `;

  return user.id;
}

type CreateCommentParameters = {
  article?: string | null;
  content: string;
  parentId?: string | null;
  targetType?: "article" | "guestbook";
  userId: string;
};

async function createComment({
  article = articleId,
  content,
  parentId = null,
  targetType = "article",
  userId,
}: CreateCommentParameters) {
  const [comment] = await testDb<{ id: string }[]>`
    INSERT INTO comments (target_type, article_id, user_id, parent_id, content)
    VALUES (${targetType}, ${article}, ${userId}, ${parentId}, ${content})
    RETURNING id
  `;

  return comment.id;
}

beforeAll(async () => {
  testDatabase = await createMigratedTestDatabase("lei_blog_comment_notifications_test");
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
    INSERT INTO site_config (id, comments_enabled)
    VALUES (1, true)
    ON CONFLICT (id) DO UPDATE SET comments_enabled = EXCLUDED.comments_enabled
  `;

  const category = await createCategory(currentAdmin, { name: "评论通知" }, testDb);
  const article = await createArticle(
    currentAdmin,
    {
      categoryIds: [category.id],
      contentMdx: "评论通知正文",
      slug: "comment-notification-article",
      status: "published",
      title: "评论通知文章",
    },
    testDb
  );
  articleId = article.id;
  const otherArticle = await createArticle(
    currentAdmin,
    {
      categoryIds: [category.id],
      contentMdx: "另一篇评论通知正文",
      slug: "other-comment-notification-article",
      status: "published",
      title: "另一篇评论通知文章",
    },
    testDb
  );
  otherArticleId = otherArticle.id;
});

beforeEach(async () => {
  await testDb`DELETE FROM comments`;
  await testDb`DELETE FROM users WHERE id <> ${currentAdmin.id}`;
  await testDb`
    UPDATE site_config
    SET comments_enabled = true,
        resend_domain = null,
        resend_api_key_encrypted = null
    WHERE id = 1
  `;
});

afterAll(async () => {
  await testDb?.close({ timeout: 1 });
  await testDatabase?.drop();
});

describe("comment notification emails", () => {
  test("renders comment notification content inside the LeiBlog email shell", () => {
    const html = renderCommentNotificationEmailHtml({
      content: '<script>alert("x")</script>\n第二行 & Tom\'s reply',
      description: '张三在《测试文章》文章评论了： <script>alert("desc")</script> & Tom\'s note',
      title: "新评论通知",
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("LeiBlog");
    expect(html).toContain("张三在《测试文章》文章评论了：");
    expect(html).toContain(
      "张三在《测试文章》文章评论了： &lt;script&gt;alert(&quot;desc&quot;)&lt;/script&gt; &amp; Tom&#39;s note"
    );
    expect(html).not.toContain('<script>alert("desc")</script>');
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain("第二行 &amp; Tom&#39;s reply");
    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain("white-space:pre-wrap");
    expect(html).toContain("word-break:break-word");
  });

  test("uses the configured site logo by Shanghai day and night, and falls back to the site initial", () => {
    const dayBranding = resolveEmailBranding(
      {
        logoDarkUrl: "/uploads/site/logo-dark.png",
        logoLightUrl: "/uploads/site/logo-light.png",
        siteName: "Trace Blog",
      },
      new Date("2026-06-15T04:00:00.000Z")
    );
    const nightBranding = resolveEmailBranding(
      {
        logoDarkUrl: "/uploads/site/logo-dark.png",
        logoLightUrl: "/uploads/site/logo-light.png",
        siteName: "Trace Blog",
      },
      new Date("2026-06-15T14:00:00.000Z")
    );
    const fallbackBranding = resolveEmailBranding({ siteName: "Trace Blog" });

    const dayHtml = renderCommentNotificationEmailHtml({
      branding: dayBranding,
      content: "白天测试",
      description: "白天说明",
      title: "白天标题",
    });
    const nightHtml = renderCommentNotificationEmailHtml({
      branding: nightBranding,
      content: "夜间测试",
      description: "夜间说明",
      title: "夜间标题",
    });
    const fallbackHtml = renderCommentNotificationEmailHtml({
      branding: fallbackBranding,
      content: "托底测试",
      description: "托底说明",
      title: "托底标题",
    });

    expect(dayHtml).toContain('src="http://localhost:3000/uploads/site/logo-light.png"');
    expect(nightHtml).toContain('src="http://localhost:3000/uploads/site/logo-dark.png"');
    expect(fallbackHtml).toContain(">T</div>");
    expect(fallbackHtml).toContain("Trace Blog");
  });

  test("resolves enabled admins with valid deduplicated email addresses", async () => {
    const authorId = await createUser({
      email: "author@example.com",
      name: "张三",
      username: "comment-author",
    });
    await createUser({
      email: " Admin@Example.COM ",
      name: "管理员 A",
      role: "admin",
      username: "admin-a",
    });
    await createUser({
      email: "admin@example.com ",
      name: "管理员 B",
      role: "admin",
      username: "admin-b",
    });
    await createUser({
      email: "disabled@example.com",
      enabled: false,
      role: "admin",
      username: "disabled-admin",
    });
    await createUser({
      email: "invalid email@example.com",
      role: "admin",
      username: "invalid-admin",
    });
    await createUser({
      email: null,
      role: "admin",
      username: "empty-admin",
    });
    const commentId = await createComment({
      content: "管理员筛选评论",
      userId: authorId,
    });

    const notifications = await resolveCommentNotifications(commentId, testDb);
    const adminNotifications = notifications.filter((notification) => notification.kind === "admin");

    expect(adminNotifications.map((notification) => notification.to)).toEqual(["admin@example.com"]);
    expect(adminNotifications[0]?.description).toBe("张三在《评论通知文章》文章评论了：");
    expect(adminNotifications[0]?.subject).toContain("新评论通知");
    expect(adminNotifications[0]?.subject).toContain("评论通知文章");
  });

  test("resolves only the direct parent author for reply notifications", async () => {
    const parentAuthorId = await createUser({
      email: "parent@example.com",
      name: "李四",
      username: "parent-author",
    });
    const otherParticipantId = await createUser({
      email: "other@example.com",
      name: "王五",
      username: "other-participant",
    });
    const replyAuthorId = await createUser({
      email: "reply-author@example.com",
      name: "赵六",
      username: "reply-author",
    });
    const parentId = await createComment({
      content: "父评论",
      userId: parentAuthorId,
    });
    await createComment({
      content: "无关参与者回复",
      parentId,
      userId: otherParticipantId,
    });
    const replyId = await createComment({
      content: "直接回复父评论",
      parentId,
      userId: replyAuthorId,
    });

    const notifications = await resolveCommentNotifications(replyId, testDb);
    const replyNotifications = notifications.filter((notification) => notification.kind === "reply");

    expect(replyNotifications.map((notification) => notification.to)).toEqual(["parent@example.com"]);
    expect(replyNotifications[0]?.description).toBe("赵六在《评论通知文章》文章中回复了你的评论：");
    expect(replyNotifications[0]?.subject).toContain("评论回复通知");
    expect(replyNotifications[0]?.subject).toContain("评论通知文章");
    expect(notifications.some((notification) => notification.to === "other@example.com")).toBe(false);
  });

  test("does not notify parent authors from another target or article", async () => {
    const guestbookParentAuthorId = await createUser({
      email: "guestbook-parent@example.com",
      name: "留言板父作者",
      username: "guestbook-parent-author",
    });
    const otherArticleParentAuthorId = await createUser({
      email: "other-article-parent@example.com",
      name: "其他文章父作者",
      username: "other-article-parent-author",
    });
    const replyAuthorId = await createUser({
      email: "dirty-reply-author@example.com",
      name: "脏数据回复者",
      username: "dirty-reply-author",
    });
    const guestbookParentId = await createComment({
      article: null,
      content: "留言板父评论",
      targetType: "guestbook",
      userId: guestbookParentAuthorId,
    });
    const otherArticleParentId = await createComment({
      article: otherArticleId,
      content: "另一篇文章父评论",
      userId: otherArticleParentAuthorId,
    });
    const guestbookParentReplyId = await createComment({
      content: "文章回复错误指向留言板父评论",
      parentId: guestbookParentId,
      userId: replyAuthorId,
    });
    const otherArticleParentReplyId = await createComment({
      content: "文章回复错误指向另一篇文章父评论",
      parentId: otherArticleParentId,
      userId: replyAuthorId,
    });

    const guestbookParentNotifications = await resolveCommentNotifications(
      guestbookParentReplyId,
      testDb
    );
    const otherArticleParentNotifications = await resolveCommentNotifications(
      otherArticleParentReplyId,
      testDb
    );

    expect(
      guestbookParentNotifications.some(
        (notification) => notification.to === "guestbook-parent@example.com"
      )
    ).toBe(false);
    expect(
      otherArticleParentNotifications.some(
        (notification) => notification.to === "other-article-parent@example.com"
      )
    ).toBe(false);
    expect(guestbookParentNotifications.some((notification) => notification.kind === "admin")).toBe(
      true
    );
    expect(otherArticleParentNotifications.some((notification) => notification.kind === "admin")).toBe(
      true
    );
  });

  test("does not send reply notifications for self replies or disabled parent authors", async () => {
    const disabledParentId = await createUser({
      email: "disabled-parent@example.com",
      enabled: false,
      name: "禁用用户",
      username: "disabled-parent",
    });
    const selfParentId = await createUser({
      email: "self-parent@example.com",
      name: "自回用户",
      username: "self-parent",
    });
    const disabledParentCommentId = await createComment({
      content: "禁用父评论",
      userId: disabledParentId,
    });
    const disabledReplyId = await createComment({
      content: "回复禁用父评论",
      parentId: disabledParentCommentId,
      userId: selfParentId,
    });
    const selfParentCommentId = await createComment({
      content: "自回父评论",
      userId: selfParentId,
    });
    const selfReplyId = await createComment({
      content: "自我回复",
      parentId: selfParentCommentId,
      userId: selfParentId,
    });

    const disabledReplyNotifications = await resolveCommentNotifications(disabledReplyId, testDb);
    const selfReplyNotifications = await resolveCommentNotifications(selfReplyId, testDb);

    expect(disabledReplyNotifications.some((notification) => notification.kind === "reply")).toBe(false);
    expect(selfReplyNotifications.some((notification) => notification.kind === "reply")).toBe(false);
  });

  test("keeps the admin notification when an admin is also the replied parent author", async () => {
    const adminParentId = await createUser({
      email: "reply-admin@example.com",
      name: "回复管理员",
      role: "admin",
      username: "reply-admin",
    });
    const replyAuthorId = await createUser({
      email: "admin-reply-author@example.com",
      name: "回复者",
      username: "admin-reply-author",
    });
    const parentId = await createComment({
      content: "管理员父评论",
      userId: adminParentId,
    });
    const replyId = await createComment({
      content: "回复管理员",
      parentId,
      userId: replyAuthorId,
    });

    const merged = mergeCommentNotificationRecipients(
      await resolveCommentNotifications(replyId, testDb)
    );
    const adminParentNotifications = merged.filter(
      (notification) => notification.to === "reply-admin@example.com"
    );

    expect(adminParentNotifications).toHaveLength(1);
    expect(adminParentNotifications[0]?.kind).toBe("admin");
    expect(adminParentNotifications[0]?.description).toBe(
      "回复者在《评论通知文章》文章回复了评论："
    );
  });

  test("resolves guestbook copy and falls back to username when name is blank", async () => {
    const parentAuthorId = await createUser({
      email: "guest-parent@example.com",
      name: "留言父作者",
      username: "guest-parent",
    });
    const replyAuthorId = await createUser({
      email: "guest-reply@example.com",
      name: "   ",
      username: "guest-reply",
    });
    const guestbookCommentId = await createComment({
      article: null,
      content: "留言板评论",
      targetType: "guestbook",
      userId: replyAuthorId,
    });
    const parentId = await createComment({
      article: null,
      content: "留言板父评论",
      targetType: "guestbook",
      userId: parentAuthorId,
    });
    const replyId = await createComment({
      article: null,
      content: "留言板回复",
      parentId,
      targetType: "guestbook",
      userId: replyAuthorId,
    });

    const guestbookNotifications = await resolveCommentNotifications(guestbookCommentId, testDb);
    const replyNotifications = await resolveCommentNotifications(replyId, testDb);

    expect(guestbookNotifications[0]?.description).toBe("guest-reply在留言板评论了：");
    expect(guestbookNotifications[0]?.subject).toContain("新评论通知");
    expect(guestbookNotifications[0]?.subject).toContain("留言板");
    expect(replyNotifications.find((notification) => notification.kind === "admin")?.description).toBe(
      "guest-reply在留言板回复了评论："
    );
    expect(replyNotifications.find((notification) => notification.kind === "admin")?.subject).toContain(
      "留言板"
    );
    expect(replyNotifications.find((notification) => notification.kind === "reply")?.description).toBe(
      "guest-reply在留言板中回复了你的评论："
    );
    expect(replyNotifications.find((notification) => notification.kind === "reply")?.subject).toContain(
      "留言板"
    );
  });

  test("merge helper defensively deduplicates normalized recipient emails", () => {
    const merged = mergeCommentNotificationRecipients([
      {
        content: "第一封",
        description: "管理员通知",
        kind: "admin",
        subject: "新评论通知",
        to: " User@Example.COM ",
      },
      {
        content: "第二封",
        description: "回复通知",
        kind: "reply",
        subject: "评论回复通知",
        to: "user@example.com",
      },
      {
        content: "无效邮箱",
        description: "无效",
        kind: "admin",
        subject: "新评论通知",
        to: "invalid email@example.com",
      },
    ]);

    expect(merged).toEqual([
      {
        content: "第一封",
        description: "管理员通知",
        kind: "admin",
        subject: "新评论通知",
        to: "user@example.com",
      },
    ]);
  });

  test("send isolates single-recipient failures and still attempts the remaining recipients", async () => {
    const authorId = await createUser({
      email: "send-author@example.com",
      name: "发送作者",
      username: "send-author",
    });
    await createUser({
      email: "send-admin-a@example.com",
      role: "admin",
      username: "send-admin-a",
    });
    await createUser({
      email: "send-admin-b@example.com",
      role: "admin",
      username: "send-admin-b",
    });
    const commentId = await createComment({
      content: "发送失败隔离",
      userId: authorId,
    });
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
      await sendCommentEmailNotifications(commentId, testDb);
    } finally {
      globalThis.fetch = originalFetch;
      emailErrorSpy.mockRestore();
    }

    expect(fetchCalls).toContain("send-admin-a@example.com");
    expect(fetchCalls).toContain("send-admin-b@example.com");
    expect(fetchCalls.length).toBeGreaterThanOrEqual(2);
    const firstError = errorLogs[0]?.[0] as
      | {
          commentId?: string;
          error?: unknown;
          kind?: string;
          subject?: string;
          to?: string;
        }
      | undefined;

    expect(firstError?.commentId).toBe(commentId);
    expect(firstError?.to).toBe(fetchCalls[0]);
    expect(firstError?.kind).toBe("admin");
    expect(firstError?.subject).toContain("新评论通知");
    expect(firstError?.error).toBeInstanceOf(Error);
  });

  test("send returns false without Resend config and schedule never throws", async () => {
    const authorId = await createUser({
      email: "no-config-author@example.com",
      name: "无配置作者",
      username: "no-config-author",
    });
    const commentId = await createComment({
      content: "缺少 Resend 配置",
      userId: authorId,
    });

    await testDb`
      UPDATE site_config
      SET resend_domain = null,
          resend_api_key_encrypted = null
      WHERE id = 1
    `;

    await expect(sendCommentEmailNotifications(commentId, testDb)).resolves.toBe(false);
    expect(() => scheduleCommentEmailNotifications(commentId, testDb)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 25));
  });

  test("schedule logs comment context when the async notification task fails", async () => {
    const commentId = "00000000-0000-0000-0000-000000000001";
    const expectedError = new Error("scheduled failure");
    const errorLogs: unknown[][] = [];
    const emailErrorSpy = spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errorLogs.push(args);
    });
    const failingClient = (async () => {
      throw expectedError;
    }) as unknown as Bun.SQL;

    try {
      expect(() => scheduleCommentEmailNotifications(commentId, failingClient)).not.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 25));
    } finally {
      emailErrorSpy.mockRestore();
    }

    const firstError = errorLogs[0]?.[0] as
      | {
          commentId?: string;
          error?: unknown;
        }
      | undefined;
    expect(firstError?.commentId).toBe(commentId);
    expect(firstError?.error).toBe(expectedError);
  });
});
