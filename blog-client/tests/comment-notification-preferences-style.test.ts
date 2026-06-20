import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import authPagesSource from "../src/features/blog/auth/AuthPages.tsx?raw";
import setupPageSource from "../src/features/admin/setup/SetupPage.tsx?raw";
import profilePageSource from "../src/features/admin/system/ProfilePage.tsx?raw";
import siteSettingsPageSource from "../src/features/admin/system/SiteSettingsPage.tsx?raw";

const layoutsCss = readFileSync(
  new URL("../src/shared/theme/layouts.css", import.meta.url),
  "utf8",
);

function expectClickableSwitchLabel(source: string, label: string) {
  expect(source).toMatch(
    new RegExp(
      `<Switch\\.Content(?:\\s+[^>]*)?>\\s*<Switch\\.Control>[\\s\\S]*?<strong>${label}</strong>`,
    ),
  );
}

describe("comment notification preference styles", () => {
  it("shares the compact site settings switch style and right-aligns preference saves", () => {
    expect(siteSettingsPageSource).toContain('className="settings-switch-row"');
    expect(profilePageSource).toContain('className="account-preference-list settings-form"');
    expect(authPagesSource).toContain('className="account-preference-list settings-form"');
    expect(profilePageSource).not.toContain('className="settings-switch-row"');
    expect(authPagesSource).toContain('className="settings-switch-row"');
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
    expect(layoutsCss).toContain(".settings-switch-content");
  });

  it("places switch controls inside their clickable labels", () => {
    for (const source of [
      siteSettingsPageSource,
      profilePageSource,
      authPagesSource,
      setupPageSource,
    ]) {
      expect(source).not.toMatch(/<\/Switch\.Control>\s*<Switch\.Content>/);
    }

    expectClickableSwitchLabel(siteSettingsPageSource, "开启评论系统");
    expectClickableSwitchLabel(profilePageSource, "评论邮件通知");
    expectClickableSwitchLabel(profilePageSource, "新文章邮件通知");
    expectClickableSwitchLabel(authPagesSource, "评论回复邮件通知");
    expectClickableSwitchLabel(authPagesSource, "新文章邮件通知");
    expectClickableSwitchLabel(setupPageSource, "评论邮件通知");
    expectClickableSwitchLabel(setupPageSource, "新文章邮件通知");
    expectClickableSwitchLabel(setupPageSource, "开启评论");
  });
});
