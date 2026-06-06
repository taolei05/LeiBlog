import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  getSystemFiling,
  updateSystemFiling,
} from "../src/admin/system/service";
import { getPublicSiteFiling } from "../src/public/site/service";
import type { AuthUser } from "../src/shared/auth";
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
  testDatabase = await createMigratedTestDatabase("lei_blog_site_filing_test");
  testDb = new Bun.SQL(testDatabase.databaseUrl, { max: 1 });
});

afterAll(async () => {
  await clearSiteCache();
  await testDb?.close({ timeout: 1 });
  await testDatabase?.drop();
});

describe("site filing service", () => {
  test("stores multiple ICP filing records while keeping the first record compatible", async () => {
    await updateSystemFiling(
      currentAdmin,
      {
        icpRecords: [
          { number: "京ICP备00000000号-1", url: "https://beian.miit.gov.cn/" },
          { number: "京ICP备00000000号-2", url: "https://beian.example.com/two" },
        ],
        policeNumber: "京公网安备00000000000000号",
        policeUrl: "https://www.beian.gov.cn/",
      },
      testDb
    );

    const system = await getSystemFiling(currentAdmin, testDb);
    if (!system.item) throw new Error("备案配置未返回");

    expect(system.item.icpNumber).toBe("京ICP备00000000号-1");
    expect(system.item.icpUrl).toBe("https://beian.miit.gov.cn/");
    expect(system.item.icpRecords).toEqual([
      { number: "京ICP备00000000号-1", url: "https://beian.miit.gov.cn/" },
      { number: "京ICP备00000000号-2", url: "https://beian.example.com/two" },
    ]);

    await clearSiteCache();
    const publicFiling = await getPublicSiteFiling(testDb);
    expect(publicFiling.icpNumber).toBe("京ICP备00000000号-1");
    expect(publicFiling.icpRecords).toEqual(system.item.icpRecords);
  });
});
