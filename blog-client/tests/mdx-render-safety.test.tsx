import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import mdxRendererSource from "../src/shared/mdx/MdxRenderer.tsx?raw";
import { MdxRenderer } from "../src/shared/mdx/MdxRenderer";
import {
  allowedMdxJsxComponentNames,
  isAllowedMdxJsxComponent,
  mdxJsxComponentDescriptors,
} from "../src/shared/mdx/mdxWhitelist";

const layoutsCss = await fetch(new URL("../src/shared/theme/layouts.css", import.meta.url)).then(
  (response) => response.text(),
);

describe("MDX rendering safety", () => {
  it("keeps custom JSX constrained to the shared whitelist", () => {
    expect(allowedMdxJsxComponentNames).toEqual(["Callout", "ImageLink", "ReadNext", "CodeBlock"]);
    expect(mdxJsxComponentDescriptors.map((descriptor) => descriptor.name)).toEqual(
      allowedMdxJsxComponentNames,
    );
    expect(isAllowedMdxJsxComponent("Callout")).toBe(true);
    expect(isAllowedMdxJsxComponent("script")).toBe(false);
    expect(isAllowedMdxJsxComponent("iframe")).toBe(false);
  });

  it("escapes raw text instead of emitting executable script tags", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <MdxRenderer>{"<script>alert('xss')</script>"}</MdxRenderer>
      </MemoryRouter>,
    );

    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("renders only the allowed reading components", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <MdxRenderer>
          {({ Callout, CodeBlock, ImageLink, ReadNext }) => (
            <>
              <Callout title="提示" tone="info">
                安全组件
              </Callout>
              <CodeBlock fileName="example.ts">const ok = true;</CodeBlock>
              <ImageLink alt="测试图" src="https://example.com/image.png" />
              <ReadNext title="下一篇" to="/articles/next" />
            </>
          )}
        </MdxRenderer>
      </MemoryRouter>,
    );

    expect(html).toContain("mdx-callout");
    expect(html).toContain("article-code-window");
    expect(html).toContain("article-code-window__copy");
    expect(html).toContain('aria-label="复制代码"');
    expect(html).toContain("复制");
    expect(html).toContain("mdx-image-link__preview");
    expect(html).toContain('src="https://example.com/image.png"');
    expect(html).toContain('href="/articles/next"');
  });

  it("themes article code blocks for light and dark frontend modes", () => {
    expect(layoutsCss).toContain("--article-code-bg: color-mix");
    expect(layoutsCss).toContain("--article-code-ink: var(--cursor-ink)");
    expect(layoutsCss).toContain("--article-code-caption-bg: color-mix");
    expect(layoutsCss).toContain("--article-code-dot-close: #ff5f57");
    expect(layoutsCss).toContain("--article-code-dot-minimize: #ffbd2e");
    expect(layoutsCss).toContain("--article-code-dot-maximize: #28c840");
    expect(layoutsCss).toContain(
      ':is(.dark, [data-theme="dark"]) .blog-shell .article-code-window',
    );
    expect(layoutsCss).not.toMatch(
      /\.article-code-window\s*{[^}]*background:\s*var\(--cursor-media-base\)/s,
    );
    expect(layoutsCss).not.toMatch(/\.article-code-window\s*{[^}]*color:\s*#f4f4f5/s);
  });

  it("copies the current code block through the clipboard API", () => {
    expect(mdxRendererSource).toContain("navigator.clipboard.writeText");
    expect(mdxRendererSource).toContain("getCodeBlockText(children)");
    expect(mdxRendererSource).toContain("setIsCopied(true)");
  });
});
