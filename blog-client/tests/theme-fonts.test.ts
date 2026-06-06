import { describe, expect, it } from "vitest";

const tokensCss = await fetch(new URL("../src/shared/theme/tokens.css", import.meta.url)).then(
  (response) => response.text(),
);
const layoutsCss = await fetch(new URL("../src/shared/theme/layouts.css", import.meta.url)).then(
  (response) => response.text(),
);
const lxgwFont = await fetch(
  new URL("../public/fonts/LXGWWenKai-Medium.woff2", import.meta.url),
).then((response) => response.arrayBuffer());
const mapleMonoFont = await fetch(
  new URL("../public/fonts/MapleMono-Medium.woff2", import.meta.url),
).then((response) => response.arrayBuffer());

describe("theme fonts", () => {
  it("uses bundled public fonts for global text and frontend code blocks", () => {
    expect(tokensCss).toContain('font-family: "LXGW WenKai Local"');
    expect(tokensCss).toContain('url("/fonts/LXGWWenKai-Medium.woff2") format("woff2")');
    expect(tokensCss).toContain('font-family: "Maple Mono Local"');
    expect(tokensCss).toContain('url("/fonts/MapleMono-Medium.woff2") format("woff2")');
    expect(tokensCss).toMatch(/--font-sans:\s*"LXGW WenKai Local"/);
    expect(tokensCss).toContain(
      '--font-blog-code: "Maple Mono Local", "Maple Mono", var(--font-code)',
    );
    expect(layoutsCss).toMatch(
      /\.article-code-window code\s*{[^}]*font-family:\s*var\(--font-blog-code\)/s,
    );
    expect(lxgwFont.byteLength).toBeGreaterThan(0);
    expect(mapleMonoFont.byteLength).toBeGreaterThan(0);
  });
});
