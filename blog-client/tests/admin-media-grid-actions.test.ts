import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import mediaPageSource from "../src/features/admin/content/MediaPage.tsx?raw";
import usersPageSource from "../src/features/admin/system/UsersPage.tsx?raw";

const layoutsCss = readFileSync(
  new URL("../src/shared/theme/layouts.css", import.meta.url),
  "utf8",
);

describe("admin media grid actions", () => {
  it("keeps only the grid view with selection, download, and delete actions", () => {
    expect(mediaPageSource).not.toContain("媒体视图切换");
    expect(mediaPageSource).not.toContain('setViewMode("list")');
    expect(mediaPageSource).toContain("选择全部当前媒体");
    expect(mediaPageSource).toContain("批量删除");
    expect(mediaPageSource).toContain("下载${row.fileName}");
    expect(mediaPageSource).toContain("删除${row.fileName}");
  });

  it("shows a clear empty state when the selected folder has no files", () => {
    expect(mediaPageSource).toContain("const isActiveFolderEmpty =");
    expect(mediaPageSource).toContain('className="media-folder-empty-card"');
    expect(mediaPageSource).toContain("文件夹暂无文件");
    expect(mediaPageSource).toContain("点击上方上传按钮，可以将文件添加到当前文件夹。");
    expect(layoutsCss).toContain(`.media-folder-empty-card {
  display: grid;
  min-height: 12rem;
  grid-column: 1 / -1;`);
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

  it("shows the localized login location in the user table", () => {
    expect(usersPageSource).toContain('header: "登录地点"');
    expect(usersPageSource).toContain("lastLoginLocation: item.lastLoginLocation ??");
  });
});
