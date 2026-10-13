import { describe, expect, test } from "bun:test";
import { resolvePublicOrigin } from "./public-origin";

describe("public deployment origin", () => {
  const input = {
    corsOrigins: ["https://blog.example.com"],
    hostname: "0.0.0.0",
    port: 3000,
    isProduction: true,
  };
  test("uses the HTTPS frontend origin behind a reverse proxy", () => {
    expect(resolvePublicOrigin(input)).toBe("https://blog.example.com");
  });
  test("accepts an explicit canonical public origin", () => {
    expect(resolvePublicOrigin({ ...input, configuredOrigin: "https://www.example.com/" })).toBe(
      "https://www.example.com",
    );
  });
  test("refuses unsafe or non-origin production values", () => {
    for (const configuredOrigin of [
      "http://example.com",
      "https://user:pass@example.com",
      "https://example.com/path",
      "https://example.com/?x=1",
      "javascript:alert(1)",
    ]) {
      expect(() => resolvePublicOrigin({ ...input, configuredOrigin })).toThrow();
    }
  });
  test("retains the local API origin in development", () => {
    expect(resolvePublicOrigin({ ...input, isProduction: false })).toBe("http://localhost:3000");
  });
});
