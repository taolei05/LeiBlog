import { describe, expect, it } from "vitest";

const layoutsCss = await fetch(new URL("../src/shared/theme/layouts.css", import.meta.url)).then(
  (response) => response.text(),
);

describe("category cover fallback", () => {
  it("does not render tone-colored cover blocks for categories without covers", () => {
    expect(layoutsCss).not.toMatch(
      /\.category-overview-card--(?:amber|cyan|green|pink|violet):not\(\.has-cover\)/,
    );
  });

  it("does not mute temporary article fallback covers", () => {
    expect(layoutsCss).not.toMatch(/\.home-article-row__media--fallback img\s*{[^}]*opacity:/s);
    expect(layoutsCss).not.toMatch(/\.home-article-row__media--fallback img\s*{[^}]*filter:/s);
  });
});
