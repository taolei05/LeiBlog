import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  getSystemSiteInfo,
  updateSystemSiteInfo,
} from "../src/admin/system/service";
import { getPublicSiteInfo } from "../src/public/site/service";
import type { AuthUser } from "../src/shared/auth";
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
});

afterAll(async () => {
  await testDb?.close({ timeout: 1 });
  await testDatabase?.drop();
});

describe("site info settings", () => {
  test("does not keep the legacy homepage cover column after migrations", async () => {
    const [row] = await testDb<{ column_count: string }[]>`
      SELECT count(*) AS column_count
      FROM information_schema.columns
      WHERE table_name = 'site_info'
        AND column_name = 'home_cover_url'
    `;

    expect(Number(row?.column_count ?? 0)).toBe(0);
  });

  test("saves multiple homepage cover URLs", async () => {
    const saved = await updateSystemSiteInfo(
      currentAdmin,
      {
        description: "多封面测试站点",
        establishedAt: "2026-06-05T12:00:00.000Z",
        homeCoverUrls: [
          " /uploads/site/cover-a.jpg ",
          "",
          "/uploads/site/cover-b.jpg",
          "/uploads/site/cover-a.jpg",
        ],
        siteName: "LeiBlog Multi Cover",
      },
      testDb
    );

    expect(saved.item?.homeCoverUrls).toEqual([
      "/uploads/site/cover-a.jpg",
      "/uploads/site/cover-b.jpg",
    ]);

    const adminInfo = await getSystemSiteInfo(currentAdmin, testDb);
    expect(adminInfo.item?.homeCoverUrls).toEqual([
      "/uploads/site/cover-a.jpg",
      "/uploads/site/cover-b.jpg",
    ]);

    const publicInfo = await getPublicSiteInfo(testDb);
    expect(publicInfo.homeCoverUrls).toEqual([
      "/uploads/site/cover-a.jpg",
      "/uploads/site/cover-b.jpg",
    ]);
  });
});
