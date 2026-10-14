import { describe, expect, it } from "vite-plus/test";
import { resolveApiBaseUrl } from "./api-base-url";

describe("API deployment origin", () => {
  it("uses same-origin API routes in production", () => {
    expect(resolveApiBaseUrl({ isProduction: true })).toBe("");
  });
  it("uses the API development port only in development", () => {
    expect(
      resolveApiBaseUrl({
        isProduction: false,
        location: { protocol: "http:", hostname: "192.168.1.2" },
      }),
    ).toBe("http://192.168.1.2:3000");
  });
  it("honors an explicit empty same-origin configuration", () => {
    expect(resolveApiBaseUrl({ isProduction: false, configuredUrl: "" })).toBe("");
  });
  it("uses the same-origin proxy for HTTPS development without accessing an HTTP backend", () => {
    expect(
      resolveApiBaseUrl({
        isProduction: false,
        location: { protocol: "https:", hostname: "192.168.3.125" },
      }),
    ).toBe("");
  });
  it("normalizes a configured origin", () => {
    expect(
      resolveApiBaseUrl({ isProduction: true, configuredUrl: " https://api.example.com/ " }),
    ).toBe("https://api.example.com");
  });
});
