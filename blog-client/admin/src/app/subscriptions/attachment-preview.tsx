import { useCallback } from "react";
import type { SubscriptionAttachment } from "../../../../shared/subscriptions-api";
import { downloadSubscriptionAttachment } from "../../../../shared/subscriptions-api";
import { MediaDocumentPreview } from "../media-library/media-document-preview";
import { createDocumentPreviewResource } from "../media-library/document-preview-resource";
import type { DocumentPreviewRequest } from "../media-library/document-preview-resource";

export const loadSubscriptionAttachmentPreviewResource = async ({
  subscriptionId,
  attachmentId,
  fileName,
  token,
  kind,
  signal,
}: DocumentPreviewRequest & {
  subscriptionId: string;
  attachmentId: string;
  fileName: string;
  token: string;
}) => {
  const blob = await downloadSubscriptionAttachment({
    id: subscriptionId,
    attachmentId,
    token,
    signal,
  });
  const imageTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    ico: "image/x-icon",
  };
  const imageType = imageTypes[fileName.split(".").pop()?.toLowerCase() ?? ""];
  // Attachment downloads intentionally use octet-stream; the saved extension was validated on upload.
  const content =
    kind === "image" && blob.type === "application/octet-stream" && imageType
      ? new Blob([blob], { type: imageType })
      : blob;
  return createDocumentPreviewResource({ kind, blob: content, signal });
};

type SubscriptionAttachmentPreviewProps = {
  subscriptionId: string;
  attachment: SubscriptionAttachment;
  token: string;
  isNarrow: boolean;
  onClose: () => void;
  onDownload: () => Promise<void>;
};
export const SubscriptionAttachmentPreview = ({
  subscriptionId,
  attachment,
  token,
  ...props
}: SubscriptionAttachmentPreviewProps) => {
  const readResource = useCallback(
    (request: DocumentPreviewRequest) =>
      loadSubscriptionAttachmentPreviewResource({
        ...request,
        subscriptionId,
        attachmentId: attachment.id,
        fileName: attachment.fileName,
        token,
      }),
    [subscriptionId, attachment.id, attachment.fileName, token],
  );
  return (
    <MediaDocumentPreview
      {...props}
      token={token}
      media={{
        id: attachment.id,
        fileName: attachment.fileName,
        fileFormat: attachment.fileName.split(".").pop() ?? "",
        accessUrl: `/api/admin/subscriptions/${subscriptionId}/attachments/${attachment.id}`,
        folderSlug: "subscription-attachments",
        storageProvider: "local",
      }}
      readResource={readResource}
    />
  );
};
