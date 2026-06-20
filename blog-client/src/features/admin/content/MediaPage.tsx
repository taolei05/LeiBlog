import {
  AlertDialog,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Label,
  Modal,
  ProgressBar,
  ScrollShadow,
} from "@heroui/react";
import SVG from "react-inlinesvg";
import { useEffect, useMemo, useRef, useState } from "react";

import { resolveApiAssetUrl } from "../../../shared/api/api-base-url";
import { AppIcon } from "../../../shared/icons";
import type { LocalImageEditorKind } from "../../../shared/media/local-image-editor";
import { LocalImageEditorDialog } from "../../../shared/media/local-image-editor";
import { showOperationToast } from "../../../shared/toast/operation-toast";
import { AdminDataPage } from "../shared/AdminDataPage";
import { AdminFormModal, AdminInputGroupField } from "../shared/admin-form-modal";
import { DataStatusChip } from "../shared/DataTable";
import { adminFetch, downloadAdminFile } from "../shared/admin-api";

type MediaRow = {
  alt: string;
  fileName: string;
  folderId: string | null;
  folderName: string;
  folderSlug: string | null;
  folderSystemKey: string | null;
  id: string;
  isSvg: boolean;
  kind: "document" | "image" | "video";
  size: string;
  status: "linked" | "unused";
  storageProvider: "local" | "r2";
  uploadedAt: string;
  url: string;
  usage: string;
};

type AdminMediaItem = {
  accessUrl: string;
  createdAt: string;
  fileFormat: string;
  fileName: string;
  fileSizeBytes: number;
  fileType: MediaRow["kind"];
  folderId: string | null;
  folderName: string | null;
  folderSlug: string | null;
  folderSystemKey: string | null;
  id: string;
  storageBucket: string | null;
  storageKey: string | null;
  storageProvider: MediaRow["storageProvider"];
  updatedAt: string;
};

type MediaFolder = {
  description: string;
  fileCount: number;
  id: string;
  isProtected: boolean;
  name: string;
  slug: string;
  systemKey: string | null;
};

type MediaStorageCounts = {
  all: number;
  local: number;
  r2: number;
};

type MediaFolderStorageCounts = {
  id: string;
  local: number;
  name: string;
  r2: number;
  slug: string;
  systemKey: string | null;
  total: number;
};

type MediaStorageSummary = {
  folders: MediaFolderStorageCounts[];
  ok: boolean;
  totals: MediaStorageCounts;
};

type MediaRenameModalState = {
  row: MediaRow;
  setNotice: (message: string) => void;
};

type FolderModalState =
  | {
      mode: "create";
      setNotice: (message: string) => void;
    }
  | {
      folder: MediaFolder;
      mode: "edit";
      setNotice: (message: string) => void;
    };

type MediaUploadEditState = {
  file: File;
  folderSlug: string;
  kind: LocalImageEditorKind;
  targetProvider: UploadTargetProvider;
};

type MediaOperationProgress = {
  label: string;
  total: number;
  value: number;
};

type StorageProviderFilter = "all" | "local" | "r2";
type UploadTargetProvider = "local" | "r2";
type MigrationConfirmationTarget = Exclude<StorageProviderFilter, "all">;

const MEDIA_GRID_INITIAL_LIMIT = 60;
const MEDIA_GRID_BATCH_SIZE = 60;
const EMPTY_MEDIA_STORAGE_SUMMARY: MediaStorageSummary = {
  folders: [],
  ok: true,
  totals: { all: 0, local: 0, r2: 0 },
};
const STORAGE_PROVIDER_FILTERS = [
  {
    icon: "filter",
    label: "全部存储",
    value: "all",
  },
  {
    icon: "server",
    label: "服务器文件",
    storageProvider: "local",
    value: "local",
  },
  {
    icon: "cloudUpload",
    label: "Cloudflare R2 文件",
    storageProvider: "r2",
    value: "r2",
  },
] as const;

