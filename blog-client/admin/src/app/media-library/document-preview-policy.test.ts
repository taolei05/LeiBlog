import { describe, expect, it } from "vite-plus/test";
import { getDocumentPreviewPolicy, withDocumentPreviewExtension } from "./document-preview-policy";

const media = {
  fileFormat: "docx",
  accessUrl: "/uploads/media/file.docx?media-v=2",
  storageProvider: "local" as const,
};
const policy = (changes = {}) =>
  getDocumentPreviewPolicy({
    media: { ...media, ...changes },
    origin: "https://blog.example.test",
  });
describe("document preview privacy and URL policy", () => {
  it("keeps PDF and text local, regardless of their storage or privacy", () => {
    expect(policy({ fileFormat: "pdf", folderSlug: "subscription-attachments" })).toEqual({
      kind: "pdf",
    });
    expect(policy({ fileFormat: "md" })).toEqual({ kind: "text" });
    expect(policy({ fileFormat: "txt" })).toEqual({ kind: "text" });
  });
  it("sends only public HTTPS Office URLs to the viewer", () => {
    expect(policy()).toEqual({
      kind: "office",
      url: "https://blog.example.test/uploads/media/file.docx?media-v=2#leiblog-preview.docx",
    });
    expect(
      policy({ storageProvider: "r2", accessUrl: "https://cdn.example.test/file.docx" }).kind,
    ).toBe("office");
  });
  it.each(["jpg", "jpeg", "PNG", "gif", "webp", "ico"])(
    "keeps private %s images local",
    (fileFormat) => {
      expect(
        policy({
          fileFormat,
          folderSlug: "subscription-attachments",
          accessUrl: "/api/admin/subscriptions/private/attachments/image",
        }),
      ).toEqual({ kind: "image" });
    },
  );
  it("never discloses authenticated or signed document links", () => {
    expect(policy({ folderSlug: "subscription-attachments" })).toEqual({
      kind: "download",
      reason: "privateOffice",
    });
    expect(policy({ accessUrl: "/api/admin/media/test/download" })).toEqual({
      kind: "download",
      reason: "privateOffice",
    });
    for (const accessUrl of [
      "https://example.test/uploads/f.docx?token=secret",
      "https://user:pass@example.test/uploads/f.docx",
      "http://example.test/uploads/f.docx",
      "javascript:alert(1)",
    ]) {
      expect(policy({ accessUrl }).kind).toBe("download");
    }
  });
  it.each(["localhost", "127.0.0.1", "192.168.3.125", "10.1.1.1", "172.16.0.2", "[::1]"])(
    "does not ask Microsoft to fetch local host %s",
    (host) => {
      expect(policy({ accessUrl: `https://${host}/uploads/a.docx` }).kind).toBe("download");
    },
  );
  it("preserves the real URL and query while fixing upstream extension detection", () => {
    const url = withDocumentPreviewExtension("blob:https://blog.example.test/id", "pdf");
    expect(url).toBe("blob:https://blog.example.test/id#leiblog-preview.pdf");
    expect(policy({ fileFormat: "exe" })).toEqual({ kind: "download", reason: "unsupported" });
  });
});
