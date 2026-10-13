import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  CloudUpload,
  Copy,
  Database,
  Download,
  Eye,
  ExternalLink,
  FileText,
  Film,
  Folder,
  FolderPlus,
  Image,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Dialog } from "@astryxdesign/core/Dialog";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Grid, GridSpan } from "@astryxdesign/core/Grid";
import { IconButton } from "@astryxdesign/core/IconButton";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { Pagination } from "@astryxdesign/core/Pagination";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Spinner } from "@astryxdesign/core/Spinner";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";

import {
  AdminFeedbackBanner,
  createAdminFeedbackBanner,
} from "../components/admin-feedback-banner";
import type { AdminFeedbackBannerState } from "../components/admin-feedback-banner";
import { AdminActionTooltip } from "../components/admin-action-tooltip";
import { AdminFormDialog } from "../components/admin-form-dialog";
import type {
  MediaAsset,
  MediaFileType,
  MediaFolder,
  MediaLibraryList,
  MediaStorageProvider,
} from "../../../../shared/admin-api";
import {
  createMediaFolder,
  deleteMediaAsset,
  deleteMediaFolder,
  downloadMediaAsset,
  getMediaAssets,
  getMediaFolders,
  migrateMediaStorage,
  resolveAdminAssetUrl,
  uploadMediaAsset,
  updateMediaAsset,
  updateMediaFolder,
} from "../../../../shared/admin-api";
import { normalizeLanguage } from "../../../../shared/i18n";
import type { LocalImageEditorKind } from "../../../../shared/local-image-editor";
import {
  getLocalImageEditorKind,
  LocalImageEditorDialog,
} from "../../../../shared/local-image-editor";
import { formatDateTimeInTimeZone } from "../../../../shared/time-zone";

type MediaFilter = MediaFileType | "all";
type MediaViewMode = "grid" | "list";
type MediaStorageFilter = MediaStorageProvider | "all";
type BulkDeleteResult = { ok: true } | { error: unknown; ok: false };
type MediaMigrationTarget = MediaStorageProvider;

type UploadEditState = {
  file: File;
  folderSlug: string;
  kind: LocalImageEditorKind;
  pendingFiles: File[];
  readyFiles: File[];
};

type ContinueUploadWorkflowParameters = {
  folderSlug: string;
  pendingFiles: File[];
  readyFiles: File[];
};

type UploadSelectedFilesParameters = {
  files: File[];
  folderSlug: string;
};

type FolderFormState =
  | {
      description: string;
      mode: "create";
      name: string;
      slug: string;
    }
  | {
      description: string;
      folder: MediaFolder;
      mode: "edit";
      name: string;
      slug: string;
    };

type MediaLibraryPageProps = {
  authToken: string;
  isNarrow: boolean;
  timeZone: string;
};

const MEDIA_FILTERS: MediaFilter[] = ["all", "image", "video", "document"];
const MEDIA_STORAGE_FILTERS: MediaStorageFilter[] = ["all", "local", "r2"];
const MEDIA_VIEW_MODES: MediaViewMode[] = ["grid", "list"];
const PAGE_SIZE_OPTIONS = [12, 24, 48];
const ALL_FOLDERS_VALUE = "all";
const DEFAULT_UPLOAD_FOLDER_SLUG = "media";
const SYSTEM_MEDIA_FOLDER_TRANSLATION_KEYS = {
  "article-covers": "articleCovers",
  avatars: "avatars",
  comments: "comments",
  media: "media",
  site: "site",
  "website-icons": "websiteIcons",
} as const;

type SystemMediaFolderSlug = keyof typeof SYSTEM_MEDIA_FOLDER_TRANSLATION_KEYS;
type SystemMediaFolderTranslationKey =
  (typeof SYSTEM_MEDIA_FOLDER_TRANSLATION_KEYS)[SystemMediaFolderSlug];

const EMPTY_MEDIA_LIBRARY_LIST: MediaLibraryList = {
  media: [],
  pageInfo: {
    page: 1,
    pageSize: 12,
    totalItems: 0,
    totalPages: 1,
  },
  summary: {
    documents: 0,
    images: 0,
    storageBytes: 0,
    total: 0,
    videos: 0,
  },
};

const MEDIA_LIBRARY_ERROR_KEYS: Record<string, string> = {
  "File is empty.": "admin.mediaLibrary.errors.emptyFile",
  "File is too large.": "admin.mediaLibrary.errors.fileTooLarge",
  "File type is not supported.": "admin.mediaLibrary.errors.unsupportedFileType",
  "Media asset was not found.": "admin.mediaLibrary.errors.notFound",
  "Media folder was not found.": "admin.mediaLibrary.errors.folderNotFound",
  "Media folder slug already exists.": "admin.mediaLibrary.errors.folderSlugExists",
  "Protected media folder cannot be deleted.": "admin.mediaLibrary.errors.protectedFolder",
  "Cloudflare R2 storage configuration is incomplete.": "admin.mediaLibrary.errors.r2Incomplete",
  "Remote media download is not supported.": "admin.mediaLibrary.errors.remoteDownload",
};

const getSystemMediaFolderTranslationKey = (
  slug?: string,
  systemKey?: string,
): SystemMediaFolderTranslationKey | undefined => {
  if (slug !== undefined && slug in SYSTEM_MEDIA_FOLDER_TRANSLATION_KEYS) {
    return SYSTEM_MEDIA_FOLDER_TRANSLATION_KEYS[slug as SystemMediaFolderSlug];
  }

  if (systemKey !== undefined && systemKey in SYSTEM_MEDIA_FOLDER_TRANSLATION_KEYS) {
    return SYSTEM_MEDIA_FOLDER_TRANSLATION_KEYS[systemKey as SystemMediaFolderSlug];
  }

  return undefined;
};

const pageStackStyle: CSSProperties = {
  width: "100%",
};

const summaryIconStyle: CSSProperties = {
  color: "var(--color-text-secondary)",
};

const filterCardStyle: CSSProperties = {
  width: "100%",
};

const folderCardStyle: CSSProperties = {
  width: "100%",
};

const folderGridStyle: CSSProperties = {
  alignItems: "center",
  display: "grid",
  columnGap: 4,
  gridTemplateColumns: "repeat(auto-fill, minmax(116px, 154px))",
  rowGap: 4,
  width: "100%",
};

const folderButtonStyle: CSSProperties = {
  justifyContent: "space-between",
  minWidth: 0,
  width: "100%",
};

const folderMetaStyle: CSSProperties = {
  flex: "0 0 auto",
  fontVariantNumeric: "tabular-nums",
  minWidth: 14,
  textAlign: "right",
};

const activeFolderLabelStyle: CSSProperties = {
  color: "var(--color-on-accent)",
  fontWeight: 700,
};

const activeFolderMetaStyle: CSSProperties = {
  ...folderMetaStyle,
  color: "color-mix(in srgb, var(--color-on-accent) 72%, transparent)",
  fontWeight: 700,
};

const folderActionButtonStyle: CSSProperties = {
  flex: "0 0 auto",
  height: 24,
  width: 24,
};

const hiddenInputStyle: CSSProperties = {
  display: "none",
};

const mediaCardStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
};

const mediaListCardStyle: CSSProperties = {
  overflow: "hidden",
  width: "100%",
};

const mediaListViewportStyle: CSSProperties = {
  overflowX: "auto",
  width: "100%",
};

const mediaListTableStyle: CSSProperties = {
  minWidth: "max-content",
  width: "100%",
};

const mediaListNarrowTableStyle: CSSProperties = {
  width: "100%",
};

const mediaListHeaderStyle: CSSProperties = {
  alignItems: "center",
  background: "var(--color-surface-subtle)",
  borderBottom: "1px solid var(--color-border)",
  display: "grid",
  gap: 12,
  gridTemplateColumns: "48px minmax(260px, 2fr) 120px 140px 96px 160px 132px",
  justifyItems: "center",
  padding: "12px 16px",
};

const mediaListRowStyle: CSSProperties = {
  alignItems: "center",
  display: "grid",
  gap: 12,
  gridTemplateColumns: "48px minmax(260px, 2fr) 120px 140px 96px 160px 132px",
  justifyItems: "center",
  padding: "12px 16px",
};

const mediaListNarrowRowStyle: CSSProperties = {
  padding: 12,
};

const mediaListThumbnailFrameStyle: CSSProperties = {
  aspectRatio: "4 / 3",
  width: 72,
};

const mediaListHeaderCellStyle: CSSProperties = {
  justifySelf: "center",
  textAlign: "center",
};

const mediaListFileCellStyle: CSSProperties = {
  alignItems: "center",
  display: "flex",
  justifyContent: "center",
  justifySelf: "stretch",
  minWidth: 0,
};

const mediaListFileContentStyle: CSSProperties = {
  alignItems: "center",
  justifyContent: "center",
  minWidth: 0,
  width: "100%",
};

