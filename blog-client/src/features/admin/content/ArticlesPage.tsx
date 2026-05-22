import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { AdminDataPage } from "../shared/AdminDataPage";
import type {
  DataTableBulkAction,
  DataTableColumn,
  DataTableFilter,
  DataTableRow,
  DataTableRowAction,
  DataTableToolbarAction,
} from "../shared/DataTable";
import { DataStatusChip, DataTable, truncateDataTablePrimaryText } from "../shared/DataTable";
import { adminFetch } from "../shared/admin-api";

type ArticleRow = DataTableRow & {
  author: string;
  category: string;
  comments: number;
  slug: string;
  status: "draft" | "offline" | "published";
  title: string;
  updatedAt: string;
  views: number;
};

type AdminArticleItem = {
  authorName: string | null;
  categories: Array<{ name: string }>;
  commentCount: number;
  id: string;
  readCount: number;
  slug: string;
  status: ArticleRow["status"];
  title: string;
  updatedAt: string;
};

type ArticleRelationKind = "category" | "contributor" | "tag";

type ArticleRelationScope = {
  id: string;
  kind: ArticleRelationKind;
};

type AdminArticleRelationItem = {
  id: string;
  name: string;
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
        <strong title={row.title}>{truncateDataTablePrimaryText(row.title)}</strong>
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

function openPublicArticle(slug: string) {
  window.open(`/articles/${encodeURIComponent(slug)}`, "_blank", "noopener,noreferrer");
}

function relationConfig(kind: ArticleRelationKind) {
  if (kind === "category") {
    return {
      emptyName: "当前分类",
      icon: "albums" as const,
      queryKey: "categoryId",
      resource: "categories",
      title: "分类文章",
    };
  }

  if (kind === "contributor") {
    return {
      emptyName: "当前贡献者",
      icon: "personAdd" as const,
      queryKey: "contributorId",
      resource: "contributors",
      title: "贡献者文章",
    };
  }

  return {
    emptyName: "当前标签",
    icon: "pricetags" as const,
    queryKey: "tagId",
    resource: "tags",
    title: "标签文章",
  };
}

function ArticleDataPage({ relation }: { relation?: ArticleRelationScope }) {
  const navigate = useNavigate();
  const [articleRows, setArticleRows] = useState<ArticleRow[]>([]);
  const [relationName, setRelationName] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const relationId = relation?.id ?? "";
  const relationKind = relation?.kind ?? null;
  const activeRelation = useMemo(
    () => (relationKind ? relationConfig(relationKind) : null),
    [relationKind],
  );

  async function loadArticles() {
    const query = new URLSearchParams();

    if (activeRelation && relationId) {
      query.set(activeRelation.queryKey, relationId);
    }

    const queryString = query.toString();
    const response = await adminFetch<{ items: AdminArticleItem[] }>(
      `/admin/content/articles${queryString ? `?${queryString}` : ""}`,
    );
    setArticleRows(
      response.items.map((article) => ({
        author: article.authorName ?? "未知",
        category: article.categories[0]?.name ?? "未分类",
        comments: article.commentCount,
        id: article.id,
        slug: article.slug,
        status: article.status,
        title: article.title,
        updatedAt: new Date(article.updatedAt).toLocaleString("zh-CN"),
        views: article.readCount,
      })),
    );
  }

  useEffect(() => {
    void loadArticles();
  }, [reloadKey, relationId, relationKind]);

  useEffect(() => {
    let isActive = true;

    async function loadRelation() {
      if (!activeRelation || !relationId) {
        setRelationName("");
        return;
      }

      try {
        const response = await adminFetch<{ item: AdminArticleRelationItem }>(
          `/admin/content/${activeRelation.resource}/${relationId}`,
        );

        if (isActive) {
          setRelationName(response.item.name);
        }
      } catch {
        if (isActive) {
          setRelationName(activeRelation.emptyName);
        }
      }
    }

    void loadRelation();

    return () => {
      isActive = false;
    };
  }, [activeRelation, relationId]);

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
      label: "发布",
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
    {
      access: "danger",
      confirmationDescription: (rows) => {
        const commentCount = rows.reduce((total, row) => total + row.comments, 0);

        return `这是批量删除，将移除所选文章、共 ${commentCount} 条评论，以及分类、标签和贡献者关联。`;
      },
      icon: "trash",
      label: "删除",
      onPress: async (rows, { clearSelection, setNotice }) => {
        await Promise.all(
          rows.map((row) =>
            adminFetch(`/admin/content/articles/${row.id}`, {
              method: "DELETE",
            }),
          ),
        );
        clearSelection();
        setNotice(`已删除 ${rows.length} 篇文章`);
        setReloadKey((key) => key + 1);
      },
    },
  ];

  const articleRowActions: DataTableRowAction<ArticleRow>[] = [
    {
      access: "read",
      icon: "eye",
      label: "查看",
      onPress: (row) => openPublicArticle(row.slug),
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
      confirmationDescription: (row) =>
        `删除《${row.title}》后，会移除文章、${row.comments} 条评论，以及分类、标签和贡献者关联。`,
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
  const scopeName = relationName || activeRelation?.emptyName;
  const pageTitle = activeRelation ? `${activeRelation.title}：${scopeName}` : "文章管理";

  return (
    <AdminDataPage
      description={
        activeRelation
          ? `这里汇总「${scopeName}」关联的文章，可继续查看、编辑、发布、下架和删除。`
          : "文章管理保留搜索、状态筛选、列排序、分页和批量操作。"
      }
      eyebrow="内容管理"
      icon={activeRelation?.icon ?? "documentText"}
      metrics={[
        { label: "草稿", value: String(draftCount) },
        { label: "已发布", value: String(publishedCount) },
        { label: "已下架", value: String(offlineCount) },
      ]}
      title={pageTitle}
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
        emptyText="暂无文章记录"
      />
    </AdminDataPage>
  );
}

export function ArticlesPage() {
  return <ArticleDataPage />;
}

export function CategoryArticlesPage() {
  const { id } = useParams();

  return <ArticleDataPage relation={id ? { id, kind: "category" } : undefined} />;
}

export function TagArticlesPage() {
  const { id } = useParams();

  return <ArticleDataPage relation={id ? { id, kind: "tag" } : undefined} />;
}

export function ContributorArticlesPage() {
  const { id } = useParams();

  return <ArticleDataPage relation={id ? { id, kind: "contributor" } : undefined} />;
}
