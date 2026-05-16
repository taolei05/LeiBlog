import { Card } from "@heroui/react";
import { lazy, Suspense } from "react";

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

type ArticleRow = DataTableRow & {
  author: string;
  category: string;
  comments: number;
  status: "draft" | "published" | "review";
  title: string;
  updatedAt: string;
  views: number;
};

const articleRows: ArticleRow[] = [
  {
    id: "article-1",
    author: "Lei",
    category: "工程札记",
    comments: 12,
    status: "published",
    title: "用 Elysia 重建博客后端",
    updatedAt: "2026-05-12 22:18",
    views: 2368,
  },
  {
    id: "article-2",
    author: "Lei",
    category: "前端",
    comments: 5,
    status: "review",
    title: "HeroUI v3 主题变量整理",
    updatedAt: "2026-05-14 09:30",
    views: 841,
  },
  {
    id: "article-3",
    author: "Lei",
    category: "生活",
    comments: 0,
    status: "draft",
    title: "五月写作计划",
    updatedAt: "2026-05-15 18:42",
    views: 93,
  },
  {
    id: "article-4",
    author: "Demo",
    category: "摄影",
    comments: 18,
    status: "published",
    title: "夜色里的城市光线",
    updatedAt: "2026-05-08 21:04",
    views: 1720,
  },
  {
    id: "article-5",
    author: "Lei",
    category: "工程札记",
    comments: 3,
    status: "published",
    title: "Redis 缓存键设计笔记",
    updatedAt: "2026-05-03 11:12",
    views: 1284,
  },
  {
    id: "article-6",
    author: "Lei",
    category: "前端",
    comments: 1,
    status: "draft",
    title: "MDXEditor 插件链草稿",
    updatedAt: "2026-05-01 16:25",
    views: 340,
  },
  {
    id: "article-7",
    author: "Lei",
    category: "系统",
    comments: 7,
    status: "review",
    title: "首次配置流程验收清单",
    updatedAt: "2026-04-28 08:10",
    views: 918,
  },
];

const statusMeta = {
  draft: { label: "草稿", tone: "default" },
  published: { label: "已发布", tone: "success" },
  review: { label: "待审核", tone: "warning" },
} as const;

const articleColumns: DataTableColumn<ArticleRow>[] = [
  {
    header: "标题",
    id: "title",
    isRowHeader: true,
    render: (row) => (
      <span className="data-table-primary-cell">
        <strong>{row.title}</strong>
        <small>{row.category}</small>
      </span>
    ),
    searchValue: (row) => `${row.title} ${row.category} ${row.author}`,
    sortable: true,
    value: (row) => row.title,
  },
  {
    header: "状态",
    id: "status",
    render: (row) => (
      <DataStatusChip tone={statusMeta[row.status].tone}>
        {statusMeta[row.status].label}
      </DataStatusChip>
    ),
    sortable: true,
    value: (row) => statusMeta[row.status].label,
  },
  {
    header: "作者",
    id: "author",
    sortable: true,
    value: (row) => row.author,
  },
  {
    header: "浏览",
    id: "views",
    sortable: true,
    value: (row) => row.views,
  },
  {
    header: "评论",
    id: "comments",
    sortable: true,
    value: (row) => row.comments,
  },
  {
    header: "更新时间",
    id: "updatedAt",
    sortable: true,
    value: (row) => row.updatedAt,
  },
];

const articleFilters: DataTableFilter<ArticleRow>[] = [
  {
    allLabel: "全部状态",
    key: "status",
    label: "状态",
    options: [
      { label: "已发布", predicate: (row) => row.status === "published", value: "published" },
      { label: "待审核", predicate: (row) => row.status === "review", value: "review" },
      { label: "草稿", predicate: (row) => row.status === "draft", value: "draft" },
    ],
  },
  {
    allLabel: "全部分类",
    key: "category",
    label: "分类",
    options: ["工程札记", "前端", "生活", "摄影", "系统"].map((category) => ({
      label: category,
      predicate: (row) => row.category === category,
      value: category,
    })),
  },
];

const articleToolbarActions: DataTableToolbarAction<ArticleRow>[] = [
  {
    icon: "create",
    label: "新建文章",
    onPress: ({ setNotice }) => setNotice("新建文章表单会在编辑器阶段接入"),
  },
  {
    access: "read",
    icon: "download",
    label: "导出",
    onPress: ({ setNotice }) => setNotice("已生成文章导出占位任务"),
  },
];

const articleBulkActions: DataTableBulkAction<ArticleRow>[] = [
  {
    icon: "checkmarkCircle",
    label: "批量发布",
    onPress: (rows, { clearSelection, setNotice }) => {
      setNotice(`已标记 ${rows.length} 篇文章等待发布接口`);
      clearSelection();
    },
  },
  {
    icon: "folderOpen",
    label: "归档",
    onPress: (rows, { clearSelection, setNotice }) => {
      setNotice(`已标记 ${rows.length} 篇文章等待归档接口`);
      clearSelection();
    },
  },
];

const articleRowActions: DataTableRowAction<ArticleRow>[] = [
  {
    access: "read",
    icon: "eye",
    label: "查看",
    onPress: (row, { setNotice }) => setNotice(`预览《${row.title}》`),
  },
  {
    icon: "pencil",
    label: "编辑",
    onPress: (row, { setNotice }) => setNotice(`编辑《${row.title}》会在 MDX 阶段接入`),
  },
  {
    access: "danger",
    icon: "trash",
    label: "删除",
    onPress: (row, { setNotice }) => setNotice(`删除《${row.title}》需要后端接口确认`),
  },
];

const ArticleMdxEditorPanel = lazy(() =>
  import("./ArticleMdxEditorPanel").then((module) => ({
    default: module.ArticleMdxEditorPanel,
  })),
);

export function ArticlesPage() {
  return (
    <AdminDataPage
      description="文章管理已接入搜索、状态/分类筛选、列排序、分页和批量操作占位。"
      eyebrow="内容管理"
      icon="documentText"
      metrics={[
        { label: "草稿", value: "12" },
        { label: "已发布", value: "48" },
        { label: "待审核", value: "3" },
      ]}
      title="文章管理"
      wide
    >
      <DataTable
        ariaLabel="文章管理表格"
        bulkActions={articleBulkActions}
        columns={articleColumns}
        defaultSort={{ column: "updatedAt", direction: "desc" }}
        filters={articleFilters}
        rowActions={articleRowActions}
        rows={articleRows}
        searchPlaceholder="搜索标题、分类、作者"
        toolbarActions={articleToolbarActions}
      />
      <Suspense
        fallback={
          <Card className="admin-mdx-card">
            <Card.Header>
              <Card.Title>正文编辑</Card.Title>
              <Card.Description>编辑器载入中</Card.Description>
            </Card.Header>
          </Card>
        }
      >
        <ArticleMdxEditorPanel />
      </Suspense>
    </AdminDataPage>
  );
}
