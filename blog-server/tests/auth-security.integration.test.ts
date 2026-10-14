import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { createHash } from "node:crypto";

import { createChallenge, solveChallenge } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import { Elysia } from "elysia";
import postgres from "postgres";
import { createClient } from "redis";

import type { AuthProvider } from "../src/shared/auth-providers";

const databaseUrl = Bun.env.AUTH_TEST_DATABASE_URL;
const redisUrl = Bun.env.AUTH_TEST_REDIS_URL;
const enabled = databaseUrl !== undefined && redisUrl !== undefined;
const suite = enabled ? describe : describe.skip;

suite("authentication security with isolated PostgreSQL and Redis", () => {
  const sql = postgres(databaseUrl ?? "postgres://localhost/auth_security_unused", {
    max: 10,
    transform: postgres.camel,
    onnotice: () => {},
  });
  const redis = createClient({ url: redisUrl ?? "redis://localhost:6379" });
  const altchaSecret = "synthetic-altcha-test-key";
  const encryptionSecret = "synthetic-encryption-test-key";
  const frontendOrigin = "https://blog.example.test";
  const meta = {
    ip: null,
    userAgent: "security-regression-test",
    timeZone: null,
    timeZoneOffsetMinutes: null,
  };
  let networkCalls = 0;
  let deeplApiKey: string | undefined;
  let redisUnavailable = false;
  let auth: typeof import("../src/blog/auth/service");
  let oauth: typeof import("../src/blog/auth/oauth");
  let admin: typeof import("../src/admin/auth/service");
  let users: typeof import("../src/admin/users/service");
  let setup: typeof import("../src/admin/setup/service");
  let altcha: typeof import("../src/shared/altcha");
  let attempts: typeof import("../src/shared/email-verification");
  let reveals: typeof import("../src/admin/settings/email-code");
  let routes: Pick<Elysia, "handle">;
  let appRoutes: Pick<Elysia, "handle">;
  let adminRoutes: Pick<Elysia, "handle">;
  let encrypt: typeof import("../src/shared/security/encryption").encryptSecret;
  let decrypt: typeof import("../src/shared/security/encryption").decryptSecret;
  let originalFetch: typeof fetch;

  const hash = (text: string) => createHash("sha256").update(text).digest("hex");

  const createProof = async () => {
    const challenge = await createChallenge({
      algorithm: "PBKDF2/SHA-256",
      cost: 10,
      counter: 2,
      deriveKey,
      expiresAt: new Date(Date.now() + 600_000),
      hmacSignatureSecret: altchaSecret,
      hmacKeySignatureSecret: `${altchaSecret}:key-signature`,
    });
    const solution = await solveChallenge({ challenge, deriveKey });
    return JSON.stringify({ challenge, solution });
  };

  const createUser = async (role: "admin" | "user" = "admin") => {
    const id = crypto.randomUUID();
    const passwordHash = await Bun.password.hash("test-original-password");
    await sql`
      INSERT INTO users (id, role, username, email, password_hash)
      VALUES (${id}, ${role}, ${id}, ${`${id}@example.test`}, ${passwordHash})
    `;
    return auth.readBlogUserProfileById({ sql, userId: id });
  };

  const insertCode = async ({
    email,
    purpose = "password_reset",
    code = "123456",
    createdAt = new Date(),
    expiresAt = new Date(Date.now() + 600_000),
  }: {
    email: string;
    purpose?: string;
    code?: string;
    createdAt?: Date;
    expiresAt?: Date;
  }) => {
    await sql`
      INSERT INTO email_verification_codes (email, purpose, code_hash, created_at, expires_at)
      VALUES (${email}, ${purpose}, ${hash(code)}, ${createdAt}, ${expiresAt})
    `;
  };

  const createSessions = async (user: Awaited<ReturnType<typeof createUser>>) => {
    const adminSession = await admin.createAdminSession({ user: { ...user, role: "admin" } });
    const sessionId = crypto.randomUUID();
    await sql`
      INSERT INTO auth_sessions (user_id, session_id, token_hash, expires_at)
      VALUES (${user.id}, ${sessionId}, ${hash(`synthetic-session-token:${sessionId}`)}, ${new Date(Date.now() + 600_000)})
    `;
    return { adminSession, sessionId };
  };

  const configureProvider = async ({
    provider,
    redirectUri,
  }: {
    provider: AuthProvider;
    redirectUri: string;
  }) => {
    await sql`
      INSERT INTO auth_provider_settings (provider, display_name, enabled, client_id, client_secret_encrypted, redirect_uri, scopes)
      VALUES (${provider}, ${provider}, true, 'test-client', ${encrypt({ value: "synthetic-oauth-key", secret: encryptionSecret })},
        ${redirectUri}, ${provider === "github" ? ["read:user", "user:email"] : ["openid", "email", "profile"]})
    `;
  };

  const configureGithub = () =>
    configureProvider({
      provider: "github",
      redirectUri: "https://api.example.test/api/blog/auth/oauth/github/callback",
    });

  const identityFetcher = (emailPayload: unknown) => async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/access_token")) {
      return Response.json({ access_token: "synthetic-provider-token" });
    }
    if (url.endsWith("/user/emails")) {
      return Response.json(emailPayload);
    }
    if (url.endsWith("/user")) {
      return Response.json({ id: 42, login: "test-oauth-user", email: "victim@example.test" });
    }
    throw new Error("Unexpected external request");
  };

  beforeAll(async () => {
    const database = new URL(databaseUrl ?? "");
    const cache = new URL(redisUrl ?? "");
    if (
      !database.pathname.startsWith("/leiblog_test_") ||
      !["localhost", "127.0.0.1"].includes(database.hostname) ||
      !["localhost", "127.0.0.1"].includes(cache.hostname) ||
      cache.port === "" ||
      cache.port === "6379"
    ) {
      throw new Error(
        "Security tests require a disposable local leiblog_test_ database and Redis on a non-default port.",
      );
    }
    // These modules are replaced before importing application code; no real env/settings are loaded.
    mock.module("../src/shared/env", () => ({
      env: {
        altchaSecret,
        configEncryptionSecret: encryptionSecret,
        corsOrigins: [frontendOrigin],
        hostname: "localhost",
        port: 3000,
        sessionTtlSeconds: 600,
        jwtSecret: "synthetic-jwt-test-key",
      },
    }));
    mock.module("../src/shared/db/postgres", () => ({ getSql: () => sql }));
    mock.module("../src/shared/db/redis", () => ({
      getRedisClient: async () => {
        if (redisUnavailable) {
          throw new Error("Synthetic Redis outage");
        }
        return redis;
      },
    }));
    mock.module("../src/admin/settings/service", () => ({
      readEncryptedSetting: async (key: string) => key === "deepl_api_key" ? deeplApiKey : undefined,
      getSiteSettings: async () => ({
        basics: { resendDomain: "" },
        site: { siteName: "Test Blog", lightLogoUrl: "", darkLogoUrl: "" },
        siteLocalizations: { en: { siteName: "Test Blog" }, zhCN: { siteName: "Test Blog" } },
      }),
    }));
    mock.module("../src/shared/login-metadata", () => ({
      describeDevice: () => null,
      describeLocation: () => null,
      readLocationLabels: async ({ values }: { values: unknown[] }) => values.map(() => ({ zhCN: null, en: null })),
      recordLoginAttempt: async () => {},
      readUserLoginInfo: async () => ({}),
    }));
    originalFetch = globalThis.fetch;
    globalThis.fetch = Object.assign(
      async () => {
        networkCalls += 1;
        throw new Error("External requests disabled in security tests");
      },
      { preconnect: originalFetch.preconnect },
    );
    await redis.connect();
    const schema = await Bun.file(new URL("../src/shared/db/schema.sql", import.meta.url)).text();
    await sql.unsafe(schema);
    auth = await import("../src/blog/auth/service");
    oauth = await import("../src/blog/auth/oauth");
    admin = await import("../src/admin/auth/service");
    users = await import("../src/admin/users/service");
    setup = await import("../src/admin/setup/service");
    altcha = await import("../src/shared/altcha");
    attempts = await import("../src/shared/email-verification");
    reveals = await import("../src/admin/settings/email-code");
    encrypt = (await import("../src/shared/security/encryption")).encryptSecret;
    decrypt = (await import("../src/shared/security/encryption")).decryptSecret;
    const { blogAuthRoutes, blogOAuthCallbackRoutes } = await import("../src/blog/auth/routes");
    routes = new Elysia().use(blogAuthRoutes);
    const { adminAuthRoutes } = await import("../src/admin/auth/routes");
    const { adminContentRoutes } = await import("../src/admin/content/routes");
    const { applyAdminCookieAuthentication } = await import("../src/admin/auth/cookie");
    const { createRequestSecurity } = await import("../src/shared/request-security");
    appRoutes = new Elysia()
      .use(createRequestSecurity({ consumeRateLimit: async () => 0 }))
      .group("/api/auth", (app) => app.use(blogOAuthCallbackRoutes))
      .group("/api/blog", (app) => app.use(blogAuthRoutes));
    adminRoutes = new Elysia()
      .use(createRequestSecurity({ consumeRateLimit: async () => 0 }))
      .onTransform({ as: "global" }, applyAdminCookieAuthentication)
      .use(adminAuthRoutes)
      .use(adminContentRoutes);
  });

  beforeEach(async () => {
    await sql`TRUNCATE users, email_verification_codes, oauth_login_states, auth_provider_settings CASCADE`;
    await redis.flushDb();
    redisUnavailable = false;
    networkCalls = 0;
    deeplApiKey = undefined;
  });

  afterAll(async () => {
    if (originalFetch !== undefined) {
      globalThis.fetch = originalFetch;
    }
    await sql.end();
    if (redis.isOpen) {
      await redis.quit();
    }
    mock.restore();
  });

  test("a solved ALTCHA challenge cannot be reused with new encoding or metadata", async () => {
    const challenge = await createChallenge({
      algorithm: "PBKDF2/SHA-256",
      cost: 10,
      counter: 2,
      deriveKey,
      expiresAt: new Date(Date.now() + 600_000),
      hmacSignatureSecret: altchaSecret,
      hmacKeySignatureSecret: `${altchaSecret}:key-signature`,
    });
    const solution = await solveChallenge({ challenge, deriveKey });
    expect(solution).not.toBeNull();
    const payload = { challenge, solution };
    expect(await altcha.verifyAltchaPayload(JSON.stringify(payload))).toEqual({ ok: true });
    const changed = { solution: { ...solution, time: 999 }, challenge };
    const encodings = [
      JSON.stringify(changed, null, 2),
      Buffer.from(JSON.stringify(payload)).toString("base64"),
    ];
    for (const encoded of encodings) {
      expect(await altcha.verifyAltchaPayload(encoded)).toEqual({
        ok: false,
        reason: "altcha-replayed",
      });
    }
    redisUnavailable = true;
    expect((await altcha.verifyAltchaPayload(JSON.stringify(payload))).ok).toBe(false);
  });

  test("only five concurrent guesses are allowed per normalized email and purpose", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        attempts.reserveEmailVerificationAttempt({
          email: i % 2 ? "Victim@Example.test" : " victim@example.test ",
          purpose: "password_reset",
        }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(5);
    const keys = await redis.keys("leiblog:email-code-attempts:*");
    expect(keys).toHaveLength(1);
    expect(await redis.ttl(keys[0])).toBeGreaterThan(0);
    expect(
      await attempts.reserveEmailVerificationAttempt({
        email: "victim@example.test",
        purpose: "register",
      }),
    ).toBe(true);
    redisUnavailable = true;
    expect(
      await attempts.reserveEmailVerificationAttempt({
        email: "new@example.test",
        purpose: "register",
      }),
    ).toBe(false);
  });

  test("six-digit brute force cannot continue with a correct sixth guess", async () => {
    const user = await createUser();
    await insertCode({ email: user.email });
    for (let i = 0; i < 5; i += 1) {
      await expect(
        auth.resetBlogUserPassword({
          email: user.email,
          emailCode: "000000",
          password: "new-test-password",
        }),
      ).rejects.toMatchObject({ reason: "invalid-code" });
    }
    await expect(
      auth.resetBlogUserPassword({
        email: user.email,
        emailCode: "123456",
        password: "new-test-password",
      }),
    ).rejects.toMatchObject({ reason: "invalid-code" });
  });

  test("two simultaneous password resets can consume one email code only once", async () => {
    const user = await createUser();
    const { adminSession, sessionId } = await createSessions(user);
    await insertCode({ email: user.email });
    const results = await Promise.allSettled(
      Array.from({ length: 2 }, () =>
        auth.resetBlogUserPassword({
          email: user.email,
          emailCode: "123456",
          password: "new-test-password",
        }),
      ),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await admin.readAdminSession({ sessionId: adminSession.sessionId })).toBeUndefined();
    const sessions =
      await sql`SELECT revoked_at FROM auth_sessions WHERE session_id = ${sessionId}`;
    expect(sessions[0]?.revokedAt).not.toBeNull();
  });

  test("consuming the newest code does not revive an older code", async () => {
    const user = await createUser();
    await insertCode({ email: user.email, code: "111111", createdAt: new Date(Date.now() - 1000) });
    await insertCode({ email: user.email });
    await auth.resetBlogUserPassword({
      email: user.email,
      emailCode: "123456",
      password: "new-test-password",
    });
    await expect(
      auth.resetBlogUserPassword({
        email: user.email,
        emailCode: "111111",
        password: "another-test-password",
      }),
    ).rejects.toMatchObject({ reason: "invalid-code" });
  });

  test("administrator secret reveal codes are atomic and do not revive older codes", async () => {
    const user = await createUser();
    const purpose = "admin_api_key_reveal";
    await insertCode({
      email: user.email,
      purpose,
      code: "111111",
      createdAt: new Date(Date.now() - 1000),
    });
    await insertCode({ email: user.email, purpose });
    const results = await Promise.all(
      Array.from({ length: 2 }, () =>
        reveals.consumeSecretRevealEmailCode({
          email: user.email,
          emailCode: "123456",
          purpose,
          sql,
        }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(
      await reveals.consumeSecretRevealEmailCode({
        email: user.email,
        emailCode: "111111",
        purpose,
        sql,
      }),
    ).toBe(false);
  });

  test("missing email delivery cannot disclose a usable reset code", async () => {
    const user = await createUser();
    await expect(
      auth.createEmailCode({ email: user.email, purpose: "password_reset" }),
    ).rejects.toMatchObject({ reason: "email-unavailable", statusCode: 503 });
    const rows =
      await sql`SELECT count(*)::int AS count FROM email_verification_codes WHERE consumed_at IS NULL`;
    expect(rows[0]?.count).toBe(0);
    expect(networkCalls).toBe(0);
  });

  test("OAuth return URLs stay on the configured frontend origin", () => {
    for (const returnTo of [
      "/\\evil.example",
      "/\t/evil.example",
      "//evil.example",
      "/\\\\evil.example",
    ]) {
      expect(
        new URL(oauth.createOAuthResultRedirectUrl({ returnTo, status: "success" })).origin,
      ).toBe(frontendOrigin);
    }
    const safe = new URL(
      oauth.createOAuthResultRedirectUrl({ returnTo: "/articles?tag=test", status: "success" }),
    );
    expect(safe.pathname).toBe("/articles");
    expect(safe.searchParams.get("tag")).toBe("test");
  });

  test("admin cookie login survives refresh and rejects cross-site logout", async () => {
    const user = await createUser();
    const challenge = await createChallenge({
      algorithm: "PBKDF2/SHA-256",
      cost: 10,
      counter: 2,
      deriveKey,
      expiresAt: new Date(Date.now() + 600_000),
      hmacSignatureSecret: altchaSecret,
      hmacKeySignatureSecret: `${altchaSecret}:key-signature`,
    });
    const solution = await solveChallenge({ challenge, deriveKey });
    const login = await adminRoutes.handle(
      new Request("http://localhost/api/admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", origin: frontendOrigin },
        body: JSON.stringify({
          identifier: user.username,
          password: "test-original-password",
          altcha: JSON.stringify({ challenge, solution }),
        }),
      }),
    );
    expect(login.status).toBe(200);
    const loginBody = await login.json();
    expect(loginBody.transport).toBe("cookie");
    expect(loginBody.token).toBe("");
    const setCookie = login.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    const cookie = setCookie.split(";")[0];
    const profile = await adminRoutes.handle(
      new Request("http://localhost/api/admin/auth/me", { headers: { cookie } }),
    );
    expect(profile.status).toBe(200);
    const blocked = await adminRoutes.handle(
      new Request("http://localhost/api/admin/auth/logout", {
        method: "POST",
        headers: { cookie, origin: "https://evil.example.test" },
      }),
    );
    expect(blocked.status).toBe(403);
    const logout = await adminRoutes.handle(
      new Request("http://localhost/api/admin/auth/logout", {
        method: "POST",
        headers: { cookie, origin: frontendOrigin },
      }),
    );
    expect(logout.status).toBe(200);
    expect(logout.headers.get("set-cookie")).toContain("leiblog_admin_session=");
    const stale = await adminRoutes.handle(
      new Request("http://localhost/api/admin/auth/me", { headers: { cookie } }),
    );
    expect(stale.status).toBe(401);
  });

  test("GitHub's unverified public email cannot bind an existing local account", async () => {
    await configureGithub();
    const user = await createUser();
    await sql`UPDATE users SET email = 'victim@example.test' WHERE id = ${user.id}`;
    for (const emails of [
      [],
      [{ email: "victim@example.test", primary: true, verified: false }],
      {},
    ]) {
      const authorization = await oauth.createOAuthAuthorization({ providerValue: "github", sql });
      await expect(
        oauth.completeOAuthLogin({
          code: "synthetic-code",
          providerValue: "github",
          state: authorization.state,
          requestMeta: meta,
          sql,
          fetcher: identityFetcher(emails),
        }),
      ).rejects.toMatchObject({ reason: "invalid-identity" });
    }
    const linked = await sql`SELECT count(*)::int AS count FROM user_oauth_accounts`;
    expect(linked[0]?.count).toBe(0);
  });

  test("verified GitHub email still links correctly and OAuth state is single-use", async () => {
    await configureGithub();
    const user = await createUser();
    await sql`UPDATE users SET email = 'victim@example.test' WHERE id = ${user.id}`;
    await sql`UPDATE users SET comment_email_notifications = false, new_post_email_notifications = false WHERE id = ${user.id}`;
    const authorization = await oauth.createOAuthAuthorization({ providerValue: "github", sql });
    const input = {
      code: "synthetic-code",
      providerValue: "github",
      state: authorization.state,
      requestMeta: meta,
      sql,
      fetcher: identityFetcher([{ email: "victim@example.test", primary: true, verified: true }]),
    };
    const result = await oauth.completeOAuthLogin(input);
    expect(result.user.id).toBe(user.id);
    expect(result.user.commentEmailNotifications).toBe(false);
    expect(result.user.newPostEmailNotifications).toBe(false);
    await expect(oauth.completeOAuthLogin(input)).rejects.toMatchObject({
      reason: "oauth-state-invalid",
    });
  });

  test("new password and OAuth users default to both email notifications enabled", async () => {
    await insertCode({ email: "signup@example.test", purpose: "register" });
    const registered = await auth.registerBlogUser({
      email: "signup@example.test",
      emailCode: "123456",
      username: "signup",
      password: "test-original-password",
    });
    expect(registered.commentEmailNotifications).toBe(true);
    expect(registered.newPostEmailNotifications).toBe(true);
    await configureGithub();
    const authorization = await oauth.createOAuthAuthorization({ providerValue: "github", sql });
    const result = await oauth.completeOAuthLogin({
      code: "synthetic-code",
      providerValue: "github",
      state: authorization.state,
      requestMeta: meta,
      sql,
      fetcher: identityFetcher([{ email: "victim@example.test", primary: true, verified: true }]),
    });
    expect(result.user.commentEmailNotifications).toBe(true);
    expect(result.user.newPostEmailNotifications).toBe(true);
    await sql`UPDATE users SET comment_email_notifications = false, new_post_email_notifications = false WHERE id = ${registered.id}`;
    await sql.unsafe(await Bun.file(new URL("../src/shared/db/schema.sql", import.meta.url)).text());
    const login = await auth.loginBlogUser({
      identifier: registered.username,
      password: "test-original-password",
      requestMeta: meta,
    });
    expect(login.commentEmailNotifications).toBe(false);
    expect(login.newPostEmailNotifications).toBe(false);
  });

  test("profile panel patches preserve omitted fields and explicit notification opt-outs", async () => {
    const user = await createUser("user");
    await auth.updateBlogUserProfile({
      userId: user.id,
      username: user.username,
      name: "Saved name",
      avatarUrl: "/uploads/avatar.png",
      bio: "Saved bio",
      blogUrl: "https://example.test",
      tags: ["Saved"],
    });
    const preferences = await auth.updateBlogUserProfile({
      userId: user.id,
      commentEmailNotifications: false,
      newPostEmailNotifications: false,
    });
    expect(preferences.name).toBe("Saved name");
    expect(preferences.avatarUrl).toBe("/uploads/avatar.png");
    expect(preferences.bio).toBe("Saved bio");
    expect(preferences.tags).toEqual(["Saved"]);
    const cleared = await auth.updateBlogUserProfile({
      userId: user.id, avatarUrl: "", name: "", tags: [],
    });
    expect(cleared.avatarUrl).toBeUndefined();
    expect(cleared.name).toBeUndefined();
    expect(cleared.tags).toEqual([]);
    expect(cleared.commentEmailNotifications).toBe(false);
    expect(cleared.newPostEmailNotifications).toBe(false);
  });

  test("self-service bilingual profiles persist both languages and preserve explicit preferences", async () => {
    const user = await createUser("user");
    const profileLocalizations = {
      zhCN: { name: "中文姓名", bio: "中文描述", tags: ["摄影", "写作"] },
      en: { name: "English name", bio: "English bio", tags: ["Photography", "Writing"] },
    };
    const saved = await auth.updateBlogUserProfile({ userId: user.id, profileLocalizations });
    expect(saved.profileLocalizations).toEqual(profileLocalizations);
    expect(saved.name).toBe("中文姓名");
    expect(saved.profileTranslation?.missingFields).toEqual([]);
    const preferences = await auth.updateBlogUserProfile({ userId: user.id, commentEmailNotifications: false });
    expect(preferences.profileLocalizations).toEqual(profileLocalizations);
    expect(preferences.commentEmailNotifications).toBe(false);
    const reread = await auth.readBlogUserProfileById({ sql, userId: user.id });
    expect(reread.profileLocalizations).toEqual(profileLocalizations);
    expect(networkCalls).toBe(0);
  });

  test("missing translation configuration saves entered profile values without inventing English text", async () => {
    const user = await createUser("user");
    const saved = await auth.updateBlogUserProfile({ userId: user.id, profileLocalizations: {
      zhCN: { name: "中文", bio: "简介", tags: ["摄影"] },
      en: { name: "", bio: "", tags: [] },
    } });
    expect(saved.profileLocalizations?.zhCN.name).toBe("中文");
    expect(saved.profileLocalizations?.en).toEqual({ name: "", bio: "", tags: [] });
    expect(saved.profileTranslation?.status).toBe("missing-api-key");
    expect(networkCalls).toBe(0);
  });

  test("profile API translates missing fields and cannot modify another user's profile", async () => {
    const user = await createUser("user");
    const other = await createUser("user");
    const sessionId = crypto.randomUUID();
    const sessionSecret = "synthetic-profile-session";
    await auth.createBlogSession({ user, requestMeta: meta, sessionId, sessionSecret });
    const blockedFetch = globalThis.fetch;
    deeplApiKey = "synthetic";
    const words: Record<string, string> = { 中文姓名: "English name", 中文简介: "English bio", 摄影: "Photography" };
    globalThis.fetch = Object.assign(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body)) as { text: string[] };
      return Response.json({ translations: payload.text.map(text => ({ text: words[text] ?? text })) });
    }, { preconnect: originalFetch.preconnect });
    try {
      const response = await appRoutes.handle(new Request("http://localhost/api/blog/auth/me", {
        method: "PATCH", headers: { "Content-Type": "application/json", origin: frontendOrigin, cookie: `leiblog_blog_session=${sessionId}.${sessionSecret}` },
        body: JSON.stringify({ userId: other.id, profileLocalizations: {
          zhCN: { name: "中文姓名", bio: "中文简介", tags: ["摄影"] }, en: { name: "", bio: "", tags: [] },
        } }),
      }));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.user.id).toBe(user.id);
      expect(body.user.profileLocalizations.en).toEqual({ name: "English name", bio: "English bio", tags: ["Photography"] });
      expect((await auth.readBlogUserProfileById({ sql, userId: other.id })).name).toBeUndefined();
      expect((await auth.readBlogUserProfileById({ sql, userId: user.id })).profileLocalizations?.en).toEqual(body.user.profileLocalizations.en);
    } finally { globalThis.fetch = blockedFetch; }
  });

  test("categories and tags persist automatic translations and expose true untranslated fields", async () => {
    const content = await import("../src/admin/content/service");
    const suffix = crypto.randomUUID();
    const empty = await content.createCategory({ input: { name: "未翻译分类", slug: `empty-${suffix}` } });
    expect(empty.item.localizations.en).toEqual({ name: "", description: "" });
    const blockedFetch = globalThis.fetch;
    deeplApiKey = "synthetic";
    const words: Record<string, string> = { 测试分类: "Test category", 测试标签: "Test tag", 中文描述: "English description" };
    globalThis.fetch = Object.assign(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body)) as { text: string[] };
      return Response.json({ translations: payload.text.map(text => ({ text: words[text] ?? text })) });
    }, { preconnect: originalFetch.preconnect });
    try {
      const category = await content.updateCategory({ categoryId: empty.item.id, input: { name: "测试分类", description: "中文描述", slug: `empty-${suffix}` } });
      expect(category.item.localizations.en).toEqual({ name: "Test category", description: "English description" });
      expect(category.item.slug).toBe(`empty-${suffix}`);
      const tag = await content.createTag({ input: { name: "测试标签", description: "中文描述", color: "#123456", slug: `tag-${suffix}` } });
      expect(tag.item.localizations.en).toEqual({ name: "Test tag", description: "English description" });
      const updated = await content.updateTag({ tagId: tag.item.id, input: { name: "测试标签", description: "中文描述", slug: tag.item.slug, color: tag.item.color, localizations: { en: { name: "Manual name" } } } });
      expect(updated.item.localizations.en.name).toBe("Manual name");
      expect(updated.item.localizations.en.description).toBe("English description");
      const reread = await content.listTags({ query: updated.item.slug });
      expect(reread.items[0]?.localizations.en.name).toBe("Manual name");
    } finally { globalThis.fetch = blockedFetch; }
  });

  test("article translation rejects anonymous access and reports missing keys only to authenticated admins", async () => {
    const request = (cookie?: string) => new Request("http://localhost/api/admin/content/articles/translate", {
      method: "POST", headers: { "Content-Type": "application/json", origin: frontendOrigin, ...(cookie ? { cookie } : {}) },
      body: JSON.stringify({ content: "# Text", sourceLocale: "en" }),
    });
    expect((await adminRoutes.handle(request())).status).toBe(401);
    const user = await createUser("admin");
    const login = await adminRoutes.handle(new Request("http://localhost/api/admin/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: user.username, password: "test-original-password", altcha: await createProof() }),
    }));
    expect(login.status).toBe(200);
    const cookie = login.headers.getSetCookie().find(value => value.startsWith("leiblog_admin_session="))?.split(";")[0];
    expect(cookie).toBeDefined();
    const response = await adminRoutes.handle(request(cookie));
    expect(response.status).toBe(409);
    expect((await response.json()).reason).toBe("missing-deepl-api-key");
    expect(networkCalls).toBe(0);
    const blockedFetch = globalThis.fetch;
    deeplApiKey = "synthetic";
    globalThis.fetch = Object.assign(async () => Response.json({ translations: [{ text: "文本" }] }), { preconnect: originalFetch.preconnect });
    try {
      const translated = await adminRoutes.handle(request(cookie));
      expect(translated.status).toBe(200);
      expect(await translated.json()).toEqual({ content: "# 文本" });
      const [articles] = await sql`SELECT count(*)::int AS total FROM articles WHERE title = '文本'`;
      expect(articles.total).toBe(0);
    } finally { globalThis.fetch = blockedFetch; }
    await sql`UPDATE users SET role = 'user' WHERE id = ${user.id}`;
    expect((await adminRoutes.handle(request(cookie))).status).toBe(401);
  });

  test("OAuth callback rejects missing or mismatched browser state before token exchange", async () => {
    await configureGithub();
    const start = await routes.handle(new Request("http://localhost/auth/oauth/github/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ altcha: await createProof() }),
    }));
    expect(start.status).toBe(200);
    const setCookie = start.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    const { authorizationUrl } = await start.json();
    const state = new URL(authorizationUrl).searchParams.get("state");
    for (const cookie of ["", "leiblog_oauth_state_github=wrong-state"]) {
      const response = await routes.handle(
        new Request(`http://localhost/auth/oauth/github/callback?code=test-code&state=${state}`, {
          headers: { cookie },
        }),
      );
      expect(response.status).toBe(302);
      expect(new URL(response.headers.get("location") ?? "").searchParams.get("oauth_status")).toBe(
        "error",
      );
    }
    expect(networkCalls).toBe(0);
    const states = await sql`SELECT consumed_at FROM oauth_login_states`;
    expect(states[0]?.consumedAt).toBeNull();
  });

  for (const provider of ["github", "google"] as const) {
    test(`${provider} cannot start OAuth without a fresh human verification proof`, async () => {
      await configureProvider({
        provider,
        redirectUri: `https://api.example.test/api/auth/oauth/${provider}/callback`,
      });
      const path = `http://localhost/api/blog/auth/oauth/${provider}/start`;
      const bypass = await appRoutes.handle(new Request(path));
      expect(bypass.status).toBe(405);
      for (const altcha of [undefined, "invalid-proof"]) {
        const response = await appRoutes.handle(new Request(path, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: frontendOrigin },
          body: JSON.stringify({ altcha, locale: "en", returnTo: "/" }),
        }));
        expect(response.status).toBe(400);
        expect(response.headers.get("set-cookie")).toBeNull();
      }
      const before = await sql`SELECT count(*)::int AS count FROM oauth_login_states`;
      expect(before[0]?.count).toBe(0);
      const altcha = await createProof();
      const request = () => new Request(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: frontendOrigin },
        body: JSON.stringify({ altcha, locale: "en", returnTo: "/" }),
      });
      const started = await appRoutes.handle(request());
      expect(started.status).toBe(200);
      expect(await started.json()).toMatchObject({ ok: true, authorizationUrl: expect.any(String) });
      expect(started.headers.get("set-cookie")).toContain(`leiblog_oauth_state_${provider}=`);
      const replay = await appRoutes.handle(request());
      expect(replay.status).toBe(400);
      expect(await replay.json()).toMatchObject({ reason: "altcha-replayed" });
      const after = await sql`SELECT count(*)::int AS count FROM oauth_login_states`;
      expect(after[0]?.count).toBe(1);
      expect(networkCalls).toBe(0);
    });
  }

  for (const prefix of ["/api/auth", "/api/blog/auth"]) {
    for (const provider of ["github", "google"] as const) {
      test(`${provider} callback at ${prefix} establishes a session and rejects replay`, async () => {
        const redirectUri = `https://api.example.test${prefix}/oauth/${provider}/callback`;
        await configureProvider({ provider, redirectUri });
        const returnTo = "/articles/oauth?lang=en#comments";
        const start = await appRoutes.handle(
          new Request(
            `http://localhost/api/blog/auth/oauth/${provider}/start`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", Origin: frontendOrigin },
              body: JSON.stringify({ altcha: await createProof(), returnTo }),
            },
          ),
        );
        expect(start.status).toBe(200);
        const { authorizationUrl } = await start.json();
        const authorization = new URL(authorizationUrl);
        expect(authorization.searchParams.get("redirect_uri")).toBe(redirectUri);
        const state = authorization.searchParams.get("state") ?? "";
        const stateCookie = start.headers.getSetCookie()
          .find((value) => value.startsWith(`leiblog_oauth_state_${provider}=`))
          ?.split(";")[0];
        expect(stateCookie).toBeDefined();
        const blockedFetch = globalThis.fetch;
        globalThis.fetch = Object.assign(
          async (input: RequestInfo | URL, init?: RequestInit) => {
            networkCalls += 1;
            const endpoint = String(input);
            if (
              endpoint === "https://github.com/login/oauth/access_token" ||
              endpoint === "https://oauth2.googleapis.com/token"
            ) {
              if (!(init?.body instanceof URLSearchParams)) {
                throw new Error("Expected an OAuth token form");
              }
              expect(init.body.get("redirect_uri")).toBe(redirectUri);
              expect(init.body.get("code")).toBe("synthetic-oauth-code");
              const challenge = createHash("sha256")
                .update(init.body.get("code_verifier") ?? "")
                .digest("base64url");
              expect(challenge).toBe(authorization.searchParams.get("code_challenge") ?? "");
              return Response.json({ access_token: "synthetic-provider-token" });
            }
            if (provider === "github") {
              return identityFetcher([
                { email: "victim@example.test", primary: true, verified: true },
              ])(input);
            }
            if (endpoint === "https://openidconnect.googleapis.com/v1/userinfo") {
              return Response.json({
                sub: "test-google-id",
                email: "victim@example.test",
                email_verified: true,
              });
            }
            throw new Error("Unexpected external request");
          },
          { preconnect: blockedFetch.preconnect },
        );
        try {
          const query = new URLSearchParams({ code: "synthetic-oauth-code", state });
          if (provider === "google") {
            query.set("iss", "https://accounts.google.com");
          }
          const callbackRequest = () =>
            new Request(`${redirectUri}?${query}`, {
              headers: { cookie: stateCookie ?? "" },
            });
          const callback = await appRoutes.handle(callbackRequest());
          expect(callback.status).toBe(302);
          const destination = new URL(callback.headers.get("location") ?? "");
          expect(destination.origin).toBe(frontendOrigin);
          expect(destination.pathname).toBe("/articles/oauth");
          expect(destination.searchParams.get("lang")).toBe("en");
          expect(destination.hash).toBe("#comments");
          expect(destination.searchParams.get("oauth_status")).toBe("success");
          const sessionCookie = callback.headers.getSetCookie()
            .find((value) => value.startsWith("leiblog_blog_session="))
            ?.split(";")[0];
          expect(sessionCookie).toBeDefined();
          const me = await appRoutes.handle(
            new Request("http://localhost/api/blog/auth/me", {
              headers: { cookie: sessionCookie ?? "" },
            }),
          );
          expect(me.status).toBe(200);
          expect(await me.json()).toMatchObject({ user: { email: "victim@example.test" } });
          const exchangeCalls = networkCalls;
          expect(exchangeCalls).toBe(provider === "github" ? 3 : 2);
          const replay = await appRoutes.handle(callbackRequest());
          expect(replay.status).toBe(302);
          expect(new URL(replay.headers.get("location") ?? "").searchParams.get("oauth_status"))
            .toBe("error");
          expect(replay.headers.get("set-cookie") ?? "").not.toContain("leiblog_blog_session=");
          expect(networkCalls).toBe(exchangeCalls);
        } finally {
          globalThis.fetch = blockedFetch;
        }
      });

      test(`${provider} callback at ${prefix} rejects invalid browser state without token exchange`, async () => {
        const redirectUri = `https://api.example.test${prefix}/oauth/${provider}/callback`;
        await configureProvider({ provider, redirectUri });
        const authorization = await oauth.createOAuthAuthorization({ providerValue: provider, sql });
        const query = new URLSearchParams({ code: "synthetic-oauth-code", state: authorization.state });
        for (const cookie of ["", `leiblog_oauth_state_${provider}=wrong-state`]) {
          const response = await appRoutes.handle(
            new Request(`${redirectUri}?${query}`, {
              headers: { cookie },
            }),
          );
          expect(response.status).toBe(302);
          expect(new URL(response.headers.get("location") ?? "").searchParams.get("oauth_status"))
            .toBe("error");
          expect(response.headers.get("set-cookie") ?? "").not.toContain("leiblog_blog_session=");
        }
        expect(networkCalls).toBe(0);
        const states = await sql`SELECT consumed_at FROM oauth_login_states`;
        expect(states[0]?.consumedAt).toBeNull();
      });
    }
  }

  test("a corrupt Redis entry cannot prevent revoking the user's other admin sessions", async () => {
    const user = await createUser();
    const { adminSession } = await createSessions(user);
    await redis.set("admin:session:corrupt", "broken-json");
    expect(await admin.readAdminSession({ sessionId: "corrupt" })).toBeUndefined();
    await redis.set("admin:session:wrong-id", JSON.stringify(adminSession));
    expect(await admin.readAdminSession({ sessionId: "wrong-id" })).toBeUndefined();
    await admin.deleteAdminSessionsForUser({ userId: user.id });
    expect(await admin.readAdminSession({ sessionId: adminSession.sessionId })).toBeUndefined();
  });

  test("password changes revoke admin and blog sessions", async () => {
    const user = await createUser();
    const { adminSession, sessionId } = await createSessions(user);
    await auth.changeBlogUserPassword({
      user,
      method: "password",
      currentPassword: "test-original-password",
      newPassword: "new-test-password",
    });
    expect(await admin.readAdminSession({ sessionId: adminSession.sessionId })).toBeUndefined();
    const sessions =
      await sql`SELECT revoked_at FROM auth_sessions WHERE session_id = ${sessionId}`;
    expect(sessions[0]?.revokedAt).not.toBeNull();
  });

  test("database revocation rejects an admin session even when Redis cleanup fails", async () => {
    const user = await createUser();
    const { adminSession } = await createSessions(user);
    redisUnavailable = true;
    expect(
      await auth.changeBlogUserPassword({
        user,
        method: "password",
        currentPassword: "test-original-password",
        newPassword: "new-test-password",
      }),
    ).toEqual({ ok: true });
    redisUnavailable = false;
    expect(await redis.get(`admin:session:${adminSession.sessionId}`)).not.toBeNull();
    expect(await admin.readAdminSession({ sessionId: adminSession.sessionId })).toBeUndefined();
  });

  test("an admin session ID is not a predictable blog session secret", async () => {
    const user = await createUser();
    const { adminSession } = await createSessions(user);
    expect(
      await auth.getBlogUserBySession({
        sessionId: adminSession.sessionId,
        sessionSecret: `admin:${adminSession.sessionId}`,
      }),
    ).toBeUndefined();
  });

  test("AES-GCM rejects shortened tags, trailing fields, and altered ciphertext", () => {
    const value = encrypt({ value: "synthetic-config-value", secret: encryptionSecret });
    expect(decrypt({ value, secret: encryptionSecret })).toBe("synthetic-config-value");
    const parts = value.split(":");
    parts[2] = Buffer.from(parts[2], "base64").subarray(0, 4).toString("base64");
    expect(() => decrypt({ value: parts.join(":"), secret: encryptionSecret })).toThrow();
    expect(() => decrypt({ value: `${value}:extra`, secret: encryptionSecret })).toThrow();
    const tampered = value.split(":");
    const bytes = Buffer.from(tampered[3], "base64");
    bytes[0] ^= 1;
    tampered[3] = bytes.toString("base64");
    expect(() => decrypt({ value: tampered.join(":"), secret: encryptionSecret })).toThrow();
    const empty = encrypt({ value: "", secret: encryptionSecret });
    expect(decrypt({ value: empty, secret: encryptionSecret })).toBe("");
  });

  test("managed password or role changes revoke both session stores", async () => {
    const actor = await createUser();
    for (const role of ["admin", "user"] as const) {
      const user = await createUser();
      const { adminSession, sessionId } = await createSessions(user);
      const result = await users.updateManagedUser({
        actorUserId: actor.id,
        userId: user.id,
        input: {
          role,
          username: user.username,
          email: user.email,
          password: role === "admin" ? "new-test-password" : "",
          avatarUrl: "",
          blogUrl: "",
          commentEmailNotifications: false,
          newPostEmailNotifications: false,
          profileLocalizations: {
            zhCN: { name: "", bio: "", tags: [] },
            en: { name: "", bio: "", tags: [] },
          },
        },
      });
      expect(result.ok).toBe(true);
      expect(await admin.readAdminSession({ sessionId: adminSession.sessionId })).toBeUndefined();
      const sessions =
        await sql`SELECT revoked_at FROM auth_sessions WHERE session_id = ${sessionId}`;
      expect(sessions[0]?.revokedAt).not.toBeNull();
    }
  });

  const setupInput = (
    username: string,
  ): import("../src/admin/setup/service").CompleteInitialSetupInput => ({
    admin: {
      name: "Test Admin",
      username,
      password: "test-admin-password",
      email: `${username}@example.test`,
      avatarUrl: "",
      bio: "",
      tags: [],
      tagLocale: "zh-CN",
      socialLinks: [],
      blogUrl: "",
      commentEmailNotifications: false,
      newPostEmailNotifications: false,
    },
    site: {
      siteName: "Test Blog",
      foundedAt: "2026-01-01 00:00",
      siteDescription: "",
      coverUrls: [],
      homepageCopy: "",
      lightLogoUrl: "",
      darkLogoUrl: "",
      faviconUrl: "",
      timeZone: "Asia/Shanghai",
    },
    basics: {
      seoTitle: "",
      seoDescription: "",
      seoKeywords: [],
      copyright: "",
      commentsEnabled: true,
      resendDomain: "",
      resendApiKey: "",
      deeplApiKey: "",
      ipGeolocationApiKey: "",
    },
    filings: { icpRecords: [], policeRecordNumber: "", policeRecordUrl: "" },
  });

  test("concurrent setup creates exactly one administrator", async () => {
    const results = await Promise.all([
      setup.completeInitialSetup(setupInput("first")),
      setup.completeInitialSetup(setupInput("second")),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.reason === "admin-exists")).toHaveLength(
      1,
    );
    const rows = await sql`SELECT count(*)::int AS count FROM users WHERE role = 'admin'`;
    expect(rows[0]?.count).toBe(1);
  });

  test("completed setup rejects takeover before translation or supplied key use", async () => {
    await createUser();
    const input = setupInput("attacker");
    input.basics.deeplApiKey = "synthetic-key-must-not-be-used";
    const result = await setup.completeInitialSetup(input);
    expect(result).toEqual({ ok: false, reason: "admin-exists" });
    expect(networkCalls).toBe(0);
  });
});
