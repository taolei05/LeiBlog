import { readFileSync } from "node:fs";
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

describe("comment image layout", () => {
  const styles = readFileSync(new URL("../style.css", import.meta.url), "utf8");
  const button = styles.match(/\.article-comment-image\s*\{([^}]+)\}/)?.[1];
  const image = styles.match(/\.article-comment-image img\s*\{([^}]+)\}/)?.[1];

  it("bounds the preview button and avoids painting empty space beyond the image", () => {
    expect(button).toContain("justify-self: start;");
    expect(button).toContain("width: fit-content;");
    expect(button).toContain("max-width: min(100%, 280px);");
    expect(button).toContain("background: transparent;");
    expect(button).toContain("border: 0;");
    expect(image).toContain("border: 1px solid var(--blog-border);");
    expect(image).toContain("border-radius: inherit;");
  });

  it("preserves image proportions within narrow comments without upscaling or cropping", () => {
    expect(image).toContain("width: auto;");
    expect(image).toContain("height: auto;");
    expect(image).toContain("max-width: 100%;");
    expect(image).toContain("max-height: 220px;");
    expect(image).toContain("object-fit: contain;");
    expect(image).toContain("box-sizing: border-box;");
  });
});

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
