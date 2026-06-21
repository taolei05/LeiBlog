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
    expect(mediaPageSource).toContain("选择当前文件夹全部媒体");
    expect(mediaPageSource).toContain("批量删除");
    expect(mediaPageSource).toContain("下载${row.fileName}");
    expect(mediaPageSource).toContain("删除${row.fileName}");
  });

  it("keeps bulk selection independent from the rendered media batch", () => {
    expect(mediaPageSource).toContain("MEDIA_GRID_INITIAL_LIMIT");
    expect(mediaPageSource).toContain("MEDIA_GRID_BATCH_SIZE");
    expect(mediaPageSource).toContain("renderedMediaRows");
    expect(mediaPageSource).toContain("visibleMediaRows.slice(0, mediaRenderLimit)");
    expect(mediaPageSource).toContain("visibleMediaRows.forEach");
    expect(mediaPageSource).toContain(
      "已显示 {renderedMediaRows.length} / {visibleMediaRows.length} 项",
    );
    expect(mediaPageSource).toContain("加载更多媒体");
  });

  it("keeps the bulk selection label inside the clickable checkbox content", () => {
    expect(mediaPageSource).toMatch(
      /aria-label="选择全部当前媒体"[\s\S]*?<Checkbox\.Content>[\s\S]*?<Checkbox\.Control>[\s\S]*?activeFolder \? "选择当前文件夹全部媒体" : "选择全部媒体"[\s\S]*?<\/Checkbox\.Content>/,
    );
  });

  it("keeps each media card selection checkbox inside Checkbox.Content", () => {
    expect(mediaPageSource).toMatch(
      /aria-label=\{`选择\$\{row\.fileName\}`\}[\s\S]*?<Checkbox\.Content>[\s\S]*?<Checkbox\.Control>[\s\S]*?<Checkbox\.Indicator \/>[\s\S]*?<\/Checkbox\.Control>[\s\S]*?<\/Checkbox\.Content>/,
    );
  });

  it("limits heavy media card work for large libraries", () => {
    expect(mediaPageSource).toContain("deleteModalRow");
    expect(mediaPageSource).toContain("setDeleteModalRow(row)");
    expect(mediaPageSource).toContain('loading="lazy"');
    expect(mediaPageSource).toContain('decoding="async"');
    expect(layoutsCss).toContain("content-visibility: auto");
    expect(layoutsCss).toContain("contain-intrinsic-size");
  });

  it("supports batch uploads and visible upload or migration progress", () => {
    expect(mediaPageSource).toContain("ProgressBar");
    expect(mediaPageSource).toContain("mediaProgress");
    expect(mediaPageSource).toContain("multiple");
    expect(mediaPageSource).toContain("Array.from(event.target.files");
    expect(mediaPageSource).toContain("uploadFiles");
    expect(mediaPageSource).toContain("maxValue={mediaProgress.total}");
    expect(layoutsCss).toContain(".media-operation-progress");
  });

  it("loads folders independently from the media list request", () => {
    expect(mediaPageSource).toContain(
      'adminFetch<{ items: MediaFolder[] }>("/admin/media/folders")',
    );
    expect(mediaPageSource).not.toMatch(
      /Promise\.all\(\[[\s\S]*adminFetch<\{ items: AdminMediaItem\[\] \}>[\s\S]*adminFetch<\{ items: MediaFolder\[\] \}>/,
    );
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

  it("renders SVG image assets with react-inlinesvg in grid cards and preview modal", () => {
    expect(mediaPageSource).toContain('import SVG from "react-inlinesvg";');
    expect(mediaPageSource).toContain("isSvg: isSvgMediaItem(item)");
    expect(mediaPageSource).toContain("function SvgMediaPreview");
    expect(mediaPageSource).toContain("<SVG");
    expect(mediaPageSource).toContain('className="media-svg-preview__svg"');
    expect(mediaPageSource).toContain("row.isSvg ? (");
    expect(mediaPageSource).toContain("item.isSvg ? (");
    expect(mediaPageSource).toContain('if (file.type === "image/svg+xml") return null;');
    expect(layoutsCss).toContain(".media-svg-preview {");
    expect(layoutsCss).toContain(".media-svg-preview__svg {");
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

  it("shows the latest login method in the user table", () => {
    expect(usersPageSource).toContain('header: "登录方式"');
    expect(usersPageSource).toContain("lastLoginMethod: item.lastLoginMethod");
  });
});
