import type { MediaAsset } from "../../../../shared/admin-api";

export type DocumentPreviewPolicy =
  | { kind: "pdf" | "text" }
  | { kind: "office"; url: string }
  | { kind: "download"; reason: "privateOffice" | "publicUrlRequired" | "unsupported" };

const officeFormats = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"];
const isLocalHost = (hostname: string) =>
  hostname === "localhost" ||
  hostname.endsWith(".localhost") ||
  hostname.endsWith(".local") ||
  hostname.includes(":") ||
  /^(?:127|10|0)\./.test(hostname) ||
  hostname.startsWith("192.168.") ||
  /^172\.(?:1[6-9]|2\d|3[01])\./.test(hostname) ||
  hostname.startsWith("169.254.");

export const withDocumentPreviewExtension = (url: string, format: string) => {
  // The upstream viewer determines format from the very end of the URL, including its query.
  const result = new URL(url);
  result.hash = `leiblog-preview.${format}`;
  return result.href;
};

export const getDocumentPreviewPolicy = ({
  media,
  origin,
}: {
  media: Pick<MediaAsset, "fileFormat" | "accessUrl" | "folderSlug" | "storageProvider">;
  origin: string;
}): DocumentPreviewPolicy => {
  const format = media.fileFormat.toLowerCase();
  if (format === "pdf") return { kind: "pdf" };
  if (["txt", "md"].includes(format)) return { kind: "text" };
  if (!officeFormats.includes(format)) return { kind: "download", reason: "unsupported" };
  try {
    const url = new URL(media.accessUrl, origin);
    if (media.folderSlug === "subscription-attachments" || url.pathname.startsWith("/api/")) {
      return { kind: "download", reason: "privateOffice" };
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      isLocalHost(url.hostname) ||
      (media.storageProvider !== "r2" && !url.pathname.startsWith("/uploads/")) ||
      [...url.searchParams.keys()].some((key) => key !== "media-v")
    ) {
      return { kind: "download", reason: "publicUrlRequired" };
    }
    return { kind: "office", url: withDocumentPreviewExtension(url.href, format) };
  } catch {
    return { kind: "download", reason: "publicUrlRequired" };
  }
};
