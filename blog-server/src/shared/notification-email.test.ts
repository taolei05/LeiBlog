import { describe, expect, test } from "bun:test";

import {
  renderArticleNotificationEmail,
  renderCommentNotificationEmail,
} from "./notification-email";

const branding = { locale: "en" as const, logoUrl: null, siteInitial: "L", siteName: "LeiBlog" };
const articleUrl = "https://blog.example.test/articles/test";
const preferencesUrl = "https://blog.example.test/profile#profile-section-preferences";

describe("bilingual notification email templates", () => {
  test.each([
    {
      locale: "en" as const,
      subject: "New article: Test",
      action: "Read article",
      manage: "Manage email notifications",
      lang: "en",
    },
    {
      locale: "zh-CN" as const,
      subject: "新文章发布：Test",
      action: "查看文章",
      manage: "管理邮件通知",
      lang: "zh-CN",
    },
  ])(
    "reuses the existing email frame for article notifications ($locale)",
    ({ locale, subject, action, manage, lang }) => {
      const email = renderArticleNotificationEmail({
        branding: { ...branding, locale },
        title: "Test",
        summary: "Summary",
        articleUrl,
        preferencesUrl,
      });
      expect(email.subject).toBe(subject);
      expect(email.html).toContain(`<html lang="${lang}">`);
      expect(email.html).toContain(action);
      expect(email.html).toContain(manage);
      expect(email.html).toContain("Summary");
      expect(email.html).toContain("LeiBlog");
      expect(email.text).toContain(articleUrl);
      expect(email.text).toContain(preferencesUrl);
    },
  );

  test.each(["en", "zh-CN"] as const)("supports replies and admin notices in %s", (locale) => {
    for (const kind of ["comment_reply", "comment_admin"] as const) {
      for (const target of ["article", "guestbook"] as const) {
        const email = renderCommentNotificationEmail({
          branding: { ...branding, locale },
          kind,
          target,
          authorName: "Alice",
          articleTitle: "Article",
          content: "Reply text",
          commentUrl: `${articleUrl}#comments`,
          preferencesUrl,
        });
        expect(email.text).toContain("Alice");
        expect(email.html).toContain("Reply text");
        expect(email.subject).toContain(
          locale === "en"
            ? kind === "comment_reply"
              ? "New reply"
              : "New comment"
            : kind === "comment_reply"
              ? "评论回复通知"
              : "新评论通知",
        );
        expect(email.subject).toContain(
          target === "guestbook" ? (locale === "en" ? "Guestbook" : "留言板") : "Article",
        );
      }
    }
  });

  test("escapes untrusted titles, authors, contents and links, and limits excerpts", () => {
    const email = renderCommentNotificationEmail({
      branding,
      kind: "comment_reply",
      target: "article",
      authorName: '<img src=x onerror="evil">',
      articleTitle: "Test\r\nBcc: victim",
      content: "<script>evil</script>" + "x".repeat(5000),
      commentUrl: `${articleUrl}?a="value"`,
      preferencesUrl,
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("&quot;value&quot;");
    expect(email.text.length).toBeLessThan(3000);
    expect(email.subject).not.toMatch(/[\r\n]/);
  });
});
