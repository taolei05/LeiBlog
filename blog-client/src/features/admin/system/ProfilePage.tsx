import { AdminDataPage } from "../shared/AdminDataPage";
import {
  DataStatusChip,
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableRow,
  type DataTableRowAction,
  type DataTableToolbarAction,
} from "../shared/DataTable";

type ProfileSettingRow = DataTableRow & {
  description: string;
  group: "偏好" | "安全" | "资料";
  item: string;
  status: "complete" | "pending" | "readonly";
  updatedAt: string;
};

const profileRows: ProfileSettingRow[] = [
  {
    description: "昵称、邮箱、头像链接和个人简介。",
    group: "资料",
    id: "profile-basic",
    item: "基础资料",
    status: "complete",
    updatedAt: "2026-05-15",
  },
  {
    description: "博客链接、社交链接和标签。",
    group: "资料",
    id: "profile-social",
    item: "公开展示",
    status: "pending",
    updatedAt: "2026-05-12",
  },
  {
    description: "当前密码、登录设备和会话退出。",
    group: "安全",
    id: "profile-security",
    item: "安全设置",
    status: "pending",
    updatedAt: "2026-05-10",
  },
  {
    description: "后台默认主题、表格密度和语言偏好。",
    group: "偏好",
    id: "profile-preference",
    item: "界面偏好",
    status: "complete",
    updatedAt: "2026-05-08",
  },
  {
    description: "demo 账户仅能查看资料，不允许保存修改。",
    group: "安全",
    id: "profile-demo",
    item: "只读策略",
    status: "readonly",
    updatedAt: "2026-05-01",
  },
];

const profileStatusMeta = {
  complete: { label: "已配置", tone: "success" },
  pending: { label: "待完善", tone: "warning" },
  readonly: { label: "只读", tone: "default" },
} as const;

const profileColumns: DataTableColumn<ProfileSettingRow>[] = [
  {
    header: "设置项",
    id: "item",
    isRowHeader: true,
    render: (row) => (
      <span className="data-table-primary-cell">
        <strong>{row.item}</strong>
        <small>{row.description}</small>
      </span>
    ),
    searchValue: (row) => `${row.item} ${row.description} ${row.group}`,
    sortable: true,
    value: (row) => row.item,
  },
  {
    header: "分组",
    id: "group",
    sortable: true,
    value: (row) => row.group,
  },
  {
    header: "状态",
    id: "status",
    render: (row) => (
      <DataStatusChip tone={profileStatusMeta[row.status].tone}>
        {profileStatusMeta[row.status].label}
      </DataStatusChip>
    ),
    sortable: true,
    value: (row) => profileStatusMeta[row.status].label,
  },
  {
    header: "更新时间",
    id: "updatedAt",
    sortable: true,
    value: (row) => row.updatedAt,
  },
];

const profileFilters: DataTableFilter<ProfileSettingRow>[] = [
  {
    allLabel: "全部分组",
    key: "group",
    label: "分组",
    options: ["资料", "安全", "偏好"].map((group) => ({
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
      { label: "已配置", predicate: (row) => row.status === "complete", value: "complete" },
      { label: "待完善", predicate: (row) => row.status === "pending", value: "pending" },
      { label: "只读", predicate: (row) => row.status === "readonly", value: "readonly" },
    ],
  },
];

const profileToolbarActions: DataTableToolbarAction<ProfileSettingRow>[] = [
  {
    icon: "save",
    label: "保存资料",
    onPress: ({ setNotice }) => setNotice("个人资料保存接口等待接入"),
  },
];

const profileRowActions: DataTableRowAction<ProfileSettingRow>[] = [
  {
    access: "read",
    icon: "eye",
    label: "查看",
    onPress: (row, { setNotice }) => setNotice(`查看「${row.item}」设置`),
  },
  {
    icon: "pencil",
    isDisabled: (row) => row.status === "readonly",
    label: "编辑",
    onPress: (row, { setNotice }) => setNotice(`编辑「${row.item}」表单等待接入`),
  },
];

export function ProfilePage() {
  return (
    <AdminDataPage
      description="个人设置使用同一 DataTable 能力展示资料、安全和偏好配置状态。"
      eyebrow="系统"
      icon="personCircle"
      metrics={[
        { label: "资料完整度", value: "72%" },
        { label: "安全项", value: "3/5" },
        { label: "偏好项", value: "6" },
      ]}
      title="个人设置"
      wide
    >
      <DataTable
        ariaLabel="个人设置表格"
        columns={profileColumns}
        defaultSort={{ column: "updatedAt", direction: "desc" }}
        filters={profileFilters}
        rowActions={profileRowActions}
        rows={profileRows}
        searchPlaceholder="搜索资料、安全、偏好"
        toolbarActions={profileToolbarActions}
      />
    </AdminDataPage>
  );
}
