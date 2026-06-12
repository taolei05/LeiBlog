import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import profilePageSource from "../src/features/admin/system/ProfilePage.tsx?raw";

const layoutsCss = readFileSync(
  new URL("../src/shared/theme/layouts.css", import.meta.url),
  "utf8",
);

describe("admin comment notification preferences", () => {
  it("adds a comment email notification switch to the profile preferences", () => {
    expect(profilePageSource).toContain('title="偏好设置"');
    expect(profilePageSource).not.toContain('title="偏好"');
    expect(profilePageSource).toContain("评论邮件通知");
    expect(profilePageSource).toContain("接收全站文章和留言板的新评论、新回复邮件。");
    expect(profilePageSource).toContain("/me/preferences");
    expect(profilePageSource).toContain("commentEmailNotificationsEnabled");
    expect(profilePageSource).toMatch(
      /import\s*{[\s\S]*\bSwitch\b[\s\S]*}\s*from "@heroui\/react"/,
    );
    expect(profilePageSource).toContain("<Switch");
    expect(profilePageSource).toContain("<Switch.Control>");
    expect(profilePageSource).toContain("profile?.commentEmailNotificationsEnabled ?? true");
    expect(layoutsCss).toContain(".account-preference-list");
    expect(layoutsCss).toContain(".account-preference-row");
  });
});
