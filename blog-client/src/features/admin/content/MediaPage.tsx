import { Card } from "@heroui/react";
import { useState } from "react";

import { AppIcon } from "../../../shared/icons";
import { AdminDataPage } from "../shared/AdminDataPage";
import {
  DataStatusChip,
  DataTable,
  type DataTableBulkAction,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableRow,
  type DataTableRowAction,
  type DataTableToolbarAction,
} from "../shared/DataTable";

type MediaRow = DataTableRow & {
  alt: string;
  fileName: string;
  kind: "document" | "image";
  size: string;
  status: "linked" | "unused";
  uploadedAt: string;
  url: string;
  usage: string;
};

const mediaRows: MediaRow[] = [
  {
    alt: "后台主题预览截图",
    fileName: "admin-theme-preview.png",
    id: "media-theme-preview",
    kind: "image",
    size: "420 KB",
    status: "linked",
    uploadedAt: "2026-05-15 20:12",
    url: "https://cdn.leiblog.local/media/admin-theme-preview.png",
    usage: "主题系统",
  },
  {
    alt: "城市夜景照片",
    fileName: "city-night-lights.jpg",
    id: "media-city-night",
    kind: "image",
    size: "1.8 MB",
    status: "linked",
    uploadedAt: "2026-05-10 21:33",
    url: "https://cdn.leiblog.local/media/city-night-lights.jpg",
    usage: "摄影文章",
  },
  {
    alt: "后端架构图文档",
    fileName: "backend-architecture.pdf",
    id: "media-backend-pdf",
    kind: "document",
    size: "960 KB",
    status: "linked",
    uploadedAt: "2026-05-08 11:09",
    url: "https://cdn.leiblog.local/media/backend-architecture.pdf",
    usage: "工程札记",
  },
  {
    alt: "MDX 编辑器截图",
    fileName: "mdx-editor-toolbar.png",
    id: "media-mdx-toolbar",
    kind: "image",
    size: "380 KB",
    status: "unused",
    uploadedAt: "2026-05-02 16:20",
    url: "https://cdn.leiblog.local/media/mdx-editor-toolbar.png",
    usage: "未引用",
  },
  {
    alt: "备案说明草稿",
    fileName: "filing-notes.txt",
    id: "media-filing-notes",
    kind: "document",
    size: "18 KB",
    status: "unused",
    uploadedAt: "2026-04-29 08:44",
    url: "https://cdn.leiblog.local/media/filing-notes.txt",
    usage: "未引用",
  },
  {
    alt: "文章封面图",
    fileName: "redis-cache-cover.webp",
    id: "media-redis-cover",
    kind: "image",
    size: "742 KB",
    status: "linked",
    uploadedAt: "2026-04-26 14:02",
    url: "https://cdn.leiblog.local/media/redis-cache-cover.webp",
    usage: "Redis 缓存键设计笔记",
  },
];

function MediaThumb({ item }: { item: MediaRow }) {
  return (
    <span className={`media-thumb media-thumb--${item.kind}`} title={item.alt}>
      <AppIcon name={item.kind === "image" ? "image" : "documentAttach"} />
    </span>
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
          <strong>{row.fileName}</strong>
          <small>{row.url}</small>
        </span>
      </span>
    ),
    searchValue: (row) => `${row.fileName} ${row.url} ${row.usage}`,
    sortable: true,
    value: (row) => row.fileName,
  },
  {
    header: "类型",
    id: "kind",
    render: (row) => (
      <DataStatusChip tone={row.kind === "image" ? "accent" : "default"}>
        {row.kind === "image" ? "图片" : "文档"}
      </DataStatusChip>
    ),
    sortable: true,
    value: (row) => (row.kind === "image" ? "图片" : "文档"),
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
  const [previewItem, setPreviewItem] = useState<MediaRow>(mediaRows[0]!);

  const mediaToolbarActions: DataTableToolbarAction<MediaRow>[] = [
    {
      icon: "cloudUpload",
      label: "上传",
      onPress: ({ setNotice }) => setNotice("上传面板等待接入对象存储接口"),
    },
    {
      access: "read",
      icon: "refresh",
      label: "刷新",
      onPress: ({ setNotice }) => setNotice("媒体索引刷新占位已触发"),
    },
  ];

  const mediaBulkActions: DataTableBulkAction<MediaRow>[] = [
    {
      icon: "pencil",
      label: "批量重命名",
      onPress: (rows, { clearSelection, setNotice }) => {
        setNotice(`已选择 ${rows.length} 个文件等待批量重命名`);
        clearSelection();
      },
    },
    {
      access: "danger",
      icon: "trash",
      label: "批量删除",
      onPress: (rows, { clearSelection, setNotice }) => {
        setNotice(`已标记 ${rows.length} 个文件等待删除确认`);
        clearSelection();
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
      onPress: (row, { setNotice }) => {
        setPreviewItem(row);
        setNotice(`正在预览 ${row.fileName}`);
      },
    },
    {
      access: "read",
      icon: "download",
      label: "下载",
      onPress: (row, { setNotice }) => setNotice(`${row.fileName} 下载占位任务已创建`),
    },
    {
      icon: "pencil",
      label: "重命名",
      onPress: (row, { setNotice }) => setNotice(`${row.fileName} 重命名弹窗等待接入`),
    },
    {
      access: "read",
      icon: "informationCircle",
      label: "详细",
      onPress: (row, { setNotice }) => {
        setPreviewItem(row);
        setNotice(`${row.fileName} 详细信息已展示`);
      },
    },
    {
      access: "danger",
      icon: "trash",
      label: "删除",
      onPress: (row, { setNotice }) => {
        if (window.confirm(`确认删除 ${row.fileName}？`)) {
          setNotice(`${row.fileName} 删除占位确认已通过`);
        }
      },
    },
  ];

  return (
    <AdminDataPage
      description="媒体库已接入搜索、类型/引用筛选、排序、分页和复制、预览、下载、重命名、详细、删除操作占位。"
      eyebrow="内容管理"
      icon="images"
      metrics={[
        { label: "图片", value: "96" },
        { label: "文档", value: "8" },
        { label: "本月新增", value: "21" },
      ]}
      title="媒体库"
      wide
    >
      <div className="media-library-layout">
        <DataTable
          ariaLabel="媒体库表格"
          bulkActions={mediaBulkActions}
          columns={mediaColumns}
          defaultSort={{ column: "uploadedAt", direction: "desc" }}
          filters={mediaFilters}
          rowActions={mediaRowActions}
          rows={mediaRows}
          searchPlaceholder="搜索文件、链接、引用文章"
          toolbarActions={mediaToolbarActions}
        />

        <Card className="media-preview-card">
          <Card.Header>
            <Card.Title>
              <AppIcon name="eye" />
              预览与详细
            </Card.Title>
            <Card.Description>{previewItem.alt}</Card.Description>
          </Card.Header>
          <div className="media-preview-card__visual">
            <MediaThumb item={previewItem} />
          </div>
          <dl className="media-detail-list">
            <div>
              <dt>文件名</dt>
              <dd>{previewItem.fileName}</dd>
            </div>
            <div>
              <dt>链接</dt>
              <dd>{previewItem.url}</dd>
            </div>
            <div>
              <dt>引用</dt>
              <dd>{previewItem.usage}</dd>
            </div>
            <div>
              <dt>大小</dt>
              <dd>{previewItem.size}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </AdminDataPage>
  );
}
