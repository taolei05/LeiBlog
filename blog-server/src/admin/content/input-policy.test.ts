import { describe, expect, test } from "bun:test";

import { ContentInputError } from "./errors";
import { normalizeContentUrl, parsePublicationDate } from "./input-policy";

describe("content URLs", () => {
  test.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "//example.test/path",
    "/\\example.test/path",
    "https://example.test/\npath",
  ])("rejects active or ambiguous URL %j", (url) => {
    expect(() => normalizeContentUrl(url)).toThrow(ContentInputError);
  });

  test("accepts web and local media URLs and preserves nullable clearing", () => {
    expect(normalizeContentUrl(" https://example.test/article ")).toBe(
      "https://example.test/article",
    );
    expect(normalizeContentUrl("http://example.test/article")).toBe("http://example.test/article");
    expect(normalizeContentUrl("/uploads/media/asset.png")).toBe("/uploads/media/asset.png");
    expect(normalizeContentUrl(null)).toBeNull();
    expect(normalizeContentUrl(undefined)).toBeNull();
    expect(normalizeContentUrl(" ")).toBeNull();
  });
});

describe("publication dates", () => {
  test("rejects invalid dates instead of silently converting them to immediate publication", () => {
    expect(() => parsePublicationDate("not-a-date")).toThrow(ContentInputError);
  });
  test("parses valid instants and keeps omitted fields distinct from explicit clearing", () => {
    expect(parsePublicationDate("2026-10-12T00:00:00Z")?.toISOString()).toBe(
      "2026-10-12T00:00:00.000Z",
    );
    expect(parsePublicationDate(undefined)).toBeUndefined();
    expect(parsePublicationDate(null)).toBeNull();
    expect(parsePublicationDate("")).toBeNull();
  });
});
