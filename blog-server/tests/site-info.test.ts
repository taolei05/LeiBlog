import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  getSystemSiteInfo,
  updateSystemSiteInfo,
  type SystemSiteInfoInput,
} from "../src/admin/system/service";
import { getPublicSiteInfo } from "../src/public/site/service";
import { type AuthUser } from "../src/shared/auth";
import { clearSiteCache } from "../src/shared/cache/content";
import { createMigratedTestDatabase, type TestDatabase } from "./helpers/database";

let testDatabase: TestDatabase;
let testDb: Bun.SQL;

const currentAdmin: AuthUser = {
  avatarUrl: null,
  email: "admin@example.com",
  id: "00000000-0000-0000-0000-000000000001",
  name: null,
  role: "admin",
  username: "admin",
};

beforeAll(async () => {
  testDatabase = await createMigratedTestDatabase("lei_blog_site_info_test");
  testDb = new Bun.SQL(testDatabase.databaseUrl, { max: 1 });
  await clearSiteCache();
});

afterAll(async () => {
  await clearSiteCache();
  await testDb?.close({ timeout: 1 });
  await testDatabase?.drop();
});

describe("site info settings", () => {
  test("saves multiple homepage cover URLs and keeps the legacy cover field in sync", async () => {
    const saved = await updateSystemSiteInfo(
      currentAdmin,
      {
        description: "多封面测试站点",
        establishedAt: "2026-06-05T12:00:00.000Z",
        homeCoverUrl: "/uploads/site/legacy.jpg",
        homeCoverUrls: [
          " /uploads/site/cover-a.jpg ",
          "",
          "/uploads/site/cover-b.jpg",
          "/uploads/site/cover-a.jpg",
        ],
        siteName: "LeiBlog Multi Cover",
      } as SystemSiteInfoInput & { homeCoverUrls: string[] },
      testDb
    );

    expect(saved.item?.homeCoverUrl).toBe("/uploads/site/cover-a.jpg");
    expect((saved.item as { homeCoverUrls?: string[] } | null)?.homeCoverUrls).toEqual([
      "/uploads/site/cover-a.jpg",
      "/uploads/site/cover-b.jpg",
    ]);

    const adminInfo = await getSystemSiteInfo(currentAdmin, testDb);
    expect((adminInfo.item as { homeCoverUrls?: string[] } | null)?.homeCoverUrls).toEqual([
      "/uploads/site/cover-a.jpg",
      "/uploads/site/cover-b.jpg",
    ]);

    const publicInfo = await getPublicSiteInfo(testDb);
    expect(publicInfo.homeCoverUrl).toBe("/uploads/site/cover-a.jpg");
    expect((publicInfo as { homeCoverUrls?: string[] }).homeCoverUrls).toEqual([
      "/uploads/site/cover-a.jpg",
      "/uploads/site/cover-b.jpg",
    ]);
  });

  test("uses the legacy homepage cover URL when no cover array is supplied", async () => {
    const saved = await updateSystemSiteInfo(
      currentAdmin,
      {
        description: "兼容旧封面字段",
        establishedAt: "2026-06-05T12:00:00.000Z",
        homeCoverUrl: " /uploads/site/legacy-only.jpg ",
        siteName: "LeiBlog Legacy Cover",
      },
      testDb
    );

    expect(saved.item?.homeCoverUrl).toBe("/uploads/site/legacy-only.jpg");
    expect((saved.item as { homeCoverUrls?: string[] } | null)?.homeCoverUrls).toEqual([
      "/uploads/site/legacy-only.jpg",
    ]);
  });
});
