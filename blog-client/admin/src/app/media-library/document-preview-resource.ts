import { readMediaAssetForPreview } from "../../../../shared/admin-api";
import { withDocumentPreviewExtension } from "./document-preview-policy";

export type DocumentPreviewResource =
  | { kind: "pdf" | "image"; url: string; dispose: () => void }
  | { kind: "text"; text: string; dispose: () => void };

export type DocumentPreviewRequest = {
  kind: DocumentPreviewResource["kind"];
  signal: AbortSignal;
};

const previewMaxBytes = { pdf: 25 * 1024 * 1024, text: 1024 * 1024, image: 5 * 1024 * 1024 };

export const createDocumentPreviewResource = async ({
  kind,
  blob,
  signal,
}: DocumentPreviewRequest & {
  blob: Blob;
}): Promise<DocumentPreviewResource> => {
  signal.throwIfAborted();
  if (blob.size > previewMaxBytes[kind]) throw new RangeError("Preview is too large");
  if (kind === "text") {
    const text = await blob.text();
    signal.throwIfAborted();
    return { kind, text, dispose: () => {} };
  }
  if (kind === "image") {
    if (
      ![
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/x-icon",
        "image/vnd.microsoft.icon",
      ].includes(blob.type)
    )
      throw new Error("Invalid image");
  } else if (!(await blob.slice(0, 1024).text()).includes("%PDF-")) {
    throw new Error("Invalid PDF");
  }
  signal.throwIfAborted();
  const url = URL.createObjectURL(
    kind === "pdf" ? new Blob([blob], { type: "application/pdf" }) : blob,
  );
  return {
    kind,
    url: kind === "pdf" ? withDocumentPreviewExtension(url, "pdf") : url,
    dispose: () => URL.revokeObjectURL(url),
  };
};

export const loadDocumentPreviewResource = async ({
  kind,
  ...parameters
}: DocumentPreviewRequest & {
  mediaId: string;
  token: string;
}): Promise<DocumentPreviewResource> => {
  const blob = await readMediaAssetForPreview({ ...parameters, maxBytes: previewMaxBytes[kind] });
  return createDocumentPreviewResource({ kind, blob, signal: parameters.signal });
};
