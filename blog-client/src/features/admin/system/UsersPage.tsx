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

type UserRow = DataTableRow & {
  email: string;
  lastLogin: string;
  name: string;
  role: "admin" | "demo" | "user";
  status: "active" | "disabled";
  username: string;
};

const userRows: UserRow[] = [
  {
    email: "lei@example.com",
    id: "user-admin",
    lastLogin: "2026-05-16 09:58",
    name: "Lei 管理员",
    role: "admin",
    status: "active",
    username: "admin",
  },
  {
    email: "demo@example.com",
    id: "user-demo",
    lastLogin: "2026-05-15 21:16",
    name: "Demo 账户",
    role: "demo",
    status: "active",
    username: "demo",
  },
  {
    email: "chen@example.com",
    id: "user-chen",
    lastLogin: "2026-05-14 19:20",
    name: "陈同学",
    role: "user",
    status: "active",
    username: "chen",
  },
  {
    email: "mika@example.com",
    id: "user-mika",
    lastLogin: "2026-05-13 10:12",
    name: "Mika",
    role: "user",
    status: "active",
    username: "mika",
  },
  {
    email: "old-reader@example.com",
    id: "user-old-reader",
    lastLogin: "2026-04-19 08:44",
    name: "旧读者",
    role: "user",
    status: "disabled",
    username: "old_reader",
  },
  {
    email: "yu@example.com",
    id: "user-yu",
    lastLogin: "2026-05-10 20:05",
    name: "Yu",
    role: "user",
    status: "active",
    username: "yu",
  },
];

const roleLabel = {
  admin: "管理员",
  demo: "Demo",
  user: "普通用户",
} as const;

const userColumns: DataTableColumn<UserRow>[] = [
  {
    header: "用户",
    id: "username",
    isRowHeader: true,
    render: (row) => (
      <span className="data-table-primary-cell">
        <strong>{row.name}</strong>
        <small>
          {row.username} · {row.email}
        </small>
      </span>
    ),
    searchValue: (row) => `${row.name} ${row.username} ${row.email}`,
    sortable: true,
    value: (row) => row.username,
  },
  {
    header: "角色",
    id: "role",
    render: (row) => (
      <DataStatusChip
        tone={row.role === "admin" ? "accent" : row.role === "demo" ? "warning" : "default"}
      >
        {roleLabel[row.role]}
      </DataStatusChip>
    ),
    sortable: true,
    value: (row) => roleLabel[row.role],
  },
  {
    header: "状态",
    id: "status",
    render: (row) => (
      <DataStatusChip tone={row.status === "active" ? "success" : "danger"}>
        {row.status === "active" ? "启用" : "停用"}
      </DataStatusChip>
    ),
    sortable: true,
    value: (row) => (row.status === "active" ? "启用" : "停用"),
  },
  {
    header: "最近登录",
    id: "lastLogin",
    sortable: true,
    value: (row) => row.lastLogin,
  },
];

const userFilters: DataTableFilter<UserRow>[] = [
  {
    allLabel: "全部角色",
    key: "role",
    label: "角色",
    options: [
      { label: "管理员", predicate: (row) => row.role === "admin", value: "admin" },
      { label: "Demo", predicate: (row) => row.role === "demo", value: "demo" },
      { label: "普通用户", predicate: (row) => row.role === "user", value: "user" },
    ],
  },
  {
    allLabel: "全部状态",
    key: "status",
    label: "状态",
    options: [
      { label: "启用", predicate: (row) => row.status === "active", value: "active" },
      { label: "停用", predicate: (row) => row.status === "disabled", value: "disabled" },
    ],
  },
];

const userToolbarActions: DataTableToolbarAction<UserRow>[] = [
  {
    icon: "people",
    label: "新建用户",
    onPress: ({ setNotice }) => setNotice("新建用户表单等待接入"),
  },
  {
    access: "read",
    icon: "download",
    label: "导出",
    onPress: ({ setNotice }) => setNotice("用户列表导出占位任务已创建"),
  },
];

const userBulkActions: DataTableBulkAction<UserRow>[] = [
  {
    icon: "ban",
    label: "停用",
    onPress: (rows, { clearSelection, setNotice }) => {
      setNotice(`已选择 ${rows.length} 个用户等待停用接口`);
      clearSelection();
    },
  },
];

const userRowActions: DataTableRowAction<UserRow>[] = [
  {
    access: "read",
    icon: "eye",
    label: "查看",
    onPress: (row, { setNotice }) => setNotice(`查看 ${row.name} 的资料`),
  },
  {
    icon: "shield",
    isDisabled: (row) => row.role === "admin",
    label: "角色",
    onPress: (row, { setNotice }) => setNotice(`${row.name} 角色变更等待后端校验`),
  },
  {
    icon: "ban",
    isDisabled: (row) => row.role === "admin",
    label: "停用",
    onPress: (row, { setNotice }) => setNotice(`${row.name} 停用操作等待确认`),
  },
];

export function UsersPage() {
  return (
    <AdminDataPage
      description="用户管理已接入角色/状态筛选、搜索、排序、分页和写操作只读禁用。"
      eyebrow="系统"
      icon="people"
      metrics={[
        { label: "管理员", value: "1" },
        { label: "Demo", value: "1" },
        { label: "普通用户", value: "36" },
      ]}
      title="用户管理"
      wide
    >
      <DataTable
        ariaLabel="用户管理表格"
        bulkActions={userBulkActions}
        columns={userColumns}
        defaultSort={{ column: "lastLogin", direction: "desc" }}
        filters={userFilters}
        rowActions={userRowActions}
        rows={userRows}
        searchPlaceholder="搜索用户名、昵称、邮箱"
        toolbarActions={userToolbarActions}
      />
    </AdminDataPage>
  );
}
