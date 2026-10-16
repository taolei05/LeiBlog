import { lazy, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, RefreshCw } from "lucide-react";
import { Center } from "@astryxdesign/core/Center";
import { Button } from "@astryxdesign/core/Button";
import { Spinner } from "@astryxdesign/core/Spinner";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import type { MediaAsset } from "../../../../shared/admin-api";
import { resolveAdminAssetUrl } from "../../../../shared/admin-api";
import { AdminAsyncContent } from "../components/admin-async-content";
import { AdminFormDialog } from "../components/admin-form-dialog";
import { getDocumentPreviewPolicy } from "./document-preview-policy";
import type { DocumentPreviewPolicy } from "./document-preview-policy";
import { loadDocumentPreviewResource } from "./document-preview-resource";
import type { DocumentPreviewRequest, DocumentPreviewResource } from "./document-preview-resource";

const DocumentViewer = lazy(async () => ({
  default: (await import("./document-viewer")).DocumentViewer,
}));
type PreviewState =
  | { status: "loading" }
  | { status: "failed"; tooLarge: boolean }
  | { status: "ready"; resource: DocumentPreviewResource };

type DocumentPreviewContentProps = {
  policy: DocumentPreviewPolicy;
  state: PreviewState;
  fileName: string;
  onClose: () => void;
  onRetry: () => void;
};
export const DocumentPreviewContent = ({
  policy,
  state,
  fileName,
  onClose,
  onRetry,
}: DocumentPreviewContentProps) => {
  const { t } = useTranslation();
  if (policy.kind === "download") {
    return (
      <Center height="100%" padding={4}>
        <Text color="secondary">{t(`admin.mediaLibrary.documentPreview.${policy.reason}`)}</Text>
      </Center>
    );
  }
  if (policy.kind !== "office" && state.status === "loading") {
    return (
      <Center height="100%">
        <Spinner label={t("admin.mediaLibrary.documentPreview.loading")} />
      </Center>
    );
  }
  if (policy.kind !== "office" && state.status === "failed") {
    return (
      <Center height="100%" padding={4}>
        <VStack gap={3} hAlign="center">
          <Text role="alert">
            {t(`admin.mediaLibrary.documentPreview.${state.tooLarge ? "tooLarge" : "failed"}`)}
          </Text>
          {!state.tooLarge && (
            <Button
              icon={<RefreshCw size={16} />}
              label={t("admin.asyncContent.retry")}
              variant="secondary"
              onClick={onRetry}
            />
          )}
        </VStack>
      </Center>
    );
  }
  if (state.status === "ready" && state.resource.kind === "text" && policy.kind === "text") {
    return (
      <VStack
        as="pre"
        className="admin-document-text"
        gap={0}
        padding={3}
        isScrollable
        height="100%"
        tabIndex={0}
      >
        {state.resource.text}
      </VStack>
    );
  }
  if (state.status === "ready" && state.resource.kind === "image" && policy.kind === "image") {
    return (
      <img
        src={state.resource.url}
        alt={fileName}
        style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
      />
    );
  }
  const url =
    policy.kind === "office"
      ? policy.url
      : state.status === "ready" && state.resource.kind === "pdf"
        ? state.resource.url
        : undefined;
  if (!url) return null;
  return (
    <AdminAsyncContent>
      <DocumentViewer url={url} fileName={fileName} onClose={onClose} />
    </AdminAsyncContent>
  );
};

type MediaDocumentPreviewProps = {
  media: Pick<
    MediaAsset,
    "id" | "fileName" | "fileFormat" | "accessUrl" | "folderSlug" | "storageProvider"
  >;
  token: string;
  isNarrow: boolean;
  onClose: () => void;
  onDownload: () => Promise<void>;
  readResource?: (request: DocumentPreviewRequest) => Promise<DocumentPreviewResource>;
};
export const MediaDocumentPreview = ({
  media,
  token,
  isNarrow,
  onClose,
  onDownload,
  readResource,
}: MediaDocumentPreviewProps) => {
  const { t } = useTranslation();
  const policy = getDocumentPreviewPolicy({
    media,
    origin:
      typeof window === "undefined"
        ? "https://localhost"
        : new URL(resolveAdminAssetUrl("/"), window.location.origin).origin,
  });
  const [state, setState] = useState<PreviewState>({ status: "loading" });
  const [revision, setRevision] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const kind = policy.kind;
  useEffect(() => {
    if (kind !== "pdf" && kind !== "text" && kind !== "image") return;
    const controller = new AbortController();
    let resource: DocumentPreviewResource | undefined;
    setState({ status: "loading" });
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    const pending = readResource
      ? readResource({ kind, signal })
      : loadDocumentPreviewResource({ kind, mediaId: media.id, token, signal });
    void pending
      .then((result) => {
        if (controller.signal.aborted) result.dispose();
        else {
          resource = result;
          setState({ status: "ready", resource: result });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({ status: "failed", tooLarge: error instanceof RangeError });
      });
    return () => {
      controller.abort();
      resource?.dispose();
    };
  }, [kind, media.id, token, revision, readResource]);

  return (
    <AdminFormDialog
      title={t("admin.mediaLibrary.preview")}
      description={<Text className="admin-document-name">{media.fileName}</Text>}
      isNarrow={isNarrow}
      width={1100}
      closeLabel={t("actions.close")}
      cancelLabel={t("actions.close")}
      primaryLabel={t("admin.mediaLibrary.download")}
      primaryIcon={<Download size={16} />}
      isPrimaryLoading={downloading}
      onClose={onClose}
      onSubmit={() => {
        if (downloading) return;
        setDownloading(true);
        void onDownload().finally(() => setDownloading(false));
      }}
    >
      {policy.kind === "office" && (
        <Text type="supporting" color="secondary">
          {t("admin.mediaLibrary.documentPreview.officeDisclosure")}
        </Text>
      )}
      <VStack
        gap={0}
        className={`admin-document-preview${policy.kind === "download" ? " admin-document-preview--download" : ""}`}
      >
        <DocumentPreviewContent
          policy={policy}
          state={state}
          fileName={media.fileName}
          onClose={onClose}
          onRetry={() => setRevision((value) => value + 1)}
        />
      </VStack>
    </AdminFormDialog>
  );
};
