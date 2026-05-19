import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AdminDataPage } from "../shared/AdminDataPage";
import type {
  DataTableBulkAction,
  DataTableColumn,
  DataTableFilter,
  DataTableRow,
  DataTableRowAction,
  DataTableToolbarAction,
} from "../shared/DataTable";
import { DataStatusChip, DataTable } from "../shared/DataTable";
import { adminFetch } from "../shared/admin-api";

type ArticleRow = DataTableRow & {
  author: string;
  category: string;
  comments: number;
  status: "draft" | "offline" | "published";
  title: string;
  updatedAt: string;
  views: number;
};

type AdminArticleItem = {
  authorId: string | null;
  categories: Array<{ name: string }>;
  commentCount: number;
  id: string;
  readCount: number;
  slug: string;
  status: ArticleRow["status"];
  title: string;
  updatedAt: string;
};

const statusMeta = {
  draft: { label: "草稿", tone: "default" },
  offline: { label: "已下架", tone: "danger" },
  published: { label: "已发布", tone: "success" },
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
      { label: "草稿", predicate: (row) => row.status === "draft", value: "draft" },
      { label: "已发布", predicate: (row) => row.status === "published", value: "published" },
      { label: "已下架", predicate: (row) => row.status === "offline", value: "offline" },
    ],
  },
];

export function ArticlesPage() {
  const navigate = useNavigate();
  const [articleRows, setArticleRows] = useState<ArticleRow[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const articleCategoryOptions = useMemo(
    () => [...new Set(articleRows.map((row) => row.category).filter(Boolean))],
    [articleRows],
  );
  const filters = useMemo<DataTableFilter<ArticleRow>[]>(
    () => [
      ...articleFilters,
      {
        allLabel: "全部分类",
        key: "category",
        label: "分类",
        options: articleCategoryOptions.map((category) => ({
          label: category,
          predicate: (row) => row.category === category,
          value: category,
        })),
      },
    ],
    [articleCategoryOptions],
  );

  async function loadArticles() {
    const response = await adminFetch<{ items: AdminArticleItem[] }>("/admin/content/articles");
    setArticleRows(
      response.items.map((article) => ({
        author: article.authorId ?? "未知",
        category: article.categories[0]?.name ?? "未分类",
        comments: article.commentCount,
        id: article.id,
        status: article.status,
        title: article.title,
        updatedAt: new Date(article.updatedAt).toLocaleString("zh-CN"),
        views: article.readCount,
      })),
    );
  }

  useEffect(() => {
    void loadArticles();
  }, [reloadKey]);

  async function updateArticleStatus(
    row: ArticleRow,
    nextStatus: ArticleRow["status"],
    setNotice: (message: string) => void,
  ) {
    await adminFetch(`/admin/content/articles/${row.id}`, {
      body: { status: nextStatus },
      method: "PATCH",
    });
    setNotice(`《${row.title}》已更新为${statusMeta[nextStatus].label}`);
    setReloadKey((key) => key + 1);
  }

  const articleToolbarActions: DataTableToolbarAction<ArticleRow>[] = [
    {
      confirmation: "none",
      icon: "create",
      label: "新建文章",
      onPress: () => {
        void navigate("/admin/content/articles/new");
      },
    },
    {
      access: "read",
      icon: "refresh",
      label: "刷新",
      onPress: ({ setNotice }) => {
        setReloadKey((key) => key + 1);
        setNotice("文章列表已刷新");
      },
    },
  ];

  const articleBulkActions: DataTableBulkAction<ArticleRow>[] = [
    {
      icon: "checkmarkCircle",
      label: "批量发布",
      onPress: async (rows, { clearSelection, setNotice }) => {
        await Promise.all(
          rows.map((row) =>
            adminFetch(`/admin/content/articles/${row.id}`, {
              body: { status: "published" },
              method: "PATCH",
            }),
          ),
        );
        clearSelection();
        setNotice(`已发布 ${rows.length} 篇文章`);
        setReloadKey((key) => key + 1);
      },
    },
    {
      icon: "folderOpen",
      label: "下架",
      onPress: async (rows, { clearSelection, setNotice }) => {
        await Promise.all(
          rows.map((row) =>
            adminFetch(`/admin/content/articles/${row.id}`, {
              body: { status: "offline" },
              method: "PATCH",
            }),
          ),
        );
        clearSelection();
        setNotice(`已下架 ${rows.length} 篇文章`);
        setReloadKey((key) => key + 1);
      },
    },
  ];

  const articleRowActions: DataTableRowAction<ArticleRow>[] = [
    {
      access: "read",
      icon: "eye",
      label: "查看",
      onPress: (row, { setNotice }) => setNotice(`查看《${row.title}》`),
    },
    {
      confirmation: "none",
      icon: "pencil",
      label: "编辑",
      onPress: (row) => {
        void navigate(`/admin/content/articles/${row.id}/edit`);
      },
    },
    {
      icon: "send",
      isDisabled: (row) => row.status === "published",
      label: "发布",
      onPress: (row, { setNotice }) => updateArticleStatus(row, "published", setNotice),
    },
    {
      icon: "archive",
      isDisabled: (row) => row.status === "offline",
      label: "下架",
      onPress: (row, { setNotice }) => updateArticleStatus(row, "offline", setNotice),
    },
    {
      icon: "documentText",
      isDisabled: (row) => row.status === "draft",
      label: "转草稿",
      onPress: (row, { setNotice }) => updateArticleStatus(row, "draft", setNotice),
    },
    {
      access: "danger",
      icon: "trash",
      label: "删除",
      onPress: async (row, { setNotice }) => {
        await adminFetch(`/admin/content/articles/${row.id}`, { method: "DELETE" });
        setNotice("文章已删除");
        setReloadKey((key) => key + 1);
      },
    },
  ];
  const publishedCount = articleRows.filter((row) => row.status === "published").length;
  const draftCount = articleRows.filter((row) => row.status === "draft").length;
  const offlineCount = articleRows.filter((row) => row.status === "offline").length;

  return (
    <AdminDataPage
      description="文章管理保留搜索、状态/分类筛选、列排序、分页和批量操作。"
      eyebrow="内容管理"
      icon="documentText"
      metrics={[
        { label: "草稿", value: String(draftCount) },
        { label: "已发布", value: String(publishedCount) },
        { label: "已下架", value: String(offlineCount) },
      ]}
      title="文章管理"
      wide
    >
      <DataTable
        ariaLabel="文章管理表格"
        bulkActions={articleBulkActions}
        columns={articleColumns}
        defaultSort={{ column: "updatedAt", direction: "desc" }}
        filters={filters}
        rowActions={articleRowActions}
        rows={articleRows}
        searchPlaceholder="搜索标题、分类、作者"
        toolbarActions={articleToolbarActions}
        emptyText="暂无文章记录"
      />
    </AdminDataPage>
  );
}
