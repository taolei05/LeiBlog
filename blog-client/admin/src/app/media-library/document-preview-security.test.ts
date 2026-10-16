import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

describe("production document preview security policy", () => {
  it("permits only local PDF blobs and Microsoft Office frames without weakening script or embedding restrictions", () => {
    const config = readFileSync(new URL("../../../../Caddyfile", import.meta.url), "utf8");
    const policy = config.match(/Content-Security-Policy "([^"]+)"/)?.[1];
    expect(policy).toContain("frame-src 'self' blob: https://view.officeapps.live.com;");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain("xdocin.com");
  });
});
