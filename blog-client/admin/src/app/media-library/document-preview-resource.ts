import { readMediaAssetForPreview } from "../../../../shared/admin-api";
import { withDocumentPreviewExtension } from "./document-preview-policy";

export type DocumentPreviewResource =
  | { kind: "pdf"; url: string; dispose: () => void }
  | { kind: "text"; text: string; dispose: () => void };

export const loadDocumentPreviewResource = async ({
  kind,
  ...parameters
}: {
  kind: "pdf" | "text";
  mediaId: string;
  token: string;
  signal: AbortSignal;
}): Promise<DocumentPreviewResource> => {
  const blob = await readMediaAssetForPreview({
    ...parameters,
    maxBytes: (kind === "pdf" ? 25 : 1) * 1024 * 1024,
  });
  if (kind === "text") {
    const text = await blob.text();
    parameters.signal.throwIfAborted();
    return { kind, text, dispose: () => {} };
  }
  if (!(await blob.slice(0, 1024).text()).includes("%PDF-")) {
    throw new Error("Invalid PDF");
  }
  parameters.signal.throwIfAborted();
  const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
  return {
    kind,
    url: withDocumentPreviewExtension(url, "pdf"),
    dispose: () => URL.revokeObjectURL(url),
  };
};
