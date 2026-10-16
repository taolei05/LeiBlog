import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { DocumentViewer } from "./document-viewer";
import { getDocumentPreviewPolicy, withDocumentPreviewExtension } from "./document-preview-policy";

describe("actual react-doc-viewer-plus integration", () => {
  it("embeds the local PDF blob without using an online service", () => {
    const url = withDocumentPreviewExtension("blob:https://blog.test/file-id", "pdf");
    const html = renderToStaticMarkup(
      createElement(DocumentViewer, { url, fileName: "Invoice.pdf", onClose: () => {} }),
    );
    expect(html).toContain(`src="${url}"`);
    expect(html).toContain("admin-document-viewer");
    expect(html).not.toContain("officeapps");
    expect(html).not.toContain("xdocin");
  });
  it("sends only the public Office URL, including its original version parameter", () => {
    const policy = getDocumentPreviewPolicy({
      media: {
        accessUrl: "/uploads/media/contract.docx?media-v=2",
        fileFormat: "docx",
        storageProvider: "local",
      },
      origin: "https://blog.test",
    });
    if (policy.kind !== "office") throw new Error("Expected a public Office document");
    const html = renderToStaticMarkup(
      createElement(DocumentViewer, {
        url: policy.url,
        fileName: "Contract.docx",
        onClose: () => {},
      }),
    );
    expect(html).toContain(
      `src="https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(policy.url)}"`,
    );
    expect(html).not.toContain("/api/");
  });
});
