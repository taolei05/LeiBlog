import { createElement } from "react";
import type { PropsWithChildren } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("react-photo-view", () => ({ PhotoView: ({ children }: PropsWithChildren) => children }));
vi.mock("@astryxdesign/core/CodeBlock", () => ({
  CodeBlock: ({ code }: { code: string }) => createElement("pre", null, code),
}));

import { ArticleMdxContent } from "./ArticleMdxContent";

describe("untrusted article rendering", () => {
  it("renders HTML and MDX expressions as escaped text", () => {
    const markup = renderToStaticMarkup(
      createElement(ArticleMdxContent, {
        content:
          "<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n{globalThis.alert(1)}",
      }),
    );
    expect(markup).not.toContain("<script>");
    expect(markup).not.toContain("<img");
    expect(markup).toContain("&lt;script&gt;");
    expect(markup).toContain("{globalThis.alert(1)}");
  });

  it("does not emit unsafe article links or image sources", () => {
    const markup = renderToStaticMarkup(
      createElement(ArticleMdxContent, {
        content:
          "[unsafe](javascript:evil)\n\n![image](data:text/html,evil)\n\n[safe](/articles/hello)\n\n![safe](/uploads/image.png)",
      }),
    );
    expect(markup).not.toContain("javascript:");
    expect(markup).not.toContain("data:text/html");
    expect(markup).toContain("unsafe");
    expect(markup).toContain('href="/articles/hello"');
    expect(markup).toContain('src="/uploads/image.png?media-v=2"');
  });
});
