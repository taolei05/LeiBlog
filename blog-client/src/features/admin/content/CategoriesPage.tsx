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

type CategoryRow = DataTableRow & {
  articleCount: number;
  level: "一级" | "二级";
  name: string;
  parent: string;
  sort: number;
  status: "active" | "hidden";
  updatedAt: string;
};

const categoryRows: CategoryRow[] = [
  {
    articleCount: 18,
    id: "category-engineering",
    level: "一级",
    name: "工程札记",
    parent: "根分类",
    sort: 1,
    status: "active",
    updatedAt: "2026-05-14",
  },
  {
    articleCount: 12,
    id: "category-frontend",
    level: "一级",
    name: "前端",
    parent: "根分类",
    sort: 2,
    status: "active",
    updatedAt: "2026-05-13",
  },
  {
    articleCount: 8,
    id: "category-react",
    level: "二级",
    name: "React",
    parent: "前端",
    sort: 1,
    status: "active",
    updatedAt: "2026-05-08",
  },
  {
    articleCount: 6,
    id: "category-life",
    level: "一级",
    name: "生活",
    parent: "根分类",
    sort: 3,
    status: "active",
    updatedAt: "2026-05-03",
  },
  {
    articleCount: 4,
    id: "category-photo",
    level: "一级",
    name: "摄影",
    parent: "根分类",
    sort: 4,
    status: "hidden",
    updatedAt: "2026-04-27",
  },
  {
    articleCount: 2,
    id: "category-system",
    level: "二级",
    name: "系统设计",
    parent: "工程札记",
    sort: 2,
    status: "active",
    updatedAt: "2026-04-21",
  },
];

const categoryColumns: DataTableColumn<CategoryRow>[] = [
  {
    header: "分类",
    id: "name",
    isRowHeader: true,
    render: (row) => (
      <span className="data-table-primary-cell">
        <strong>{row.name}</strong>
        <small>{row.level}分类</small>
      </span>
    ),
    searchValue: (row) => `${row.name} ${row.parent}`,
    sortable: true,
    value: (row) => row.name,
  },
  {
    header: "父级",
    id: "parent",
    sortable: true,
    value: (row) => row.parent,
  },
  {
    header: "文章数",
    id: "articleCount",
    sortable: true,
    value: (row) => row.articleCount,
  },
  {
    header: "排序",
    id: "sort",
    sortable: true,
    value: (row) => row.sort,
  },
  {
    header: "状态",
    id: "status",
    render: (row) => (
      <DataStatusChip tone={row.status === "active" ? "success" : "default"}>
        {row.status === "active" ? "显示" : "隐藏"}
      </DataStatusChip>
    ),
    sortable: true,
    value: (row) => (row.status === "active" ? "显示" : "隐藏"),
  },
  {
    header: "更新时间",
    id: "updatedAt",
    sortable: true,
    value: (row) => row.updatedAt,
  },
];

const categoryFilters: DataTableFilter<CategoryRow>[] = [
  {
    allLabel: "全部层级",
    key: "level",
    label: "层级",
    options: ["一级", "二级"].map((level) => ({
      label: level,
      predicate: (row) => row.level === level,
      value: level,
    })),
  },
  {
    allLabel: "全部状态",
    key: "status",
    label: "状态",
    options: [
      { label: "显示", predicate: (row) => row.status === "active", value: "active" },
      { label: "隐藏", predicate: (row) => row.status === "hidden", value: "hidden" },
    ],
  },
];

const categoryToolbarActions: DataTableToolbarAction<CategoryRow>[] = [
  {
    icon: "albums",
    label: "新建分类",
    onPress: ({ setNotice }) => setNotice("新建分类面板等待接口接入"),
  },
];

const categoryBulkActions: DataTableBulkAction<CategoryRow>[] = [
  {
    icon: "pencil",
    label: "批量改名",
    onPress: (rows, { clearSelection, setNotice }) => {
      setNotice(`已选择 ${rows.length} 个分类等待批量改名`);
      clearSelection();
    },
  },
  {
    icon: "trash",
    access: "danger",
    label: "合并清理",
    onPress: (rows, { clearSelection, setNotice }) => {
      setNotice(`已标记 ${rows.length} 个分类等待合并确认`);
      clearSelection();
    },
  },
];

const categoryRowActions: DataTableRowAction<CategoryRow>[] = [
  {
    access: "read",
    icon: "eye",
    label: "查看",
    onPress: (row, { setNotice }) => setNotice(`查看 ${row.name} 下的文章`),
  },
  {
    icon: "pencil",
    label: "重命名",
    onPress: (row, { setNotice }) => setNotice(`${row.name} 重命名表单等待接入`),
  },
  {
    access: "danger",
    icon: "trash",
    label: "删除",
    onPress: (row, { setNotice }) => setNotice(`${row.name} 删除前会检查文章引用`),
  },
];

export function CategoriesPage() {
  return (
    <AdminDataPage
      description="分类管理已提供层级/状态筛选、统计列排序和合并清理操作占位。"
      eyebrow="内容管理"
      icon="albums"
      metrics={[
        { label: "一级分类", value: "6" },
        { label: "子分类", value: "18" },
        { label: "未归类文章", value: "2" },
      ]}
      title="分类管理"
      wide
    >
      <DataTable
        ariaLabel="分类管理表格"
        bulkActions={categoryBulkActions}
        columns={categoryColumns}
        defaultSort={{ column: "sort" }}
        filters={categoryFilters}
        rowActions={categoryRowActions}
        rows={categoryRows}
        searchPlaceholder="搜索分类或父级"
        toolbarActions={categoryToolbarActions}
      />
    </AdminDataPage>
  );
}
