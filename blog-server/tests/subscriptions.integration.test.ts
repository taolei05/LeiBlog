import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";
import postgres from "postgres";
import { createClient } from "redis";

const databaseUrl = Bun.env.AUTH_TEST_DATABASE_URL;
const redisUrl = Bun.env.AUTH_TEST_REDIS_URL;
const suite = databaseUrl && redisUrl ? describe : describe.skip;
suite("subscriptions with isolated database, authenticated routes and captured mail", () => {
  const sql = postgres(databaseUrl ?? "postgres://localhost/unused", {
    max: 10,
    transform: postgres.camel,
    onnotice: () => {},
  });
  const redis = createClient({ url: redisUrl ?? "redis://localhost:6379" });
  const secret = "synthetic-subscriptions-test-secret";
  let service: typeof import("../src/admin/subscriptions/service");
  let notifications: typeof import("../src/shared/email-notifications");
  let settings: typeof import("../src/admin/settings/service");
  let admin: typeof import("../src/admin/auth/service");
  let encrypt: typeof import("../src/shared/security/encryption").encryptSecret;
  let app: Pick<Elysia, "handle">;
  let originalFetch: typeof fetch;
  let id: string;
  let token: string;
  let rateCalls = 0;
  let rejectMail = false;
  const deliveries: Array<{
    key: string | null;
    body: { to: string[]; subject: string; html: string; text: string };
  }> = [];
  const input = () => ({
    name: "Domain <example>",
    serviceUrl: "https://example.test",
    category: "domain" as const,
    details: "Contract details",
    startDate: "2020-01-01",
    expiryDate: "2099-01-01",
    initialPrice: "1.20",
    renewalPrice: "99.90",
    currency: "USD" as const,
    renewalType: "manual" as const,
    notes: "Private notes",
    reminderEnabled: true,
    reminderDays: 7,
    reminderTime: "09:00",
  });
  const request = (path = "/", init: RequestInit = {}, auth = token) =>
    app.handle(
      new Request(`http://localhost/api/admin/subscriptions${path}`, {
        ...init,
        headers: {
          ...(auth ? { authorization: `Bearer ${auth}` } : {}),
          ...(typeof init.body === "string" ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
      }),
    );
  const makeDue = async () => {
    await sql`UPDATE subscriptions SET expiry_date = (now() AT TIME ZONE 'Asia/Shanghai')::date + 1,
      reminder_days = 7, reminder_time = '00:00' WHERE id = ${id}`;
  };
  const create = async () => {
    const response = await request("/", { method: "POST", body: JSON.stringify(input()) });
    expect(response.status).toBe(200);
    id = (await response.json()).id;
    return id;
  };

  beforeAll(async () => {
    const db = new URL(databaseUrl ?? "");
    const cache = new URL(redisUrl ?? "");
    if (
      !db.pathname.startsWith("/leiblog_test_") ||
      !["localhost", "127.0.0.1"].includes(db.hostname) ||
      !["localhost", "127.0.0.1"].includes(cache.hostname) ||
      !cache.port ||
      cache.port === "6379"
    )
      throw new Error("Disposable local services required.");
    mock.module("../src/shared/db/postgres", () => ({ getSql: () => sql }));
    mock.module("../src/shared/db/redis", () => ({ getRedisClient: async () => redis }));
    mock.module("../src/shared/env", () => ({
      env: {
        configEncryptionSecret: secret,
        jwtSecret: secret,
        corsOrigins: ["https://blog.example.test"],
        publicSiteUrl: "https://blog.example.test",
        sessionTtlSeconds: 600,
      },
    }));
    originalFetch = globalThis.fetch;
    globalThis.fetch = Object.assign(
      async (url: RequestInfo | URL, init?: RequestInit) => {
        if (String(url).startsWith("https://v6.exchangerate-api.com/")) {
          rateCalls += 1;
          return Response.json({
            result: "success",
            base_code: "USD",
            time_last_update_unix: Math.floor(Date.now() / 1000) - 60,
            time_next_update_unix: Math.floor(Date.now() / 1000) + 3600,
            conversion_rates: { USD: 1, CNY: 7, HKD: 7.8, EUR: 0.9, GBP: 0.8, JPY: 150 },
          });
        }
        if (String(url) === "https://api.resend.com/emails") {
          deliveries.push({
            key: new Headers(init?.headers).get("idempotency-key"),
            body: JSON.parse(String(init?.body)),
          });
          if (rejectMail) return Response.json({ message: "Synthetic outage" }, { status: 503 });
          return Response.json({ id: "synthetic-mail" });
        }
        throw new Error("Unexpected network request");
      },
      { preconnect: originalFetch.preconnect },
    );
    await redis.connect();
    const schema = await Bun.file(new URL("../src/shared/db/schema.sql", import.meta.url)).text();
    await sql.unsafe(schema);
    await sql.unsafe(schema);
    service = await import("../src/admin/subscriptions/service");
    notifications = await import("../src/shared/email-notifications");
    settings = await import("../src/admin/settings/service");
    admin = await import("../src/admin/auth/service");
    encrypt = (await import("../src/shared/security/encryption")).encryptSecret;
    const { adminSubscriptionRoutes } = await import("../src/admin/subscriptions/routes");
    const { adminSettingsRoutes } = await import("../src/admin/settings/routes");
    app = new Elysia().use(adminSubscriptionRoutes).use(adminSettingsRoutes);
  });
  beforeEach(async () => {
    await sql`TRUNCATE users, site_settings, site_settings_en, encrypted_settings CASCADE`;
    await redis.flushDb();
    deliveries.length = 0;
    rejectMail = false;
    rateCalls = 0;
    const [user] =
      await sql`INSERT INTO users (role, username, email, password_hash, notification_email_locale,
      comment_email_notifications, new_post_email_notifications) VALUES ('admin', 'admin', 'admin@example.test', 'unused', 'en', false, false) RETURNING *`;
    const { readBlogUserProfileById } = await import("../src/blog/auth/service");
    const profile = await readBlogUserProfileById({ sql, userId: user.id });
    const session = await admin.createAdminSession({ user: { ...profile, role: "admin" } });
    const signer = new Elysia()
      .use(jwt({ secret, name: "jwt" }))
      .get("/token", ({ jwt }) =>
        jwt.sign({ sub: user.id, sid: session.sessionId, username: user.username, role: "admin" }),
      );
    token = await (await signer.handle(new Request("http://localhost/token"))).text();
    await sql`INSERT INTO site_settings (id, site_name, time_zone, resend_domain) VALUES (1, 'Test Blog', 'Asia/Shanghai', 'example.test')`;
    await sql`INSERT INTO encrypted_settings (key, encrypted_value) VALUES ('resend_api_key', ${encrypt({ value: "synthetic-resend", secret })})`;
  });
  afterAll(async () => {
    globalThis.fetch = originalFetch;
    await redis.quit();
    await sql.end();
    mock.restore();
  });

  test("CRUD, exact money, pagination, filters and no private bytes in list", async () => {
    await create();
    const response = await request("/?search=domain&category=domain&status=normal");
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.total).toBe(1);
    expect(result.items[0].initialPrice).toBe("1.20");
    expect(result.items[0].renewalPrice).toBe("99.90");
    expect(result.items[0].startDate).toBe("2020-01-01");
    expect(result.items[0].recipientEmail).toBe("admin@example.test");
    expect(JSON.stringify(result)).not.toContain("password_hash");
    expect(
      (
        await request(`/${id}`, {
          method: "PUT",
          body: JSON.stringify({ ...input(), name: "Changed" }),
        })
      ).status,
    ).toBe(200);
    expect((await (await request("/?search=Changed")).json()).total).toBe(1);
    expect((await request(`/${id}`, { method: "DELETE" })).status).toBe(200);
    expect((await (await request()).json()).total).toBe(0);
  });
  test("unauthenticated and demoted sessions cannot access CRUD, rates or attachments", async () => {
    await create();
    for (const path of ["/", "/exchange-rates", `/${id}/attachments/${crypto.randomUUID()}`])
      expect((await request(path, {}, "")).status).toBe(401);
    await sql`UPDATE users SET role = 'user'`;
    expect((await request()).status).toBe(401);
  });
  test("rejects invalid dates, currency, prices, UUIDs and unsafe vendor links", async () => {
    for (const change of [
      { startDate: "2026-02-30" },
      { expiryDate: "2010-01-01" },
      { currency: "XYZ" },
      { initialPrice: "-1" },
      { renewalPrice: "1.234" },
      { serviceUrl: "javascript:alert(1)" },
      { reminderTime: "25:00" },
    ]) {
      const response = await request("/", {
        method: "POST",
        body: JSON.stringify({ ...input(), ...change }),
      });
      expect([400, 422]).toContain(response.status);
    }
    expect((await request("/invalid", { method: "DELETE" })).status).toBe(422);
  });
  test("attachments require correct parent and authentication; file signatures and limits are enforced", async () => {
    await create();
    const body = new FormData();
    body.set("file", new File(["private invoice"], "合同.txt"));
    const uploaded = await request(`/${id}/attachments`, { method: "POST", body });
    expect(uploaded.status).toBe(200);
    const attachment = (await uploaded.json()).item;
    const response = await request(`/${id}/attachments/${attachment.id}`);
    expect(response.headers.get("content-disposition")).toContain("attachment;");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).toBe("private invoice");
    expect((await request(`/${crypto.randomUUID()}/attachments/${attachment.id}`)).status).toBe(
      404,
    );
    const list = await (await request()).json();
    expect(list.items[0].attachments[0].fileName).toBe("合同.txt");
    expect(JSON.stringify(list)).not.toContain("private invoice");
    const fake = new FormData();
    fake.set("file", new File(["<script>alert(1)</script>"], "invoice.png"));
    expect((await request(`/${id}/attachments`, { method: "POST", body: fake })).status).toBe(400);
    expect(
      (await request(`/${id}/attachments/${attachment.id}`, { method: "DELETE" })).status,
    ).toBe(200);
  });
  test("queues once per expiry, catches up, sends despite unrelated comment preference being off", async () => {
    await create();
    await makeDue();
    await Promise.all([
      service.queueDueSubscriptionReminders(sql),
      service.queueDueSubscriptionReminders(sql),
    ]);
    const jobs = await sql`SELECT * FROM email_notification_jobs`;
    expect(jobs).toHaveLength(1);
    await notifications.processNextEmailNotification({ sql });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].body.subject).toContain("Subscription expiring");
    expect(deliveries[0].body.html).toContain("Domain &lt;example&gt;");
    expect(deliveries[0].body.text).toContain("USD 99.90");
    expect(deliveries[0].body.text).toContain("/admin/#subscriptions");
    await service.queueDueSubscriptionReminders(sql);
    expect(await notifications.processNextEmailNotification({ sql })).toBe(false);
  });
  test("does not queue early, expired, disabled or perpetual subscriptions", async () => {
    await create();
    await service.queueDueSubscriptionReminders(sql);
    expect(await sql`SELECT id FROM email_notification_jobs`).toHaveLength(0);
    await sql`UPDATE subscriptions SET expiry_date = (now() AT TIME ZONE 'Asia/Shanghai')::date - 1`;
    await service.queueDueSubscriptionReminders(sql);
    expect(await sql`SELECT id FROM email_notification_jobs`).toHaveLength(0);
    await makeDue();
    await sql`UPDATE subscriptions SET reminder_enabled = false`;
    await service.queueDueSubscriptionReminders(sql);
    expect(await sql`SELECT id FROM email_notification_jobs`).toHaveLength(0);
    await request(`/${id}`, {
      method: "PUT",
      body: JSON.stringify({ ...input(), renewalType: "perpetual" }),
    });
    const [item] = await sql`SELECT * FROM subscriptions`;
    expect(item.expiryDate).toBeNull();
    expect(item.reminderEnabled).toBe(false);
  });
  test("edits cancel queued source, renewal queues a new expiry, deletion cancels delivery", async () => {
    await create();
    await makeDue();
    await service.queueDueSubscriptionReminders(sql);
    await request(`/${id}`, { method: "PUT", body: JSON.stringify(input()) });
    expect(await notifications.processNextEmailNotification({ sql })).toBe(false);
    await makeDue();
    await service.queueDueSubscriptionReminders(sql);
    await request(`/${id}`, { method: "DELETE" });
    expect(await notifications.processNextEmailNotification({ sql })).toBe(false);
    expect(deliveries).toHaveLength(0);
  });
  test("failed delivery retries with stable idempotency and frozen message", async () => {
    await create();
    await makeDue();
    await service.queueDueSubscriptionReminders(sql);
    rejectMail = true;
    await notifications.processNextEmailNotification({ sql });
    await sql`UPDATE email_notification_jobs SET available_at = now()`;
    rejectMail = false;
    await notifications.processNextEmailNotification({ sql });
    expect(deliveries).toHaveLength(2);
    expect(deliveries[0]).toEqual(deliveries[1]);
    expect((await sql`SELECT status FROM email_notification_jobs`)[0].status).toBe("sent");
  });
  test("editing cannot replace an in-flight job and create a second reminder", async () => {
    await create();
    await makeDue();
    await service.queueDueSubscriptionReminders(sql);
    const [subscription] = await sql`SELECT expiry_date::text AS expiry_date FROM subscriptions`;
    await sql`UPDATE email_notification_jobs SET locked_until = now() + interval '1 minute'`;
    await request(`/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        ...input(),
        expiryDate: subscription.expiryDate,
        reminderTime: "00:00",
      }),
    });
    await service.queueDueSubscriptionReminders(sql);
    expect(await sql`SELECT id FROM email_notification_jobs WHERE status = 'pending'`).toHaveLength(
      1,
    );
    await sql`UPDATE email_notification_jobs SET locked_until = NULL`;
    await notifications.processNextEmailNotification({ sql });
    expect(deliveries).toHaveLength(0);
    await service.queueDueSubscriptionReminders(sql);
    await notifications.processNextEmailNotification({ sql });
    expect(deliveries).toHaveLength(1);
  });
  test("site timezone determines status and the exact reminder minute", async () => {
    await create();
    const [clock] =
      await sql`SELECT ((now() AT TIME ZONE 'Asia/Shanghai')::date + 1)::text AS tomorrow,
      to_char(now() AT TIME ZONE 'Asia/Shanghai' + interval '2 minutes', 'HH24:MI') AS future_time`;
    await sql`UPDATE subscriptions SET expiry_date = ${clock.tomorrow}, reminder_days = 1, reminder_time = ${clock.futureTime}`;
    // Skip the two-minute window around midnight, using tomorrow's reminder date instead.
    const [nearMidnight] =
      await sql`SELECT (now() AT TIME ZONE 'Asia/Shanghai')::time > time '23:57' AS value`;
    if (nearMidnight.value) await sql`UPDATE subscriptions SET reminder_days = 0`;
    await service.queueDueSubscriptionReminders(sql);
    expect(await sql`SELECT id FROM email_notification_jobs`).toHaveLength(0);
    await sql`UPDATE subscriptions SET reminder_time = '00:00', reminder_days = 1`;
    await service.queueDueSubscriptionReminders(sql);
    expect(await sql`SELECT id FROM email_notification_jobs`).toHaveLength(1);
    await sql`UPDATE subscriptions SET expiry_date = (now() AT TIME ZONE 'Asia/Shanghai')::date - 1`;
    expect((await service.listSubscriptions({ sql, status: "expired" })).total).toBe(1);
  });
  test("ExchangeRate key lives encrypted in Site Settings, blanks preserve it, cache exposes only rates", async () => {
    const current = await settings.getSiteSettings();
    const payload = {
      ...current,
      basics: {
        ...current.basics,
        resendApiKey: "",
        deeplApiKey: "",
        ipGeolocationApiKey: "",
        exchangeRateApiKey: "synthetic-rate-key",
      },
      storage: { ...current.storage, r2SecretAccessKey: "" },
    };
    const put = (body: unknown) =>
      app.handle(
        new Request("http://localhost/api/admin/settings/site", {
          method: "PUT",
          headers: { authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    expect((await put(payload)).status).toBe(200);
    const [stored] =
      await sql`SELECT encrypted_value FROM encrypted_settings WHERE key = 'exchange_rate_api_key'`;
    expect(stored.encryptedValue).not.toContain("synthetic-rate-key");
    expect((await settings.getSiteSettings()).basics.exchangeRateApiKeyConfigured).toBe(true);
    payload.basics.exchangeRateApiKey = "";
    expect((await put(payload)).status).toBe(200);
    expect(await settings.readEncryptedSetting("exchange_rate_api_key")).toBe("synthetic-rate-key");
    const first = await (await request("/exchange-rates")).json();
    const second = await (await request("/exchange-rates")).json();
    expect(first.item.rates.CNY).toBe(7);
    expect(second).toEqual(first);
    expect(rateCalls).toBe(1);
    expect(JSON.stringify(first)).not.toContain("synthetic-rate-key");
    expect(
      (
        await app.handle(
          new Request("http://localhost/api/admin/settings/site/api-keys/reveal", {
            method: "POST",
            headers: { authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ emailCode: "wrong-code" }),
          }),
        )
      ).status,
    ).toBe(400);
  });
  test("attachment count remains bounded under concurrent uploads and deletion cascades", async () => {
    await create();
    for (let index = 0; index < 9; index += 1)
      await sql`INSERT INTO subscription_attachments
      (subscription_id, file_name, content_type, file_size, content)
      VALUES (${id}, 'invoice.txt', 'application/octet-stream', 4, ${Buffer.from("text")})`;
    const upload = () => {
      const body = new FormData();
      body.set("file", new File(["invoice"], "invoice.txt"));
      return request(`/${id}/attachments`, { method: "POST", body });
    };
    const results = await Promise.all([upload(), upload()]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    const oversized = new FormData();
    oversized.set("file", new File([new Uint8Array(5242881)], "invoice.txt"));
    expect((await request(`/${id}/attachments`, { method: "POST", body: oversized })).status).toBe(
      422,
    );
    await request(`/${id}`, { method: "DELETE" });
    expect(await sql`SELECT id FROM subscription_attachments`).toHaveLength(0);
  });
  test("renewal after a sent reminder permits only the new expiry; demotion cancels pending mail", async () => {
    await create();
    await makeDue();
    await service.queueDueSubscriptionReminders(sql);
    await notifications.processNextEmailNotification({ sql });
    expect(deliveries).toHaveLength(1);
    const [date] = await sql`SELECT (expiry_date + 1)::text AS expiry_date FROM subscriptions`;
    await request(`/${id}`, {
      method: "PUT",
      body: JSON.stringify({ ...input(), expiryDate: date.expiryDate, reminderTime: "00:00" }),
    });
    await service.queueDueSubscriptionReminders(sql);
    await notifications.processNextEmailNotification({ sql });
    expect(deliveries).toHaveLength(2);
    await sql`UPDATE subscriptions SET expiry_date = expiry_date + 1`;
    await service.queueDueSubscriptionReminders(sql);
    await sql`UPDATE users SET role = 'user'`;
    await notifications.processNextEmailNotification({ sql });
    expect(deliveries).toHaveLength(2);
  });
  test("backup round-trip preserves private bytes without expanding binary data into JSON", async () => {
    await create();
    const body = new FormData();
    body.set("file", new File(["private invoice"], "invoice.txt"));
    expect((await request(`/${id}/attachments`, { method: "POST", body })).status).toBe(200);
    const { createBackupArchive } = await import("../src/admin/backup/service");
    const { readBackupZip } = await import("../src/admin/backup/archive");
    const { readBackupPayload } = await import("../src/admin/backup/payload");
    const backup = await createBackupArchive();
    const zip = await readBackupZip(new File([new Uint8Array(backup.data)], "backup.zip"));
    const dataText = zip.getEntry("data.json")!.getData().toString();
    expect(dataText).toContain('"subscription_id"');
    expect(dataText).not.toContain('"content":');
    const payload = await readBackupPayload(zip);
    expect(payload.data.tables.subscription_attachments[0].content).toBe(
      `\\x${Buffer.from("private invoice").toString("hex")}`,
    );
    expect(payload.data.tables.subscriptions[0].initial_price).toBe(1.2);
    const corrupt = zip
      .getEntries()
      .find((entry) => entry.entryName.startsWith("private/subscriptions/"))!;
    zip.updateFile(corrupt.entryName, Buffer.from("corrupt"));
    await expect(readBackupPayload(zip)).rejects.toThrow(
      "Private subscription attachment is invalid",
    );
  });
});
