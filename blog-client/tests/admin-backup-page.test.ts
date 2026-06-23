import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import adminNavigationSource from "../src/app/admin/adminNavigation.ts?raw";
import routerSource from "../src/app/router.tsx?raw";
import adminApiSource from "../src/features/admin/shared/admin-api.ts?raw";
import backupPageSource from "../src/features/admin/system/BackupPage.tsx?raw";

const layoutsCss = readFileSync(
  new URL("../src/shared/theme/layouts.css", import.meta.url),
  "utf8",
);

describe("admin full-site backup page", () => {
  it("adds a system backup route and sidebar item", () => {
    expect(adminNavigationSource).toContain("全站备份");
    expect(adminNavigationSource).toContain("/admin/system/backup");
    expect(routerSource).toContain("BackupPage");
    expect(routerSource).toContain('path="admin/system/backup"');
  });

  it("uses file-saver and JSZip for export and local package preview", () => {
    expect(backupPageSource).toContain('import { saveAs } from "file-saver"');
    expect(backupPageSource).toContain('import JSZip from "jszip"');
    expect(backupPageSource).toContain('fetchAdminBlob("/admin/backup/export")');
    expect(backupPageSource).toContain("saveAs(blob, fileName)");
    expect(backupPageSource).toContain("JSZip.loadAsync(file)");
    expect(backupPageSource).toContain("/admin/backup/preview");
  });

  it("requires confirmation before importing a backup", () => {
    expect(backupPageSource).toContain("pendingImportFile");
    expect(backupPageSource).toContain("确认导入全站备份？");
    expect(backupPageSource).toContain("/admin/backup/import");
    expect(backupPageSource).toContain("mode");
    expect(backupPageSource).toContain("replace");
  });

  it("adds a blob download helper that keeps admin auth headers", () => {
    expect(adminApiSource).toContain("fetchAdminBlob");
    expect(adminApiSource).toContain("content-disposition");
    expect(adminApiSource).toContain("buildHeaders(undefined, true)");
  });

  it("styles the backup panels and package summary", () => {
    expect(backupPageSource).toContain('className="backup-page-grid"');
    expect(backupPageSource).toContain('className="backup-package-summary"');
    expect(layoutsCss).toContain(".backup-page-grid");
    expect(layoutsCss).toContain(".backup-package-summary");
  });
});
