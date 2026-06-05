import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HeroCoverCarousel, getHeroCoverUrls } from "../src/features/blog/shared/HeroCoverCarousel";
import type { PublicSiteInfo } from "../src/shared/site/site-info";

function createSiteInfo(covers: string[]): PublicSiteInfo {
  return {
    description: "站点描述",
    establishedAt: "2026-06-05T12:00:00.000Z",
    homeCoverUrl: "https://cdn.example.com/legacy.jpg",
    homeCoverUrls: covers,
    homeSlogan: "首页文案",
    siteName: "LeiBlog",
  };
}

describe("HeroCoverCarousel", () => {
  it("reads homepage cover URLs for shared frontend hero backgrounds", () => {
    expect(
      getHeroCoverUrls(
        createSiteInfo([
          " https://cdn.example.com/cover-a.jpg ",
          "",
          "https://cdn.example.com/cover-b.jpg",
          "https://cdn.example.com/cover-a.jpg",
        ]),
      ),
    ).toEqual(["https://cdn.example.com/cover-a.jpg", "https://cdn.example.com/cover-b.jpg"]);
  });

  it("renders cover slides with page hero classes", () => {
    const html = renderToStaticMarkup(
      <HeroCoverCarousel
        activeIndex={1}
        activeSlideClassName="articles-index-hero__cover-slide--active"
        className="articles-index-hero__carousel"
        coverUrls={["https://cdn.example.com/cover-a.jpg", "https://cdn.example.com/cover-b.jpg"]}
        slideClassName="articles-index-hero__cover-slide"
      />,
    );

    expect(html).toContain("articles-index-hero__carousel");
    expect(html).toContain("articles-index-hero__cover-slide--active");
    expect(html).toContain("https://cdn.example.com/cover-a.jpg");
    expect(html).toContain("https://cdn.example.com/cover-b.jpg");
  });
});
