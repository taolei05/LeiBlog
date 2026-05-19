import { useEffect, useState } from "react";

import { AdminDataPage } from "../shared/AdminDataPage";
import {
  DataStatusChip,
  DataTable,
  type DataTableBulkAction,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableRow,
  type DataTableRowAction,
} from "../shared/DataTable";
import { adminFetch } from "../shared/admin-api";

type CommentRow = DataTableRow & {
  article: string;
  author: string;
  createdAt: string;
  excerpt: string;
  ip: string;
  status: "approved" | "pending" | "rejected";
};

type AdminCommentItem = {
  articleId: string | null;
  author: {
    name: string | null;
    username: string;
  };
  content: string;
  createdAt: string;
  id: string;
  status: CommentRow["status"];
  targetType: "article" | "guestbook";
};

const commentStatusMeta = {
  approved: { label: "已通过", tone: "success" },
  pending: { label: "待审核", tone: "warning" },
  rejected: { label: "已拒绝", tone: "danger" },
} as const;

const commentColumns: DataTableColumn<CommentRow>[] = [
  {
    header: "评论",
    id: "excerpt",
    isRowHeader: true,
    render: (row) => (
      <span className="data-table-primary-cell">
        <strong>{row.excerpt}</strong>
        <small>{row.article}</small>
      </span>
    ),
    searchValue: (row) => `${row.excerpt} ${row.article} ${row.author}`,
    sortable: true,
    value: (row) => row.excerpt,
  },
  {
    header: "状态",
    id: "status",
    render: (row) => (
      <DataStatusChip tone={commentStatusMeta[row.status].tone}>
        {commentStatusMeta[row.status].label}
      </DataStatusChip>
    ),
    sortable: true,
    value: (row) => commentStatusMeta[row.status].label,
  },
  {
    header: "评论者",
    id: "author",
    sortable: true,
    value: (row) => row.author,
  },
  {
    header: "地点",
    id: "ip",
    sortable: true,
    value: (row) => row.ip,
  },
  {
    header: "时间",
    id: "createdAt",
    sortable: true,
    value: (row) => row.createdAt,
  },
];

const commentFilters: DataTableFilter<CommentRow>[] = [
  {
    allLabel: "全部状态",
    key: "status",
    label: "状态",
    options: [
      { label: "待审核", predicate: (row) => row.status === "pending", value: "pending" },
      { label: "已通过", predicate: (row) => row.status === "approved", value: "approved" },
      { label: "已拒绝", predicate: (row) => row.status === "rejected", value: "rejected" },
    ],
  },
];

function toCommentRow(item: AdminCommentItem): CommentRow {
  return {
    article: item.targetType === "article" ? (item.articleId ?? "未知文章") : "留言板",
    author: item.author.name ?? item.author.username,
    createdAt: new Date(item.createdAt).toLocaleString("zh-CN"),
    excerpt: item.content.slice(0, 80),
    id: item.id,
    ip: "未记录",
    status: item.status,
  };
}

export function CommentsPage() {
  const [commentRows, setCommentRows] = useState<CommentRow[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  async function loadComments() {
    const response = await adminFetch<{ items: AdminCommentItem[] }>("/admin/comments/");
    setCommentRows(response.items.map(toCommentRow));
  }

  useEffect(() => {
    void loadComments();
  }, [reloadKey]);

  async function reviewComment({ id, status }: { id: string; status: CommentRow["status"] }) {
    await adminFetch(`/admin/comments/${id}/review`, {
      body: { status },
      method: "PATCH",
    });
  }

  const commentBulkActions: DataTableBulkAction<CommentRow>[] = [
    {
      icon: "checkmarkCircle",
      label: "通过",
      onPress: async (rows, { clearSelection, setNotice }) => {
        try {
          await Promise.all(rows.map((row) => reviewComment({ id: row.id, status: "approved" })));
          clearSelection();
          setNotice(`已通过 ${rows.length} 条评论`);
          setReloadKey((key) => key + 1);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "评论审核失败");
        }
      },
    },
    {
      icon: "ban",
      label: "拒绝",
      onPress: async (rows, { clearSelection, setNotice }) => {
        try {
          await Promise.all(rows.map((row) => reviewComment({ id: row.id, status: "rejected" })));
          clearSelection();
          setNotice(`已拒绝 ${rows.length} 条评论`);
          setReloadKey((key) => key + 1);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "评论审核失败");
        }
      },
    },
    {
      access: "danger",
      icon: "trash",
      label: "删除",
      onPress: async (rows, { clearSelection, setNotice }) => {
        try {
          await Promise.all(
            rows.map((row) => adminFetch(`/admin/comments/${row.id}`, { method: "DELETE" })),
          );
          clearSelection();
          setNotice(`已删除 ${rows.length} 条评论`);
          setReloadKey((key) => key + 1);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "评论删除失败");
        }
      },
    },
  ];

  const commentRowActions: DataTableRowAction<CommentRow>[] = [
    {
      access: "read",
      icon: "informationCircle",
      label: "详细",
      onPress: (row, { setNotice }) => setNotice(`${row.author}：${row.excerpt}`),
    },
    {
      icon: "checkmarkCircle",
      isDisabled: (row) => row.status === "approved",
      label: "通过",
      onPress: async (row, { setNotice }) => {
        try {
          await reviewComment({ id: row.id, status: "approved" });
          setNotice("评论已通过");
          setReloadKey((key) => key + 1);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "评论审核失败");
        }
      },
    },
    {
      icon: "ban",
      isDisabled: (row) => row.status === "rejected",
      label: "拒绝",
      onPress: async (row, { setNotice }) => {
        try {
          await reviewComment({ id: row.id, status: "rejected" });
          setNotice("评论已拒绝");
          setReloadKey((key) => key + 1);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "评论审核失败");
        }
      },
    },
    {
      access: "danger",
      icon: "trash",
      label: "删除",
      onPress: async (row, { setNotice }) => {
        try {
          await adminFetch(`/admin/comments/${row.id}`, { method: "DELETE" });
          setNotice("评论已删除");
          setReloadKey((key) => key + 1);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "评论删除失败");
        }
      },
    },
  ];

  const pendingCount = commentRows.filter((row) => row.status === "pending").length;
  const approvedCount = commentRows.filter((row) => row.status === "approved").length;
  const rejectedCount = commentRows.filter((row) => row.status === "rejected").length;

  return (
    <AdminDataPage
      description="评论管理保留审核状态筛选、搜索、排序、分页和审核操作。"
      eyebrow="内容管理"
      icon="chatbubbles"
      metrics={[
        { label: "待审核", value: String(pendingCount) },
        { label: "已通过", value: String(approvedCount) },
        { label: "已拒绝", value: String(rejectedCount) },
      ]}
      title="评论管理"
      wide
    >
      <DataTable
        ariaLabel="评论管理表格"
        bulkActions={commentBulkActions}
        columns={commentColumns}
        defaultSort={{ column: "createdAt", direction: "desc" }}
        filters={commentFilters}
        rowActions={commentRowActions}
        rows={commentRows}
        searchPlaceholder="搜索评论、文章、评论者"
        emptyText="暂无评论记录"
      />
    </AdminDataPage>
  );
}