function formatFileSize(bytes: number) {
  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function isSvgMediaItem(item: AdminMediaItem) {
  const fileFormat = item.fileFormat.trim().toLowerCase();
  const fileName = item.fileName.trim().toLowerCase();
  const accessPath = item.accessUrl.trim().toLowerCase().split(/[?#]/)[0] ?? "";

  return fileFormat === "svg" || fileName.endsWith(".svg") || accessPath.endsWith(".svg");
}

function toMediaRow(item: AdminMediaItem): MediaRow {
  return {
    alt: item.fileName,
    fileName: item.fileName,
    folderId: item.folderId,
    folderName: item.folderName ?? "未归类",
    folderSlug: item.folderSlug,
    folderSystemKey: item.folderSystemKey,
    id: item.id,
    isSvg: isSvgMediaItem(item),
    kind: item.fileType,
    size: formatFileSize(item.fileSizeBytes),
    status: "linked",
    storageProvider: item.storageProvider,
    uploadedAt: new Date(item.createdAt).toLocaleString("zh-CN"),
    url: resolveApiAssetUrl(item.accessUrl) ?? item.accessUrl,
    usage: item.fileFormat,
  };
}

function storageProviderCount(summary: MediaStorageSummary, value: StorageProviderFilter) {
  if (value === "local") return summary.totals.local;
  if (value === "r2") return summary.totals.r2;
  return summary.totals.all;
}

function folderStorageCounts(
  summary: MediaStorageSummary,
  folder: MediaFolder,
): MediaFolderStorageCounts {
  return (
    summary.folders.find((item) => item.slug === folder.slug) ?? {
      id: folder.id,
      local: 0,
      name: folder.name,
      r2: 0,
      slug: folder.slug,
      systemKey: folder.systemKey,
      total: folder.fileCount,
    }
  );
}

function folderCountForStorageFilter(
  counts: MediaFolderStorageCounts,
  value: StorageProviderFilter,
) {
  if (value === "local") return counts.local;
  if (value === "r2") return counts.r2;
  return counts.total;
}

function uploadTargetProviderLabel(targetProvider: UploadTargetProvider) {
  return targetProvider === "r2" ? "Cloudflare R2" : "服务器";
}

function migrationConfirmationTitle(targetProvider: MigrationConfirmationTarget) {
  return targetProvider === "r2" ? "确认迁移到 Cloudflare R2？" : "确认迁移到服务器？";
}

function MediaThumb({ item }: { item: MediaRow }) {
  return (
    <span className={`media-thumb media-thumb--${item.kind}`} title={item.alt}>
      <AppIcon name={item.kind === "image" ? "image" : "documentAttach"} />
    </span>
  );
}

type SvgMediaPreviewProps = {
  item: MediaRow;
};

function SvgMediaPreview({ item }: SvgMediaPreviewProps) {
  return (
    <span className="media-svg-preview" title={item.alt}>
      <SVG
        aria-label={item.alt}
        className="media-svg-preview__svg"
        loader={<MediaThumb item={item} />}
        role="img"
        src={item.url}
        title={item.alt}
        uniquifyIDs
      >
        <MediaThumb item={item} />
      </SVG>
    </span>
  );
}

type MediaPreviewModalProps = {
  item: MediaRow | null;
  onCopyUrl: (row: MediaRow) => Promise<void>;
  onOpenChange: (isOpen: boolean) => void;
};

function MediaPreviewModal({ item, onCopyUrl, onOpenChange }: MediaPreviewModalProps) {
  return (
    <Modal.Backdrop isOpen={item !== null} onOpenChange={onOpenChange} variant="blur">
      <Modal.Container placement="center" size="lg">
        <Modal.Dialog className="media-preview-modal">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Icon>
              <AppIcon name="eye" />
            </Modal.Icon>
            <div>
              <Modal.Heading>媒体预览与详细</Modal.Heading>
              <p className="admin-form-modal__description">{item?.fileName ?? "选择媒体后查看"}</p>
            </div>
          </Modal.Header>
          <Modal.Body className="media-preview-modal__body">
            <ScrollShadow
              hideScrollBar
              className="media-preview-modal__scroll"
              orientation="vertical"
              size={36}
            >
              <div className="media-preview-modal__content">
                <div className="media-preview-card__visual">
                  {item?.kind === "image" ? (
                    item.isSvg ? (
                      <SvgMediaPreview item={item} />
                    ) : (
                      <img alt={item.alt} decoding="async" loading="lazy" src={item.url} />
                    )
                  ) : item ? (
                    <MediaThumb item={item} />
                  ) : (
                    <span className="media-thumb media-thumb--document">
                      <AppIcon name="images" />
                    </span>
                  )}
                </div>
                <dl className="media-detail-list">
                  <div>
                    <dt>文件名</dt>
                    <dd>{item?.fileName ?? "暂无"}</dd>
                  </div>
                  <div>
                    <dt>链接</dt>
                    <dd>{item?.url ?? "暂无"}</dd>
                  </div>
                  <div>
                    <dt>文件夹</dt>
                    <dd>{item?.folderName ?? "暂无"}</dd>
                  </div>
                  <div>
                    <dt>类型</dt>
                    <dd>{item?.usage ?? "暂无"}</dd>
                  </div>
                  <div>
                    <dt>存储位置</dt>
                    <dd>
                      {item ? (item.storageProvider === "r2" ? "Cloudflare R2" : "服务器") : "暂无"}
                    </dd>
                  </div>
                  <div>
                    <dt>大小</dt>
                    <dd>{item?.size ?? "暂无"}</dd>
                  </div>
                  <div>
                    <dt>上传时间</dt>
                    <dd>{item?.uploadedAt ?? "暂无"}</dd>
                  </div>
                </dl>
              </div>
            </ScrollShadow>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="tertiary">
              关闭
            </Button>
            <Button
              isDisabled={!item}
              onPress={() => {
                if (!item) return;
                void onCopyUrl(item);
              }}
              variant="primary"
            >
              <AppIcon name="copy" />
              复制链接
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

export function MediaPage() {
  const [mediaRows, setMediaRows] = useState<MediaRow[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [storageSummary, setStorageSummary] = useState<MediaStorageSummary>(
    EMPTY_MEDIA_STORAGE_SUMMARY,
  );
  const [activeFolderSlug, setActiveFolderSlug] = useState("all");
  const [storageProviderFilter, setStorageProviderFilter] = useState<StorageProviderFilter>("all");
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(() => new Set());
  const [folderModalState, setFolderModalState] = useState<FolderModalState | null>(null);
  const [folderForm, setFolderForm] = useState({ description: "", name: "", slug: "" });
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [renameModalState, setRenameModalState] = useState<MediaRenameModalState | null>(null);
  const [renameFileName, setRenameFileName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [previewItem, setPreviewItem] = useState<MediaRow | null>(null);
  const [deleteModalRow, setDeleteModalRow] = useState<MediaRow | null>(null);
  const [uploadEditState, setUploadEditState] = useState<MediaUploadEditState | null>(null);
  const [mediaRenderLimit, setMediaRenderLimit] = useState(MEDIA_GRID_INITIAL_LIMIT);
  const [mediaProgress, setMediaProgress] = useState<MediaOperationProgress | null>(null);
  const [migrationConfirmationTarget, setMigrationConfirmationTarget] =
    useState<MigrationConfirmationTarget | null>(null);
  const [pageNotice, setPageNoticeState] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetProviderRef = useRef<UploadTargetProvider>("local");

  function setPageNotice(message: string) {
    setPageNoticeState(message);
    showOperationToast(message);
  }

  async function copyGridMediaUrl(row: MediaRow) {
    try {
      await navigator.clipboard.writeText(row.url);
      setPageNotice(`已复制 ${row.fileName} 链接`);
    } catch {
      setPageNotice(`${row.fileName} 链接已准备复制`);
    }
  }

  async function loadMedia() {
    const mediaParams = new URLSearchParams();
    if (storageProviderFilter !== "all") mediaParams.set("storageProvider", storageProviderFilter);
    const mediaPath = mediaParams.size
      ? `/admin/media/?${mediaParams.toString()}`
      : "/admin/media/";

    try {
      const folderResponse = await adminFetch<{ items: MediaFolder[] }>("/admin/media/folders");
      setFolders(folderResponse.items);
    } catch (error) {
      setPageNotice(error instanceof Error ? error.message : "媒体文件夹加载失败");
    }

    try {
      const storageResponse = await adminFetch<MediaStorageSummary>("/admin/media/storage/summary");
      setStorageSummary(storageResponse);
    } catch (error) {
      setStorageSummary(EMPTY_MEDIA_STORAGE_SUMMARY);
      setPageNotice(error instanceof Error ? error.message : "媒体存储统计加载失败");
    }

    try {
      const mediaResponse = await adminFetch<{ items: AdminMediaItem[] }>(mediaPath);
      const nextRows = mediaResponse.items.map(toMediaRow);
      const nextRowIds = new Set(nextRows.map((row) => row.id));

      setMediaRows(nextRows);
      setSelectedMediaIds(
        (selectedIds) => new Set([...selectedIds].filter((id) => nextRowIds.has(id))),
      );
    } catch (error) {
      setMediaRows([]);
      setSelectedMediaIds(new Set());
      setPageNotice(error instanceof Error ? error.message : "媒体列表加载失败");
    }
  }

  const activeFolder = useMemo(
    () => folders.find((folder) => folder.slug === activeFolderSlug) ?? null,
    [activeFolderSlug, folders],
  );
  const visibleMediaRows = useMemo(
    () =>
      activeFolderSlug === "all"
        ? mediaRows
        : mediaRows.filter((row) => row.folderSlug === activeFolderSlug),
    [activeFolderSlug, mediaRows],
  );
  const isActiveFolderEmpty = activeFolder !== null && visibleMediaRows.length === 0;
  const selectedMediaRows = useMemo(
    () => mediaRows.filter((row) => selectedMediaIds.has(row.id)),
    [mediaRows, selectedMediaIds],
  );
  const selectedVisibleCount = useMemo(
    () => visibleMediaRows.filter((row) => selectedMediaIds.has(row.id)).length,
    [selectedMediaIds, visibleMediaRows],
  );
  const renderedMediaRows = useMemo(
    () => visibleMediaRows.slice(0, mediaRenderLimit),
    [mediaRenderLimit, visibleMediaRows],
  );
  const canRenderMoreMedia = renderedMediaRows.length < visibleMediaRows.length;
  const areAllVisibleSelected =
    visibleMediaRows.length > 0 && selectedVisibleCount === visibleMediaRows.length;
  const areSomeVisibleSelected = selectedVisibleCount > 0 && !areAllVisibleSelected;

  useEffect(() => {
    void loadMedia();
  }, [reloadKey, storageProviderFilter]);

  useEffect(() => {
    setMediaRenderLimit(MEDIA_GRID_INITIAL_LIMIT);
  }, [activeFolderSlug, storageProviderFilter]);

  function getUploadEditorKind(file: File, folderSlug: string): LocalImageEditorKind | null {
    if (!file.type.startsWith("image/")) return null;
    if (file.type === "image/svg+xml") return null;
    if (folderSlug === "article-covers") return "article-cover";
    if (folderSlug === "avatars") return "avatar";

    return null;
  }

  function openUploadPicker(targetProvider: UploadTargetProvider) {
    uploadTargetProviderRef.current = targetProvider;
    uploadInputRef.current?.click();
    setPageNotice(`请选择文件上传到${uploadTargetProviderLabel(targetProvider)}`);
  }

  async function uploadSingleFile(
    file: File,
    folderSlug: string,
    targetProvider: UploadTargetProvider,
  ) {
    const formData = new FormData();
    formData.set("file", file);
    formData.set("folderSlug", folderSlug);
    formData.set("targetProvider", targetProvider);

    await adminFetch("/admin/media/", {
      body: formData,
      method: "POST",
    });
  }

  async function uploadFiles(
    files: File[],
    folderSlug = activeFolder?.slug ?? "article-covers",
    targetProvider: UploadTargetProvider = "local",
  ) {
    if (files.length === 0) return;

    let uploadedCount = 0;
    const failedFiles: Array<{ fileName: string; message: string }> = [];
    const targetLabel = uploadTargetProviderLabel(targetProvider);

    try {
      for (const [index, file] of files.entries()) {
        setMediaProgress({
          label: `正在上传到${targetLabel} ${file.name} (${index + 1}/${files.length})`,
          total: files.length,
          value: index,
        });

        try {
          await uploadSingleFile(file, folderSlug, targetProvider);
          uploadedCount += 1;
        } catch (error) {
          failedFiles.push({
            fileName: file.name,
            message: error instanceof Error ? error.message : "媒体上传失败",
          });
        } finally {
          setMediaProgress({
            label: `正在上传到${targetLabel} ${file.name} (${index + 1}/${files.length})`,
            total: files.length,
            value: index + 1,
          });
        }
      }

      if (uploadedCount > 0) setReloadKey((key) => key + 1);
      if (failedFiles.length > 0) {
        setPageNotice(
          uploadedCount === 0
            ? (failedFiles[0]?.message ?? "媒体上传失败")
            : `已上传 ${uploadedCount} 个文件到${targetLabel}，${failedFiles.length} 个失败`,
        );
      } else {
        setPageNotice(
          uploadedCount === 1
            ? `已上传 ${files[0]?.name ?? "文件"} 到${targetLabel}`
            : `已上传 ${uploadedCount} 个文件到${targetLabel}`,
        );
      }
    } finally {
      setMediaProgress(null);
    }
  }

  async function uploadFile(
    file: File,
    folderSlug = activeFolder?.slug ?? "article-covers",
    targetProvider: UploadTargetProvider = "local",
  ) {
    await uploadFiles([file], folderSlug, targetProvider);
  }

  async function submitRenameMedia() {
    if (!renameModalState) return;

    const fileName = renameFileName.trim();
    if (!fileName) {
      renameModalState.setNotice("文件名不能为空");
      return;
    }

    try {
      setIsRenaming(true);
      await adminFetch(`/admin/media/${renameModalState.row.id}`, {
        body: { fileName },
        method: "PATCH",
      });
      renameModalState.setNotice("媒体已重命名");
      setRenameModalState(null);
      setRenameFileName("");
      setReloadKey((key) => key + 1);
    } catch (error) {
      renameModalState.setNotice(error instanceof Error ? error.message : "媒体重命名失败");
    } finally {
      setIsRenaming(false);
    }
  }

  async function submitFolderForm() {
    if (!folderModalState) return;
    const name = folderForm.name.trim();
    if (!name) {
      folderModalState.setNotice("文件夹名称不能为空");
      return;
    }

    try {
      setIsSavingFolder(true);
      const body = {
        description: folderForm.description.trim(),
        name,
        slug: folderForm.slug.trim() || undefined,
      };

      if (folderModalState.mode === "create") {
        await adminFetch("/admin/media/folders", { body, method: "POST" });
        folderModalState.setNotice("文件夹已创建");
      } else {
        await adminFetch(`/admin/media/folders/${folderModalState.folder.id}`, {
          body,
          method: "PATCH",
        });
        folderModalState.setNotice("文件夹已更新");
      }

      setFolderModalState(null);
      setFolderForm({ description: "", name: "", slug: "" });
      setReloadKey((key) => key + 1);
    } catch (error) {
      folderModalState.setNotice(error instanceof Error ? error.message : "文件夹保存失败");
    } finally {
      setIsSavingFolder(false);
    }
  }

  async function deleteFolder(folder: MediaFolder, setNotice: (message: string) => void) {
    try {
      await adminFetch(`/admin/media/folders/${folder.id}`, { method: "DELETE" });
      setNotice("文件夹已删除");
      setActiveFolderSlug("all");
      setReloadKey((key) => key + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "文件夹删除失败");
    }
  }

  function selectFolder(slug: string) {
    setActiveFolderSlug(slug);
    setSelectedMediaIds(new Set());
  }

  function selectStorageProviderFilter(value: StorageProviderFilter) {
    setStorageProviderFilter(value);
    setSelectedMediaIds(new Set());
  }

  function updateMediaSelection(rowId: string, isSelected: boolean) {
    setSelectedMediaIds((selectedIds) => {
      const nextSelectedIds = new Set(selectedIds);

      if (isSelected) {
        nextSelectedIds.add(rowId);
      } else {
        nextSelectedIds.delete(rowId);
      }

      return nextSelectedIds;
    });
  }

  function updateVisibleMediaSelection(isSelected: boolean) {
    setSelectedMediaIds((selectedIds) => {
      const nextSelectedIds = new Set(selectedIds);

      visibleMediaRows.forEach((row) => {
        if (isSelected) {
          nextSelectedIds.add(row.id);
        } else {
          nextSelectedIds.delete(row.id);
        }
      });

      return nextSelectedIds;
    });
  }

  async function downloadMedia(row: MediaRow) {
    try {
      await downloadAdminFile(`/admin/media/${row.id}/download`, row.fileName);
      setPageNotice(`${row.fileName} 已开始下载`);
    } catch (error) {
      setPageNotice(error instanceof Error ? error.message : "媒体下载失败");
    }
  }

  async function deleteMedia(row: MediaRow) {
    try {
      await adminFetch(`/admin/media/${row.id}`, { method: "DELETE" });
      setSelectedMediaIds((selectedIds) => {
        const nextSelectedIds = new Set(selectedIds);
        nextSelectedIds.delete(row.id);
        return nextSelectedIds;
      });
      setPageNotice("媒体已删除");
      setReloadKey((key) => key + 1);
    } catch (error) {
      setPageNotice(error instanceof Error ? error.message : "媒体删除失败");
    }
  }

  async function deleteSelectedMedia() {
    try {
      await Promise.all(
        selectedMediaRows.map((row) => adminFetch(`/admin/media/${row.id}`, { method: "DELETE" })),
      );
      setSelectedMediaIds(new Set());
      setPageNotice(`已删除 ${selectedMediaRows.length} 个文件`);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setPageNotice(error instanceof Error ? error.message : "媒体删除失败");
    }
  }

  async function migrateSelectedMedia(targetProvider: Exclude<StorageProviderFilter, "all">) {
    if (selectedMediaRows.length === 0) return;

    let migratedCount = 0;
    let updatedReferences = 0;
    const failedFiles: string[] = [];

    try {
      for (const [index, row] of selectedMediaRows.entries()) {
        setMediaProgress({
          label: `正在迁移 ${row.fileName} (${index + 1}/${selectedMediaRows.length})`,
          total: selectedMediaRows.length,
          value: index,
        });

        try {
          const response = await adminFetch<{ updatedReferences: number }>(
            "/admin/media/storage/migrate",
            {
              body: {
                ids: [row.id],
                targetProvider,
              },
              method: "POST",
            },
          );
          migratedCount += 1;
          updatedReferences += response.updatedReferences ?? 0;
        } catch {
          failedFiles.push(row.fileName);
        } finally {
          setMediaProgress({
            label: `正在迁移 ${row.fileName} (${index + 1}/${selectedMediaRows.length})`,
            total: selectedMediaRows.length,
            value: index + 1,
          });
        }
      }

      setSelectedMediaIds(new Set());
      const targetLabel = targetProvider === "r2" ? "Cloudflare R2" : "服务器";
      const referenceLabel = updatedReferences > 0 ? `，同步更新 ${updatedReferences} 处引用` : "";
      const failureLabel = failedFiles.length > 0 ? `，${failedFiles.length} 个失败` : "";
      setPageNotice(
        `已迁移 ${migratedCount} 个文件到 ${targetLabel}${referenceLabel}${failureLabel}`,
      );
      setReloadKey((key) => key + 1);
    } finally {
      setMediaProgress(null);
    }
  }

  const imageCount = useMemo(
    () => mediaRows.filter((row) => row.kind === "image").length,
    [mediaRows],
  );
  const documentCount = useMemo(
    () => mediaRows.filter((row) => row.kind === "document").length,
    [mediaRows],
  );
  const videoCount = useMemo(
    () => mediaRows.filter((row) => row.kind === "video").length,
    [mediaRows],
  );
  const migrationConfirmationLabel = migrationConfirmationTarget
    ? uploadTargetProviderLabel(migrationConfirmationTarget)
    : "";

  return (
    <AdminDataPage
      description="媒体库使用平铺视图管理文件，支持选择、批量删除、预览、复制、下载和重命名。"
      eyebrow="内容管理"
      icon="images"
      metrics={[
        { label: "图片", value: String(imageCount) },
        { label: "视频", value: String(videoCount) },
        { label: "文档", value: String(documentCount) },
      ]}
      title="媒体库"
      wide
    >
      {pageNotice ? <DataStatusChip tone="success">{pageNotice}</DataStatusChip> : null}
      <AdminFormModal
        confirmDescription="将保存媒体文件夹名称、slug 和说明。"
        description="文件夹用于区分文章封面、头像、评论和站点资源。"
        icon="folderOpen"
        isOpen={folderModalState !== null}
        isSubmitting={isSavingFolder}
        onOpenChange={(isOpen) => {
          if (isOpen) return;
          setFolderModalState(null);
        }}
        onSubmit={submitFolderForm}
        submitLabel={folderModalState?.mode === "edit" ? "更新文件夹" : "创建文件夹"}
        title={folderModalState?.mode === "edit" ? "编辑文件夹" : "新建文件夹"}
      >
        <AdminInputGroupField
          icon="folderOpen"
          isRequired
          label="文件夹名称"
          onChange={(value) => setFolderForm((state) => ({ ...state, name: value }))}
          placeholder="输入文件夹名称"
          value={folderForm.name}
        />
        <AdminInputGroupField
          icon="link"
          label="Slug"
          onChange={(value) => setFolderForm((state) => ({ ...state, slug: value }))}
          placeholder="自动生成或手动填写"
          value={folderForm.slug}
        />
        <AdminInputGroupField
          icon="documentText"
          label="说明"
          onChange={(value) => setFolderForm((state) => ({ ...state, description: value }))}
          placeholder="输入文件夹用途"
          value={folderForm.description}
        />
      </AdminFormModal>
      <AdminFormModal
        confirmDescription="将保存新的媒体文件名，访问链接不会变化。"
        description="只修改媒体库记录中的文件名，访问链接保持不变。"
        icon="pencil"
        isOpen={renameModalState !== null}
        isSubmitting={isRenaming}
        onOpenChange={(isOpen) => {
          if (isOpen) return;
          setRenameModalState(null);
        }}
        onSubmit={submitRenameMedia}
        submitLabel="保存文件名"
        title="重命名媒体"
      >
        <AdminInputGroupField
          icon="documentAttach"
          isRequired
          label="文件名"
          onChange={setRenameFileName}
          placeholder="输入新的文件名"
          value={renameFileName}
        />
      </AdminFormModal>
      <MediaPreviewModal
        item={previewItem}
        onCopyUrl={copyGridMediaUrl}
        onOpenChange={(isOpen) => {
          if (isOpen) return;
          setPreviewItem(null);
        }}
      />
      {deleteModalRow ? (
        <AlertDialog>
          <AlertDialog.Backdrop
            isOpen
            onOpenChange={(isOpen) => {
              if (isOpen) return;
              setDeleteModalRow(null);
            }}
            variant="blur"
          >
            <AlertDialog.Container placement="center" size="sm">
              <AlertDialog.Dialog>
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon status="danger" />
                  <AlertDialog.Heading>确认删除媒体？</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>{`删除「${deleteModalRow.fileName}」后，已写入文章、头像或站点配置的链接不会自动替换。`}</p>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button slot="close" variant="tertiary">
                    取消
                  </Button>
                  <Button
                    onPress={() => {
                      void deleteMedia(deleteModalRow);
                      setDeleteModalRow(null);
                    }}
                    slot="close"
                    variant="danger"
                  >
                    确认删除
                  </Button>
                </AlertDialog.Footer>
              </AlertDialog.Dialog>
            </AlertDialog.Container>
          </AlertDialog.Backdrop>
        </AlertDialog>
      ) : null}
      {migrationConfirmationTarget ? (
        <AlertDialog>
          <AlertDialog.Backdrop
            isOpen
            onOpenChange={(isOpen) => {
              if (isOpen) return;
              setMigrationConfirmationTarget(null);
            }}
            variant="blur"
          >
            <AlertDialog.Container placement="center" size="sm">
              <AlertDialog.Dialog>
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon status="warning" />
                  <AlertDialog.Heading>
                    {migrationConfirmationTitle(migrationConfirmationTarget)}
                  </AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>{`将把所选 ${selectedMediaRows.length} 个媒体文件迁移到 ${migrationConfirmationLabel}，并同步更新文章、头像、站点配置等已知引用。旧文件会默认保留，不会自动删除。`}</p>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button slot="close" variant="tertiary">
                    取消
                  </Button>
                  <Button
                    onPress={() => {
                      void migrateSelectedMedia(migrationConfirmationTarget);
                      setMigrationConfirmationTarget(null);
                    }}
                    slot="close"
                    variant="primary"
                  >
                    确认迁移
                  </Button>
                </AlertDialog.Footer>
              </AlertDialog.Dialog>
            </AlertDialog.Container>
          </AlertDialog.Backdrop>
        </AlertDialog>
      ) : null}
      <div className="media-library-layout">
        <input
          ref={uploadInputRef}
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,video/mp4,video/webm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="visually-hidden"
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length === 0) return;

            const folderSlug = activeFolder?.slug ?? "article-covers";
            const targetProvider = uploadTargetProviderRef.current;
            const [file] = files;
            const kind = file && files.length === 1 ? getUploadEditorKind(file, folderSlug) : null;
            if (file && kind) {
              setUploadEditState({ file, folderSlug, kind, targetProvider });
              event.target.value = "";
              return;
            }

            void uploadFiles(files, folderSlug, targetProvider);
            event.target.value = "";
          }}
          type="file"
        />
        <div className="media-library-main">
          <div className="media-library-controls">
            <div className="media-library-toolbar">
              <div className="media-library-toolbar__actions">
                <Button
                  onPress={() => {
                    setFolderForm({ description: "", name: "", slug: "" });
                    setFolderModalState({ mode: "create", setNotice: setPageNotice });
                  }}
                  size="sm"
                  type="button"
                  variant="tertiary"
                >
                  <AppIcon name="folderOpen" />
                  新建文件夹
                </Button>
                <Dropdown>
                  <Button aria-label="选择媒体上传目标" size="sm" type="button" variant="tertiary">
                    <AppIcon name="cloudUpload" />
                    上传
                  </Button>
                  <Dropdown.Popover placement="bottom start">
                    <Dropdown.Menu
                      onAction={(key) => {
                        if (key === "local" || key === "r2") openUploadPicker(key);
                      }}
                    >
                      <Dropdown.Item id="local" textValue="上传到服务器">
                        <AppIcon name="server" />
                        <Label>上传到服务器</Label>
                      </Dropdown.Item>
                      <Dropdown.Item id="r2" textValue="上传到 Cloudflare R2">
                        <AppIcon name="cloudUpload" />
                        <Label>上传到 Cloudflare R2</Label>
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
                <Button
                  onPress={() => {
                    setReloadKey((key) => key + 1);
                    setPageNotice("媒体列表已刷新");
                  }}
                  size="sm"
                  type="button"
                  variant="tertiary"
                >
                  <AppIcon name="refresh" />
                  刷新
                </Button>
              </div>
              <div className="media-library-selection">
                <Checkbox
                  aria-label="选择全部当前媒体"
                  isDisabled={visibleMediaRows.length === 0}
                  isIndeterminate={areSomeVisibleSelected}
                  isSelected={areAllVisibleSelected}
                  onChange={updateVisibleMediaSelection}
                  variant="secondary"
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    {activeFolder ? "选择当前文件夹全部媒体" : "选择全部媒体"}
                  </Checkbox.Content>
                </Checkbox>
                <span>已选择 {selectedMediaIds.size} 项</span>
                <span>
                  已显示 {renderedMediaRows.length} / {visibleMediaRows.length} 项
                </span>
                <Button
                  isDisabled={selectedMediaRows.length === 0}
                  onPress={() => setMigrationConfirmationTarget("local")}
                  size="sm"
                  type="button"
                  variant="tertiary"
                >
                  <AppIcon name="server" />
                  迁移到服务器
                </Button>
                <Button
                  isDisabled={selectedMediaRows.length === 0}
                  onPress={() => setMigrationConfirmationTarget("r2")}
                  size="sm"
                  type="button"
                  variant="tertiary"
                >
                  <AppIcon name="cloudUpload" />
                  迁移到 Cloudflare R2
                </Button>
                <AlertDialog>
                  <Button
                    isDisabled={selectedMediaRows.length === 0}
                    size="sm"
                    type="button"
                    variant="danger-soft"
                  >
                    <AppIcon name="trash" />
                    批量删除
                  </Button>
                  <AlertDialog.Backdrop>
                    <AlertDialog.Container placement="center" size="sm">
                      <AlertDialog.Dialog>
                        <AlertDialog.CloseTrigger />
                        <AlertDialog.Header>
                          <AlertDialog.Icon status="danger" />
                          <AlertDialog.Heading>确认批量删除？</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                          <p>{`将删除所选 ${selectedMediaRows.length} 个媒体文件，已写入内容的链接不会自动替换。`}</p>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                          <Button slot="close" variant="tertiary">
                            取消
                          </Button>
                          <Button
                            onPress={() => void deleteSelectedMedia()}
                            slot="close"
                            variant="danger"
                          >
                            确认批量删除
                          </Button>
                        </AlertDialog.Footer>
                      </AlertDialog.Dialog>
                    </AlertDialog.Container>
                  </AlertDialog.Backdrop>
                </AlertDialog>
              </div>
            </div>
            {mediaProgress ? (
              <div className="media-operation-progress">
                <ProgressBar
                  aria-label={mediaProgress.label}
                  maxValue={mediaProgress.total}
                  value={mediaProgress.value}
                >
                  <Label>{mediaProgress.label}</Label>
                  <ProgressBar.Output />
                  <ProgressBar.Track>
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                </ProgressBar>
              </div>
            ) : null}
            <div className="media-storage-filter" aria-label="媒体存储位置筛选">
              {STORAGE_PROVIDER_FILTERS.map((filter) => (
                <Button
                  key={filter.value}
                  onPress={() => selectStorageProviderFilter(filter.value)}
                  size="sm"
                  type="button"
                  variant={storageProviderFilter === filter.value ? "primary" : "tertiary"}
                >
                  <AppIcon name={filter.icon} />
                  {filter.label}
                  <span>{storageProviderCount(storageSummary, filter.value)}</span>
                </Button>
              ))}
            </div>
            <div className="media-folder-list" aria-label="媒体文件夹">
              <Button
                onPress={() => selectFolder("all")}
                size="sm"
                type="button"
                variant={activeFolderSlug === "all" ? "primary" : "tertiary"}
              >
                <AppIcon name="images" />
                全部
                <span>{storageProviderCount(storageSummary, storageProviderFilter)}</span>
              </Button>
              {folders.map((folder) => {
                const counts = folderStorageCounts(storageSummary, folder);

                return (
                  <Button
                    key={folder.id}
                    onPress={() => selectFolder(folder.slug)}
                    size="sm"
                    type="button"
                    variant={activeFolderSlug === folder.slug ? "primary" : "tertiary"}
                  >
                    <AppIcon name="folderOpen" />
                    {folder.name}
                    <span>{folderCountForStorageFilter(counts, storageProviderFilter)}</span>
                  </Button>
                );
              })}
            </div>
            {activeFolder ? (
              <div className="media-folder-actions">
                <Button
                  onPress={() => {
                    setFolderForm({
                      description: activeFolder.description,
                      name: activeFolder.name,
                      slug: activeFolder.slug,
                    });
                    setFolderModalState({
                      folder: activeFolder,
                      mode: "edit",
                      setNotice: setPageNotice,
                    });
                  }}
                  size="sm"
                  type="button"
                  variant="tertiary"
                >
                  <AppIcon name="pencil" />
                  修改文件夹
                </Button>
                <AlertDialog>
                  <Button
                    isDisabled={activeFolder.isProtected}
                    size="sm"
                    type="button"
                    variant="danger-soft"
                  >
                    <AppIcon name="trash" />
                    删除文件夹
                  </Button>
                  <AlertDialog.Backdrop>
                    <AlertDialog.Container placement="center" size="sm">
                      <AlertDialog.Dialog>
                        <AlertDialog.CloseTrigger />
                        <AlertDialog.Header>
                          <AlertDialog.Icon status="danger" />
                          <AlertDialog.Heading>确认删除文件夹？</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                          <p>删除后文件仍会保留在媒体库，但不再归属于该文件夹。</p>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                          <Button slot="close" variant="tertiary">
                            取消
                          </Button>
                          <Button
                            onPress={() => void deleteFolder(activeFolder, setPageNotice)}
                            slot="close"
                            variant="danger"
                          >
                            确认删除
                          </Button>
                        </AlertDialog.Footer>
                      </AlertDialog.Dialog>
                    </AlertDialog.Container>
                  </AlertDialog.Backdrop>
                </AlertDialog>
              </div>
            ) : null}
          </div>
          <div className="media-grid-view">
            {isActiveFolderEmpty ? (
              <Card className="media-folder-empty-card">
                <span className="media-thumb media-thumb--document">
                  <AppIcon name="folderOpen" />
                </span>
                <strong>{`「${activeFolder.name}」文件夹暂无文件`}</strong>
                <p>点击上方上传按钮，可以将文件添加到当前文件夹。</p>
              </Card>
            ) : null}
            {renderedMediaRows.map((row) => {
              const isSelected = selectedMediaIds.has(row.id);

              return (
                <Card
                  className={
                    isSelected ? "media-grid-card media-grid-card--selected" : "media-grid-card"
                  }
                  key={row.id}
                >
                  <div className="media-grid-card__preview">
                    <Checkbox
                      aria-label={`选择${row.fileName}`}
                      className="media-grid-card__selection"
                      isSelected={isSelected}
                      onChange={(selected) => updateMediaSelection(row.id, selected)}
                      variant="secondary"
                    >
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Content>
                    </Checkbox>
                    {row.kind === "image" ? (
                      row.isSvg ? (
                        <SvgMediaPreview item={row} />
                      ) : (
                        <img alt={row.alt} decoding="async" loading="lazy" src={row.url} />
                      )
                    ) : (
                      <MediaThumb item={row} />
                    )}
                  </div>
                  <strong title={row.fileName}>{row.fileName}</strong>
                  <span>
                    {row.folderName} · {row.size} ·{" "}
                    {row.storageProvider === "r2" ? "Cloudflare R2" : "服务器"}
                  </span>
                  <div className="media-grid-card__actions">
                    <Button
                      isIconOnly
                      aria-label={`预览${row.fileName}`}
                      onPress={() => setPreviewItem(row)}
                      size="sm"
                      type="button"
                      variant="tertiary"
                    >
                      <AppIcon name="eye" />
                    </Button>
                    <Button
                      isIconOnly
                      aria-label={`复制${row.fileName}链接`}
                      onPress={() => void copyGridMediaUrl(row)}
                      size="sm"
                      type="button"
                      variant="tertiary"
                    >
                      <AppIcon name="copy" />
                    </Button>
                    <Button
                      isIconOnly
                      aria-label={`下载${row.fileName}`}
                      onPress={() => void downloadMedia(row)}
                      size="sm"
                      type="button"
                      variant="tertiary"
                    >
                      <AppIcon name="download" />
                    </Button>
                    <Button
                      isIconOnly
                      aria-label={`重命名${row.fileName}`}
                      onPress={() => {
                        setRenameFileName(row.fileName);
                        setRenameModalState({ row, setNotice: setPageNotice });
                      }}
                      size="sm"
                      type="button"
                      variant="tertiary"
                    >
                      <AppIcon name="pencil" />
                    </Button>
                    <Button
                      isIconOnly
                      aria-label={`删除${row.fileName}`}
                      onPress={() => setDeleteModalRow(row)}
                      size="sm"
                      type="button"
                      variant="danger-soft"
                    >
                      <AppIcon name="trash" />
                    </Button>
                  </div>
                </Card>
              );
            })}
            {canRenderMoreMedia ? (
              <Card className="media-grid-load-more-card">
                <span className="media-thumb media-thumb--document">
                  <AppIcon name="images" />
                </span>
                <strong>{`还有 ${visibleMediaRows.length - renderedMediaRows.length} 个媒体文件未显示`}</strong>
                <p>分批加载可减少大量图片和 SVG 同时渲染造成的卡顿。</p>
                <Button
                  onPress={() => setMediaRenderLimit((limit) => limit + MEDIA_GRID_BATCH_SIZE)}
                  type="button"
                  variant="tertiary"
                >
                  <AppIcon name="arrowDown" />
                  加载更多媒体
                </Button>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
      <LocalImageEditorDialog
        file={uploadEditState?.file ?? null}
        isOpen={uploadEditState !== null}
        kind={uploadEditState?.kind ?? "article-cover"}
        onApply={(file) => {
          if (!uploadEditState) return;

          void uploadFile(file, uploadEditState.folderSlug, uploadEditState.targetProvider);
          setUploadEditState(null);
        }}
        onCancel={() => setUploadEditState(null)}
      />
    </AdminDataPage>
  );
}
