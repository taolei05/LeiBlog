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

type TagRow = DataTableRow & {
  articles: number;
  group: "内容" | "技术" | "站点";
  name: string;
  status: "active" | "cleanup" | "featured";
  trend: number;
  updatedAt: string;
};

const tagRows: TagRow[] = [
  {
    articles: 18,
    group: "技术",
    id: "tag-react",
    name: "React",
    status: "featured",
    trend: 12,
    updatedAt: "2026-05-15",
  },
  {
    articles: 15,
    group: "技术",
    id: "tag-elysia",
    name: "Elysia",
    status: "active",
    trend: 8,
    updatedAt: "2026-05-12",
  },
  {
    articles: 7,
    group: "内容",
    id: "tag-mdx",
    name: "MDX",
    status: "active",
    trend: 4,
    updatedAt: "2026-05-10",
  },
  {
    articles: 2,
    group: "站点",
    id: "tag-old-note",
    name: "旧笔记",
    status: "cleanup",
    trend: -3,
    updatedAt: "2026-04-24",
  },
  {
    articles: 9,
    group: "内容",
    id: "tag-photo",
    name: "摄影",
    status: "active",
    trend: 2,
    updatedAt: "2026-04-20",
  },
  {
    articles: 1,
    group: "站点",
    id: "tag-uncategorized",
    name: "未整理",
    status: "cleanup",
    trend: -6,
    updatedAt: "2026-04-12",
  },
];

const tagStatusMeta = {
  active: { label: "常规", tone: "default" },
  cleanup: { label: "待清理", tone: "warning" },
  featured: { label: "高频", tone: "accent" },
} as const;

const tagColumns: DataTableColumn<TagRow>[] = [
  {
    header: "标签",
    id: "name",
    isRowHeader: true,
    render: (row) => (
      <span className="data-table-primary-cell">
        <strong>{row.name}</strong>
        <small>{row.group}</small>
      </span>
    ),
    searchValue: (row) => `${row.name} ${row.group}`,
    sortable: true,
    value: (row) => row.name,
  },
  {
    header: "引用",
    id: "articles",
    sortable: true,
    value: (row) => row.articles,
  },
  {
    header: "趋势",
    id: "trend",
    render: (row) => (
      <span className={row.trend >= 0 ? "data-table-trend is-up" : "data-table-trend is-down"}>
        {row.trend >= 0 ? "+" : ""}
        {row.trend}
      </span>
    ),
    sortable: true,
    value: (row) => row.trend,
  },
  {
    header: "状态",
    id: "status",
    render: (row) => (
      <DataStatusChip tone={tagStatusMeta[row.status].tone}>
        {tagStatusMeta[row.status].label}
      </DataStatusChip>
    ),
    sortable: true,
    value: (row) => tagStatusMeta[row.status].label,
  },
  {
    header: "更新时间",
    id: "updatedAt",
    sortable: true,
    value: (row) => row.updatedAt,
  },
];

const tagFilters: DataTableFilter<TagRow>[] = [
  {
    allLabel: "全部分组",
    key: "group",
    label: "分组",
    options: ["技术", "内容", "站点"].map((group) => ({
      label: group,
      predicate: (row) => row.group === group,
      value: group,
    })),
  },
  {
    allLabel: "全部状态",
    key: "status",
    label: "状态",
    options: [
      { label: "高频", predicate: (row) => row.status === "featured", value: "featured" },
      { label: "常规", predicate: (row) => row.status === "active", value: "active" },
      { label: "待清理", predicate: (row) => row.status === "cleanup", value: "cleanup" },
    ],
  },
];

const tagToolbarActions: DataTableToolbarAction<TagRow>[] = [
  {
    icon: "pricetags",
    label: "新建标签",
    onPress: ({ setNotice }) => setNotice("新建标签抽屉等待接入"),
  },
];

const tagBulkActions: DataTableBulkAction<TagRow>[] = [
  {
    icon: "pencil",
    label: "批量合并",
    onPress: (rows, { clearSelection, setNotice }) => {
      setNotice(`已选择 ${rows.length} 个标签等待合并目标`);
      clearSelection();
    },
  },
  {
    access: "danger",
    icon: "trash",
    label: "清理",
    onPress: (rows, { clearSelection, setNotice }) => {
      setNotice(`已标记 ${rows.length} 个标签等待清理确认`);
      clearSelection();
    },
  },
];

const tagRowActions: DataTableRowAction<TagRow>[] = [
  {
    access: "read",
    icon: "eye",
    label: "查看",
    onPress: (row, { setNotice }) => setNotice(`查看标签「${row.name}」关联文章`),
  },
  {
    icon: "pencil",
    label: "重命名",
    onPress: (row, { setNotice }) => setNotice(`标签「${row.name}」重命名占位`),
  },
  {
    access: "danger",
    icon: "trash",
    label: "删除",
    onPress: (row, { setNotice }) => setNotice(`标签「${row.name}」删除需要二次确认`),
  },
];

export function TagsPage() {
  return (
    <AdminDataPage
      description="标签管理已接入搜索、分组/状态筛选、引用和趋势排序，以及批量合并占位。"
      eyebrow="内容管理"
      icon="pricetags"
      metrics={[
        { label: "标签总数", value: "64" },
        { label: "高频标签", value: "11" },
        { label: "待清理", value: "7" },
      ]}
      title="标签管理"
      wide
    >
      <DataTable
        ariaLabel="标签管理表格"
        bulkActions={tagBulkActions}
        columns={tagColumns}
        defaultSort={{ column: "articles", direction: "desc" }}
        filters={tagFilters}
        rowActions={tagRowActions}
        rows={tagRows}
        searchPlaceholder="搜索标签或分组"
        toolbarActions={tagToolbarActions}
      />
    </AdminDataPage>
  );
}
