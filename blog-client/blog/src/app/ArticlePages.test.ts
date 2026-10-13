import { createElement } from "react";
import type { PropsWithChildren } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("react-photo-view", () => ({
  PhotoProvider: ({ children }: PropsWithChildren) => children,
  PhotoView: ({ children }: PropsWithChildren) => children,
}));
vi.mock("./FrontPageHero", () => ({ FrontPageHero: () => null }));
vi.mock("../../../shared/altcha-challenge", () => ({
  getAltchaVerificationDialogCopy: () => ({}),
  useAltchaVerificationDialog: () => ({ dialog: null, runWithAltcha: vi.fn() }),
}));

import { GuestbookPage } from "./ArticlePages";

describe("public comment entry switch", () => {
  const props = {
    authUser: null,
    coverUrls: [],
    fallbackCoverUrl: "",
    onFeedback: vi.fn(),
    onOpenAuth: vi.fn(),
    timeZone: "Asia/Shanghai",
  };

  it.each([
    { language: "en" as const, closed: "Comments are currently closed." },
    { language: "zh-CN" as const, closed: "评论已关闭。" },
  ])("hides the composer and upload entry when disabled ($language)", ({ language, closed }) => {
    const markup = renderToStaticMarkup(
      createElement(GuestbookPage, {
        ...props,
        language,
        commentsEnabled: false,
      }),
    );
    expect(markup).toContain(closed);
    expect(markup).not.toContain("<form");
    expect(markup).not.toContain("<textarea");
    expect(markup).not.toContain('type="file"');
    expect(markup).toContain("article-comments-list");
  });

  it("restores the composer when enabled", () => {
    const markup = renderToStaticMarkup(
      createElement(GuestbookPage, {
        ...props,
        language: "en",
        commentsEnabled: true,
      }),
    );
    expect(markup).toContain("<form");
    expect(markup).toContain("<textarea");
    expect(markup).not.toContain("Comments are currently closed.");
  });
});