const mediaListFileTextStyle: CSSProperties = {
  minWidth: 0,
  textAlign: "center",
};

const mediaListCellStyle: CSSProperties = {
  alignItems: "center",
  display: "flex",
  justifyContent: "center",
  justifySelf: "center",
  minWidth: 0,
  textAlign: "center",
};

const mediaListActionsStyle: CSSProperties = {
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
};

const previewFrameStyle: CSSProperties = {
  alignItems: "center",
  aspectRatio: "16 / 9",
  background: "var(--color-surface-subtle)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-control)",
  display: "flex",
  justifyContent: "center",
  overflow: "hidden",
  width: "100%",
};

const previewImageStyle: CSSProperties = {
  display: "block",
  height: "100%",
  objectFit: "cover",
  width: "100%",
};

const previewButtonStyle: CSSProperties = {
  background: "transparent",
  border: 0,
  cursor: "pointer",
  display: "block",
  padding: 0,
  width: "100%",
};

const mediaListThumbnailButtonStyle: CSSProperties = {
  ...previewButtonStyle,
  flex: "0 0 72px",
  width: 72,
};

const documentPreviewStyle: CSSProperties = {
  color: "var(--color-text-secondary)",
};

const mediaUrlStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const cardActionsStyle: CSSProperties = {
  justifyContent: "space-between",
};

const selectionToolbarStyle: CSSProperties = {
  width: "100%",
};

const paginationFooterStyle: CSSProperties = {
  borderTop: "1px solid var(--color-border)",
  paddingTop: 16,
  width: "100%",
};

const detailDialogContentStyle: CSSProperties = {
  maxWidth: "100%",
};

const detailLayoutStyle: CSSProperties = {
  alignItems: "start",
  display: "grid",
  gap: 16,
  gridTemplateColumns: "minmax(0, 1.35fr) minmax(280px, 0.65fr)",
  width: "100%",
};

const detailLayoutNarrowStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "1fr",
  width: "100%",
};

const detailPreviewFrameStyle: CSSProperties = {
  aspectRatio: "4 / 3",
  maxHeight: "62dvh",
};

const detailPreviewFrameNarrowStyle: CSSProperties = {
  aspectRatio: "16 / 10",
  maxHeight: "42dvh",
};

const detailPreviewMediaStyle: CSSProperties = {
  objectFit: "contain",
};

const detailGridStyle: CSSProperties = {
  width: "100%",
};

const detailInfoStyle: CSSProperties = {
  minWidth: 0,
  width: "100%",
};

const detailHeaderStyle: CSSProperties = {
  minWidth: 0,
};

const detailRowStyle: CSSProperties = {
  borderBottom: "1px solid var(--color-border)",
  paddingBottom: 8,
};

const detailValueStyle: CSSProperties = {
  minWidth: 0,
  overflowWrap: "anywhere",
  textAlign: "right",
};

type FormatDateTimeParameters = {
  language: string;
  timeZone: string;
  value: string;
};

const formatDateTime = ({ language, timeZone, value }: FormatDateTimeParameters) =>
  formatDateTimeInTimeZone({ language, timeZone, value });

