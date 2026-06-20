import { describe, expect, it } from "vitest";

import mediaPageSource from "../src/features/admin/content/MediaPage.tsx?raw";
import siteSettingsSource from "../src/features/admin/system/SiteSettingsPage.tsx?raw";

describe("admin Cloudflare R2 media storage", () => {
  it("places R2 storage settings below filing settings", () => {
    const filingIndex = siteSettingsSource.indexOf('title="备案配置"');
    const r2Index = siteSettingsSource.indexOf('title="Cloudflare R2存储配置"');

    expect(filingIndex).toBeGreaterThan(-1);
    expect(r2Index).toBeGreaterThan(filingIndex);
    expect(siteSettingsSource).toContain("启用 Cloudflare R2 存储");
    expect(siteSettingsSource).toContain("Account ID");
    expect(siteSettingsSource).toContain("Bucket");
    expect(siteSettingsSource).toContain("Access Key ID");
    expect(siteSettingsSource).toContain("Secret Access Key");
    expect(siteSettingsSource).toContain("Public Base URL");
    expect(siteSettingsSource).toContain("保存 Cloudflare R2 存储配置");
  });

  it("adds media storage filters and bidirectional migration actions", () => {
    expect(mediaPageSource).toContain("storageProviderFilter");
    expect(mediaPageSource).toContain("全部存储");
    expect(mediaPageSource).toContain("服务器文件");
    expect(mediaPageSource).toContain("Cloudflare R2 文件");
    expect(mediaPageSource).toContain('storageProvider: "local"');
    expect(mediaPageSource).toContain('storageProvider: "r2"');
    expect(mediaPageSource).toContain("迁移到服务器");
    expect(mediaPageSource).toContain("迁移到 Cloudflare R2");
    expect(mediaPageSource).toContain("/admin/media/storage/migrate");
    expect(mediaPageSource).toContain("/admin/media/storage/summary");
    expect(mediaPageSource).toContain("storageSummary");
    expect(mediaPageSource).toContain("storageProviderCount");
    expect(mediaPageSource).toContain("folderStorageCounts");
  });
});
