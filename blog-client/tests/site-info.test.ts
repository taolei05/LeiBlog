import { afterEach, describe, expect, it } from "vitest";

import { fetchPublicSiteInfo } from "../src/shared/site/site-info";

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
