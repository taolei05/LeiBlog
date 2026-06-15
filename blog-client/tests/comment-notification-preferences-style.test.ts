import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import authPagesSource from "../src/features/blog/auth/AuthPages.tsx?raw";
import profilePageSource from "../src/features/admin/system/ProfilePage.tsx?raw";
import siteSettingsPageSource from "../src/features/admin/system/SiteSettingsPage.tsx?raw";

const layoutsCss = readFileSync(
  new URL("../src/shared/theme/layouts.css", import.meta.url),
  "utf8",
);

describe("comment notification preference styles", () => {
  it("shares the compact site settings switch style and right-aligns preference saves", () => {
    expect(siteSettingsPageSource).not.toContain('className="settings-switch-row"');
    expect(profilePageSource).toContain('className="account-preference-list settings-form"');
    expect(authPagesSource).toContain('className="account-preference-list settings-form"');
    expect(profilePageSource).not.toContain('className="settings-switch-row"');
    expect(authPagesSource).not.toContain('className="settings-switch-row"');
    expect(layoutsCss).toMatch(/\.account-preference-list\s*\{[^}]*gap: 0\.75rem;/);
    expect(layoutsCss).toMatch(
      /\.account-preference-list \.switch\s*\{[^}]*--accent: var\(--cursor-accent\);/,
    );
    expect(layoutsCss).toMatch(
      /\.account-preference-list \.settings-form__submit\s*\{[^}]*justify-self: end;/,
    );
    expect(layoutsCss).not.toMatch(
      /\.account-preference-list\s*\{[^}]*--accent: var\(--cursor-accent\);/,
    );
  });
});
