import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { createHash } from "node:crypto";

import type { Elysia } from "elysia";
import postgres from "postgres";
import type { BlogUserProfile } from "../src/blog/auth/service";

const databaseUrl = Bun.env.AUTH_TEST_DATABASE_URL;
const suite = databaseUrl === undefined ? describe.skip : describe;

suite("comment entry settings with isolated PostgreSQL", () => {
  const sql = postgres(databaseUrl ?? "postgres://localhost/comment_settings_unused", {
    max: 5,
    transform: postgres.camel,
    onnotice: () => {},
  });
  let settings: typeof import("../src/admin/settings/service");
  let comments: typeof import("../src/blog/comments/service");
  let routes: Pick<Elysia, "handle">;
  let user: BlogUserProfile;
  let cookie: string;
  let originalFetch: typeof fetch;
  const slug = "comment-switch-test";
  const meta = { ip: null, userAgent: null, timeZone: null, timeZoneOffsetMinutes: null };

  const saveSwitch = async (commentsEnabled: boolean) => {
    const current = await settings.getSiteSettings();
    const result = await settings.updateSiteSettings({
      ...current,
      site: { ...current.site, foundedAt: "2026-01-01 00:00" },
      basics: {
        ...current.basics,
        commentsEnabled,
        resendApiKey: "",
        deeplApiKey: "",
        ipGeolocationApiKey: "",
      },
      storage: { ...current.storage, r2SecretAccessKey: "" },
    });
    expect(result.ok).toBe(true);
    expect((await settings.getSiteSettings()).basics.commentsEnabled).toBe(commentsEnabled);
  };

  const createComment = (target: "article" | "guestbook", parentId?: string) => {
    const parameters = { input: { content: "Test comment", parentId }, meta, user };
    return target === "article"
      ? comments.createPublicComment({ ...parameters, articleSlug: slug })
      : comments.createPublicGuestbookComment(parameters);
  };

  beforeAll(async () => {
    const database = new URL(databaseUrl ?? "");
    if (
      !database.pathname.startsWith("/leiblog_test_") ||
      !["localhost", "127.0.0.1"].includes(database.hostname)
    ) {
      throw new Error("Comment tests require a disposable local leiblog_test_ database.");
    }
    mock.module("../src/shared/db/postgres", () => ({ getSql: () => sql }));
    mock.module("../src/shared/env", () => ({
      env: {
        altchaSecret: "synthetic-comment-test-key",
        configEncryptionSecret: "synthetic-comment-test-key",
        jwtSecret: "synthetic-comment-test-key",
        corsOrigins: ["https://blog.example.test"],
        sessionTtlSeconds: 600,
      },
    }));
    originalFetch = globalThis.fetch;
    globalThis.fetch = Object.assign(
      async () => {
        throw new Error("External requests disabled in comment tests");
      },
      { preconnect: originalFetch.preconnect },
    );
    await sql.unsafe(
      await Bun.file(new URL("../src/shared/db/schema.sql", import.meta.url)).text(),
    );
    settings = await import("../src/admin/settings/service");
    comments = await import("../src/blog/comments/service");
    routes = (await import("../src/blog/routes")).blogRoutes;
  });

  beforeEach(async () => {
    await sql`TRUNCATE users, articles, comments, site_settings, site_settings_en, encrypted_settings, filing_records CASCADE`;
    await saveSwitch(true);
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO users (id, username, email, password_hash)
      VALUES (${id}, ${id}, ${`${id}@example.test`}, ${await Bun.password.hash("test-password")})
    `;
    const auth = await import("../src/blog/auth/service");
    user = await auth.readBlogUserProfileById({ sql, userId: id });
    const sessionId = crypto.randomUUID();
    const secret = "synthetic-comment-session-secret";
    const tokenHash = createHash("sha256").update(secret).digest("hex");
    await sql`
      INSERT INTO auth_sessions (user_id, session_id, token_hash, expires_at)
      VALUES (${id}, ${sessionId}, ${tokenHash}, ${new Date(Date.now() + 600_000)})
    `;
    cookie = `leiblog_blog_session=${sessionId}.${secret}`;
    await sql`INSERT INTO articles (title, slug, status) VALUES ('Test article', ${slug}, 'published')`;
  });

  afterAll(async () => {
    if (originalFetch !== undefined) globalThis.fetch = originalFetch;
    await sql.end();
    mock.restore();
  });

  test("the public settings API exposes each persisted switch value without secrets", async () => {
    for (const enabled of [false, true]) {
      await saveSwitch(enabled);
      const response = await routes.handle(new Request("http://localhost/api/blog/settings"));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.basics.commentsEnabled).toBe(enabled);
      expect(body.basics.resendApiKey).toBeUndefined();
      expect(body.storage).toBeUndefined();
    }
  });

  test("closing blocks article and guestbook posts/replies, preserves history, and allows reopening", async () => {
    const article = await createComment("article");
    const guestbook = await createComment("guestbook");
    await saveSwitch(false);
    for (const target of ["article", "guestbook"] as const) {
      const parentId = target === "article" ? article.item.id : guestbook.item.id;
      for (const parent of [undefined, parentId]) {
        await expect(createComment(target, parent)).rejects.toMatchObject({
          reason: "comments-disabled",
        });
      }
    }
    expect(
      (await comments.listPublicComments({ articleSlug: slug, query: {} })).pageInfo.totalItems,
    ).toBe(1);
    expect((await comments.listPublicGuestbookComments({ query: {} })).pageInfo.totalItems).toBe(1);
    await saveSwitch(true);
    expect((await createComment("article", article.item.id)).ok).toBe(true);
    expect((await createComment("guestbook", guestbook.item.id)).ok).toBe(true);
  });

  test("closing also rejects authenticated image uploads before storing media", async () => {
    await saveSwitch(false);
    const form = new FormData();
    const bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cE+0AAAAASUVORK5CYII=",
      "base64",
    );
    form.set("file", new File([bytes], "test.png", { type: "image/png" }));
    const response = await routes.handle(
      new Request("http://localhost/api/blog/comments/images", {
        method: "POST",
        headers: { cookie },
        body: form,
      }),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).reason).toBe("comments-disabled");
    const [count] = await sql`SELECT count(*)::int AS total FROM media_assets`;
    expect(count.total).toBe(0);
  });

  test("article and guestbook location metadata survives a real database round-trip", async () => {
    const locationMeta = {
      ip: "203.0.113.9",
      countryCode: "CN",
      userAgent: "comment-test-browser",
    };
    const countryName = new Intl.DisplayNames(["zh-CN"], { type: "region" }).of("CN") ?? null;
    for (const target of ["article", "guestbook"] as const) {
      const parameters = { input: { content: "Location regression" }, meta: locationMeta, user };
      const result =
        target === "article"
          ? await comments.createPublicComment({ ...parameters, articleSlug: slug })
          : await comments.createPublicGuestbookComment(parameters);
      expect(result.item.location).toBe(countryName);
      const [stored] =
        await sql`SELECT jsonb_typeof(comment_location) AS location_type, jsonb_typeof(comment_device) AS device_type FROM comments WHERE id = ${result.item.id}`;
      expect(stored).toEqual({ locationType: "object", deviceType: "object" });
    }
  });

  test("English comment and guestbook lists select saved English locations without changing history", async () => {
    for (const target of ["article", "guestbook"] as const) {
      const created = await createComment(target);
      const location = { location: "日本东京", location_en: "Tokyo, Japan" };
      await sql`UPDATE comments SET comment_location = ${sql.json(location)} WHERE id = ${created.item.id}`;
      for (const locale of ["en", "zh-CN"] as const) {
        const result = target === "article"
          ? await comments.listPublicComments({ articleSlug: slug, query: { locale } })
          : await comments.listPublicGuestbookComments({ query: { locale } });
        expect(result.items[0]?.location).toBe(locale === "en" ? "Tokyo, Japan" : "日本东京");
      }
      const [row] = await sql`SELECT comment_location::text AS payload FROM comments WHERE id = ${created.item.id}`;
      expect(JSON.parse(row.payload)).toEqual(location);
    }
  });
});
