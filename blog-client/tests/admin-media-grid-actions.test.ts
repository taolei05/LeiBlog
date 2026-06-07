import { describe, expect, it } from "vitest";

import mediaPageSource from "../src/features/admin/content/MediaPage.tsx?raw";
import usersPageSource from "../src/features/admin/system/UsersPage.tsx?raw";

describe("admin media grid actions", () => {
  it("keeps only the grid view with selection, download, and delete actions", () => {
    expect(mediaPageSource).not.toContain("媒体视图切换");
    expect(mediaPageSource).not.toContain('setViewMode("list")');
    expect(mediaPageSource).toContain("选择全部当前媒体");
    expect(mediaPageSource).toContain("批量删除");
    expect(mediaPageSource).toContain("下载${row.fileName}");
    expect(mediaPageSource).toContain("删除${row.fileName}");
  });
});

describe("admin user actions", () => {
  it("does not expose the read-only view action", () => {
    expect(usersPageSource).not.toMatch(/label:\s*"查看"/);
  });

  it("offers only administrator and ordinary-user roles", () => {
    expect(usersPageSource).toContain('{ label: "管理员", value: "admin" }');
    expect(usersPageSource).toContain('{ label: "普通用户", value: "user" }');
  });

  it("uses avatar as the first data column and removes the status column", () => {
    const avatarColumnIndex = usersPageSource.indexOf('header: "头像"');
    const userColumnIndex = usersPageSource.indexOf('header: "用户"');

    expect(avatarColumnIndex).toBeGreaterThan(-1);
    expect(userColumnIndex).toBeGreaterThan(-1);
    expect(avatarColumnIndex).toBeLessThan(userColumnIndex);
    expect(usersPageSource).not.toContain('header: "状态"');
    expect(usersPageSource).not.toContain('key: "status"');
    expect(usersPageSource).not.toContain('status: "active"');
  });
});
