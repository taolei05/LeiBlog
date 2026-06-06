import { afterEach, describe, expect, it } from "vitest";

import {
  fetchPublicSiteConfig,
  fetchPublicSiteFiling,
  fetchPublicSiteInfo,
} from "../src/shared/site/site-info";

const originalFetch = globalThis.fetch;

function mockSiteInfoResponse(item: Record<string, unknown>) {
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        item: {
          description: "站点描述",
          establishedAt: "2026-06-05T12:00:00.000Z",
          faviconUrl: null,
          homeSlogan: "首页文案",
          logoDarkUrl: null,
          logoLightUrl: null,
          siteName: "LeiBlog",
          ...item,
        },
        ok: true,
      }),
      { status: 200 },
    );
  };
}

describe("fetchPublicSiteInfo", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("reads and cleans multiple homepage cover URLs", async () => {
    mockSiteInfoResponse({
      homeCoverUrls: [
        "https://cdn.example.com/cover-a.jpg",
        "",
        "https://cdn.example.com/cover-b.jpg",
      ],
    });

    const siteInfo = await fetchPublicSiteInfo();

    expect(siteInfo.homeCoverUrls).toEqual([
      "https://cdn.example.com/cover-a.jpg",
      "https://cdn.example.com/cover-b.jpg",
    ]);
  });

  it("uses an empty cover list when no homepage covers are configured", async () => {
    mockSiteInfoResponse({});

    const siteInfo = await fetchPublicSiteInfo();

    expect(siteInfo.homeCoverUrls).toEqual([]);
  });
});

describe("fetchPublicSiteConfig", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("reads copyright settings for the frontend footer", async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          item: {
            commentsEnabled: true,
            copyright: "Copyright © LeiBlog",
            resendDomain: null,
            seoDescription: "SEO 描述",
            seoKeywords: ["LeiBlog"],
            seoTitle: "LeiBlog",
          },
          ok: true,
        }),
        { status: 200 },
      );
    };

    const siteConfig = await fetchPublicSiteConfig();

    expect(siteConfig.copyright).toBe("Copyright © LeiBlog");
    expect(siteConfig.commentsEnabled).toBe(true);
  });
});

describe("fetchPublicSiteFiling", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("reads multiple ICP records and police filing for the frontend footer", async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          item: {
            icpNumber: "萌ICP备20251805号",
            icpRecords: [
              { number: "萌ICP备20251805号", url: "https://beian.example.com/a" },
              { number: "喵ICP备20253781号", url: "https://beian.example.com/b" },
            ],
            icpUrl: "https://beian.example.com/a",
            policeNumber: "本ICP备2025110237号",
            policeUrl: "https://police.example.com",
          },
          ok: true,
        }),
        { status: 200 },
      );
    };

    const siteFiling = await fetchPublicSiteFiling();

    expect(siteFiling.icpRecords.map((record) => record.number)).toEqual([
      "萌ICP备20251805号",
      "喵ICP备20253781号",
    ]);
    expect(siteFiling.policeNumber).toBe("本ICP备2025110237号");
  });
});
