import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { i18n } from "../../../../shared/i18n";
import { DocumentPreviewContent } from "./media-document-preview";

const render = (props: Partial<Parameters<typeof DocumentPreviewContent>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(DocumentPreviewContent, {
      fileName: "contract.pdf",
      policy: { kind: "pdf" },
      state: { status: "loading" },
      onClose: () => {},
      onRetry: () => {},
      ...props,
    }),
  );

describe("document preview content", () => {
  it.each(["zh-CN", "en"])(
    "localizes loading, errors and private Office fallback in %s",
    async (language) => {
      await i18n.changeLanguage(language);
      expect(render()).toContain(language === "en" ? "Loading document" : "正在加载文档");
      const failed = render({ state: { status: "failed", tooLarge: false } });
      expect(failed).toContain('role="alert"');
      expect(failed).toContain(language === "en" ? "Retry" : "重试");
      const oversized = render({ state: { status: "failed", tooLarge: true } });
      expect(oversized).toContain("25 MB");
      const privateFile = render({ policy: { kind: "download", reason: "privateOffice" } });
      expect(privateFile).toContain(language === "en" ? "private" : "私有");
      expect(privateFile).not.toContain("iframe");
      expect(privateFile).not.toContain("officeapps");
    },
  );
  it("escapes HTML in text and preserves whitespace and keyboard scrolling", () => {
    const html = render({
      policy: { kind: "text" },
      state: {
        status: "ready",
        resource: { kind: "text", text: "# Title\n<script>alert(1)</script>", dispose: () => {} },
      },
    });
    expect(html).toContain("# Title\n&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain('tabindex="0"');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("iframe");
  });
  it("contains images at their natural aspect ratio without a remote iframe", () => {
    const html = render({
      fileName: "invoice.png",
      policy: { kind: "image" },
      state: {
        status: "ready",
        resource: { kind: "image", url: "blob:https://blog.test/private-image", dispose: () => {} },
      },
    });
    expect(html).toContain('alt="invoice.png"');
    expect(html).toContain('src="blob:https://blog.test/private-image"');
    expect(html).toContain("object-fit:contain");
    expect(html).not.toContain("iframe");
  });
});
