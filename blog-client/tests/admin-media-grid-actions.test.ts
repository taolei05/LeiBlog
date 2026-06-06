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
});
