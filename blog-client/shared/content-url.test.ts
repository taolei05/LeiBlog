import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { getSafeLinkUrl, resolveContentAssetUrl } from "./content-url";

afterEach(() => vi.unstubAllGlobals());

describe("untrusted content URLs", () => {
  it.each([
    "javascript:alert(1)",
    " JaVaScRiPt:alert(1) ",
    "java\nscript:alert(1)",
    "\u0000javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "blob:https://example.com/id",
    "https://[",
    "",
  ])("rejects an unsafe or malformed link: %s", (value) => {
    expect(getSafeLinkUrl(value)).toBeUndefined();
    expect(resolveContentAssetUrl(value)).toBe("");
  });

  it.each([
    "https://example.com/a",
    "http://example.com/a",
    "/articles/a",
    "../a",
    "#heading",
    "?page=2",
  ])("preserves a safe link: %s", (value) => expect(getSafeLinkUrl(value)).toBe(value));

  it("allows contact links only as links", () => {
    expect(getSafeLinkUrl("mailto:author@example.com")).toBe("mailto:author@example.com");
    expect(getSafeLinkUrl("tel:+123456")).toBe("tel:+123456");
    expect(resolveContentAssetUrl("mailto:author@example.com")).toBe("");
    expect(getSafeLinkUrl(null)).toBeUndefined();
    expect(getSafeLinkUrl(undefined)).toBeUndefined();
  });

  it("rewrites local dev assets without rewriting third-party ports", () => {
    vi.stubGlobal("window", { location: { origin: "http://localhost:5174" } });
    expect(resolveContentAssetUrl("/uploads/test.png")).toBe(
      "http://localhost:3000/uploads/test.png?media-v=2",
    );
    expect(resolveContentAssetUrl("//cdn.example.com:5174/test.png")).toBe(
      "http://cdn.example.com:5174/test.png",
    );
  });

  it("versions local images consistently for the public site without changing safe links", () => {
    vi.stubGlobal("window", { location: { origin: "https://taolei.net" } });
    const source = "/uploads/site/2026/10/logo.png";
    const displayUrl = resolveContentAssetUrl(source);
    expect(displayUrl).toBe("https://taolei.net/uploads/site/2026/10/logo.png?media-v=2");
    expect(resolveContentAssetUrl(displayUrl)).toBe(displayUrl);
    expect(getSafeLinkUrl(source)).toBe(source);
  });

  it("preserves query parameters and fragments while replacing an old media version", () => {
    vi.stubGlobal("window", { location: { origin: "https://taolei.net" } });
    const result = new URL(
      resolveContentAssetUrl("/uploads/image.png?download=1&media-v=1#preview"),
    );
    expect(result.searchParams.get("download")).toBe("1");
    expect(result.searchParams.getAll("media-v")).toEqual(["2"]);
    expect(result.hash).toBe("#preview");
  });

  it("does not version external, signed, or built-in image URLs", () => {
    vi.stubGlobal("window", { location: { origin: "https://taolei.net" } });
    expect(resolveContentAssetUrl("https://cdn.example.com/uploads/image.png?signature=abc")).toBe(
      "https://cdn.example.com/uploads/image.png?signature=abc",
    );
    expect(resolveContentAssetUrl("//cdn.example.com/uploads/image.png")).toBe(
      "https://cdn.example.com/uploads/image.png",
    );
    expect(resolveContentAssetUrl("/assets/logo.png")).toBe("https://taolei.net/assets/logo.png");
  });
});
