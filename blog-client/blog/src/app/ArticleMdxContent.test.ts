import { createElement } from "react";
import type { PropsWithChildren } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("react-photo-view", () => ({ PhotoView: ({ children }: PropsWithChildren) => children }));
vi.mock("@astryxdesign/core/CodeBlock", () => ({
  CodeBlock: ({ code }: { code: string }) => createElement("pre", null, code),
}));

import { ArticleMdxContent, parseArticleToc } from "./ArticleMdxContent";

const render = (content: string) =>
  renderToStaticMarkup(createElement(ArticleMdxContent, { content }));

describe("article images", () => {
  it("renders editor-resized images with persisted dimensions", () => {
    const markup = render(
      '<img width="400" height="225" alt="Resized" src="/uploads/resized.jpg" />',
    );
    expect(markup).toContain('src="/uploads/resized.jpg?media-v=2"');
    expect(markup).toContain('width="400"');
    expect(markup).toContain('height="225"');
    expect(markup).toContain("aspect-ratio:400 / 225");
    expect(markup).not.toContain("&lt;img");
  });

  it("keeps surrounding text and multiple resized images", () => {
    const markup = render(
      '<img width="320" height="180" src="/uploads/first.jpg" />\nAfter\n<img width="240" height="160" src="/uploads/second.jpg" />',
    );
    expect(markup.match(/<img /gu)).toHaveLength(2);
    expect(markup).toContain("After");
  });

  it("does not allow scripts, event handlers or unsafe sources through resized image HTML", () => {
    const markup = render(
      '<img width="300" src="javascript:alert(1)" />\n\n<img width="300" src="/uploads/test.jpg" onerror="alert(1)" />\n\n<svg onload="alert(1)"></svg>',
    );
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain("<svg");
    expect(markup).not.toContain('src="javascript:');
  });

  it("does not render image HTML inside code", () => {
    const markup = render('`<img width="400" src="/uploads/test.jpg" />`');
    expect(markup).not.toContain("<img");
    expect(markup).toContain("&lt;img");
  });

  it("renders an image next to text without requiring a blank line", () => {
    const markup = render("Before![](/uploads/article-covers/image.jpg?media-v=2)After");
    expect(markup).toContain("Before");
    expect(markup).toContain("After");
    expect(markup).toContain('src="/uploads/article-covers/image.jpg?media-v=2"');
    expect(markup).not.toContain("![](");
    expect(markup).toContain("mdx-image-link__preview");
  });

  it("renders adjacent images and preserves their order", () => {
    const markup = render("![First](/uploads/first.jpg)\n![Second](/uploads/second.jpg)");
    expect(markup.match(/<img /gu)).toHaveLength(2);
    expect(markup.indexOf('alt="First"')).toBeLessThan(markup.indexOf('alt="Second"'));
  });

  it("handles image titles, parentheses and reference-style images", () => {
    const markup = render(
      '![Caption](/uploads/image(1).jpg "Image title")\n\n![Reference][photo]\n\n[photo]: /uploads/reference.jpg',
    );
    expect(markup).toContain('src="/uploads/image(1).jpg?media-v=2"');
    expect(markup).toContain('title="Image title"');
    expect(markup).toContain('src="/uploads/reference.jpg?media-v=2"');
    expect(markup).not.toContain("[photo]:");
  });

  it("preserves image links without nesting a preview button inside an anchor", () => {
    const markup = render("[![Linked](/uploads/linked.jpg)](https://example.test/gallery)");
    expect(markup).toContain('href="https://example.test/gallery"');
    expect(markup).toContain('src="/uploads/linked.jpg?media-v=2"');
    expect(markup).not.toContain("<button");
  });

  it("leaves image syntax in inline and fenced code as text", () => {
    const markup = render("`![](/uploads/code.jpg)`\n\n```md\n![](/uploads/example.jpg)\n```");
    expect(markup).not.toContain("<img");
    expect(markup).toContain("![](/uploads/code.jpg)");
    expect(markup).toContain("![](/uploads/example.jpg)");
  });

  it("keeps table-of-contents IDs aligned with rendered headings", () => {
    const content = "# Title\n\n## Images\n\n![](/uploads/test.jpg)\n\n### Details";
    const markup = render(content);
    expect(parseArticleToc(content)).toEqual([
      { id: "images-2", label: "Images", level: 2 },
      { id: "details-3", label: "Details", level: 3 },
    ]);
    expect(markup).toContain('id="images-2"');
    expect(markup).toContain('id="details-3"');
  });
});

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
