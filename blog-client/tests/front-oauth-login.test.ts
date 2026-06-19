import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import authPagesSource from "../src/features/blog/auth/AuthPages.tsx?raw";

const layoutsCss = readFileSync(
  new URL("../src/shared/theme/layouts.css", import.meta.url),
  "utf8",
);

describe("front OAuth login", () => {
  it("loads public login providers and handles one-time OAuth tickets", () => {
    expect(authPagesSource).toContain("/auth/providers");
    expect(authPagesSource).toContain("/auth/oauth/ticket");
    expect(authPagesSource).toContain("oauth_ticket");
    expect(authPagesSource).toContain("oauth_provider");
  });

  it("renders provider login actions only on the front login dialog", () => {
    expect(authPagesSource).toContain("provider.displayName");
    expect(authPagesSource).toContain("front-oauth-actions");
    expect(authPagesSource).toContain("onStartOAuth");
    expect(layoutsCss).toContain(".front-oauth-actions");
  });
});
