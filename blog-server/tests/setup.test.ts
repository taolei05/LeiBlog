import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  completeSetup,
  configureAdmin,
  configureFiling,
  configureSiteConfig,
  configureSiteInfo,
  getSetupStatus,
} from "../src/admin/setup/service";
import { decryptSecret, type EncryptedSecret } from "../src/shared/crypto";
import { verifyPassword } from "../src/shared/auth";

const POSTGRES_ADMIN_URL =
  process.env.TEST_POSTGRES_ADMIN_URL ??
  "postgres://taolei:12345678@localhost:5432/postgres";

const TEST_SECRET = "setup-test-secret";
const dbName = `lei_blog_setup_test_${Date.now()}`;
const adminDb = new Bun.SQL(POSTGRES_ADMIN_URL, { max: 1 });
let setupDb: Bun.SQL;

beforeAll(async () => {
  await adminDb.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await adminDb.unsafe(`CREATE DATABASE ${dbName}`);

  setupDb = new Bun.SQL(
    `postgres://taolei:12345678@localhost:5432/${dbName}`,
    { max: 1 }
  );

  const migration = readFileSync(
    join(import.meta.dir, "../src/db/migrations/001_initial_schema.sql"),
    "utf8"
  );
  await setupDb.unsafe(migration);
});

afterAll(async () => {
  await setupDb?.close({ timeout: 1 });
  await adminDb.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await adminDb.close({ timeout: 1 });
});

describe("admin setup service", () => {
  test("runs the first setup flow and stores secrets encrypted", async () => {
    const initial = await getSetupStatus({ client: setupDb });
    expect(initial.isCompleted).toBe(false);
    expect(initial.currentStep).toBe("admin");

    const afterAdmin = await configureAdmin(
      {
        username: "admin",
        password: "12345678",
        email: "admin@example.com",
        name: "站长",
        tags: ["作者", "作者", "管理员"],
        description: "LeiBlog 管理员",
        avatarUrl: "https://example.com/avatar.png",
      },
      { client: setupDb }
    );
    expect(afterAdmin.currentStep).toBe("site-info");

    const [admin] = await setupDb<{
      username: string;
      password_hash: string;
      tags: string[];
      role: string;
    }[]>`
      SELECT username, password_hash, tags, role
      FROM users
      WHERE role = 'admin'
    `;
    expect(admin.username).toBe("admin");
    expect(admin.password_hash).not.toBe("12345678");
    expect(admin.tags).toEqual(["作者", "管理员"]);
    expect(await verifyPassword("12345678", admin.password_hash)).toBe(true);

    const afterSiteInfo = await configureSiteInfo(
      {
        siteName: "LeiBlog",
        description: "极简主义博客",
        logoDarkUrl: "https://example.com/logo-dark.png",
        logoLightUrl: "https://example.com/logo-light.png",
        faviconUrl: "https://example.com/favicon.ico",
        establishedAt: "2026-05-15T18:00:00+08:00",
      },
      { client: setupDb }
    );
    expect(afterSiteInfo.currentStep).toBe("site-config");

    const afterSiteConfig = await configureSiteConfig(
      {
        seoTitle: "LeiBlog",
        seoDescription: "个人博客",
        seoKeywords: ["博客", "React", "Elysia"],
        copyright: "Copyright LeiBlog",
        resendDomain: "mail.example.com",
        resendApiKey: "resend-secret",
        deeplApiKey: "deepl-secret",
        ipgeolocationApiKey: "ip-secret",
        commentsEnabled: true,
      },
      { client: setupDb, secret: TEST_SECRET }
    );
    expect(afterSiteConfig.currentStep).toBe("filing");

    const [siteConfig] = await setupDb<{
      seo_keywords: string[];
      resend_api_key_encrypted: EncryptedSecret;
    }[]>`
      SELECT seo_keywords, resend_api_key_encrypted
      FROM site_config
      WHERE id = 1
    `;
    expect(siteConfig.seo_keywords).toEqual(["博客", "React", "Elysia"]);
    expect(JSON.stringify(siteConfig.resend_api_key_encrypted)).not.toContain(
      "resend-secret"
    );
    expect(
      decryptSecret(siteConfig.resend_api_key_encrypted, TEST_SECRET)
    ).toBe("resend-secret");

    const afterFiling = await configureFiling(
      {
        icpNumber: "京ICP备00000000号",
        icpUrl: "https://beian.miit.gov.cn/",
        policeNumber: "京公网安备00000000000000号",
        policeUrl: "https://www.beian.gov.cn/",
      },
      { client: setupDb }
    );
    expect(afterFiling.currentStep).toBe("complete");

    const completed = await completeSetup({ client: setupDb });
    expect(completed.isCompleted).toBe(true);
    expect(completed.currentStep).toBe("completed");
    expect(typeof completed.completedAt).toBe("string");

    await expect(
      configureSiteInfo(
        {
          siteName: "Blocked",
          establishedAt: "2026-05-15T18:00:00+08:00",
        },
        { client: setupDb }
      )
    ).rejects.toThrow("首次配置已完成");
  });
});
