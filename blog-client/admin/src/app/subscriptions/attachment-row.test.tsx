import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { SubscriptionAttachmentRow } from "./attachment-row";

describe("subscription attachment actions", () => {
  it.each(["zh-CN", "en"] as const)("places preview before download in %s", (language) => {
    const html = renderToStaticMarkup(
      createElement(SubscriptionAttachmentRow, {
        attachment: {
          id: "invoice",
          fileName: "invoice.pdf",
          fileSize: 1024,
          createdAt: "2026-01-01",
        },
        language,
        isDownloading: false,
        onPreview: () => {},
        onDownload: () => {},
        onRemove: () => {},
      }),
    );
    const preview = html.indexOf(
      `aria-label="${language === "en" ? "Preview attachment" : "预览附件"}"`,
    );
    const download = html.indexOf(
      `aria-label="${language === "en" ? "Download attachment" : "下载附件"}"`,
    );
    const remove = html.indexOf(
      `aria-label="${language === "en" ? "Remove attachment" : "移除附件"}"`,
    );
    expect(preview).toBeGreaterThan(-1);
    expect(download).toBeGreaterThan(preview);
    expect(remove).toBeGreaterThan(download);
    expect(html).toContain("invoice.pdf");
    expect(html).toContain("1.0 KiB");
  });
});
