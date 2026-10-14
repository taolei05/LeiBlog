import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import postgres from "postgres";

import { readBlogUserProfileById } from "../src/blog/auth/service";
import { readUserLoginInfo, recordLoginAttempt } from "../src/shared/login-metadata";

const databaseUrl = Bun.env.AUTH_TEST_DATABASE_URL;
const suite = databaseUrl === undefined ? describe.skip : describe;

suite("login metadata round-trip with isolated PostgreSQL", () => {
  const sql = postgres(databaseUrl ?? "postgres://localhost/login_metadata_unused", {
    max: 5,
    transform: postgres.camel,
    onnotice: () => {},
  });
  const countryName = new Intl.DisplayNames(["zh-CN"], { type: "region" }).of("CN");
  const englishCountryName = new Intl.DisplayNames(["en"], { type: "region" }).of("CN");
  const meta = {
    ip: "203.0.113.9",
    countryCode: "CN",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/154.0.0.0 Safari/537.36",
  };
  let userId: string;

  beforeAll(async () => {
    const database = new URL(databaseUrl ?? "");
    if (
      !database.pathname.startsWith("/leiblog_test_") ||
      !["localhost", "127.0.0.1"].includes(database.hostname)
    ) {
      throw new Error("Login metadata tests require a disposable local leiblog_test_ database.");
    }
    await sql.unsafe(
      await Bun.file(new URL("../src/shared/db/schema.sql", import.meta.url)).text(),
    );
  });

  beforeEach(async () => {
    await sql`TRUNCATE users, login_audit_logs, encrypted_settings CASCADE`;
    userId = crypto.randomUUID();
    await sql`
      INSERT INTO users (id, username, email, password_hash)
      VALUES (${userId}, ${userId}, ${`${userId}@example.test`}, 'unused-test-password-hash')
    `;
  });

  afterAll(async () => {
    await sql.end();
  });

  test("new login records persist JSON objects and survive both profile readers", async () => {
    await sql.begin(async (transaction) => {
      await recordLoginAttempt({
        loginMethod: "password",
        meta,
        sql: transaction,
        success: true,
        timeZone: "Asia/Shanghai",
        userId,
      });
    });
    const [stored] = await sql`
      SELECT jsonb_typeof(last_login_location) AS location_type, jsonb_typeof(last_login_device) AS device_type
      FROM users WHERE id = ${userId}
    `;
    expect(stored).toEqual({ locationType: "object", deviceType: "object" });
    const [audit] =
      await sql`SELECT jsonb_typeof(location) AS location_type, jsonb_typeof(device) AS device_type FROM login_audit_logs WHERE user_id = ${userId}`;
    expect(audit).toEqual({ locationType: "object", deviceType: "object" });
    const info = await readUserLoginInfo({ sql, userId });
    expect(info.lastLoginLocation).toBe(countryName ?? null);
    expect(info.lastLoginLocationEn).toBe(englishCountryName ?? null);
    expect(info.lastLoginDevice).toBe("macOS / Chrome 154");
    expect(info.recentLogins[0]?.location).toBe(info.lastLoginLocation);
    expect(info.recentLogins[0]?.locationEn).toBe(englishCountryName ?? null);
    expect(info.recentLogins[0]?.device).toBe(info.lastLoginDevice);
    const profile = await readBlogUserProfileById({ sql, userId });
    expect(profile.lastLoginLocation).toBe(info.lastLoginLocation);
    expect(profile.lastLoginLocationEn).toBe(englishCountryName ?? null);
    expect(profile.lastLoginDevice).toBe(info.lastLoginDevice);
  });

  test("existing encoded records display correctly without rewriting historical data", async () => {
    const location = JSON.stringify({ country_name: "中国", state_prov: "山东省", city: "济南市" });
    const device = JSON.stringify({ userAgent: meta.userAgent });
    const recordedAt = new Date("2026-10-01T12:00:00Z");
    await sql`
      UPDATE users SET last_login_at = ${recordedAt}, last_login_ip = ${meta.ip}, last_login_location = ${sql.json(location)}, last_login_device = ${sql.json(device)}
      WHERE id = ${userId}
    `;
    await sql`
      INSERT INTO login_audit_logs (user_id, ip, location, device, success)
      VALUES (${userId}, ${meta.ip}, ${sql.json(location)}, ${sql.json(device)}, true)
    `;
    const info = await readUserLoginInfo({ sql, userId });
    expect(info.lastLoginLocation).toBe("中国 山东省 济南市");
    expect(info.recentLogins[0]?.location).toBe(info.lastLoginLocation);
    expect(info.lastLoginDevice).toBe("macOS / Chrome 154");
    expect(info.lastLoginIp).toBe(meta.ip);
    expect(info.lastLoginAt).toBe(recordedAt.toISOString());
    expect((await readBlogUserProfileById({ sql, userId })).lastLoginLocation).toBe(
      info.lastLoginLocation,
    );
    const [stored] =
      await sql`SELECT jsonb_typeof(last_login_location) AS location_type FROM users WHERE id = ${userId}`;
    expect(stored.locationType).toBe("string");
  });

  test("reads bilingual historical JSON metadata without changing stored records", async () => {
    const location = { location: "日本东京", location_en: "Tokyo, Japan" };
    await sql`UPDATE users SET last_login_location = ${sql.json(location)} WHERE id = ${userId}`;
    await sql`INSERT INTO login_audit_logs (user_id, location, success) VALUES (${userId}, ${sql.json(location)}, true)`;
    const info = await readUserLoginInfo({ sql, userId });
    expect(info.lastLoginLocation).toBe("日本东京");
    expect(info.lastLoginLocationEn).toBe("Tokyo, Japan");
    expect(info.recentLogins[0]?.locationEn).toBe("Tokyo, Japan");
    const profile = await readBlogUserProfileById({ sql, userId });
    expect(profile.lastLoginLocationEn).toBe("Tokyo, Japan");
    const [row] = await sql`SELECT last_login_location::text AS payload FROM users WHERE id = ${userId}`;
    expect(JSON.parse(row.payload)).toEqual(location);
  });

  test("missing locations stay SQL NULL and failed attempts do not change the latest login", async () => {
    await recordLoginAttempt({
      loginMethod: "password",
      meta: { ...meta, ip: "192.168.1.2" },
      sql,
      success: true,
      timeZone: "Asia/Shanghai",
      userId,
    });
    const [stored] =
      await sql`SELECT last_login_location IS NULL AS missing FROM users WHERE id = ${userId}`;
    expect(stored.missing).toBe(true);
    await recordLoginAttempt({
      loginMethod: "password",
      meta,
      sql,
      success: false,
      timeZone: "Asia/Shanghai",
      userId,
    });
    const info = await readUserLoginInfo({ sql, userId });
    expect(info.lastLoginIp).toBe("192.168.1.2");
    expect(info.lastLoginLocation).toBeNull();
    expect(info.recentLogins[0]?.success).toBe(false);
    expect(info.recentLogins[0]?.location).toBeNull();
  });
});
