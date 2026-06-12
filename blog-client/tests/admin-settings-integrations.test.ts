import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import setupPageSource from "../src/features/admin/setup/SetupPage.tsx?raw";
import siteSettingsPageSource from "../src/features/admin/system/SiteSettingsPage.tsx?raw";

const layoutsCss = readFileSync(
  new URL("../src/shared/theme/layouts.css", import.meta.url),
  "utf8",
);

describe("admin settings integrations", () => {
  it("lets the desktop sidebar grow with its navigation content", () => {
    expect(layoutsCss).toContain(`.admin-shell__sidebar {
  top: var(--space-page);
  min-height: calc(100svh - (var(--space-page) * 2));`);
    expect(layoutsCss).not.toContain(`.admin-shell__sidebar {
  top: var(--space-page);
  height: calc(100svh - (var(--space-page) * 2));`);
    expect(layoutsCss).toContain(`.admin-shell__sidebar {
    position: fixed;`);
    expect(layoutsCss).toContain("overflow-y: auto;");
  });

  it("shows official API key acquisition links in site settings and setup", () => {
    for (const source of [siteSettingsPageSource, setupPageSource]) {
      expect(source).toContain("ADMIN_API_KEY_URLS.resend");
      expect(source).toContain("ADMIN_API_KEY_URLS.deepl");
      expect(source).toContain("ADMIN_API_KEY_URLS.ipgeolocation");
    }

    expect(siteSettingsPageSource).toContain("<ApiKeyGetLink href={getUrl} />");
    expect(setupPageSource).toContain("<ApiKeyGetLink href={getUrl} />");
  });
});
