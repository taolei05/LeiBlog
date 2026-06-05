import { AlertDialog, Button, Card, Modal, ScrollShadow } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

import { resolveApiAssetUrl } from "../../../shared/api/api-base-url";
import { AppIcon } from "../../../shared/icons";
import type { LocalImageEditorKind } from "../../../shared/media/local-image-editor";
import { LocalImageEditorDialog } from "../../../shared/media/local-image-editor";
import { showOperationToast } from "../../../shared/toast/operation-toast";
import { AdminDataPage } from "../shared/AdminDataPage";
import { AdminFormModal, AdminInputGroupField } from "../shared/admin-form-modal";
import type {
  DataTableBulkAction,
  DataTableColumn,
  DataTableFilter,
  DataTableRow,
  DataTableRowAction,
  DataTableToolbarAction,
} from "../shared/DataTable";
import { DataStatusChip, DataTable, truncateDataTablePrimaryText } from "../shared/DataTable";
import { adminFetch, downloadAdminFile } from "../shared/admin-api";

type MediaRow = DataTableRow & {
  alt: string;
  fileName: string;
  folderId: string | null;
  folderName: string;
  folderSlug: string | null;
  folderSystemKey: string | null;
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

const mediaColumns: DataTableColumn<MediaRow>[] = [
  {
    header: "文件",
    id: "fileName",
    isRowHeader: true,
    render: (row) => (
      <span className="media-file-cell">
        <MediaThumb item={row} />
        <span className="data-table-primary-cell">
          <strong title={row.fileName}>{truncateDataTablePrimaryText(row.fileName)}</strong>
          <small>{row.url}</small>
        </span>
      </span>
    ),
    searchValue: (row) => `${row.fileName} ${row.url} ${row.usage} ${row.folderName}`,
    sortable: true,
    value: (row) => row.fileName,
  },
  {
    header: "文件夹",
    id: "folderName",
    sortable: true,
    value: (row) => row.folderName,
  },
  {
    header: "类型",
    id: "kind",
    render: (row) => (
      <DataStatusChip
        tone={row.kind === "image" ? "accent" : row.kind === "video" ? "warning" : "default"}
      >
        {row.kind === "image" ? "图片" : row.kind === "video" ? "视频" : "文档"}
      </DataStatusChip>
    ),
    sortable: true,
    value: (row) => (row.kind === "image" ? "图片" : row.kind === "video" ? "视频" : "文档"),
  },
  {
    header: "大小",
    id: "size",
    sortable: true,
    value: (row) => row.size,
  },
  {
    header: "引用",
    id: "usage",
    sortable: true,
    value: (row) => row.usage,
  },
  {
    header: "状态",
    id: "status",
    render: (row) => (
      <DataStatusChip tone={row.status === "linked" ? "success" : "warning"}>
        {row.status === "linked" ? "已引用" : "未引用"}
      </DataStatusChip>
    ),
    sortable: true,
    value: (row) => (row.status === "linked" ? "已引用" : "未引用"),
  },
  {
    header: "上传时间",
    id: "uploadedAt",
    sortable: true,
    value: (row) => row.uploadedAt,
  },
];

const mediaFilters: DataTableFilter<MediaRow>[] = [
  {
    allLabel: "全部类型",
    key: "kind",
    label: "类型",
    options: [
      { label: "图片", predicate: (row) => row.kind === "image", value: "image" },
      { label: "视频", predicate: (row) => row.kind === "video", value: "video" },
      { label: "文档", predicate: (row) => row.kind === "document", value: "document" },
    ],
  },
  {
    allLabel: "全部状态",
    key: "status",
    label: "状态",
    options: [
      { label: "已引用", predicate: (row) => row.status === "linked", value: "linked" },
      { label: "未引用", predicate: (row) => row.status === "unused", value: "unused" },
    ],
  },
];

export function MediaPage() {
  const [mediaRows, setMediaRows] = useState<MediaRow[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [activeFolderSlug, setActiveFolderSlug] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
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
    setFolders(folderResponse.items);
    setMediaRows(mediaResponse.items.map(toMediaRow));
  }

  const activeFolder = folders.find((folder) => folder.slug === activeFolderSlug) ?? null;
  const visibleMediaRows =
    activeFolderSlug === "all"
      ? mediaRows
      : mediaRows.filter((row) => row.folderSlug === activeFolderSlug);

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

  const mediaToolbarActions: DataTableToolbarAction<MediaRow>[] = [
    {
      confirmation: "none",
      icon: "folderOpen",
      label: "新建文件夹",
      onPress: ({ setNotice }) => {
        setFolderForm({ description: "", name: "", slug: "" });
        setFolderModalState({ mode: "create", setNotice });
      },
    },
    {
      icon: "cloudUpload",
      label: "上传",
      onPress: ({ setNotice }) => {
        uploadInputRef.current?.click();
        setNotice("请选择文件上传到媒体库");
      },
    },
    {
      access: "read",
      icon: "refresh",
      label: "刷新",
      onPress: ({ setNotice }) => {
        setReloadKey((key) => key + 1);
        setNotice("媒体列表已刷新");
      },
    },
  ];

  const mediaBulkActions: DataTableBulkAction<MediaRow>[] = [
    {
      access: "danger",
      confirmationDescription: (rows) =>
        `这是批量删除，将移除所选 ${rows.length} 个媒体文件。已写入文章、头像或站点配置的链接不会自动替换，相关资源可能失效。`,
      icon: "trash",
      label: "删除",
      onPress: async (rows, { clearSelection, setNotice }) => {
        try {
          await Promise.all(
            rows.map((row) => adminFetch(`/admin/media/${row.id}`, { method: "DELETE" })),
          );
          clearSelection();
          setNotice(`已删除 ${rows.length} 个文件`);
          setReloadKey((key) => key + 1);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "媒体删除失败");
        }
      },
    },
  ];

  const mediaRowActions: DataTableRowAction<MediaRow>[] = [
    {
      access: "read",
      icon: "copy",
      label: "复制链接",
      onPress: async (row, { setNotice }) => {
        try {
          await navigator.clipboard.writeText(row.url);
          setNotice(`已复制 ${row.fileName} 链接`);
        } catch {
          setNotice(`${row.fileName} 链接已准备复制`);
        }
      },
    },
    {
      access: "read",
      icon: "eye",
      label: "预览",
      onPress: (row) => {
        setPreviewItem(row);
      },
    },
    {
      access: "read",
      icon: "download",
      label: "下载",
      onPress: async (row, { setNotice }) => {
        try {
          await downloadAdminFile(`/admin/media/${row.id}/download`, row.fileName);
          setNotice(`${row.fileName} 已开始下载`);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "媒体下载失败");
        }
      },
    },
    {
      confirmation: "none",
      icon: "pencil",
      label: "重命名",
      onPress: (row, { setNotice }) => {
        setRenameFileName(row.fileName);
        setRenameModalState({ row, setNotice });
      },
    },
    {
      access: "danger",
      confirmationDescription: (row) =>
        `删除「${row.fileName}」后，已写入文章、头像或站点配置的链接不会自动替换，相关资源可能失效。`,
      icon: "trash",
      label: "删除",
      onPress: async (row, { setNotice }) => {
        try {
          await adminFetch(`/admin/media/${row.id}`, { method: "DELETE" });
          setNotice("媒体已删除");
          setReloadKey((key) => key + 1);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "媒体删除失败");
        }
      },
    },
  ];
  const imageCount = mediaRows.filter((row) => row.kind === "image").length;
  const documentCount = mediaRows.filter((row) => row.kind === "document").length;
  const videoCount = mediaRows.filter((row) => row.kind === "video").length;

  return (
    <AdminDataPage
      description="媒体库保留搜索、类型/引用筛选、排序、分页和复制、预览、下载、重命名、详细、删除操作。"
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
            <div className="media-view-toggle" role="group" aria-label="媒体视图切换">
              <Button
                onPress={() => setViewMode("list")}
                size="sm"
                type="button"
                variant={viewMode === "list" ? "primary" : "tertiary"}
              >
                <AppIcon name="list" />
                列表
              </Button>
              <Button
                onPress={() => setViewMode("grid")}
                size="sm"
                type="button"
                variant={viewMode === "grid" ? "primary" : "tertiary"}
              >
                <AppIcon name="grid" />
                平铺
              </Button>
            </div>
            <div className="media-folder-list" aria-label="媒体文件夹">
              <Button
                onPress={() => setActiveFolderSlug("all")}
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
                  onPress={() => setActiveFolderSlug(folder.slug)}
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
          {viewMode === "list" ? (
            <DataTable
              ariaLabel="媒体库表格"
              bulkActions={mediaBulkActions}
              columns={mediaColumns}
              defaultSort={{ column: "uploadedAt", direction: "desc" }}
              filters={mediaFilters}
              rowActions={mediaRowActions}
              rows={visibleMediaRows}
              searchPlaceholder="搜索文件、链接、引用文章"
              toolbarActions={mediaToolbarActions}
              emptyText="暂无媒体记录"
            />
          ) : (
            <div className="media-grid-view">
              {visibleMediaRows.map((row) => (
                <Card className="media-grid-card" key={row.id}>
                  <div className="media-grid-card__preview">
                    {row.kind === "image" ? (
                      <img alt={row.alt} src={row.url} />
                    ) : (
                      <MediaThumb item={row} />
                    )}
                  </div>
                  <strong>{row.fileName}</strong>
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
                  </div>
                </Card>
              ))}
            </div>
          )}
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
