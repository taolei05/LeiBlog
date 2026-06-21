import { describe, expect, it } from "vitest";

import { getBlogAccountMenuItems } from "../src/app/blog/BlogLayout";
import layoutStyles from "../src/shared/theme/layouts.css?raw";

function readCssRule(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return layoutStyles.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`, "u"))?.[0] ?? "";
}

describe("blog account menu", () => {
  it("shows the admin entry only for admin users", () => {
    expect(getBlogAccountMenuItems("admin").map((item) => item.id)).toContain("admin");
    expect(getBlogAccountMenuItems("user").map((item) => item.id)).not.toContain("admin");
  });

  it("centers visitor avatar fallback in desktop and mobile account buttons", () => {
    const desktopFallbackRule = readCssRule(".blog-account-dropdown .admin-user .avatar__fallback");
    const mobileFallbackRule = readCssRule(
      ".blog-mobile-nav-drawer__controls .admin-user-button.blog-account-button .avatar__fallback",
    );

    expect(desktopFallbackRule).toContain("display: grid;");
    expect(desktopFallbackRule).toContain("place-items: center;");
    expect(mobileFallbackRule).toContain("display: grid;");
    expect(mobileFallbackRule).toContain("place-items: center;");
  });
});
