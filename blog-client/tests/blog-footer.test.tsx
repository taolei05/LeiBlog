import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import blogLayoutSource from "../src/app/blog/BlogLayout.tsx?raw";
import { BlogFooter, getSiteUptimeSeconds } from "../src/app/blog/BlogFooter";

const siteInfo = {
  description: "站点描述",
  establishedAt: "2026-01-01T00:00:00.000Z",
  homeCoverUrls: [],
  homeSlogan: "",
  siteName: "LeiBlog",
};

const siteConfig = {
  commentsEnabled: true,
  copyright: "Copyright © 2024-2026 Lei's Blog",
  resendDomain: null,
  seoDescription: "",
  seoKeywords: [],
  seoTitle: "LeiBlog",
};

const siteFiling = {
  icpNumber: "萌ICP备20251805号",
  icpRecords: [
    { number: "萌ICP备20251805号", url: "https://beian.example.com/a" },
    { number: "喵ICP备20253781号", url: "https://beian.example.com/b" },
  ],
  icpUrl: "https://beian.example.com/a",
  policeNumber: "本ICP备2025110237号",
  policeUrl: "https://police.example.com",
};

describe("BlogFooter", () => {
  it("renders copyright, uptime seconds, ICP records, police filing, and a Separator", () => {
    const html = renderToStaticMarkup(
      <BlogFooter
        now={new Date("2026-01-01T00:00:10.000Z").getTime()}
        siteConfig={siteConfig}
        siteFiling={siteFiling}
        siteInfo={siteInfo}
      />,
    );

    expect(html).toContain("blog-footer__separator");
    expect(html).toContain("Copyright © 2024-2026 Lei&#x27;s Blog");
    expect(html).toContain("本站已运行10秒");
    expect(html).toContain("萌ICP备20251805号");
    expect(html).toContain("喵ICP备20253781号");
    expect(html).toContain("本ICP备2025110237号");
    expect(html).toContain('href="https://beian.example.com/a"');
    expect(html).toContain('href="https://police.example.com"');
  });

  it("clamps invalid or future established time to zero seconds", () => {
    expect(getSiteUptimeSeconds("not-a-date", 1000)).toBe(0);
    expect(getSiteUptimeSeconds("2026-01-01T00:01:00.000Z", 1000)).toBe(0);
  });

  it("loads public site config and filing data from the front layout", () => {
    expect(blogLayoutSource).toContain("fetchPublicSiteConfig");
    expect(blogLayoutSource).toContain("fetchPublicSiteFiling");
    expect(blogLayoutSource).toContain("<BlogFooter");
  });
});
