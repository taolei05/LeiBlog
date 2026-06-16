import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { extractSvgDocument, isSvgAssetUrl, toSvgDataUri } from "../src/shared/media/svg";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("site SVG assets", () => {
  it("strips response metadata that was accidentally appended to SVG bodies", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>\nContent-Length: 0\n';

    expect(extractSvgDocument(svg)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>',
    );
    expect(decodeURIComponent(toSvgDataUri(svg))).not.toContain("Content-Length: 0");
  });

  it("detects SVG asset URLs with query strings", () => {
    expect(isSvgAssetUrl("/uploads/site/logo.svg?v=1")).toBe(true);
    expect(isSvgAssetUrl("data:image/svg+xml,%3Csvg%3E%3C/svg%3E")).toBe(true);
    expect(isSvgAssetUrl("/uploads/site/logo.png")).toBe(false);
  });

  it("renders front and admin site logos through the SVG asset component", () => {
    expect(source("src/app/blog/BlogLayout.tsx")).toContain("<SvgAsset");
    expect(source("src/app/admin/AdminLayout.tsx")).toContain("<SvgAsset");
  });

  it("renders media field previews and picker thumbnails through the SVG asset component", () => {
    const mediaAssetField = source("src/features/admin/shared/media-asset-field.tsx");

    expect(mediaAssetField.match(/<SvgAsset/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(mediaAssetField).toContain('localFile?.type === "image/svg+xml"');
  });

  it("sets SVG favicons with the correct type and sanitized data URI fallback", () => {
    const siteInfo = source("src/shared/site/site-info.ts");

    expect(siteInfo).toContain("image/svg+xml");
    expect(siteInfo).toContain("toSvgDataUri");
  });
});
