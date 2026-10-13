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
      "http://localhost:3000/uploads/test.png",
    );
    expect(resolveContentAssetUrl("//cdn.example.com:5174/test.png")).toBe(
      "http://cdn.example.com:5174/test.png",
    );
  });
});
