import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

import { OAuthSignInOptions } from "./oauth-sign-in-options";
import type { PublicAuthProvider } from "../../../shared/admin-api";

describe("public OAuth sign-in options", () => {
  const render = (providers: PublicAuthProvider[], isPending = false) =>
    renderToStaticMarkup(
      createElement(OAuthSignInOptions, {
        dividerLabel: "Or continue with",
        isPending,
        onSelect: vi.fn(),
        providers,
        options: [
          { provider: "google", label: "Google sign-in", icon: null },
          { provider: "github", label: "GitHub sign-in", icon: null },
        ],
      }),
    );
  it("hides the entire section when no providers are enabled", () => {
    expect(render([])).toBe("");
  });
  it.each(["google", "github"] as const)("only shows enabled %s sign-in", (provider) => {
    const markup = render([{ provider, displayName: provider }]);
    expect(markup).toContain(provider === "google" ? "Google sign-in" : "GitHub sign-in");
    expect(markup).not.toContain(provider === "google" ? "GitHub sign-in" : "Google sign-in");
    expect(markup).not.toContain("Apple");
  });
  it("disables available options while another verification is pending", () => {
    expect(render([{ provider: "google", displayName: "Google" }], true)).toContain("disabled");
  });
});
