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
    details: "taolei.net\nContract <details>",
    startDate: "2020-01-01",
    expiryDate: "2099-01-01",
    initialPrice: "1.20",
    renewalPrice: "99.90",
    initialCurrency: "HKD" as const,
    renewalCurrency: "USD" as const,
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
      reminder_days = 7, reminder_time = '00:00', reminder_times = ARRAY['00:00'::time] WHERE id = ${id}`;
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
    const { adminMediaRoutes } = await import("../src/admin/media/routes");
    app = new Elysia().use(adminSubscriptionRoutes).use(adminSettingsRoutes).use(adminMediaRoutes);
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

  test("creates the protected attachment folder lazily and protects an existing matching folder", async () => {
    await sql`DELETE FROM media_folders WHERE slug = 'subscription-attachments'`;
    const schema = await Bun.file(new URL("../src/shared/db/schema.sql", import.meta.url)).text();
    await sql.unsafe(schema);
    await sql.unsafe(schema);
    expect(await sql`SELECT id FROM media_folders WHERE slug = 'subscription-attachments'`).toHaveLength(0);
    await sql`INSERT INTO media_folders (name, slug, is_protected)
      VALUES ('Existing folder', 'subscription-attachments', false)`;
    await create();
    const body = new FormData();
    body.set("file", new File(["private invoice"], "invoice.txt"));
    expect((await request(`/${id}/attachments`, { method: "POST", body })).status).toBe(200);
    const [folder] = await sql`SELECT system_key, is_protected FROM media_folders WHERE slug = 'subscription-attachments'`;
    expect(folder).toEqual({ systemKey: "subscription-attachments", isProtected: true });
    expect(await sql`SELECT id FROM media_assets WHERE subscription_attachment_id IS NOT NULL`).toHaveLength(1);
  });
  test("persists validated multiple times through the service", async () => {
    const [user] = await sql`SELECT id FROM users LIMIT 1`;
    const saved = await service.saveSubscription({ userId: user.id, input: { ...input(), reminderTimes: ["18:30", "09:00"] }, sql });
    expect(saved.ok).toBe(true);
    expect((await service.listSubscriptions({ sql })).items[0].reminderTimes).toEqual(["09:00", "18:30"]);
  });
  test("CRUD, exact money, pagination, filters and no private bytes in list", async () => {
    await create();
    const response = await request("/?search=domain&category=domain&status=normal");
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.total).toBe(1);
    expect(result.items[0].initialPrice).toBe("1.20");
    expect(result.items[0].renewalPrice).toBe("99.90");
    expect(result.items[0].initialCurrency).toBe("HKD");
    expect(result.items[0].renewalCurrency).toBe("USD");
    expect(result.items[0].startDate).toBe("2020-01-01");
    expect(result.items[0].recipientEmail).toBe("admin@example.test");
    expect(JSON.stringify(result)).not.toContain("password_hash");
    expect(
      (
        await request(`/${id}`, {
          method: "PUT",
      body: JSON.stringify({ ...input(), name: "Changed", initialCurrency: "EUR", renewalCurrency: "JPY" }),
        })
      ).status,
    ).toBe(200);
    const updated = await (await request("/?search=Changed")).json();
    expect(updated.total).toBe(1);
    expect(updated.items[0].initialCurrency).toBe("EUR");
    expect(updated.items[0].renewalCurrency).toBe("JPY");
    expect((await request(`/${id}`, { method: "DELETE" })).status).toBe(200);
    expect((await (await request()).json()).total).toBe(0);
  });
  test("edits existing subscriptions with multiple times without losing attachments", async () => {
    await create();
    const body = new FormData();
    body.set("file", new File(["private invoice"], "invoice.txt"));
    expect((await request(`/${id}/attachments`, { method: "POST", body })).status).toBe(200);
    const listed = (await (await request()).json()).items[0];
    expect(listed.reminderTime).toBe("09:00:00");
    expect(listed.reminderTimes).toEqual(["09:00"]);
    expect(listed.attachments).toHaveLength(1);

    const { reminderTime, ...editable } = input();
    for (const reminderTimes of [["09:00", "10:00"], ["23:59"]]) {
      const response = await request(`/${id}`, {
        method: "PUT",
        body: JSON.stringify({ ...editable, reminderTimes }),
      });
      expect(response.status).toBe(200);
      const updated = (await (await request()).json()).items[0];
      expect(updated.reminderTimes).toEqual(reminderTimes);
      expect(updated.attachments).toEqual(listed.attachments);
      expect(updated.details).toBe(listed.details);
      expect(updated.initialPrice).toBe(listed.initialPrice);
      expect(updated.renewalPrice).toBe(listed.renewalPrice);
      expect(updated.initialCurrency).toBe(listed.initialCurrency);
      expect(updated.renewalCurrency).toBe(listed.renewalCurrency);
    }
  });
  test("unauthenticated and demoted sessions cannot access CRUD, rates or attachments", async () => {
    await create();
    for (const path of ["/", "/exchange-rates", `/${id}/attachments/${crypto.randomUUID()}`])
      expect((await request(path, {}, "")).status).toBe(401);
    await sql`UPDATE users SET role = 'user'`;
    expect((await request()).status).toBe(401);
  });
  test("legacy API inputs initialize both price currencies", async () => {
    const { initialCurrency, renewalCurrency, ...legacy } = input();
    expect((await request("/", {
      method: "POST", body: JSON.stringify({ ...legacy, currency: "EUR" }),
    })).status).toBe(200);
    const result = await (await request()).json();
    expect(result.items[0].initialCurrency).toBe("EUR");
    expect(result.items[0].renewalCurrency).toBe("EUR");
  });
  test("schema upgrades legacy currencies without overwriting independent selections on restart", async () => {
    await sql`ALTER TABLE subscriptions DROP COLUMN initial_currency, DROP COLUMN renewal_currency, DROP COLUMN reminder_times`;
    await sql`INSERT INTO subscriptions (name, category, start_date, expiry_date,
      initial_price, renewal_price, currency, renewal_type)
      VALUES ('Legacy', 'domain', '2020-01-01', '2099-01-01', 12.50, 25.00, 'GBP', 'manual')`;
    const schema = await Bun.file(new URL("../src/shared/db/schema.sql", import.meta.url)).text();
    await sql.unsafe(schema);
    const [migrated] = await sql`SELECT initial_currency, renewal_currency, initial_price::text, renewal_price::text FROM subscriptions`;
    expect(migrated).toMatchObject({ initialCurrency: "GBP", renewalCurrency: "GBP", initialPrice: "12.50", renewalPrice: "25.00" });
    await sql`UPDATE subscriptions SET initial_currency = 'EUR', renewal_currency = 'JPY'`;
    await sql.unsafe(schema);
    const [restarted] = await sql`SELECT initial_currency, renewal_currency FROM subscriptions`;
    expect(restarted).toEqual({ initialCurrency: "EUR", renewalCurrency: "JPY" });
    await expect(sql`UPDATE subscriptions SET initial_currency = 'XYZ'`.then((rows) => rows)).rejects.toThrow();
    await expect(sql`UPDATE subscriptions SET renewal_currency = 'XYZ'`.then((rows) => rows)).rejects.toThrow();
  });
  test("rejects invalid dates, currency, prices, UUIDs and unsafe vendor links", async () => {
    for (const change of [
      { startDate: "2026-02-30" },
      { expiryDate: "2010-01-01" },
      { currency: "XYZ" },
      { initialCurrency: "XYZ" },
      { renewalCurrency: "XYZ" },
      { initialCurrency: undefined },
      { renewalCurrency: undefined },
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
  test("queues once per date/time, catches up today, sends despite unrelated comment preference being off", async () => {
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
    expect(deliveries[0].body.text).toContain("Details: taolei.net\nContract <details>");
    expect(deliveries[0].body.html).toContain("Contract &lt;details&gt;");
    expect(deliveries[0].body.text).toContain("/admin/#subscriptions");
    await service.queueDueSubscriptionReminders(sql);
    expect(await notifications.processNextEmailNotification({ sql })).toBe(false);
  });
  test("does not queue early, disabled or perpetual subscriptions", async () => {
    await create();
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
    await sql`UPDATE subscriptions SET expiry_date = ${clock.tomorrow}, reminder_days = 1, reminder_time = ${clock.futureTime}, reminder_times = ARRAY[${clock.futureTime}::time]`;
    // Skip the two-minute window around midnight, using tomorrow's reminder date instead.
    const [nearMidnight] =
      await sql`SELECT (now() AT TIME ZONE 'Asia/Shanghai')::time > time '23:57' AS value`;
    if (nearMidnight.value) await sql`UPDATE subscriptions SET reminder_days = 0`;
    await service.queueDueSubscriptionReminders(sql);
    expect(await sql`SELECT id FROM email_notification_jobs`).toHaveLength(0);
    await sql`UPDATE subscriptions SET reminder_time = '00:00', reminder_times = ARRAY['00:00'::time], reminder_days = 1`;
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
    expect(await sql`SELECT id FROM media_assets WHERE subscription_attachment_id IS NOT NULL`).toHaveLength(0);
  });
  test("private subscription attachments appear in a fixed media folder with synchronized rename and deletion", async () => {
    await create();
    const file = new FormData();
    file.set("file", new File(["private invoice"], "invoice.txt"));
    expect((await request(`/${id}/attachments`, { method: "POST", body: file })).status).toBe(200);
    const mediaRequest = (path: string, init: RequestInit = {}, auth = token) => app.handle(new Request(`http://localhost/api/admin/media${path}`, {
      ...init, headers: { ...(auth ? { authorization: `Bearer ${auth}` } : {}),
        ...(typeof init.body === "string" ? { "Content-Type": "application/json" } : {}) },
    }));
    const folders = await (await mediaRequest("/folders")).json();
    const folder = folders.folders.find((item: { slug: string }) => item.slug === "subscription-attachments");
    expect(folder.isProtected).toBe(true);
    expect(folder.fileCount).toBe(1);
    expect((await mediaRequest(`/folders/${folder.id}`, { method: "DELETE" })).status).toBe(400);
    const list = await (await mediaRequest("?folderSlug=subscription-attachments")).json();
    const asset = list.media[0];
    expect(asset.fileName).toBe("invoice.txt");
    expect(asset.accessUrl).toBe(`/api/admin/media/${asset.id}/download`);
    expect(asset.accessUrl).not.toContain("/uploads/");
    const picker = await (await mediaRequest("?excludePrivate=true")).json();
    expect(picker.media).toHaveLength(0);
    expect(picker.pageInfo.totalItems).toBe(0);
    expect((await mediaRequest(`/${asset.id}/download`, {}, "")).status).toBe(401);
    const download = await mediaRequest(`/${asset.id}/download`);
    expect(download.headers.get("cache-control")).toBe("private, no-store");
    expect(await download.text()).toBe("private invoice");
    expect((await mediaRequest(`/${asset.id}`, { method: "PATCH", body: JSON.stringify({ fileName: "contract.txt" }) })).status).toBe(200);
    const renamed = await (await request()).json();
    expect(renamed.items[0].attachments[0].fileName).toBe("contract.txt");
    const forbidden = new FormData();
    forbidden.set("file", new File(["private"], "contract.txt"));
    forbidden.set("folderSlug", "subscription-attachments");
    expect((await mediaRequest("", { method: "POST", body: forbidden })).status).toBe(400);
    expect((await mediaRequest(`/${asset.id}`, { method: "DELETE" })).status).toBe(200);
    expect(await sql`SELECT id FROM subscription_attachments`).toHaveLength(0);
    expect(await sql`SELECT id FROM media_assets WHERE id = ${asset.id}`).toHaveLength(0);
  });
  test("existing private attachments are indexed once on upgrade", async () => {
    await create();
    await sql`DROP TRIGGER subscription_attachment_media_sync ON subscription_attachments`;
    const [file] = await sql`INSERT INTO subscription_attachments (subscription_id, file_name, content_type, file_size, content)
      VALUES (${id}, 'legacy.txt', 'application/octet-stream', 7, ${Buffer.from("invoice")}) RETURNING id`;
    const schema = await Bun.file(new URL("../src/shared/db/schema.sql", import.meta.url)).text();
    await sql.unsafe(schema);
    await sql.unsafe(schema);
    expect(await sql`SELECT id FROM media_assets WHERE subscription_attachment_id = ${file.id}`).toHaveLength(1);
    await request(`/${id}/attachments/${file.id}`, { method: "DELETE" });
    expect(await sql`SELECT id FROM media_assets WHERE subscription_attachment_id = ${file.id}`).toHaveLength(0);
  });
  test("image attachments retain authenticated image downloads without a public storage object", async () => {
    await create();
    const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9WQAAAAASUVORK5CYII=", "base64");
    const body = new FormData();
    body.set("file", new File([bytes], "invoice.png"));
    const response = await request(`/${id}/attachments`, { method: "POST", body });
    expect(response.status).toBe(200);
    const { item } = await response.json();
    const [asset] = await sql`SELECT file_type, file_format, storage_key FROM media_assets WHERE subscription_attachment_id = ${item.id}`;
    expect(asset).toEqual({ fileType: "image", fileFormat: "png", storageKey: null });
    const url = `http://localhost/api/admin/media/${item.id}/download`;
    const download = await app.handle(new Request(url, { headers: { authorization: `Bearer ${token}` } }));
    expect(download.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await download.arrayBuffer())).toEqual(bytes);
    expect((await app.handle(new Request(url))).status).toBe(401);
    await sql`UPDATE users SET role = 'user'`;
    expect((await app.handle(new Request(url, { headers: { authorization: `Bearer ${token}` } }))).status).toBe(401);
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
  test("sends at each 24-hour time every day through expiry, without historical-day catch-up or concurrent duplicates", async () => {
    const response = await request("/", { method: "POST", body: JSON.stringify({ ...input(), expiryDate: "2026-10-23", reminderTimes: ["18:30", "09:00", "12:00", "09:00"] }) });
    expect(response.status).toBe(200);
    id = (await response.json()).id;
    expect((await (await request()).json()).items[0].reminderTimes).toEqual(["09:00", "12:00", "18:30"]);
    const tick = async (time: string) => {
      await Promise.all([service.queueDueSubscriptionReminders(sql, new Date(time)), service.queueDueSubscriptionReminders(sql, new Date(time))]);
    };
    await tick("2026-10-16T08:59:00+08:00");
    expect(await sql`SELECT id FROM email_notification_jobs`).toHaveLength(0);
    await tick("2026-10-16T09:00:00+08:00");
    expect(await sql`SELECT id FROM email_notification_jobs`).toHaveLength(1);
    await tick("2026-10-16T12:00:00+08:00");
    expect(await sql`SELECT id FROM email_notification_jobs`).toHaveLength(2);
    await tick("2026-10-16T18:30:00+08:00");
    expect(await sql`SELECT id FROM email_notification_jobs`).toHaveLength(3);
    await tick("2026-10-17T09:00:00+08:00");
    expect(await sql`SELECT id FROM email_notification_jobs`).toHaveLength(4);
    await tick("2026-10-22T18:30:00+08:00");
    const rows = await sql`SELECT subscription_reminder_date::text AS day FROM email_notification_jobs ORDER BY subscription_reminder_date, subscription_reminder_time`;
    expect(rows.map((row) => row.day)).toEqual(["2026-10-16", "2026-10-16", "2026-10-16", "2026-10-17", "2026-10-22", "2026-10-22", "2026-10-22"]);
    await tick("2026-10-23T18:30:00+08:00");
    expect(await sql`SELECT id FROM email_notification_jobs WHERE subscription_reminder_date = '2026-10-23'`).toHaveLength(3);
    await sql`UPDATE subscriptions SET reminder_enabled = false`;
    await tick("2026-10-24T18:30:00+08:00");
    expect(await sql`SELECT id FROM email_notification_jobs WHERE subscription_reminder_final`).toHaveLength(0);
  });
  test("sends exactly one final expired-service email, regardless of later times, dates or retries", async () => {
    await create();
    await sql`UPDATE subscriptions SET expiry_date = (now() AT TIME ZONE 'Asia/Shanghai')::date - 1,
      reminder_times = ARRAY['00:00'::time, '12:00'::time, '18:30'::time]`;
    await Promise.all([service.queueDueSubscriptionReminders(sql), service.queueDueSubscriptionReminders(sql)]);
    const [job] = await sql`SELECT subscription_reminder_final, subscription_reminder_time::text AS time FROM email_notification_jobs`;
    expect(job).toEqual({ subscriptionReminderFinal: true, time: "00:00:00" });
    rejectMail = true;
    await notifications.processNextEmailNotification({ sql });
    await service.queueDueSubscriptionReminders(sql, new Date("2099-01-01T23:59:00+08:00"));
    expect(await sql`SELECT id FROM email_notification_jobs`).toHaveLength(1);
    rejectMail = false;
    await sql`UPDATE email_notification_jobs SET available_at = now()`;
    await notifications.processNextEmailNotification({ sql });
    expect(deliveries).toHaveLength(2);
    expect(deliveries[0]).toEqual(deliveries[1]);
    expect(deliveries[1].body.subject).toContain("Subscription expired");
    expect(deliveries[1].body.text).toContain("Status: Expired");
    await service.queueDueSubscriptionReminders(sql, new Date("2099-01-02T23:59:00+08:00"));
    expect(await sql`SELECT id FROM email_notification_jobs`).toHaveLength(1);
  });
  test("disabling reminders cancels every unsent time slot", async () => {
    await create();
    await makeDue();
    await sql`UPDATE subscriptions SET reminder_times = ARRAY['00:00'::time, '00:01'::time]`;
    await service.queueDueSubscriptionReminders(sql);
    const result = await request(`/${id}`, { method: "PUT", body: JSON.stringify({ ...input(), reminderEnabled: false, reminderTimes: ["09:00", "18:30"] }) });
    expect(result.status).toBe(200);
    expect(await notifications.processNextEmailNotification({ sql })).toBe(false);
    expect(await sql`SELECT id FROM email_notification_jobs WHERE status = 'pending'`).toHaveLength(0);
    expect(deliveries).toHaveLength(0);
  });
  test("migrates legacy single-time settings and sent jobs idempotently without resending today's reminder", async () => {
    await create();
    await makeDue();
    await service.queueDueSubscriptionReminders(sql);
    await notifications.processNextEmailNotification({ sql });
    expect(deliveries).toHaveLength(1);
    await sql`ALTER TABLE subscriptions ALTER COLUMN reminder_times DROP NOT NULL`;
    await sql`ALTER TABLE email_notification_jobs DROP CONSTRAINT email_notification_jobs_check`;
    await sql`UPDATE subscriptions SET reminder_times = NULL`;
    await sql`UPDATE email_notification_jobs SET subscription_reminder_date = NULL, subscription_reminder_time = NULL`;
    const schema = await Bun.file(new URL("../src/shared/db/schema.sql", import.meta.url)).text();
    await sql.unsafe(schema);
    await sql.unsafe(schema);
    expect((await (await request()).json()).items[0].reminderTimes).toEqual(["00:00"]);
    await service.queueDueSubscriptionReminders(sql);
    expect(await sql`SELECT id FROM email_notification_jobs`).toHaveLength(1);
  });
  test("backup round-trip preserves private bytes without expanding binary data into JSON", async () => {
    await create();
    await sql`UPDATE subscriptions SET reminder_times = ARRAY['09:00'::time, '18:30'::time]`;
    const body = new FormData();
    body.set("file", new File(["private invoice"], "invoice.txt"));
    expect((await request(`/${id}/attachments`, { method: "POST", body })).status).toBe(200);
    const { createBackupArchive, importBackupArchive } = await import("../src/admin/backup/service");
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
    expect(payload.data.tables.subscriptions[0].initial_currency).toBe("HKD");
    expect(payload.data.tables.subscriptions[0].renewal_currency).toBe("USD");
    expect(payload.data.tables.media_assets).toHaveLength(0);
    await importBackupArchive({ file: new File([new Uint8Array(backup.data)], "backup.zip") });
    const [restored] = await sql`SELECT initial_currency, renewal_currency, reminder_enabled FROM subscriptions`;
    expect(restored).toEqual({ initialCurrency: "HKD", renewalCurrency: "USD", reminderEnabled: false });
    expect((await service.listSubscriptions({ sql })).items[0].reminderTimes).toEqual(["09:00", "18:30"]);
    expect(await sql`SELECT id FROM media_assets WHERE subscription_attachment_id IS NOT NULL`).toHaveLength(1);
    const rawData: typeof payload.data = JSON.parse(dataText);
    for (const row of rawData.tables.subscriptions) {
      delete row.initial_currency;
      delete row.renewal_currency;
      delete row.reminder_times;
    }
    zip.updateFile("data.json", Buffer.from(JSON.stringify(rawData)));
    await importBackupArchive({ file: new File([new Uint8Array(zip.toBuffer())], "legacy.zip") });
    const [legacy] = await sql`SELECT initial_currency, renewal_currency, reminder_enabled FROM subscriptions`;
    expect(legacy).toEqual({ initialCurrency: "HKD", renewalCurrency: "HKD", reminderEnabled: false });
    expect((await service.listSubscriptions({ sql })).items[0].reminderTimes).toEqual(["09:00"]);
    const corrupt = zip
      .getEntries()
      .find((entry) => entry.entryName.startsWith("private/subscriptions/"))!;
    zip.updateFile(corrupt.entryName, Buffer.from("corrupt"));
    await expect(readBackupPayload(zip)).rejects.toThrow(
      "Private subscription attachment is invalid",
    );
  });
});
