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

type CommentRow = DataTableRow & {
  article: string;
  author: string;
  createdAt: string;
  excerpt: string;
  ip: string;
  status: "approved" | "blocked" | "pending";
};

const commentRows: CommentRow[] = [
  {
    article: "用 Elysia 重建博客后端",
    author: "chen",
    createdAt: "2026-05-15 22:08",
    excerpt: "这个插件式结构很清晰，想看 Redis 缓存那部分。",
    id: "comment-1",
    ip: "上海",
    status: "pending",
  },
  {
    article: "HeroUI v3 主题变量整理",
    author: "mika",
    createdAt: "2026-05-14 13:20",
    excerpt: "暗色模式下边框对比度很舒服。",
    id: "comment-2",
    ip: "杭州",
    status: "approved",
  },
  {
    article: "夜色里的城市光线",
    author: "guest-2048",
    createdAt: "2026-05-13 20:41",
    excerpt: "这组照片的色温处理很喜欢。",
    id: "comment-3",
    ip: "北京",
    status: "approved",
  },
  {
    article: "Redis 缓存键设计笔记",
    author: "bot-check",
    createdAt: "2026-05-12 03:16",
    excerpt: "Visit suspicious.example for free traffic.",
    id: "comment-4",
    ip: "未知",
    status: "blocked",
  },
  {
    article: "首次配置流程验收清单",
    author: "demo-reader",
    createdAt: "2026-05-11 10:30",
    excerpt: "首次配置后禁止重复执行危险配置，这点很好。",
    id: "comment-5",
    ip: "深圳",
    status: "pending",
  },
  {
    article: "五月写作计划",
    author: "yu",
    createdAt: "2026-05-10 19:52",
    excerpt: "期待文章列表和归档页。",
    id: "comment-6",
    ip: "成都",
    status: "approved",
  },
];

const commentStatusMeta = {
  approved: { label: "已通过", tone: "success" },
  blocked: { label: "已拦截", tone: "danger" },
  pending: { label: "待审核", tone: "warning" },
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
      { label: "已拦截", predicate: (row) => row.status === "blocked", value: "blocked" },
    ],
  },
];

const commentBulkActions: DataTableBulkAction<CommentRow>[] = [
  {
    icon: "checkmarkCircle",
    label: "通过",
    onPress: (rows, { clearSelection, setNotice }) => {
      setNotice(`已选择 ${rows.length} 条评论等待通过接口`);
      clearSelection();
    },
  },
  {
    icon: "ban",
    label: "拒绝",
    onPress: (rows, { clearSelection, setNotice }) => {
      setNotice(`已选择 ${rows.length} 条评论等待拒绝接口`);
      clearSelection();
    },
  },
  {
    access: "danger",
    icon: "trash",
    label: "删除",
    onPress: (rows, { clearSelection, setNotice }) => {
      setNotice(`已标记 ${rows.length} 条评论等待删除确认`);
      clearSelection();
    },
  },
];

const commentRowActions: DataTableRowAction<CommentRow>[] = [
  {
    access: "read",
    icon: "informationCircle",
    label: "详细",
    onPress: (row, { setNotice }) => setNotice(`查看 ${row.author} 的评论详情`),
  },
  {
    icon: "checkmarkCircle",
    isDisabled: (row) => row.status === "approved",
    label: "通过",
    onPress: (row, { setNotice }) => setNotice(`评论 ${row.id} 等待通过接口`),
  },
  {
    icon: "ban",
    isDisabled: (row) => row.status === "blocked",
    label: "拒绝",
    onPress: (row, { setNotice }) => setNotice(`评论 ${row.id} 等待拒绝接口`),
  },
  {
    access: "danger",
    icon: "trash",
    label: "删除",
    onPress: (row, { setNotice }) => setNotice(`评论 ${row.id} 删除需要确认`),
  },
];

export function CommentsPage() {
  return (
    <AdminDataPage
      description="评论管理已接入审核状态筛选、搜索、排序、分页和审核操作占位。"
      eyebrow="内容管理"
      icon="chatbubbles"
      metrics={[
        { label: "待审核", value: "5" },
        { label: "已通过", value: "128" },
        { label: "已拦截", value: "14" },
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
      />
    </AdminDataPage>
  );
}
