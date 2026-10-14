import { describe, expect, test } from "bun:test";
import { renderEmailExcerpt, renderEmailLogo, resolveEmailAssetUrl } from "./email-content";

const origin = "https://blog.example.test";

describe("email assets", () => {
  test("uses absolute public image URLs and bypasses stale upload cache entries", () => {
    expect(resolveEmailAssetUrl("/uploads/site/logo.png", origin)).toBe(
      `${origin}/uploads/site/logo.png?media-v=2`,
    );
    expect(resolveEmailAssetUrl("https://cdn.example.test/image.jpg?v=1", origin)).toBe(
      "https://cdn.example.test/image.jpg?v=1",
    );
    expect(
      renderEmailLogo({ logoUrl: "/uploads/logo.png", siteName: "Test", siteInitial: "T" }, origin),
    ).toContain('width="34" height="34"');
  });
  test.each([
    "javascript:alert(1)",
    "data:image/png;base64,test",
    "file:///tmp/photo",
    "https://user:password@example.test/x",
    "https://example.test/\nimage",
  ])("rejects unsafe assets: %s", (value) => {
    expect(resolveEmailAssetUrl(value, origin)).toBeNull();
    expect(renderEmailLogo({ logoUrl: value, siteName: "Test", siteInitial: "T" }, origin)).toBe(
      "T",
    );
  });
  test("strips unsafe HTML attributes and rejects executable URLs", () => {
    const result = renderEmailExcerpt(
      '<img src=x onerror="evil"> ![bad](javascript:alert) [bad](data:text/html,evil)',
      origin,
    );
    expect(result.html).not.toContain("onerror");
    expect(result.html).not.toContain("javascript:");
    expect(result.html).not.toContain("data:text");
    expect(result.html).toContain(`src="${origin}/x"`);
  });
  test("keeps images intact after long text while bounding the excerpt", () => {
    const result = renderEmailExcerpt("x".repeat(5000) + " ![photo](/uploads/photo.png)", origin);
    expect(result.html).toContain(`<img src="${origin}/uploads/photo.png?media-v=2"`);
    expect(result.text.length).toBeLessThan(2200);
  });
  test("renders editor image HTML with safe attributes only", () => {
    const result = renderEmailExcerpt(
      '<img src="/uploads/photo.png" width="200" onerror="evil" alt="Photo" />',
      origin,
    );
    expect(result.html).toContain(`<img src="${origin}/uploads/photo.png?media-v=2"`);
    expect(result.html).not.toContain("onerror");
    expect(result.text).toContain(`${origin}/uploads/photo.png?media-v=2`);
  });
});
