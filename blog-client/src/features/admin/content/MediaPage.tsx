import { AlertDialog, Button, Card, Checkbox, Modal, ScrollShadow } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

import { resolveApiAssetUrl } from "../../../shared/api/api-base-url";
import { AppIcon } from "../../../shared/icons";
import type { LocalImageEditorKind } from "../../../shared/media/local-image-editor";
import { LocalImageEditorDialog } from "../../../shared/media/local-image-editor";
import { useAdminSession } from "../../../shared/routing/adminGuards";
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
  kind: "document" | "image" | "video";
  size: string;
  status: "linked" | "unused";
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
};

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

function toMediaRow(item: AdminMediaItem): MediaRow {
  return {
    alt: item.fileName,
    fileName: item.fileName,
    folderId: item.folderId,
    folderName: item.folderName ?? "未归类",
    folderSlug: item.folderSlug,
    folderSystemKey: item.folderSystemKey,
    id: item.id,
    kind: item.fileType,
    size: formatFileSize(item.fileSizeBytes),
    status: "linked",
    uploadedAt: new Date(item.createdAt).toLocaleString("zh-CN"),
    url: resolveApiAssetUrl(item.accessUrl) ?? item.accessUrl,
    usage: item.fileFormat,
  };
}

function MediaThumb({ item }: { item: MediaRow }) {
  return (
    <span className={`media-thumb media-thumb--${item.kind}`} title={item.alt}>
      <AppIcon name={item.kind === "image" ? "image" : "documentAttach"} />
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
                    <img alt={item.alt} src={item.url} />
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
  const session = useAdminSession();
  const [mediaRows, setMediaRows] = useState<MediaRow[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [activeFolderSlug, setActiveFolderSlug] = useState("all");
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(() => new Set());
  const [folderModalState, setFolderModalState] = useState<FolderModalState | null>(null);
  const [folderForm, setFolderForm] = useState({ description: "", name: "", slug: "" });
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [renameModalState, setRenameModalState] = useState<MediaRenameModalState | null>(null);
  const [renameFileName, setRenameFileName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [previewItem, setPreviewItem] = useState<MediaRow | null>(null);
  const [uploadEditState, setUploadEditState] = useState<MediaUploadEditState | null>(null);
  const [pageNotice, setPageNoticeState] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

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
    const [mediaResponse, folderResponse] = await Promise.all([
      adminFetch<{ items: AdminMediaItem[] }>("/admin/media/"),
      adminFetch<{ items: MediaFolder[] }>("/admin/media/folders"),
    ]);
    const nextRows = mediaResponse.items.map(toMediaRow);

    setFolders(folderResponse.items);
    setMediaRows(nextRows);
    setSelectedMediaIds(
      (selectedIds) =>
        new Set([...selectedIds].filter((id) => nextRows.some((row) => row.id === id))),
    );
  }

  const activeFolder = folders.find((folder) => folder.slug === activeFolderSlug) ?? null;
  const visibleMediaRows =
    activeFolderSlug === "all"
      ? mediaRows
      : mediaRows.filter((row) => row.folderSlug === activeFolderSlug);
  const selectedMediaRows = mediaRows.filter((row) => selectedMediaIds.has(row.id));
  const selectedVisibleCount = visibleMediaRows.filter((row) =>
    selectedMediaIds.has(row.id),
  ).length;
  const areAllVisibleSelected =
    visibleMediaRows.length > 0 && selectedVisibleCount === visibleMediaRows.length;
  const areSomeVisibleSelected = selectedVisibleCount > 0 && !areAllVisibleSelected;

  useEffect(() => {
    void loadMedia();
  }, [reloadKey]);

  function getUploadEditorKind(file: File, folderSlug: string): LocalImageEditorKind | null {
    if (!file.type.startsWith("image/")) return null;
    if (folderSlug === "article-covers") return "article-cover";
    if (folderSlug === "avatars") return "avatar";

    return null;
  }

  async function uploadFile(file: File, folderSlug = activeFolder?.slug ?? "article-covers") {
    const formData = new FormData();
    formData.set("file", file);
    formData.set("folderSlug", folderSlug);

    try {
      await adminFetch("/admin/media/", {
        body: formData,
        method: "POST",
      });
      setPageNotice(`已上传 ${file.name}`);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setPageNotice(error instanceof Error ? error.message : "媒体上传失败");
    }
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

  const imageCount = mediaRows.filter((row) => row.kind === "image").length;
  const documentCount = mediaRows.filter((row) => row.kind === "document").length;
  const videoCount = mediaRows.filter((row) => row.kind === "video").length;

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
      <div className="media-library-layout">
        <input
          ref={uploadInputRef}
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,video/mp4,video/webm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="visually-hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;

            const folderSlug = activeFolder?.slug ?? "article-covers";
            const kind = getUploadEditorKind(file, folderSlug);
            if (kind) {
              setUploadEditState({ file, folderSlug, kind });
              event.target.value = "";
              return;
            }

            void uploadFile(file);
            event.target.value = "";
          }}
          type="file"
        />
        <div className="media-library-main">
          <div className="media-library-controls">
            <div className="media-library-toolbar">
              <div className="media-library-toolbar__actions">
                <Button
                  isDisabled={session.isReadOnly}
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
                <Button
                  isDisabled={session.isReadOnly}
                  onPress={() => {
                    uploadInputRef.current?.click();
                    setPageNotice("请选择文件上传到媒体库");
                  }}
                  size="sm"
                  type="button"
                  variant="tertiary"
                >
                  <AppIcon name="cloudUpload" />
                  上传
                </Button>
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
                  isDisabled={session.isReadOnly || visibleMediaRows.length === 0}
                  isIndeterminate={areSomeVisibleSelected}
                  isSelected={areAllVisibleSelected}
                  onChange={updateVisibleMediaSelection}
                  variant="secondary"
                >
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                </Checkbox>
                <span>已选择 {selectedMediaIds.size} 项</span>
                <AlertDialog>
                  <Button
                    isDisabled={session.isReadOnly || selectedMediaRows.length === 0}
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
            <div className="media-folder-list" aria-label="媒体文件夹">
              <Button
                onPress={() => selectFolder("all")}
                size="sm"
                type="button"
                variant={activeFolderSlug === "all" ? "primary" : "tertiary"}
              >
                <AppIcon name="images" />
                全部
              </Button>
              {folders.map((folder) => (
                <Button
                  key={folder.id}
                  onPress={() => selectFolder(folder.slug)}
                  size="sm"
                  type="button"
                  variant={activeFolderSlug === folder.slug ? "primary" : "tertiary"}
                >
                  <AppIcon name="folderOpen" />
                  {folder.name}
                  <span>{folder.fileCount}</span>
                </Button>
              ))}
            </div>
            {activeFolder ? (
              <div className="media-folder-actions">
                <Button
                  isDisabled={session.isReadOnly}
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
                    isDisabled={session.isReadOnly || activeFolder.isProtected}
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
            {visibleMediaRows.map((row) => {
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
                      isDisabled={session.isReadOnly}
                      isSelected={isSelected}
                      onChange={(selected) => updateMediaSelection(row.id, selected)}
                      variant="secondary"
                    >
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox>
                    {row.kind === "image" ? (
                      <img alt={row.alt} src={row.url} />
                    ) : (
                      <MediaThumb item={row} />
                    )}
                  </div>
                  <strong title={row.fileName}>{row.fileName}</strong>
                  <span>
                    {row.folderName} · {row.size}
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
                      isDisabled={session.isReadOnly}
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
                    <AlertDialog>
                      <Button
                        isDisabled={session.isReadOnly}
                        isIconOnly
                        aria-label={`删除${row.fileName}`}
                        size="sm"
                        type="button"
                        variant="danger-soft"
                      >
                        <AppIcon name="trash" />
                      </Button>
                      <AlertDialog.Backdrop>
                        <AlertDialog.Container placement="center" size="sm">
                          <AlertDialog.Dialog>
                            <AlertDialog.CloseTrigger />
                            <AlertDialog.Header>
                              <AlertDialog.Icon status="danger" />
                              <AlertDialog.Heading>确认删除媒体？</AlertDialog.Heading>
                            </AlertDialog.Header>
                            <AlertDialog.Body>
                              <p>{`删除「${row.fileName}」后，已写入文章、头像或站点配置的链接不会自动替换。`}</p>
                            </AlertDialog.Body>
                            <AlertDialog.Footer>
                              <Button slot="close" variant="tertiary">
                                取消
                              </Button>
                              <Button
                                onPress={() => void deleteMedia(row)}
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
                </Card>
              );
            })}
          </div>
        </div>
      </div>
      <LocalImageEditorDialog
        file={uploadEditState?.file ?? null}
        isOpen={uploadEditState !== null}
        kind={uploadEditState?.kind ?? "article-cover"}
        onApply={(file) => {
          if (!uploadEditState) return;

          void uploadFile(file, uploadEditState.folderSlug);
          setUploadEditState(null);
        }}
        onCancel={() => setUploadEditState(null)}
      />
    </AdminDataPage>
  );
}