const formatFileSize = (sizeBytes: number) => {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let unitIndex = -1;
  let value = sizeBytes;

  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex] ?? "KB"}`;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.length > 0 ? error.message : fallback;

const copyTextWithTextArea = (text: string) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("aria-hidden", "true");
  textArea.setAttribute("readonly", "true");
  textArea.style.left = "-9999px";
  textArea.style.opacity = "0";
  textArea.style.position = "fixed";
  textArea.style.top = "0";

  document.body.append(textArea);
  textArea.focus();
  textArea.select();

  try {
    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error("Copy command was rejected.");
    }
  } finally {
    textArea.remove();
  }
};

const copyTextToClipboard = async (text: string) => {
  if (window.isSecureContext && window.navigator.clipboard !== undefined) {
    try {
      await window.navigator.clipboard.writeText(text);
      return;
    } catch {
      copyTextWithTextArea(text);
      return;
    }
  }

  copyTextWithTextArea(text);
};

type SummaryCardProps = {
  description: string;
  icon: ReactNode;
  label: string;
  value: string | number;
};

const SummaryCard = ({ description, icon, label, value }: SummaryCardProps) => (
  <Card padding={4}>
    <VStack gap={3}>
      <HStack gap={2} vAlign="center">
        <span style={summaryIconStyle}>{icon}</span>
        <Text type="label" color="secondary">
          {label}
        </Text>
      </HStack>
      <Heading level={3}>{value}</Heading>
      <Text type="supporting" color="secondary">
        {description}
      </Text>
    </VStack>
  </Card>
);

type MediaTypeBadgeProps = {
  fileType: MediaFileType;
};

const MediaTypeBadge = ({ fileType }: MediaTypeBadgeProps) => {
  const { t } = useTranslation();
  const icon =
    fileType === "image" ? (
      <Image size={14} />
    ) : fileType === "video" ? (
      <Film size={14} />
    ) : (
      <FileText size={14} />
    );

  return <Badge label={t(`admin.mediaLibrary.fileTypes.${fileType}`)} icon={icon} />;
};

type MediaPreviewProps = {
  frameStyle?: CSSProperties;
  mediaStyle?: CSSProperties;
  media: MediaAsset;
};

const MediaPreview = ({ frameStyle, mediaStyle, media }: MediaPreviewProps) => {
  const { t } = useTranslation();
  const assetUrl = resolveAdminAssetUrl(media.accessUrl);
  const resolvedFrameStyle =
    frameStyle === undefined
      ? previewFrameStyle
      : {
          ...previewFrameStyle,
          ...frameStyle,
        };
  const resolvedMediaStyle =
    mediaStyle === undefined
      ? previewImageStyle
      : {
          ...previewImageStyle,
          ...mediaStyle,
        };

  if (media.fileType === "image") {
    return (
      <div style={resolvedFrameStyle}>
        <img
          alt={t("admin.mediaLibrary.previewAlt", { name: media.fileName })}
          src={assetUrl}
          style={resolvedMediaStyle}
        />
      </div>
    );
  }

  if (media.fileType === "video") {
    return (
      <div style={resolvedFrameStyle}>
        <video
          controls
          muted
          playsInline
          preload="metadata"
          src={assetUrl}
          style={resolvedMediaStyle}
        />
      </div>
    );
  }

  return (
    <div style={resolvedFrameStyle}>
      <FileText size={40} style={documentPreviewStyle} />
    </div>
  );
};

type MediaActionsProps = {
  isNarrow: boolean;
  media: MediaAsset;
  onCopy: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onPreview: () => void;
  onRename: () => void;
  showFormat?: boolean;
};

const MediaActions = ({
  isNarrow,
  media,
  onCopy,
  onDelete,
  onDownload,
  onPreview,
  onRename,
  showFormat = true,
}: MediaActionsProps) => {
  const { t } = useTranslation();

  if (isNarrow) {
    return (
      <MoreMenu
        alignment="end"
        className="admin-list-actions-menu"
        icon={<MoreHorizontal size={16} />}
        label={t("admin.mediaLibrary.actions")}
        presentation="adaptive"
        items={[
          {
            icon: <Eye size={16} />,
            id: "preview",
            label: t("admin.mediaLibrary.preview"),
            onClick: onPreview,
          },
          {
            icon: <Pencil size={16} />,
            id: "rename",
            label: t("admin.mediaLibrary.rename"),
            onClick: onRename,
          },
          {
            icon: <Download size={16} />,
            id: "download",
            label: t("admin.mediaLibrary.download"),
            onClick: onDownload,
          },
          {
            icon: <Copy size={16} />,
            id: "copy",
            label: t("admin.mediaLibrary.copyLink"),
            onClick: onCopy,
          },
          {
            icon: <Trash2 size={16} />,
            id: "delete",
            label: t("admin.mediaLibrary.delete"),
            onClick: onDelete,
            variant: "destructive",
          },
        ]}
      />
    );
  }

  return (
    <HStack gap={1} vAlign="center">
      <AdminActionTooltip label={t("admin.mediaLibrary.preview")}>
        <IconButton
          label={t("admin.mediaLibrary.preview")}
          icon={<Eye size={16} />}
          variant="ghost"
          size="sm"
          onClick={onPreview}
        />
      </AdminActionTooltip>
      <AdminActionTooltip label={t("admin.mediaLibrary.copyLink")}>
        <IconButton
          label={t("admin.mediaLibrary.copyLink")}
          icon={<Copy size={16} />}
          variant="ghost"
          size="sm"
          onClick={onCopy}
        />
      </AdminActionTooltip>
      <AdminActionTooltip label={t("admin.mediaLibrary.rename")}>
        <IconButton
          label={t("admin.mediaLibrary.rename")}
          icon={<Pencil size={16} />}
          variant="ghost"
          size="sm"
          onClick={onRename}
        />
      </AdminActionTooltip>
      <AdminActionTooltip label={t("admin.mediaLibrary.download")}>
        <IconButton
          label={t("admin.mediaLibrary.download")}
          icon={<Download size={16} />}
          variant="ghost"
          size="sm"
          onClick={onDownload}
        />
      </AdminActionTooltip>
      <AdminActionTooltip label={t("admin.mediaLibrary.delete")}>
        <IconButton
          label={t("admin.mediaLibrary.delete")}
          icon={<Trash2 size={16} />}
          variant="ghost"
          size="sm"
          onClick={onDelete}
        />
      </AdminActionTooltip>
      {showFormat && <span aria-hidden>{media.fileFormat.toUpperCase()}</span>}
    </HStack>
  );
};

type MediaListRowProps = {
  isSelected: boolean;
  isLast: boolean;
  isNarrow: boolean;
  language: string;
  media: MediaAsset;
  onCopy: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onPreview: () => void;
  onRename: () => void;
  onSelect: (isSelected: boolean) => void;
  timeZone: string;
};

const MediaListRow = ({
  isSelected,
  isLast,
  isNarrow,
  language,
  media,
  onCopy,
  onDelete,
  onDownload,
  onPreview,
  onRename,
  onSelect,
  timeZone,
}: MediaListRowProps) => {
  const { t } = useTranslation();
  const rowStyle = {
    ...(isNarrow ? mediaListNarrowRowStyle : mediaListRowStyle),
    borderBottom: isLast ? undefined : "1px solid var(--color-border)",
  };
  const folderTranslationKey = getSystemMediaFolderTranslationKey(media.folderSlug);
  const folderName =
    folderTranslationKey === undefined
      ? (media.folderName ?? t("admin.mediaLibrary.defaultFolder"))
      : t(`admin.mediaLibrary.systemFolders.${folderTranslationKey}.name`);
  const createdAt = formatDateTime({ language, timeZone, value: media.createdAt });
  const fileSize = formatFileSize(media.fileSizeBytes);

  if (isNarrow) {
    return (
      <div role="row" style={rowStyle}>
        <VStack gap={3}>
          <HStack gap={3} vAlign="center">
            <CheckboxInput
              label={t("admin.mediaLibrary.selectMedia", { name: media.fileName })}
              isLabelHidden
              value={isSelected}
              onChange={onSelect}
            />
            <button type="button" style={mediaListThumbnailButtonStyle} onClick={onPreview}>
              <MediaPreview media={media} frameStyle={mediaListThumbnailFrameStyle} />
            </button>
            <StackItem size="fill">
              <VStack gap={1}>
                <Text type="body" weight="semibold" maxLines={2}>
                  {media.fileName}
                </Text>
                <Text type="supporting" color="secondary" style={mediaUrlStyle}>
                  {media.accessUrl}
                </Text>
              </VStack>
            </StackItem>
            <MediaActions
              isNarrow
              media={media}
              onCopy={onCopy}
              onDelete={onDelete}
              onDownload={onDownload}
              onPreview={onPreview}
              onRename={onRename}
            />
          </HStack>
          <HStack gap={2} wrap="wrap" vAlign="center">
            <MediaTypeBadge fileType={media.fileType} />
            <Badge label={folderName} />
            <Text type="supporting" color="secondary">
              {fileSize} · {createdAt}
            </Text>
          </HStack>
        </VStack>
      </div>
    );
  }

  return (
    <div role="row" style={rowStyle}>
      <div role="cell" style={mediaListCellStyle}>
        <CheckboxInput
          label={t("admin.mediaLibrary.selectMedia", { name: media.fileName })}
          isLabelHidden
          value={isSelected}
          onChange={onSelect}
        />
      </div>
      <div role="cell" style={mediaListFileCellStyle}>
        <HStack gap={3} vAlign="center" style={mediaListFileContentStyle}>
          <button type="button" style={mediaListThumbnailButtonStyle} onClick={onPreview}>
            <MediaPreview media={media} frameStyle={mediaListThumbnailFrameStyle} />
          </button>
          <VStack gap={1} style={mediaListFileTextStyle}>
            <Text type="body" weight="semibold" maxLines={1}>
              {media.fileName}
            </Text>
            <Text type="supporting" color="secondary" style={mediaUrlStyle}>
              {media.accessUrl}
            </Text>
          </VStack>
        </HStack>
      </div>
      <div role="cell" style={mediaListCellStyle}>
        <MediaTypeBadge fileType={media.fileType} />
      </div>
      <Text type="body" role="cell" style={mediaListCellStyle}>
        {folderName}
      </Text>
      <Text type="body" role="cell" style={mediaListCellStyle}>
        {fileSize}
      </Text>
      <Text type="body" role="cell" style={mediaListCellStyle}>
        {createdAt}
      </Text>
      <HStack role="cell" gap={1} vAlign="center" style={mediaListActionsStyle}>
        <MediaActions
          isNarrow={false}
          media={media}
          onCopy={onCopy}
          onDelete={onDelete}
          onDownload={onDownload}
          onPreview={onPreview}
          onRename={onRename}
          showFormat={false}
        />
      </HStack>
    </div>
  );
};

type MediaListViewProps = {
  isNarrow: boolean;
  isSelectionIndeterminate: boolean;
  isAllSelected: boolean;
  language: string;
  media: MediaAsset[];
  onCopy: (media: MediaAsset) => void;
  onDelete: (media: MediaAsset) => void;
  onDownload: (media: MediaAsset) => void;
  onPreview: (media: MediaAsset) => void;
  onRename: (media: MediaAsset) => void;
  onSelect: (mediaId: string, isSelected: boolean) => void;
  onSelectAll: (isSelected: boolean) => void;
  selectedMediaIds: Set<string>;
  timeZone: string;
};

const MediaListView = ({
  isNarrow,
  isSelectionIndeterminate,
  isAllSelected,
  language,
  media,
  onCopy,
  onDelete,
  onDownload,
  onPreview,
  onRename,
  onSelect,
  onSelectAll,
  selectedMediaIds,
  timeZone,
}: MediaListViewProps) => {
  const { t } = useTranslation();
  const tableStyle = isNarrow ? mediaListNarrowTableStyle : mediaListTableStyle;

  return (
    <Card padding={0} style={mediaListCardStyle}>
      <div style={mediaListViewportStyle}>
        <div role="table" aria-label={t("admin.mediaLibrary.listLabel")} style={tableStyle}>
          {!isNarrow && (
            <div role="row" style={mediaListHeaderStyle}>
              <div role="columnheader" style={mediaListHeaderCellStyle}>
                <CheckboxInput
                  label={t("admin.mediaLibrary.selectAll")}
                  isLabelHidden
                  value={isAllSelected ? true : isSelectionIndeterminate ? "indeterminate" : false}
                  onChange={onSelectAll}
                />
              </div>
              <Text
                type="label"
                color="secondary"
                role="columnheader"
                style={mediaListHeaderCellStyle}
              >
                {t("admin.mediaLibrary.columns.file")}
              </Text>
              <Text
                type="label"
                color="secondary"
                role="columnheader"
                style={mediaListHeaderCellStyle}
              >
                {t("admin.mediaLibrary.columns.type")}
              </Text>
              <Text
                type="label"
                color="secondary"
                role="columnheader"
                style={mediaListHeaderCellStyle}
              >
                {t("admin.mediaLibrary.columns.folder")}
              </Text>
              <Text
                type="label"
                color="secondary"
                role="columnheader"
                style={mediaListHeaderCellStyle}
              >
                {t("admin.mediaLibrary.columns.size")}
              </Text>
              <Text
                type="label"
                color="secondary"
                role="columnheader"
                style={mediaListHeaderCellStyle}
              >
                {t("admin.mediaLibrary.columns.createdAt")}
              </Text>
              <Text
                type="label"
                color="secondary"
                role="columnheader"
                style={mediaListHeaderCellStyle}
              >
                {t("admin.mediaLibrary.columns.actions")}
              </Text>
            </div>
          )}
          <div role="rowgroup">
            {media.map((item, index) => (
              <MediaListRow
                key={item.id}
                isSelected={selectedMediaIds.has(item.id)}
                isLast={index === media.length - 1}
                isNarrow={isNarrow}
                language={language}
                media={item}
                onCopy={() => onCopy(item)}
                onDelete={() => onDelete(item)}
                onDownload={() => onDownload(item)}
                onPreview={() => onPreview(item)}
                onRename={() => onRename(item)}
                onSelect={(isSelected) => onSelect(item.id, isSelected)}
                timeZone={timeZone}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

type DetailRowProps = {
  label: string;
  value: ReactNode;
};

const DetailRow = ({ label, value }: DetailRowProps) => (
  <HStack gap={3} hAlign="between" vAlign="start" style={detailRowStyle}>
    <Text type="supporting" color="secondary">
      {label}
    </Text>
    <Text type="body" style={detailValueStyle}>
      {value}
    </Text>
  </HStack>
);

type MediaDetailDialogProps = {
  isNarrow: boolean;
  language: string;
  media: MediaAsset;
  onClose: () => void;
  onCopy: () => void;
  onOpenFile: () => void;
  timeZone: string;
};

const MediaDetailDialog = ({
  isNarrow,
  language,
  media,
  onClose,
  onCopy,
  onOpenFile,
  timeZone,
}: MediaDetailDialogProps) => {
  const { t } = useTranslation();
  const assetUrl = resolveAdminAssetUrl(media.accessUrl);
  const folderTranslationKey = getSystemMediaFolderTranslationKey(media.folderSlug);
  const folderName =
    folderTranslationKey === undefined
      ? (media.folderName ?? t("admin.mediaLibrary.defaultFolder"))
      : t(`admin.mediaLibrary.systemFolders.${folderTranslationKey}.name`);

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
      variant={isNarrow ? "fullscreen" : "standard"}
      width={980}
      maxHeight="90dvh"
      padding={isNarrow ? 3 : 4}
      aria-label={t("admin.mediaLibrary.detail.title")}
    >
      <VStack gap={4} style={detailDialogContentStyle}>
        <div style={isNarrow ? detailLayoutNarrowStyle : detailLayoutStyle}>
          <MediaPreview
            media={media}
            frameStyle={isNarrow ? detailPreviewFrameNarrowStyle : detailPreviewFrameStyle}
            mediaStyle={detailPreviewMediaStyle}
          />

          <VStack gap={4} style={detailInfoStyle}>
            <HStack gap={3} hAlign="between" vAlign="start">
              <VStack gap={1} style={detailHeaderStyle}>
                <Heading level={2}>{media.fileName}</Heading>
                <Text type="supporting" color="secondary">
                  {t("admin.mediaLibrary.detail.title")}
                </Text>
              </VStack>
              <MediaTypeBadge fileType={media.fileType} />
            </HStack>

            <VStack gap={2} style={detailGridStyle}>
              <DetailRow
                label={t("admin.mediaLibrary.detail.fileFormat")}
                value={media.fileFormat.toUpperCase()}
              />
              <DetailRow
                label={t("admin.mediaLibrary.detail.fileSize")}
                value={formatFileSize(media.fileSizeBytes)}
              />
              <DetailRow label={t("admin.mediaLibrary.detail.folder")} value={folderName} />
              <DetailRow
                label={t("admin.mediaLibrary.detail.storage")}
                value={t(`admin.mediaLibrary.storageProviders.${media.storageProvider}`)}
              />
              <DetailRow
                label={t("admin.mediaLibrary.detail.createdAt")}
                value={formatDateTime({ language, timeZone, value: media.createdAt })}
              />
              <DetailRow
                label={t("admin.mediaLibrary.detail.updatedAt")}
                value={formatDateTime({ language, timeZone, value: media.updatedAt })}
              />
              <DetailRow label={t("admin.mediaLibrary.detail.accessUrl")} value={assetUrl} />
            </VStack>

            <HStack gap={2} hAlign="end" wrap="wrap">
              <Button label={t("actions.close")} variant="ghost" onClick={onClose} />
              <Button
                label={t("admin.mediaLibrary.copyLink")}
                icon={<Copy size={16} />}
                variant="secondary"
                onClick={onCopy}
              />
              <Button
                label={t("admin.mediaLibrary.openOriginal")}
                icon={<ExternalLink size={16} />}
                variant="primary"
                onClick={onOpenFile}
              />
            </HStack>
          </VStack>
        </div>
      </VStack>
    </Dialog>
  );
};

type FolderFormDialogProps = {
  folderForm: FolderFormState;
  isNarrow: boolean;
  isSaving: boolean;
  onClose: () => void;
  onDescriptionChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onSubmit: () => void;
};

const FolderFormDialog = ({
  folderForm,
  isNarrow,
  isSaving,
  onClose,
  onDescriptionChange,
  onNameChange,
  onSlugChange,
  onSubmit,
}: FolderFormDialogProps) => {
  const { t } = useTranslation();
  const isEditingProtectedFolder = folderForm.mode === "edit" && folderForm.folder.isProtected;

  return (
    <AdminFormDialog
      cancelLabel={t("actions.cancel")}
      closeLabel={t("actions.close")}
      description={t("admin.mediaLibrary.folders.formDescription")}
      isNarrow={isNarrow}
      isPrimaryLoading={isSaving}
      onClose={onClose}
      onSubmit={onSubmit}
      primaryIcon={folderForm.mode === "create" ? <FolderPlus size={16} /> : <Pencil size={16} />}
      primaryLabel={t(
        folderForm.mode === "create"
          ? "admin.mediaLibrary.folders.createAction"
          : "admin.mediaLibrary.folders.saveAction",
      )}
      title={t(
        folderForm.mode === "create"
          ? "admin.mediaLibrary.folders.createTitle"
          : "admin.mediaLibrary.folders.editTitle",
      )}
    >
      <Grid columns={{ minWidth: 280, repeat: "fit" }} gap={3}>
        <TextInput
          label={t("admin.mediaLibrary.folders.name")}
          value={folderForm.name}
          onChange={onNameChange}
          placeholder={t("admin.mediaLibrary.folders.namePlaceholder")}
        />
        <TextInput
          label={t("admin.mediaLibrary.folders.slug")}
          value={folderForm.slug}
          isDisabled={isEditingProtectedFolder}
          onChange={onSlugChange}
          placeholder={t("admin.mediaLibrary.folders.slugPlaceholder")}
        />
        <GridSpan columns="full">
          <TextArea
            label={t("admin.mediaLibrary.folders.folderDescription")}
            rows={3}
            value={folderForm.description}
            onChange={onDescriptionChange}
            placeholder={t("admin.mediaLibrary.folders.descriptionPlaceholder")}
          />
        </GridSpan>
      </Grid>
    </AdminFormDialog>
  );
};

type RenameMediaDialogProps = {
  isNarrow: boolean;
  isSaving: boolean;
  media: MediaAsset;
  name: string;
  onClose: () => void;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
};

const RenameMediaDialog = ({
  isNarrow,
  isSaving,
  media,
  name,
  onClose,
  onNameChange,
  onSubmit,
}: RenameMediaDialogProps) => {
  const { t } = useTranslation();

  return (
    <AdminFormDialog
      cancelLabel={t("actions.cancel")}
      closeLabel={t("actions.close")}
      description={t("admin.mediaLibrary.renameDescription", { name: media.fileName })}
      isNarrow={isNarrow}
      isPrimaryLoading={isSaving}
      onClose={onClose}
      onSubmit={onSubmit}
      primaryIcon={<Pencil size={16} />}
      primaryLabel={t("admin.mediaLibrary.renameAction")}
      title={t("admin.mediaLibrary.renameTitle")}
    >
      <TextInput
        label={t("admin.mediaLibrary.detail.fileName")}
        value={name}
        onChange={onNameChange}
      />
    </AdminFormDialog>
  );
};

export function MediaLibraryPage({ authToken, isNarrow, timeZone }: MediaLibraryPageProps) {
  const { i18n, t } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [mediaData, setMediaData] = useState<MediaLibraryList>(EMPTY_MEDIA_LIBRARY_LIST);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [activeFolderSlug, setActiveFolderSlug] = useState(ALL_FOLDERS_VALUE);
  const [query, setQuery] = useState("");
  const [fileType, setFileType] = useState<MediaFilter>("all");
  const [storageProvider, setStorageProvider] = useState<MediaStorageFilter>("all");
  const [viewMode, setViewMode] = useState<MediaViewMode>("grid");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [isLoading, setIsLoading] = useState(true);
  const [isFolderLoading, setIsFolderLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [isRenamingMedia, setIsRenamingMedia] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [deletingMedia, setDeletingMedia] = useState<MediaAsset>();
  const [deletingFolder, setDeletingFolder] = useState<MediaFolder>();
  const [migrationTarget, setMigrationTarget] = useState<MediaMigrationTarget>();
  const [uploadEditState, setUploadEditState] = useState<UploadEditState>();
  const [folderForm, setFolderForm] = useState<FolderFormState>();
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [previewingMedia, setPreviewingMedia] = useState<MediaAsset>();
  const [renamingMedia, setRenamingMedia] = useState<MediaAsset>();
  const [renamingMediaName, setRenamingMediaName] = useState("");
  const [banner, setBanner] = useState<AdminFeedbackBannerState>();
  const getMediaLibraryErrorMessage = useCallback(
    (error: unknown, fallback: string) => {
      const message = getErrorMessage(error, fallback);
      const translationKey = MEDIA_LIBRARY_ERROR_KEYS[message];
      if (translationKey === undefined) {
        return message;
      }

      return t(translationKey);
    },
    [t],
  );

  const loadFolders = useCallback(async () => {
    setIsFolderLoading(true);

    try {
      const nextFolders = await getMediaFolders({ token: authToken });
      setFolders(nextFolders.folders);
    } catch (error) {
      setBanner(
        createAdminFeedbackBanner({
          description: getMediaLibraryErrorMessage(
            error,
            t("admin.mediaLibrary.folders.loadFailed"),
          ),
          status: "error",
          title: t("admin.mediaLibrary.folders.loadFailed"),
        }),
      );
    } finally {
      setIsFolderLoading(false);
    }
  }, [authToken, getMediaLibraryErrorMessage, t]);

  const loadMedia = useCallback(async () => {
    setIsLoading(true);

    try {
      const nextMediaData = await getMediaAssets({
        fileType,
        folderSlug: activeFolderSlug === ALL_FOLDERS_VALUE ? undefined : activeFolderSlug,
        page,
        pageSize,
        query,
        storageProvider,
        token: authToken,
      });
      setMediaData(nextMediaData);
      if (nextMediaData.pageInfo.page !== page) {
        setPage(nextMediaData.pageInfo.page);
      }
    } catch (error) {
      setBanner(
        createAdminFeedbackBanner({
          description: getMediaLibraryErrorMessage(error, t("admin.mediaLibrary.loadFailed")),
          status: "error",
          title: t("admin.mediaLibrary.loadFailed"),
        }),
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    activeFolderSlug,
    authToken,
    fileType,
    getMediaLibraryErrorMessage,
    page,
    pageSize,
    query,
    storageProvider,
    t,
  ]);

  useEffect(() => {
    const visibleMediaIds = new Set(mediaData.media.map((media) => media.id));

    setSelectedMediaIds((current) => {
      const nextSelectedMediaIds = new Set(
        Array.from(current).filter((mediaId) => visibleMediaIds.has(mediaId)),
      );

      return nextSelectedMediaIds.size === current.size ? current : nextSelectedMediaIds;
    });
  }, [mediaData.media]);

  const selectedMedia = useMemo(
    () => mediaData.media.filter((media) => selectedMediaIds.has(media.id)),
    [mediaData.media, selectedMediaIds],
  );
  const selectedMediaCount = selectedMedia.length;
  const isAllVisibleMediaSelected =
    mediaData.media.length > 0 && mediaData.media.every((media) => selectedMediaIds.has(media.id));
  const isVisibleMediaSelectionIndeterminate = selectedMediaCount > 0 && !isAllVisibleMediaSelected;

  const toggleMediaSelection = useCallback((mediaId: string, isSelected: boolean) => {
    setSelectedMediaIds((current) => {
      const nextSelectedMediaIds = new Set(current);
      if (isSelected) {
        nextSelectedMediaIds.add(mediaId);
      } else {
        nextSelectedMediaIds.delete(mediaId);
      }

      return nextSelectedMediaIds;
    });
  }, []);

  const toggleAllVisibleMedia = useCallback(
    (isSelected: boolean) => {
      setSelectedMediaIds((current) => {
        const nextSelectedMediaIds = new Set(current);

        for (const media of mediaData.media) {
          if (isSelected) {
            nextSelectedMediaIds.add(media.id);
          } else {
            nextSelectedMediaIds.delete(media.id);
          }
        }

        return nextSelectedMediaIds;
      });
    },
    [mediaData.media],
  );

  const clearSelectedMedia = useCallback(() => {
    setSelectedMediaIds(new Set());
  }, []);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    let isMounted = true;

    const loadMountedMedia = async () => {
      setIsLoading(true);

      try {
        const nextMediaData = await getMediaAssets({
          fileType,
          folderSlug: activeFolderSlug === ALL_FOLDERS_VALUE ? undefined : activeFolderSlug,
          page,
          pageSize,
          query,
          storageProvider,
          token: authToken,
        });
        if (!isMounted) {
          return;
        }

        setMediaData(nextMediaData);
        if (nextMediaData.pageInfo.page !== page) {
          setPage(nextMediaData.pageInfo.page);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setBanner(
          createAdminFeedbackBanner({
            description: getMediaLibraryErrorMessage(error, t("admin.mediaLibrary.loadFailed")),
            status: "error",
            title: t("admin.mediaLibrary.loadFailed"),
          }),
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadMountedMedia();

    return () => {
      isMounted = false;
    };
  }, [
    activeFolderSlug,
    authToken,
    fileType,
    getMediaLibraryErrorMessage,
    page,
    pageSize,
    query,
    storageProvider,
    t,
  ]);

  const uploadFolderSlug =
    activeFolderSlug === ALL_FOLDERS_VALUE ? DEFAULT_UPLOAD_FOLDER_SLUG : activeFolderSlug;

  const openCreateFolderForm = () => {
    setFolderForm({
      description: "",
      mode: "create",
      name: "",
      slug: "",
    });
  };

  const openEditFolderForm = (folder: MediaFolder) => {
    setFolderForm({
      description: folder.description,
      folder,
      mode: "edit",
      name: folder.name,
      slug: folder.slug,
    });
  };

  const updateFolderFormName = (name: string) => {
    setFolderForm((current) => (current === undefined ? current : { ...current, name }));
  };

  const updateFolderFormSlug = (slug: string) => {
    setFolderForm((current) => (current === undefined ? current : { ...current, slug }));
  };

  const updateFolderFormDescription = (description: string) => {
    setFolderForm((current) => (current === undefined ? current : { ...current, description }));
  };

  const saveFolderForm = async () => {
    if (folderForm === undefined) {
      return;
    }

    setIsSavingFolder(true);

    try {
      const payload = {
        description: folderForm.description,
        name: folderForm.name,
        slug: folderForm.slug,
      };
      const savedFolder =
        folderForm.mode === "create"
          ? await createMediaFolder({ payload, token: authToken })
          : await updateMediaFolder({
              folderId: folderForm.folder.id,
              payload,
              token: authToken,
            });

      setBanner(
        createAdminFeedbackBanner({
          status: "success",
          title: t(
            folderForm.mode === "create"
              ? "admin.mediaLibrary.folders.createSuccess"
              : "admin.mediaLibrary.folders.updateSuccess",
          ),
        }),
      );
      setFolderForm(undefined);
      setActiveFolderSlug(savedFolder.slug);
      setPage(1);
      await loadFolders();
      await loadMedia();
    } catch (error) {
      setBanner(
        createAdminFeedbackBanner({
          description: getMediaLibraryErrorMessage(
            error,
            t(
              folderForm.mode === "create"
                ? "admin.mediaLibrary.folders.createFailed"
                : "admin.mediaLibrary.folders.updateFailed",
            ),
          ),
          status: "error",
          title: t(
            folderForm.mode === "create"
              ? "admin.mediaLibrary.folders.createFailed"
              : "admin.mediaLibrary.folders.updateFailed",
          ),
        }),
      );
    } finally {
      setIsSavingFolder(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (deletingFolder === undefined) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteMediaFolder({
        folderId: deletingFolder.id,
        token: authToken,
      });
      setBanner(
        createAdminFeedbackBanner({
          status: "success",
          title: t("admin.mediaLibrary.folders.deleteSuccess"),
        }),
      );
      if (activeFolderSlug === deletingFolder.slug) {
        setActiveFolderSlug(ALL_FOLDERS_VALUE);
        setPage(1);
      }
      setDeletingFolder(undefined);
      await loadFolders();
      await loadMedia();
    } catch (error) {
      setBanner(
        createAdminFeedbackBanner({
          description: getMediaLibraryErrorMessage(
            error,
            t("admin.mediaLibrary.folders.deleteFailed"),
          ),
          status: "error",
          title: t("admin.mediaLibrary.folders.deleteFailed"),
        }),
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const openUploadPicker = () => {
    uploadInputRef.current?.click();
  };

  const uploadSelectedFiles = async ({ files, folderSlug }: UploadSelectedFilesParameters) => {
    if (files.length === 0) {
      return;
    }

    setIsUploading(true);

    try {
      for (const file of files) {
        await uploadMediaAsset({
          file,
          folderSlug,
          token: authToken,
        });
      }

      setBanner(
        createAdminFeedbackBanner({
          description: t("admin.mediaLibrary.uploadSuccessDescription", {
            count: files.length,
          }),
          status: "success",
          title: t("admin.mediaLibrary.uploadSuccess"),
        }),
      );
      setPage(1);
      await loadFolders();
      await loadMedia();
    } catch (error) {
      setBanner(
        createAdminFeedbackBanner({
          description: getMediaLibraryErrorMessage(error, t("admin.mediaLibrary.uploadFailed")),
          status: "error",
          title: t("admin.mediaLibrary.uploadFailed"),
        }),
      );
    } finally {
      setIsUploading(false);
    }
  };

  const continueUploadWorkflow = ({
    folderSlug,
    pendingFiles,
    readyFiles,
  }: ContinueUploadWorkflowParameters) => {
    const nextReadyFiles = [...readyFiles];

    for (let index = 0; index < pendingFiles.length; index += 1) {
      const file = pendingFiles[index];
      if (file === undefined) {
        continue;
      }

      const kind = getLocalImageEditorKind({ file, folderSlug });
      if (kind !== undefined) {
        setUploadEditState({
          file,
          folderSlug,
          kind,
          pendingFiles: pendingFiles.slice(index + 1),
          readyFiles: nextReadyFiles,
        });
        return;
      }

      nextReadyFiles.push(file);
    }

    setUploadEditState(undefined);
    void uploadSelectedFiles({ files: nextReadyFiles, folderSlug });
  };

  const handleUploadFiles = (files: FileList | null) => {
    const selectedFiles = files === null ? [] : Array.from(files);
    if (uploadInputRef.current !== null) {
      uploadInputRef.current.value = "";
    }
    if (selectedFiles.length === 0) {
      return;
    }

    continueUploadWorkflow({
      folderSlug: uploadFolderSlug,
      pendingFiles: selectedFiles,
      readyFiles: [],
    });
  };

  const copyMediaLink = async (media: MediaAsset) => {
    try {
      await copyTextToClipboard(resolveAdminAssetUrl(media.accessUrl));
      setBanner(
        createAdminFeedbackBanner({
          status: "success",
          title: t("admin.mediaLibrary.copySuccess"),
        }),
      );
    } catch {
      setBanner(
        createAdminFeedbackBanner({
          status: "error",
          title: t("admin.mediaLibrary.copyFailed"),
        }),
      );
    }
  };

  const openMedia = (media: MediaAsset) => {
    window.open(resolveAdminAssetUrl(media.accessUrl), "_blank", "noopener,noreferrer");
  };

  const downloadMedia = async (media: MediaAsset) => {
    try {
      await downloadMediaAsset({
        fileName: media.fileName,
        mediaId: media.id,
        token: authToken,
      });
      setBanner(
        createAdminFeedbackBanner({
          status: "success",
          title: t("admin.mediaLibrary.downloadSuccess"),
        }),
      );
    } catch (error) {
      setBanner(
        createAdminFeedbackBanner({
          description: getMediaLibraryErrorMessage(error, t("admin.mediaLibrary.downloadFailed")),
          status: "error",
          title: t("admin.mediaLibrary.downloadFailed"),
        }),
      );
    }
  };

  const openRenameMedia = (media: MediaAsset) => {
    setRenamingMedia(media);
    setRenamingMediaName(media.fileName);
  };

  const handleRenameMedia = async () => {
    if (renamingMedia === undefined) {
      return;
    }

    setIsRenamingMedia(true);

    try {
      await updateMediaAsset({
        fileName: renamingMediaName,
        mediaId: renamingMedia.id,
        token: authToken,
      });
      setBanner(
        createAdminFeedbackBanner({
          status: "success",
          title: t("admin.mediaLibrary.renameSuccess"),
        }),
      );
      setRenamingMedia(undefined);
      setRenamingMediaName("");
      await loadMedia();
    } catch (error) {
      setBanner(
        createAdminFeedbackBanner({
          description: getMediaLibraryErrorMessage(error, t("admin.mediaLibrary.renameFailed")),
          status: "error",
          title: t("admin.mediaLibrary.renameFailed"),
        }),
      );
    } finally {
      setIsRenamingMedia(false);
    }
  };

  const handleDeleteMedia = async () => {
    if (deletingMedia === undefined) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteMediaAsset({
        mediaId: deletingMedia.id,
        token: authToken,
      });
      setBanner(
        createAdminFeedbackBanner({
          status: "success",
          title: t("admin.mediaLibrary.deleteSuccess"),
        }),
      );
      setSelectedMediaIds((current) => {
        const nextSelectedMediaIds = new Set(current);
        nextSelectedMediaIds.delete(deletingMedia.id);
        return nextSelectedMediaIds;
      });
      setDeletingMedia(undefined);
      await loadFolders();
      await loadMedia();
    } catch (error) {
      setBanner(
        createAdminFeedbackBanner({
          description: getMediaLibraryErrorMessage(error, t("admin.mediaLibrary.deleteFailed")),
          status: "error",
          title: t("admin.mediaLibrary.deleteFailed"),
        }),
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDeleteMedia = async () => {
    if (selectedMedia.length === 0) {
      setIsBulkDeleteOpen(false);
      return;
    }

    setIsDeleting(true);

    const results: BulkDeleteResult[] = [];
    for (const media of selectedMedia) {
      try {
        await deleteMediaAsset({
          mediaId: media.id,
          token: authToken,
        });
        results.push({ ok: true });
      } catch (error) {
        results.push({ error, ok: false });
      }
    }

    const deletedCount = results.filter((result) => result.ok).length;
    const failedResults = results.filter(
      (result): result is Extract<BulkDeleteResult, { ok: false }> => !result.ok,
    );

    if (failedResults.length === 0) {
      setBanner(
        createAdminFeedbackBanner({
          description: t("admin.mediaLibrary.bulkDeleteSuccessDescription", {
            count: deletedCount,
          }),
          status: "success",
          title: t("admin.mediaLibrary.bulkDeleteSuccess"),
        }),
      );
      clearSelectedMedia();
    } else {
      const firstFailedResult = failedResults[0];
      const fallbackDescription = t("admin.mediaLibrary.bulkDeletePartialDescription", {
        deleted: deletedCount,
        failed: failedResults.length,
      });

      setBanner(
        createAdminFeedbackBanner({
          description:
            firstFailedResult === undefined
              ? fallbackDescription
              : getMediaLibraryErrorMessage(firstFailedResult.error, fallbackDescription),
          status: deletedCount > 0 ? "warning" : "error",
          title:
            deletedCount > 0
              ? t("admin.mediaLibrary.bulkDeletePartial")
              : t("admin.mediaLibrary.deleteFailed"),
        }),
      );
      setSelectedMediaIds(
        new Set(selectedMedia.filter((_, index) => !results[index]?.ok).map((media) => media.id)),
      );
    }

    setIsBulkDeleteOpen(false);
    setIsDeleting(false);
    await loadFolders();
    await loadMedia();
  };

  const handleMigrateSelectedMedia = async () => {
    if (migrationTarget === undefined || selectedMedia.length === 0) {
      setMigrationTarget(undefined);
      return;
    }

    setIsMigrating(true);

    try {
      const result = await migrateMediaStorage({
        ids: selectedMedia.map((media) => media.id),
        targetProvider: migrationTarget,
        token: authToken,
      });

      setBanner(
        createAdminFeedbackBanner({
          description: t("admin.mediaLibrary.migration.successDescription", {
            count: result.items.length,
            references: result.updatedReferences,
          }),
          status: "success",
          title: t("admin.mediaLibrary.migration.success"),
        }),
      );
      clearSelectedMedia();
      setMigrationTarget(undefined);
      await loadFolders();
      await loadMedia();
    } catch (error) {
      setBanner(
        createAdminFeedbackBanner({
          description: getMediaLibraryErrorMessage(error, t("admin.mediaLibrary.migration.failed")),
          status: "error",
          title: t("admin.mediaLibrary.migration.failed"),
        }),
      );
    } finally {
      setIsMigrating(false);
    }
  };

  const hasInitialLoadingState = isLoading && mediaData.media.length === 0;
  const hasPagination = mediaData.pageInfo.totalItems > 0;
  const isAllFoldersActive = activeFolderSlug === ALL_FOLDERS_VALUE;
  const migrationTargetLabel =
    migrationTarget === undefined
      ? ""
      : t(`admin.mediaLibrary.storageProviders.${migrationTarget}`);

  return (
    <VStack gap={4} style={pageStackStyle}>
      <AdminFeedbackBanner banner={banner} onDismiss={() => setBanner(undefined)} />

      <input
        ref={uploadInputRef}
        aria-label={t("admin.mediaLibrary.upload")}
        type="file"
        multiple
        accept="image/*,video/*,.pdf,.doc,.docx,.txt,.md"
        style={hiddenInputStyle}
        onChange={(event) => {
          handleUploadFiles(event.currentTarget.files);
        }}
      />
      <LocalImageEditorDialog
        file={uploadEditState?.file}
        isOpen={uploadEditState !== undefined}
        kind={uploadEditState?.kind ?? "article-cover"}
        onApply={(file) => {
          if (uploadEditState === undefined) {
            return;
          }

          continueUploadWorkflow({
            folderSlug: uploadEditState.folderSlug,
            pendingFiles: uploadEditState.pendingFiles,
            readyFiles: [...uploadEditState.readyFiles, file],
          });
        }}
        onCancel={() => setUploadEditState(undefined)}
      />

      <Grid columns={{ minWidth: isNarrow ? 180 : 220, max: 4 }} gap={isNarrow ? 3 : 4}>
        <SummaryCard
          label={t("admin.mediaLibrary.summary.total")}
          value={mediaData.summary.total}
          description={t("admin.pageDescriptions.media")}
          icon={<Image size={18} />}
        />
        <SummaryCard
          label={t("admin.mediaLibrary.summary.images")}
          value={mediaData.summary.images}
          description={t("admin.mediaLibrary.fileTypes.image")}
          icon={<Image size={18} />}
        />
        <SummaryCard
          label={t("admin.mediaLibrary.summary.videos")}
          value={mediaData.summary.videos}
          description={t("admin.mediaLibrary.fileTypes.video")}
          icon={<Film size={18} />}
        />
        <SummaryCard
          label={t("admin.mediaLibrary.summary.storage")}
          value={formatFileSize(mediaData.summary.storageBytes)}
          description={t("admin.mediaLibrary.summary.storageDescription")}
          icon={<FileText size={18} />}
        />
      </Grid>

      <Card padding={2} style={folderCardStyle}>
        <VStack gap={1}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            <VStack gap={1}>
              <Heading level={3}>{t("admin.mediaLibrary.folders.title")}</Heading>
              <Text type="supporting" color="secondary">
                {t("admin.mediaLibrary.folders.intro")}
              </Text>
            </VStack>
            <Button
              label={t("admin.mediaLibrary.folders.create")}
              icon={<FolderPlus size={16} />}
              size="sm"
              variant="secondary"
              onClick={openCreateFolderForm}
            />
          </HStack>

          {isFolderLoading && folders.length === 0 ? (
            <HStack gap={2} vAlign="center">
              <Spinner size="sm" />
              <Text type="supporting" color="secondary">
                {t("admin.mediaLibrary.folders.loading")}
              </Text>
            </HStack>
          ) : (
            <div style={folderGridStyle}>
              <Button
                label={t("admin.mediaLibrary.folders.all")}
                icon={<Folder size={14} />}
                size="sm"
                variant={isAllFoldersActive ? "primary" : "secondary"}
                width="100%"
                onClick={() => {
                  setActiveFolderSlug(ALL_FOLDERS_VALUE);
                  setPage(1);
                }}
              >
                <HStack gap={1} hAlign="between" vAlign="center" style={folderButtonStyle}>
                  <Text
                    type="label"
                    maxLines={1}
                    style={isAllFoldersActive ? activeFolderLabelStyle : undefined}
                  >
                    {t("admin.mediaLibrary.folders.all")}
                  </Text>
                  <Text
                    type="supporting"
                    color="secondary"
                    style={isAllFoldersActive ? activeFolderMetaStyle : folderMetaStyle}
                  >
                    {mediaData.summary.total}
                  </Text>
                </HStack>
              </Button>

              {folders.map((folder) => {
                const isFolderActive = activeFolderSlug === folder.slug;
                const folderTranslationKey = getSystemMediaFolderTranslationKey(
                  folder.slug,
                  folder.systemKey,
                );
                const folderName =
                  folderTranslationKey === undefined
                    ? folder.name
                    : t(`admin.mediaLibrary.systemFolders.${folderTranslationKey}.name`);

                return (
                  <HStack key={folder.id} gap={1} vAlign="center">
                    <StackItem size="fill">
                      <Button
                        label={folderName}
                        icon={<Folder size={14} />}
                        size="sm"
                        variant={isFolderActive ? "primary" : "secondary"}
                        width="100%"
                        onClick={() => {
                          setActiveFolderSlug(folder.slug);
                          setPage(1);
                        }}
                      >
                        <HStack gap={1} hAlign="between" vAlign="center" style={folderButtonStyle}>
                          <Text
                            type="label"
                            maxLines={1}
                            style={isFolderActive ? activeFolderLabelStyle : undefined}
                          >
                            {folderName}
                          </Text>
                          <Text
                            type="supporting"
                            color="secondary"
                            style={isFolderActive ? activeFolderMetaStyle : folderMetaStyle}
                          >
                            {folder.fileCount}
                          </Text>
                        </HStack>
                      </Button>
                    </StackItem>
                    <IconButton
                      label={t("admin.mediaLibrary.folders.edit")}
                      tooltip={t("admin.mediaLibrary.folders.edit")}
                      icon={<Pencil size={14} />}
                      variant="ghost"
                      size="sm"
                      style={folderActionButtonStyle}
                      onClick={() => openEditFolderForm(folder)}
                    />
                    {!folder.isProtected && (
                      <IconButton
                        label={t("admin.mediaLibrary.folders.delete")}
                        tooltip={t("admin.mediaLibrary.folders.delete")}
                        icon={<Trash2 size={14} />}
                        variant="ghost"
                        size="sm"
                        style={folderActionButtonStyle}
                        onClick={() => setDeletingFolder(folder)}
                      />
                    )}
                  </HStack>
                );
              })}
            </div>
          )}
        </VStack>
      </Card>

      <Card padding={isNarrow ? 3 : 4} style={filterCardStyle}>
        <HStack gap={3} vAlign="end" wrap="wrap">
          <StackItem size="fill">
            <TextInput
              label={t("admin.mediaLibrary.search")}
              placeholder={t("admin.mediaLibrary.searchPlaceholder")}
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
            />
          </StackItem>
          <SegmentedControl
            label={t("admin.mediaLibrary.typeFilter")}
            value={fileType}
            onChange={(nextFileType) => {
              setFileType(
                MEDIA_FILTERS.includes(nextFileType as MediaFilter)
                  ? (nextFileType as MediaFilter)
                  : "all",
              );
              setPage(1);
            }}
          >
            {MEDIA_FILTERS.map((filter) => (
              <SegmentedControlItem
                key={filter}
                value={filter}
                label={
                  filter === "all"
                    ? t("admin.mediaLibrary.fileTypes.all")
                    : t(`admin.mediaLibrary.fileTypes.${filter}`)
                }
              />
            ))}
          </SegmentedControl>
          <SegmentedControl
            label={t("admin.mediaLibrary.storageFilter")}
            value={storageProvider}
            onChange={(nextStorageProvider) => {
              setStorageProvider(
                MEDIA_STORAGE_FILTERS.includes(nextStorageProvider as MediaStorageFilter)
                  ? (nextStorageProvider as MediaStorageFilter)
                  : "all",
              );
              setPage(1);
            }}
          >
            {MEDIA_STORAGE_FILTERS.map((filter) => (
              <SegmentedControlItem
                key={filter}
                value={filter}
                label={
                  filter === "all"
                    ? t("admin.mediaLibrary.storageProviders.all")
                    : t(`admin.mediaLibrary.storageProviders.${filter}`)
                }
              />
            ))}
          </SegmentedControl>
          <SegmentedControl
            label={t("admin.mediaLibrary.viewMode")}
            value={viewMode}
            onChange={(nextViewMode) => {
              setViewMode(
                MEDIA_VIEW_MODES.includes(nextViewMode as MediaViewMode)
                  ? (nextViewMode as MediaViewMode)
                  : "grid",
              );
            }}
          >
            {MEDIA_VIEW_MODES.map((mode) => (
              <SegmentedControlItem
                key={mode}
                value={mode}
                label={t(`admin.mediaLibrary.views.${mode}`)}
              />
            ))}
          </SegmentedControl>
          <Button
            label={t("admin.mediaLibrary.upload")}
            icon={<UploadCloud size={16} />}
            variant="primary"
            isDisabled={uploadEditState !== undefined}
            isLoading={isUploading}
            onClick={openUploadPicker}
          />
          <Button
            label={t("admin.mediaLibrary.refresh")}
            icon={<RefreshCw size={16} />}
            variant="secondary"
            isLoading={isLoading && mediaData.media.length > 0}
            onClick={() => {
              void loadMedia();
            }}
          />
        </HStack>
      </Card>

      {selectedMediaCount > 0 && (
        <Card padding={3} style={selectionToolbarStyle}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            <Text type="body" weight="semibold">
              {t("admin.mediaLibrary.selectedCount", { count: selectedMediaCount })}
            </Text>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Button
                label={t("admin.mediaLibrary.clearSelection")}
                variant="ghost"
                onClick={clearSelectedMedia}
              />
              <Button
                label={t("admin.mediaLibrary.migration.toLocal")}
                icon={<Database size={16} />}
                variant="secondary"
                isDisabled={isMigrating || isDeleting}
                onClick={() => setMigrationTarget("local")}
              />
              <Button
                label={t("admin.mediaLibrary.migration.toR2")}
                icon={<CloudUpload size={16} />}
                variant="secondary"
                isDisabled={isMigrating || isDeleting}
                onClick={() => setMigrationTarget("r2")}
              />
              <Button
                label={t("admin.mediaLibrary.bulkDelete")}
                icon={<Trash2 size={16} />}
                variant="destructive"
                onClick={() => setIsBulkDeleteOpen(true)}
              />
            </HStack>
          </HStack>
        </Card>
      )}

      {hasInitialLoadingState ? (
        <Card padding={isNarrow ? 4 : 5}>
          <HStack gap={2} vAlign="center">
            <Spinner size="sm" />
            <Text type="supporting" color="secondary">
              {t("admin.mediaLibrary.loading")}
            </Text>
          </HStack>
        </Card>
      ) : mediaData.media.length === 0 ? (
        <Card padding={0}>
          <EmptyState
            icon={<Search size={32} />}
            title={t("admin.mediaLibrary.emptyTitle")}
            description={t("admin.mediaLibrary.emptyDescription")}
            actions={
              <Button
                label={t("admin.mediaLibrary.upload")}
                variant="primary"
                icon={<Plus size={16} />}
                onClick={openUploadPicker}
              />
            }
          />
        </Card>
      ) : viewMode === "list" ? (
        <MediaListView
          isNarrow={isNarrow}
          isAllSelected={isAllVisibleMediaSelected}
          isSelectionIndeterminate={isVisibleMediaSelectionIndeterminate}
          language={language}
          media={mediaData.media}
          onCopy={(media) => {
            void copyMediaLink(media);
          }}
          onDelete={setDeletingMedia}
          onDownload={(media) => {
            void downloadMedia(media);
          }}
          onPreview={setPreviewingMedia}
          onRename={openRenameMedia}
          onSelect={toggleMediaSelection}
          onSelectAll={toggleAllVisibleMedia}
          selectedMediaIds={selectedMediaIds}
          timeZone={timeZone}
        />
      ) : (
        <Grid columns={{ minWidth: isNarrow ? 220 : 260, max: 4 }} gap={isNarrow ? 3 : 4}>
          {mediaData.media.map((media) => {
            const folderTranslationKey = getSystemMediaFolderTranslationKey(media.folderSlug);
            const folderName =
              folderTranslationKey === undefined
                ? (media.folderName ?? t("admin.mediaLibrary.defaultFolder"))
                : t(`admin.mediaLibrary.systemFolders.${folderTranslationKey}.name`);

            return (
              <Card key={media.id} padding={3} style={mediaCardStyle}>
                <VStack gap={3}>
                  <HStack gap={2} hAlign="between" vAlign="center">
                    <CheckboxInput
                      label={t("admin.mediaLibrary.selectMedia", { name: media.fileName })}
                      isLabelHidden
                      value={selectedMediaIds.has(media.id)}
                      onChange={(isSelected) => toggleMediaSelection(media.id, isSelected)}
                    />
                    <MediaTypeBadge fileType={media.fileType} />
                  </HStack>
                  <button
                    type="button"
                    style={previewButtonStyle}
                    onClick={() => setPreviewingMedia(media)}
                  >
                    <MediaPreview media={media} />
                  </button>
                  <VStack gap={1}>
                    <Text type="body" weight="semibold" maxLines={2}>
                      {media.fileName}
                    </Text>
                    <Text type="supporting" color="secondary" style={mediaUrlStyle}>
                      {media.accessUrl}
                    </Text>
                    <Text type="supporting" color="secondary">
                      {formatFileSize(media.fileSizeBytes)} ·{" "}
                      {formatDateTime({ language, timeZone, value: media.createdAt })}
                    </Text>
                  </VStack>
                  <HStack gap={2} vAlign="center" style={cardActionsStyle}>
                    <Badge label={folderName} />
                    <MediaActions
                      isNarrow={isNarrow}
                      media={media}
                      onCopy={() => {
                        void copyMediaLink(media);
                      }}
                      onDelete={() => setDeletingMedia(media)}
                      onDownload={() => {
                        void downloadMedia(media);
                      }}
                      onPreview={() => setPreviewingMedia(media)}
                      onRename={() => openRenameMedia(media)}
                    />
                  </HStack>
                </VStack>
              </Card>
            );
          })}
        </Grid>
      )}

      {hasPagination && (
        <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap" style={paginationFooterStyle}>
          <Text type="supporting" color="secondary">
            {t("admin.mediaLibrary.pageSummary", {
              count: mediaData.pageInfo.totalItems,
            })}
          </Text>
          <Pagination
            label={t("admin.mediaLibrary.paginationLabel")}
            page={mediaData.pageInfo.page}
            pageLabel={t("admin.mediaLibrary.pageLabel")}
            pageSize={mediaData.pageInfo.pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            totalItems={mediaData.pageInfo.totalItems}
            variant={isNarrow ? "compact" : "pages"}
            isDisabled={isLoading}
            onChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            }}
          />
        </HStack>
      )}

      {previewingMedia !== undefined && (
        <MediaDetailDialog
          isNarrow={isNarrow}
          language={language}
          media={previewingMedia}
          onClose={() => setPreviewingMedia(undefined)}
          onCopy={() => {
            void copyMediaLink(previewingMedia);
          }}
          onOpenFile={() => openMedia(previewingMedia)}
          timeZone={timeZone}
        />
      )}

      {folderForm !== undefined && (
        <FolderFormDialog
          folderForm={folderForm}
          isNarrow={isNarrow}
          isSaving={isSavingFolder}
          onClose={() => setFolderForm(undefined)}
          onDescriptionChange={updateFolderFormDescription}
          onNameChange={updateFolderFormName}
          onSlugChange={updateFolderFormSlug}
          onSubmit={() => {
            void saveFolderForm();
          }}
        />
      )}

      {renamingMedia !== undefined && (
        <RenameMediaDialog
          isNarrow={isNarrow}
          isSaving={isRenamingMedia}
          media={renamingMedia}
          name={renamingMediaName}
          onClose={() => {
            setRenamingMedia(undefined);
            setRenamingMediaName("");
          }}
          onNameChange={setRenamingMediaName}
          onSubmit={() => {
            void handleRenameMedia();
          }}
        />
      )}

      {deletingFolder !== undefined && (
        <AlertDialog
          isOpen
          title={t("admin.mediaLibrary.folders.deleteTitle")}
          description={t("admin.mediaLibrary.folders.deleteDescription", {
            name: deletingFolder.name,
          })}
          cancelLabel={t("actions.cancel")}
          actionLabel={t("admin.mediaLibrary.folders.deleteAction")}
          actionVariant="destructive"
          isActionLoading={isDeleting}
          onAction={() => {
            void handleDeleteFolder();
          }}
          onOpenChange={(isOpen) => {
            if (!isOpen && !isDeleting) {
              setDeletingFolder(undefined);
            }
          }}
        />
      )}

      {deletingMedia !== undefined && (
        <AlertDialog
          isOpen
          title={t("admin.mediaLibrary.deleteTitle")}
          description={t("admin.mediaLibrary.deleteDescription", {
            name: deletingMedia.fileName,
          })}
          cancelLabel={t("actions.cancel")}
          actionLabel={t("admin.mediaLibrary.deleteAction")}
          actionVariant="destructive"
          isActionLoading={isDeleting}
          onAction={() => {
            void handleDeleteMedia();
          }}
          onOpenChange={(isOpen) => {
            if (!isOpen && !isDeleting) {
              setDeletingMedia(undefined);
            }
          }}
        />
      )}

      {isBulkDeleteOpen && (
        <AlertDialog
          isOpen
          title={t("admin.mediaLibrary.bulkDeleteTitle")}
          description={t("admin.mediaLibrary.bulkDeleteDescription", {
            count: selectedMediaCount,
          })}
          cancelLabel={t("actions.cancel")}
          actionLabel={t("admin.mediaLibrary.bulkDelete")}
          actionVariant="destructive"
          isActionLoading={isDeleting}
          onAction={() => {
            void handleBulkDeleteMedia();
          }}
          onOpenChange={(isOpen) => {
            if (!isOpen && !isDeleting) {
              setIsBulkDeleteOpen(false);
            }
          }}
        />
      )}

      {migrationTarget !== undefined && (
        <AlertDialog
          isOpen
          title={t("admin.mediaLibrary.migration.title", {
            target: migrationTargetLabel,
          })}
          description={t("admin.mediaLibrary.migration.description", {
            count: selectedMediaCount,
            target: migrationTargetLabel,
          })}
          cancelLabel={t("actions.cancel")}
          actionLabel={t("admin.mediaLibrary.migration.action")}
          actionVariant="primary"
          isActionLoading={isMigrating}
          onAction={() => {
            void handleMigrateSelectedMedia();
          }}
          onOpenChange={(isOpen) => {
            if (!isOpen && !isMigrating) {
              setMigrationTarget(undefined);
            }
          }}
        />
      )}
    </VStack>
  );
}
