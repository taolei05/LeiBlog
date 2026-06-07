import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  completeSetup,
  configureAdmin,
  configureFiling,
  configureSiteConfig,
  configureSiteInfo,
  getSetupStatus,
  requireSetupToken,
} from "../src/admin/setup/service";
import type { EncryptedSecret } from "../src/shared/crypto";
import { hashPassword, verifyPassword } from "../src/shared/auth";
import { decryptSecret } from "../src/shared/crypto";

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

  const migrationsDir = join(import.meta.dir, "../src/db/migrations");
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    await setupDb.unsafe(readFileSync(join(migrationsDir, file), "utf8"));
  }
});

afterAll(async () => {
  await setupDb?.close({ timeout: 1 });
  await adminDb.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await adminDb.close({ timeout: 1 });
});

describe("admin setup service", () => {
  test("requires the configured setup token", () => {
    expect(() => requireSetupToken(undefined, "required-token")).toThrow(
      "初始化令牌无效"
    );
    expect(() => requireSetupToken("wrong-token", "required-token")).toThrow(
      "初始化令牌无效"
    );
    expect(() => requireSetupToken("required-token", "required-token")).not.toThrow();
    expect(() => requireSetupToken(undefined, null)).not.toThrow();
  });

  test("treats an existing admin user as completed setup for legacy databases", async () => {
    const passwordHash = await hashPassword("12345678");

    await setupDb`
      INSERT INTO users (username, password_hash, role)
      VALUES ('legacy-admin', ${passwordHash}, 'admin')
    `;
    await setupDb`
      UPDATE setup_state
      SET is_completed = false,
          current_step = 'admin',
          completed_at = null
      WHERE id = 1
    `;

    try {
      const status = await getSetupStatus({ client: setupDb });

      expect(status.isCompleted).toBe(true);
      expect(status.currentStep).toBe("completed");

      const [setupState] = await setupDb<{
        current_step: string;
        is_completed: boolean;
      }[]>`
        SELECT is_completed, current_step
        FROM setup_state
        WHERE id = 1
      `;
      expect(setupState.is_completed).toBe(true);
      expect(setupState.current_step).toBe("completed");
    } finally {
      await setupDb`
        DELETE FROM users
        WHERE username = 'legacy-admin'
      `;
      await setupDb`
        UPDATE setup_state
        SET is_completed = false,
            current_step = 'admin',
            completed_at = null
        WHERE id = 1
      `;
    }
  });

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
    await expect(
      configureAdmin(
        {
          username: "attacker",
          password: "attacker-password",
        },
        { client: setupDb }
      )
    ).rejects.toThrow("管理员配置已完成");

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
        homeCoverUrls: [
          "https://example.com/home-cover-a.jpg",
          "https://example.com/home-cover-b.jpg",
        ],
        homeSlogan: "写给首页的第一句话。",
        establishedAt: "2026-05-15T18:00:00+08:00",
      },
      { client: setupDb }
    );
    expect(afterSiteInfo.currentStep).toBe("site-config");

    const [siteInfo] = await setupDb<{
      home_cover_urls: string[];
      home_slogan: string;
    }[]>`
      SELECT home_cover_urls, home_slogan
      FROM site_info
      WHERE id = 1
    `;
    expect(siteInfo.home_cover_urls).toEqual([
      "https://example.com/home-cover-a.jpg",
      "https://example.com/home-cover-b.jpg",
    ]);
    expect(siteInfo.home_slogan).toBe("写给首页的第一句话。");

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
        icpRecords: [
          { number: "京ICP备00000000号-1", url: "https://beian.miit.gov.cn/" },
          { number: "京ICP备00000000号-2", url: "https://beian.example.com/two" },
        ],
        policeNumber: "京公网安备00000000000000号",
        policeUrl: "https://www.beian.gov.cn/",
      },
      { client: setupDb }
    );
    expect(afterFiling.currentStep).toBe("complete");

    const [filing] = await setupDb<{ icp_records: string }[]>`
      SELECT icp_records
      FROM site_filing
      WHERE id = 1
    `;
    expect(JSON.parse(filing.icp_records)).toEqual([
      { number: "京ICP备00000000号-1", url: "https://beian.miit.gov.cn/" },
      { number: "京ICP备00000000号-2", url: "https://beian.example.com/two" },
    ]);

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
