import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { MdxRenderer } from "../src/shared/mdx/MdxRenderer";
import {
  allowedMdxJsxComponentNames,
  isAllowedMdxJsxComponent,
  mdxJsxComponentDescriptors,
} from "../src/shared/mdx/mdxWhitelist";

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
    expect(html).toContain('href="https://example.com/image.png"');
    expect(html).toContain('href="/articles/next"');
  });
});
