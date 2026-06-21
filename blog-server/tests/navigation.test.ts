import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  createNavigationGroup,
  createNavigationItem,
  deleteNavigationGroup,
  listNavigation,
  reorderNavigationGroups,
  reorderNavigationItems,
  updateNavigationItem,
} from "../src/admin/navigation/service";
import { hashPassword, type AuthUser } from "../src/shared/auth";
import { listPublicNavigation } from "../src/public/navigation/service";
import {
  createMigratedTestDatabase,
  type TestDatabase,
} from "./helpers/database";

let testDatabase: TestDatabase;
let testDb: Bun.SQL;
let currentAdmin: AuthUser;

beforeAll(async () => {
  testDatabase = await createMigratedTestDatabase("lei_blog_navigation_test");
  testDb = new Bun.SQL(testDatabase.databaseUrl, { max: 1 });
  const [admin] = await testDb<{ id: string }[]>`
    INSERT INTO users (username, password_hash, email, role)
    VALUES ('navigation-admin', ${await hashPassword("admin-password")}, 'navigation-admin@example.com', 'admin')
    RETURNING id
  `;

  currentAdmin = {
    id: admin.id,
    username: "navigation-admin",
    email: "navigation-admin@example.com",
    name: null,
    role: "admin",
    avatarUrl: null,
  };
});

afterAll(async () => {
  await testDb?.close({ timeout: 1 });
  await testDatabase?.drop();
});

describe("navigation services", () => {
  test("manages ordered groups and items while filtering empty public groups", async () => {
    const tools = await createNavigationGroup(currentAdmin, { name: "常用工具" }, testDb);
    const ai = await createNavigationGroup(currentAdmin, { name: "AI 导航" }, testDb);
    const item = await createNavigationItem(currentAdmin, {
      groupId: tools.id,
      name: "Can I use",
      url: "https://caniuse.com",
      note: "前端 API 兼容性查询",
    }, testDb);

    const navigationBeforeReorder = await listNavigation(currentAdmin, testDb);
    const otherGroupIds = navigationBeforeReorder.groups
      .map((group) => group.id)
      .filter((id) => id !== ai.id && id !== tools.id);

    await reorderNavigationGroups(currentAdmin, { ids: [ai.id, tools.id, ...otherGroupIds] }, testDb);
    const moved = await updateNavigationItem(currentAdmin, item.id, {
      groupId: ai.id,
      iconUrl: "/uploads/website-icons/caniuse.png",
      name: item.name,
      note: item.note,
      url: item.url,
    }, testDb);

    expect(moved.groupId).toBe(ai.id);
    await expect(deleteNavigationGroup(currentAdmin, ai.id, testDb))
      .rejects.toThrow("请先移动或删除组内网站");

    const adminNavigation = await listNavigation(currentAdmin, testDb);
    expect(adminNavigation.groups.slice(0, 2).map((group) => group.name)).toEqual([
      "AI 导航",
      "常用工具",
    ]);
    expect(adminNavigation.groups[0]?.items[0]?.iconUrl).toBe(
      "/uploads/website-icons/caniuse.png"
    );

    const publicNavigation = await listPublicNavigation(testDb);
    const publicAiGroup = publicNavigation.groups.find((group) => group.name === "AI 导航");
    expect(publicAiGroup?.items[0]?.url).toBe("https://caniuse.com");
  });

  test("validates duplicate names, URLs, reorder IDs, and admin access", async () => {
    const first = await createNavigationGroup(currentAdmin, { name: "框架" }, testDb);
    const second = await createNavigationGroup(currentAdmin, { name: "部署" }, testDb);
    const firstItem = await createNavigationItem(currentAdmin, {
      groupId: first.id,
      name: "React",
      url: "https://react.dev",
    }, testDb);
    const secondItem = await createNavigationItem(currentAdmin, {
      groupId: first.id,
      name: "Vue",
      url: "https://vuejs.org",
    }, testDb);

    await expect(
      createNavigationGroup(currentAdmin, { name: "框架" }, testDb)
    ).rejects.toThrow("导航分组名称已存在");
    await expect(
      createNavigationItem(currentAdmin, {
        groupId: second.id,
        name: "本地文件",
        url: "file:///tmp/navigation",
      }, testDb)
    ).rejects.toThrow("网址仅支持 http 或 https");
    await expect(
      reorderNavigationGroups(currentAdmin, { ids: [first.id] }, testDb)
    ).rejects.toThrow("排序列表必须包含全部导航分组");
    await expect(
      reorderNavigationItems(currentAdmin, {
        groupId: first.id,
        ids: [firstItem.id, firstItem.id],
      }, testDb)
    ).rejects.toThrow("排序列表必须包含组内全部网站");

    await reorderNavigationItems(currentAdmin, {
      groupId: first.id,
      ids: [secondItem.id, firstItem.id],
    }, testDb);
    const listed = await listNavigation(currentAdmin, testDb);
    const group = listed.groups.find((item) => item.id === first.id);
    expect(group?.items.map((item) => item.name)).toEqual(["Vue", "React"]);

    await expect(
      listNavigation({ ...currentAdmin, role: "user" }, testDb)
    ).rejects.toThrow("需要管理员权限");
  });
});
