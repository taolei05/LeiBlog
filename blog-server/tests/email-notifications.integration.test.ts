import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";

import postgres from "postgres";

const databaseUrl = Bun.env.AUTH_TEST_DATABASE_URL;
const suite = databaseUrl === undefined ? describe.skip : describe;

suite("email notifications with isolated PostgreSQL and captured mail delivery", () => {
  const sql = postgres(databaseUrl ?? "postgres://localhost/email_notifications_unused", {
    max: 10,
    transform: postgres.camel,
    onnotice: () => {},
  });
  const encryptionSecret = "synthetic-notification-test-key";
  const meta = { ip: null, userAgent: null, timeZone: null, timeZoneOffsetMinutes: null };
  let notifications: typeof import("../src/shared/email-notifications");
  let content: typeof import("../src/admin/content/service");
  let comments: typeof import("../src/blog/comments/service");
  let auth: typeof import("../src/blog/auth/service");
  let reviews: typeof import("../src/admin/comments/service");
  let encrypt: typeof import("../src/shared/security/encryption").encryptSecret;
  let originalFetch: typeof fetch;
  const delivered: Array<{
    key: string | null;
    body: { to: string[]; subject: string; html: string; text: string };
  }> = [];
  let rejectDelivery = false;

  type CreateUserParameters = {
    role?: "admin" | "user";
    locale?: "en" | "zh-CN";
    comment?: boolean;
    article?: boolean;
  };
  const createUser = async ({
    role = "user",
    locale = "zh-CN",
    comment = true,
    article = false,
  }: CreateUserParameters = {}) => {
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO users (id, role, username, email, password_hash, notification_email_locale, comment_email_notifications, new_post_email_notifications)
      VALUES (${id}, ${role}, ${id}, ${`${id}@example.test`}, 'synthetic-unused-password-hash', ${locale}, ${comment}, ${article})
    `;
    return auth.readBlogUserProfileById({ sql, userId: id });
  };
  const createArticle = async (
    authorId: string,
    status: "draft" | "published" | "scheduled" = "published",
    scheduledPublishAt?: string,
  ) => {
    return content.createArticle({
      authorId,
      input: {
        title: "中文文章",
        slug: crypto.randomUUID(),
        summary: "中文摘要",
        contentMdx: "Text",
        status,
        scheduledPublishAt,
        localizations: {
          en: { title: "English article", summary: "English summary", contentMdx: "English text" },
        },
      },
    });
  };
  type CreateCommentParameters = {
    user: Awaited<ReturnType<typeof createUser>>;
    parentId?: string;
    articleSlug?: string;
  };
  const createComment = ({ user, parentId, articleSlug }: CreateCommentParameters) => {
    const parameters = {
      user,
      meta,
      input: { content: "Reply <script>unsafe</script>", parentId },
    };
    return articleSlug === undefined
      ? comments.createPublicGuestbookComment(parameters)
      : comments.createPublicComment({ ...parameters, articleSlug });
  };
  const drain = async () => {
    for (let i = 0; i < 30; i += 1) {
      if (!(await notifications.processNextEmailNotification({ sql }))) return;
    }
    throw new Error("Unexpected notification loop");
  };

  beforeAll(async () => {
    const database = new URL(databaseUrl ?? "");
    if (
      !database.pathname.startsWith("/leiblog_test_") ||
      !["localhost", "127.0.0.1"].includes(database.hostname)
    ) {
      throw new Error("Email tests require a disposable local leiblog_test_ database.");
    }
    mock.module("../src/shared/db/postgres", () => ({ getSql: () => sql }));
    mock.module("../src/shared/env", () => ({
      env: {
        altchaSecret: encryptionSecret,
        configEncryptionSecret: encryptionSecret,
        jwtSecret: encryptionSecret,
        corsOrigins: ["https://blog.example.test"],
        sessionTtlSeconds: 600,
      },
    }));
    originalFetch = globalThis.fetch;
    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe("https://api.resend.com/emails");
        delivered.push({
          key: new Headers(init?.headers).get("idempotency-key"),
          body: JSON.parse(String(init?.body)),
        });
        if (rejectDelivery) return Response.json({ message: "synthetic outage" }, { status: 503 });
        return Response.json({ id: "synthetic-delivery-id" });
      },
      { preconnect: originalFetch.preconnect },
    );
    await sql.unsafe(
      await Bun.file(new URL("../src/shared/db/schema.sql", import.meta.url)).text(),
    );
    notifications = await import("../src/shared/email-notifications");
    content = await import("../src/admin/content/service");
    comments = await import("../src/blog/comments/service");
    auth = await import("../src/blog/auth/service");
    reviews = await import("../src/admin/comments/service");
    encrypt = (await import("../src/shared/security/encryption")).encryptSecret;
  });

  beforeEach(async () => {
    await sql`TRUNCATE users, articles, comments, site_settings, site_settings_en, encrypted_settings CASCADE`;
    await sql`INSERT INTO site_settings (id, site_name, resend_domain) VALUES (1, '中文站点', 'example.test')`;
    await sql`INSERT INTO site_settings_en (id, site_name) VALUES (1, 'English Blog')`;
    await sql`INSERT INTO encrypted_settings (key, encrypted_value) VALUES ('resend_api_key', ${encrypt({ value: "synthetic-resend-key", secret: encryptionSecret })})`;
    delivered.length = 0;
    rejectDelivery = false;
  });

  afterAll(async () => {
    if (originalFetch !== undefined) globalThis.fetch = originalFetch;
    await sql.end();
    mock.restore();
  });

  test("first publication sends bilingual notices only to subscribers, excluding the author", async () => {
    const author = await createUser({ article: true });
    const english = await createUser({ locale: "en", article: true });
    const chinese = await createUser({ article: true });
    await createUser({ article: false });
    const article = await createArticle(author.id);
    await drain();
    expect(delivered).toHaveLength(2);
    const en = delivered.find((mail) => mail.body.to.includes(english.email));
    const zh = delivered.find((mail) => mail.body.to.includes(chinese.email));
    expect(en?.body.subject).toContain("English article");
    expect(en?.body.html).toContain('<html lang="en">');
    expect(en?.body.html).toContain("English Blog");
    expect(en?.body.text).toContain("English summary");
    expect(zh?.body.subject).toContain("中文文章");
    expect(zh?.body.html).toContain('<html lang="zh-CN">');
    expect(en?.body.text).toContain(`/articles/${article.item.slug}`);
  });

  test("drafts, edits and republication do not repeat a new article notification", async () => {
    const author = await createUser();
    await createUser({ article: true });
    const article = await createArticle(author.id, "draft");
    await drain();
    expect(delivered).toHaveLength(0);
    await content.updateArticle({ articleId: article.item.id, input: { status: "published" } });
    await drain();
    await createUser({ article: true });
    for (const input of [
      { title: "Edited title" },
      { status: "draft" as const },
      { status: "published" as const },
    ]) {
      await content.updateArticle({ articleId: article.item.id, input });
    }
    await drain();
    expect(delivered).toHaveLength(1);
  });

  test("scheduled publication queues notices only when due, and is idempotent", async () => {
    const author = await createUser();
    await createUser({ article: true });
    const article = await createArticle(
      author.id,
      "scheduled",
      new Date(Date.now() + 60_000).toISOString(),
    );
    expect(await notifications.publishDueScheduledArticles(sql)).toBe(0);
    expect(await notifications.processNextEmailNotification({ sql })).toBe(false);
    await sql`UPDATE articles SET scheduled_publish_at = now() - interval '1 second' WHERE id = ${article.item.id}`;
    await notifications.publishDueScheduledArticles(sql);
    await notifications.publishDueScheduledArticles(sql);
    await drain();
    expect(delivered).toHaveLength(1);
    const [published] = await sql`SELECT status FROM articles WHERE id = ${article.item.id}`;
    expect(published.status).toBe("published");
  });

  test.each(["guestbook", "article"] as const)(
    "replies notify the parent and admins once in %s",
    async (target) => {
      const admin = await createUser({ role: "admin", locale: "en" });
      const parentAuthor = await createUser();
      const replier = await createUser();
      const articleSlug =
        target === "article" ? (await createArticle(admin.id)).item.slug : undefined;
      const parent = await createComment({ user: parentAuthor, articleSlug });
      await drain();
      delivered.length = 0;
      await createComment({ user: replier, parentId: parent.item.id, articleSlug });
      await drain();
      expect(delivered).toHaveLength(2);
      expect(
        delivered.find((mail) => mail.body.to.includes(parentAuthor.email))?.body.subject,
      ).toContain("评论回复通知");
      expect(delivered.find((mail) => mail.body.to.includes(admin.email))?.body.subject).toContain(
        "New comment",
      );
      expect(delivered.every((mail) => !mail.body.to.includes(replier.email))).toBe(true);
      expect(delivered.every((mail) => !mail.body.html.includes("<script>"))).toBe(true);
    },
  );

  test("an admin who is the parent gets one reply notice, and self-replies are silent", async () => {
    const admin = await createUser({ role: "admin" });
    const replier = await createUser();
    const parent = await createComment({ user: admin });
    await createComment({ user: replier, parentId: parent.item.id });
    await drain();
    expect(delivered).toHaveLength(1);
    expect(delivered[0]?.body.subject).toContain("评论回复通知");
    delivered.length = 0;
    await createComment({ user: admin, parentId: parent.item.id });
    await drain();
    expect(delivered).toHaveLength(0);
  });

  test("moderated comments notify only after approval and never on repeated reviews", async () => {
    await createUser({ role: "admin" });
    const user = await createUser();
    const [row] =
      await sql`INSERT INTO comments (target_type, user_id, content, status) VALUES ('guestbook', ${user.id}, 'Pending', 'pending') RETURNING id`;
    await notifications.queueCommentNotifications({ commentId: row.id, sql });
    await drain();
    expect(delivered).toHaveLength(0);
    await reviews.reviewComment({ commentId: row.id, nextStatus: "approved" });
    await reviews.reviewComment({ commentId: row.id, nextStatus: "approved" });
    await drain();
    expect(delivered).toHaveLength(1);
  });

  test("saved locale chooses the email language, and omitted preference flags stay subscribed", async () => {
    const author = await createUser();
    const reader = await createUser({ article: true });
    await auth.updateBlogUserProfile({
      userId: reader.id,
      username: reader.username,
      notificationEmailLocale: "en",
    });
    const [saved] =
      await sql`SELECT notification_email_locale, new_post_email_notifications FROM users WHERE id = ${reader.id}`;
    expect(saved.notificationEmailLocale).toBe("en");
    expect(saved.newPostEmailNotifications).toBe(true);
    await createArticle(author.id);
    await drain();
    expect(delivered[0]?.body.html).toContain('<html lang="en">');
  });

  test("unsubscribing before delivery skips queued notifications", async () => {
    const author = await createUser();
    const reader = await createUser({ article: true });
    await createArticle(author.id);
    await auth.updateBlogUserProfile({
      userId: reader.id,
      username: reader.username,
      newPostEmailNotifications: false,
    });
    await drain();
    expect(delivered).toHaveLength(0);
    const [job] = await sql`SELECT status FROM email_notification_jobs`;
    expect(job.status).toBe("skipped");
  });

  test("delivery retries use the same frozen message and provider idempotency key", async () => {
    const author = await createUser();
    await createUser({ article: true });
    const article = await createArticle(author.id);
    rejectDelivery = true;
    await drain();
    const [pending] = await sql`SELECT status, attempts FROM email_notification_jobs`;
    expect(pending.status).toBe("pending");
    expect(pending.attempts).toBe(1);
    await content.updateArticle({
      articleId: article.item.id,
      input: { title: "Changed after attempt" },
    });
    await sql`UPDATE site_settings SET resend_domain = 'new.example.test' WHERE id = 1`;
    await sql`UPDATE email_notification_jobs SET available_at = now()`;
    rejectDelivery = false;
    await drain();
    expect(delivered).toHaveLength(2);
    expect(delivered[0]).toEqual(delivered[1]);
    const [sent] = await sql`SELECT status, attempts FROM email_notification_jobs`;
    expect(sent.status).toBe("sent");
    expect(sent.attempts).toBe(2);
  });

  test("concurrent workers claim a job only once", async () => {
    const author = await createUser();
    await createUser({ article: true });
    await createArticle(author.id);
    await Promise.all(
      Array.from({ length: 5 }, () => notifications.processNextEmailNotification({ sql })),
    );
    expect(delivered).toHaveLength(1);
  });

  test("missing configuration keeps jobs pending without making an external call", async () => {
    const author = await createUser();
    await createUser({ article: true });
    await createArticle(author.id);
    await sql`DELETE FROM encrypted_settings WHERE key = 'resend_api_key'`;
    await drain();
    expect(delivered).toHaveLength(0);
    const [pending] = await sql`SELECT status, attempts, message FROM email_notification_jobs`;
    expect(pending.status).toBe("pending");
    expect(pending.attempts).toBe(0);
    expect(pending.message).toBeNull();
  });

  test("expired retries stop before the provider's idempotency window elapses", async () => {
    const author = await createUser();
    await createUser({ article: true });
    await createArticle(author.id);
    await sql`UPDATE email_notification_jobs SET first_attempt_at = now() - interval '24 hours'`;
    await drain();
    expect(delivered).toHaveLength(0);
    const [job] = await sql`SELECT status FROM email_notification_jobs`;
    expect(job.status).toBe("failed");
  });

  test("deleted comments and unpublished articles are not delivered", async () => {
    await createUser({ role: "admin", article: true });
    const author = await createUser();
    const article = await createArticle(author.id);
    const comment = await createComment({ user: author });
    await content.updateArticle({ articleId: article.item.id, input: { status: "draft" } });
    await reviews.deleteCommentByAdmin({ commentId: comment.item.id });
    await drain();
    expect(delivered).toHaveLength(0);
    const rows = await sql`SELECT status FROM email_notification_jobs`;
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.status === "skipped")).toBe(true);
  });

  test("changing the recipient email cancels an old frozen retry", async () => {
    const author = await createUser();
    const reader = await createUser({ article: true });
    await createArticle(author.id);
    rejectDelivery = true;
    await drain();
    await sql`UPDATE users SET email = 'new-recipient@example.test' WHERE id = ${reader.id}`;
    await sql`UPDATE email_notification_jobs SET available_at = now()`;
    rejectDelivery = false;
    await drain();
    expect(delivered).toHaveLength(1);
    const [job] = await sql`SELECT status FROM email_notification_jobs`;
    expect(job.status).toBe("skipped");
  });

  test("content rollback also rolls back its notification jobs", async () => {
    await createUser({ article: true });
    await expect(
      sql.begin(async (transaction) => {
        const [article] =
          await transaction`INSERT INTO articles (title, slug, status) VALUES ('Rolled back', 'rollback', 'published') RETURNING id`;
        await notifications.queueArticleNotifications({ articleId: article.id, sql: transaction });
        throw new Error("Synthetic rollback");
      }),
    ).rejects.toThrow("Synthetic rollback");
    expect(await sql`SELECT id FROM articles`).toHaveLength(0);
    expect(await sql`SELECT id FROM email_notification_jobs`).toHaveLength(0);
  });

  test("schema upgrades mark historical public content without sending a notification blast", async () => {
    const reader = await createUser({ role: "admin", article: true });
    await sql`INSERT INTO articles (title, slug, status) VALUES ('Historical', 'historical', 'published')`;
    await sql`INSERT INTO comments (target_type, user_id, content) VALUES ('guestbook', ${reader.id}, 'Historical comment')`;
    await sql`ALTER TABLE articles DROP COLUMN notification_enqueued_at`;
    await sql`ALTER TABLE comments DROP COLUMN notification_enqueued_at`;
    await sql.unsafe(
      await Bun.file(new URL("../src/shared/db/schema.sql", import.meta.url)).text(),
    );
    const [article] = await sql`SELECT notification_enqueued_at FROM articles`;
    const [comment] = await sql`SELECT notification_enqueued_at FROM comments`;
    expect(article.notificationEnqueuedAt).not.toBeNull();
    expect(comment.notificationEnqueuedAt).not.toBeNull();
    await notifications.publishDueScheduledArticles(sql);
    await drain();
    expect(delivered).toHaveLength(0);
  });
});
