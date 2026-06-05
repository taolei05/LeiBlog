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
          homeCoverUrl: null,
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
      homeCoverUrl: "https://cdn.example.com/legacy.jpg",
      homeCoverUrls: [
        "https://cdn.example.com/cover-a.jpg",
        "",
        "https://cdn.example.com/cover-b.jpg",
      ],
    });

    const siteInfo = await fetchPublicSiteInfo();

    expect((siteInfo as { homeCoverUrls?: string[] }).homeCoverUrls).toEqual([
      "https://cdn.example.com/cover-a.jpg",
      "https://cdn.example.com/cover-b.jpg",
    ]);
    expect(siteInfo.homeCoverUrl).toBe("https://cdn.example.com/legacy.jpg");
  });

  it("falls back to the legacy cover as a single-item cover list", async () => {
    mockSiteInfoResponse({
      homeCoverUrl: "https://cdn.example.com/legacy-only.jpg",
    });

    const siteInfo = await fetchPublicSiteInfo();

    expect((siteInfo as { homeCoverUrls?: string[] }).homeCoverUrls).toEqual([
      "https://cdn.example.com/legacy-only.jpg",
    ]);
  });
});
