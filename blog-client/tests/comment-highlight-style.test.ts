import { describe, expect, it } from "vitest";

const layoutsCss = await fetch(new URL("../src/shared/theme/layouts.css", import.meta.url)).then(
  (response) => response.text(),
);

describe("comment highlight marker", () => {
  it("uses a whole-comment focus marker for linked comments", () => {
    expect(layoutsCss).toMatch(
      /\.comment-item\.is-highlighted::before\s*{[^}]*inset:\s*-0\.625rem -0\.75rem;[^}]*border-radius:\s*1rem;[^}]*pointer-events:\s*none;/s,
    );
    expect(layoutsCss).toMatch(
      /\.comment-item\.is-highlighted::after\s*{[^}]*clip-path:\s*polygon\(0 0,\s*100% 0,\s*100% 100%\);/s,
    );
    expect(layoutsCss).not.toMatch(/\.comment-item\.is-highlighted \.comment-item__body::before/);
    expect(layoutsCss).not.toMatch(/\.comment-item\.is-highlighted \.comment-item__body::after/);
  });
});
