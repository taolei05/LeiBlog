import { describe, expect, it } from "vite-plus/test";

import { getCommentSourceLabel } from "./comment-source";
import { i18n } from "../../../../shared/i18n";

describe("admin comment sources", () => {
  const labels = { fallback: "No linked post", guestbookLabel: "Guestbook" };

  it.each([null, "parent-comment"])("labels guestbook messages and replies (%s)", (parentId) => {
    const comment = { articleTitle: null, parentId, targetType: "guestbook" as const };
    expect(getCommentSourceLabel({ comment, ...labels })).toBe("Guestbook");
  });

  it("uses the Chinese guestbook label", () => {
    expect(
      getCommentSourceLabel({
        comment: { articleTitle: null, targetType: "guestbook" },
        fallback: "未关联文章",
        guestbookLabel: "留言板",
      }),
    ).toBe("留言板");
  });

  it("preserves the source title of article comments", () => {
    expect(
      getCommentSourceLabel({
        comment: { articleTitle: "Article title", targetType: "article" },
        ...labels,
      }),
    ).toBe("Article title");
  });

  it("does not mislabel an unlinked article comment as guestbook", () => {
    expect(
      getCommentSourceLabel({
        comment: { articleTitle: null, targetType: "article" },
        ...labels,
      }),
    ).toBe("No linked post");
  });

  it.each([
    { language: "zh-CN", expected: "留言板" },
    { language: "en", expected: "Guestbook" },
  ])("uses the configured $language translation", ({ language, expected }) => {
    const t = i18n.getFixedT(language);
    expect(
      getCommentSourceLabel({
        comment: { articleTitle: null, targetType: "guestbook" },
        fallback: t("admin.contentManagement.placeholders.unlinkedArticle"),
        guestbookLabel: t("admin.contentManagement.sources.guestbook"),
      }),
    ).toBe(expected);
  });
});
