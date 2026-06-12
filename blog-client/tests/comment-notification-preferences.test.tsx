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
    expect(profilePageSource).toContain(
      "onChange={(nextValue) => void saveCommentEmailNotificationPreference(nextValue)}",
    );
    expect(profilePageSource).toContain("isDisabled={isLoading || isSavingPreferences");
    expect(layoutsCss).toContain(".account-preference-list");
    expect(layoutsCss).toContain(".account-preference-row");
  });

  it("saves comment notification preferences optimistically with rollback", () => {
    expect(profilePageSource).toMatch(
      /adminFetch<\{ user: AdminProfile \}>\("\/me\/preferences", \{\s+body: \{ commentEmailNotificationsEnabled: nextValue \},\s+method: "PATCH",\s+\}\)/,
    );
    expect(profilePageSource).toContain(
      "setProfile({ ...previousProfile, commentEmailNotificationsEnabled: nextValue })",
    );
    expect(profilePageSource).toContain("setProfile(response.user)");
    expect(profilePageSource).toContain("syncAdminSession(response.user)");
    expect(profilePageSource).toMatch(/showOperationToast\("评论邮件通知偏好已保存", "success"\)/);
    expect(profilePageSource).toContain("setProfile(previousProfile)");
    expect(profilePageSource).toMatch(
      /showOperationToast\(\s+error instanceof Error \? error\.message : "评论邮件通知偏好保存失败",\s+"danger",\s+\)/,
    );
  });
});
