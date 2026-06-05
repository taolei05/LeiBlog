import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { AboutAuthorPage, AboutSitePage, GuestbookPage } from "../src/features/blog/site/SitePages";

const originalLocation = globalThis.location;

function setTestLocation(origin: string) {
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: {
      origin,
    },
  });
}

describe("AboutSitePage", () => {
  afterEach(() => {
    if (originalLocation) {
      Object.defineProperty(globalThis, "location", {
        configurable: true,
        value: originalLocation,
      });
      return;
    }

    Reflect.deleteProperty(globalThis, "location");
  });

  it("renders the about site sections inspired by the legacy layout", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AboutSitePage />
      </MemoryRouter>,
    );

    expect(html).toContain("about-site-page");
    expect(html).toContain("articles-index-hero__waves");
    expect(html).toContain("网站特色");
    expect(html).toContain("技术栈");
    expect(html).toContain("本站信息");
    expect(html.indexOf("站点作者")).toBeGreaterThan(-1);
    expect(html.indexOf("站点作者")).toBeLessThan(html.indexOf("站点名称"));
    expect(html).toContain("联系与反馈");
    expect(html).toContain('href="/about-author"');
    expect(html).toContain('href="/guestbook"');
  });

  it("uses the current origin for the site url card", () => {
    setTestLocation("http://192.168.1.24:5173");

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AboutSitePage />
      </MemoryRouter>,
    );

    expect(html).toContain('href="http://192.168.1.24:5173"');
    expect(html).toContain("http://192.168.1.24:5173");
    expect(html).not.toContain("https://taolei.net");
  });
});

describe("AboutAuthorPage", () => {
  it("renders a wave hero and complete author sections", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AboutAuthorPage />
      </MemoryRouter>,
    );

    expect(html).toContain("about-author-page");
    expect(html).toContain("articles-index-hero__waves");
    expect(html).toContain("关于作者");
    expect(html).toContain("写作坐标");
    expect(html).toContain("常用工具");
    expect(html).toContain("继续探索");
    expect(html).toContain('href="/articles"');
    expect(html).toContain('href="/guestbook"');
  });
});

describe("GuestbookPage", () => {
  it("renders a wave hero above the guestbook thread", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <GuestbookPage />
      </MemoryRouter>,
    );

    expect(html).toContain("guestbook-page");
    expect(html).toContain("articles-index-hero__waves");
    expect(html).toContain("留言板");
    expect(html).toContain("留言前的小约定");
    expect(html).toContain("站点留言");
  });
});
