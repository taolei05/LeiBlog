import { describe, expect, it } from "vitest";

import setupPageSource from "../src/features/admin/setup/SetupPage.tsx?raw";
import {
  getCompletedSetupRedirectPath,
  toSetupFilingPayload,
  toSetupHomeCoverUrls,
} from "../src/features/admin/setup/SetupPage";

describe("setup payload helpers", () => {
  it("cleans homepage covers and multiple ICP records for setup submission", () => {
    expect(
      toSetupHomeCoverUrls(
        [" https://example.com/a.jpg ", "", "https://example.com/a.jpg"],
        ["https://example.com/b.jpg"],
      ),
    ).toEqual(["https://example.com/a.jpg", "https://example.com/b.jpg"]);

    expect(
      toSetupFilingPayload([
        { id: "first", number: " 京ICP备00000000号-1 ", url: " https://beian.miit.gov.cn/ " },
        { id: "empty", number: " ", url: "https://example.com/ignored" },
        { id: "second", number: "京ICP备00000000号-2", url: "" },
      ]),
    ).toEqual([
      { number: "京ICP备00000000号-1", url: "https://beian.miit.gov.cn/" },
      { number: "京ICP备00000000号-2", url: null },
    ]);
  });

  it("redirects completed setup visits to the admin login page", () => {
    expect(getCompletedSetupRedirectPath()).toBe("/admin/login");
  });

  it("includes the admin email notification preferences in setup step 1", () => {
    expect(setupPageSource).toContain("commentEmailNotificationsEnabled: boolean;");
    expect(setupPageSource).toContain("newArticleEmailNotificationsEnabled: boolean;");
    expect(setupPageSource).toContain("commentEmailNotificationsEnabled: true,");
    expect(setupPageSource).toContain("newArticleEmailNotificationsEnabled: true,");
    expect(setupPageSource).toContain(
      "commentEmailNotificationsEnabled: setupState.commentEmailNotificationsEnabled,",
    );
    expect(setupPageSource).toContain(
      "newArticleEmailNotificationsEnabled: setupState.newArticleEmailNotificationsEnabled,",
    );
    expect(setupPageSource).toContain("<strong>评论邮件通知</strong>");
    expect(setupPageSource).toContain("接收全站文章和留言板的新评论、新回复邮件。");
    expect(setupPageSource).toContain("<strong>新文章邮件通知</strong>");
    expect(setupPageSource).toContain("有新文章发布时，通过邮箱接收通知。");
  });
});
