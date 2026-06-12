import { Avatar } from "@heroui/react";
import { useEffect, useState } from "react";

import { resolveApiAssetUrl } from "../../../shared/api/api-base-url";
import { AdminDataPage } from "../shared/AdminDataPage";
import {
  AdminFormModal,
  AdminInputGroupField,
  AdminSelectGroupField,
  AdminTextAreaGroupField,
} from "../shared/admin-form-modal";
import type {
  DataTableBulkAction,
  DataTableColumn,
  DataTableFilter,
  DataTableRow,
  DataTableRowAction,
  DataTableToolbarAction,
} from "../shared/DataTable";
import { DataStatusChip, DataTable, truncateDataTablePrimaryText } from "../shared/DataTable";
import { adminFetch, uploadAdminMediaFile } from "../shared/admin-api";
import { MediaAssetField } from "../shared/media-asset-field";

type UserRow = DataTableRow & {
  avatarUrl: string;
  blogUrl: string;
  description: string;
  email: string;
  lastLogin: string;
  lastLoginLocation: string;
  name: string;
  role: "admin" | "user";
  username: string;
  tags: string[];
};

type AdminUserItem = {
  avatarUrl: string | null;
  blogUrl: string | null;
  createdAt: string;
  description: string;
  email: string | null;
  id: string;
  lastLoginAt: string | null;
  lastLoginLocation: string | null;
  name: string | null;
  role: UserRow["role"];
  tags: string[];
  username: string;
};

type UserFormState = {
  avatarUrl: string;
  blogUrl: string;
  description: string;
  email: string;
  name: string;
  password: string;
  role: UserRow["role"];
  tags: string;
  username: string;
};

type UserModalState =
  | {
      mode: "create";
      setNotice: (message: string) => void;
    }
  | {
      mode: "edit";
      setNotice: (message: string) => void;
      userId: string;
    };

const roleLabel = {
  admin: "管理员",
  user: "普通用户",
} as const;

const userRoleOptions: Array<{ label: string; value: UserRow["role"] }> = [
  { label: "管理员", value: "admin" },
  { label: "普通用户", value: "user" },
];

const emptyUserForm: UserFormState = {
  avatarUrl: "",
  blogUrl: "",
  description: "",
  email: "",
  name: "",
  password: "",
  role: "user",
  tags: "",
  username: "",
};

const userColumns: DataTableColumn<UserRow>[] = [
  {
    header: "头像",
    id: "avatar",
    render: (row) => (
      <span className="user-avatar-cell">
        <Avatar size="sm">
          {row.avatarUrl ? (
            <Avatar.Image
              alt={row.name}
              key={resolveApiAssetUrl(row.avatarUrl)}
              src={resolveApiAssetUrl(row.avatarUrl)}
            />
          ) : null}
          <Avatar.Fallback>{row.name.slice(0, 1).toUpperCase()}</Avatar.Fallback>
        </Avatar>
      </span>
    ),
    value: (row) => row.name,
  },
  {
    header: "用户",
    id: "username",
    isRowHeader: true,
    render: (row) => (
      <span className="user-table-cell">
        <span className="data-table-primary-cell">
          <strong title={row.name}>{truncateDataTablePrimaryText(row.name)}</strong>
          <small>
            {row.username} · {row.email}
          </small>
        </span>
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
      <DataStatusChip tone={row.role === "admin" ? "accent" : "default"}>
        {roleLabel[row.role]}
      </DataStatusChip>
    ),
    sortable: true,
    value: (row) => roleLabel[row.role],
  },
  {
    header: "登录地点",
    id: "lastLoginLocation",
    sortable: true,
    value: (row) => row.lastLoginLocation,
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
      { label: "普通用户", predicate: (row) => row.role === "user", value: "user" },
    ],
  },
];

function toUserRow(item: AdminUserItem): UserRow {
  return {
    avatarUrl: item.avatarUrl ?? "",
    blogUrl: item.blogUrl ?? "",
    description: item.description,
    email: item.email ?? "未设置邮箱",
    id: item.id,
    lastLogin: item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString("zh-CN") : "从未登录",
    lastLoginLocation: item.lastLoginLocation ?? "暂无记录",
    name: item.name ?? item.username,
    role: item.role,
    tags: item.tags,
    username: item.username,
  };
}

function toOptional(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function splitTags(value: string) {
  return [
    ...new Set(
      value
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function toCreateOptional(value: string) {
  return toOptional(value) ?? undefined;
}

function isUserRole(value: string): value is UserRow["role"] {
  return value === "admin" || value === "user";
}

export function UsersPage() {
  const [userRows, setUserRows] = useState<UserRow[]>([]);
  const [userModalState, setUserModalState] = useState<UserModalState | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm);
  const [avatarLocalFile, setAvatarLocalFile] = useState<File | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  async function loadUsers() {
    const response = await adminFetch<{ items: AdminUserItem[] }>("/admin/users/");
    setUserRows(response.items.map(toUserRow));
  }

  useEffect(() => {
    void loadUsers();
  }, [reloadKey]);

  function updateUserForm(key: keyof UserFormState, value: string) {
    setUserForm((state) => ({ ...state, [key]: value }));
  }

  function updateUserRole(value: string) {
    if (!isUserRole(value)) return;
    setUserForm((state) => ({ ...state, role: value }));
  }

  async function submitUserForm() {
    if (!userModalState) return;

    const password = userForm.password.trim();
    if (userModalState.mode === "create" && !userForm.username.trim()) {
      userModalState.setNotice("用户名不能为空");
      return;
    }
    if (userModalState.mode === "create" && password.length < 8) {
      userModalState.setNotice("初始密码至少需要 8 位");
      return;
    }
    if (userModalState.mode === "edit" && password && password.length < 8) {
      userModalState.setNotice("新密码至少需要 8 位");
      return;
    }

    try {
      setIsSavingUser(true);
      const avatarUrl = avatarLocalFile
        ? (
            await uploadAdminMediaFile({
              file: avatarLocalFile,
              folderSlug: "avatars",
            })
          ).item.accessUrl
        : userForm.avatarUrl;

      if (userModalState.mode === "create") {
        await adminFetch("/admin/users/", {
          body: {
            avatarUrl: toCreateOptional(avatarUrl),
            blogUrl: toCreateOptional(userForm.blogUrl),
            description: userForm.description.trim(),
            email: toCreateOptional(userForm.email),
            name: toCreateOptional(userForm.name),
            password,
            role: userForm.role,
            tags: splitTags(userForm.tags),
            username: userForm.username.trim(),
          },
          method: "POST",
        });
        userModalState.setNotice("用户已创建");
      } else {
        await adminFetch(`/admin/users/${userModalState.userId}`, {
          body: {
            avatarUrl: toOptional(avatarUrl),
            blogUrl: toOptional(userForm.blogUrl),
            description: userForm.description,
            email: toOptional(userForm.email),
            name: toOptional(userForm.name),
            password: password || undefined,
            role: userForm.role,
            tags: splitTags(userForm.tags),
          },
          method: "PATCH",
        });
        userModalState.setNotice("用户资料已更新");
      }

      setUserModalState(null);
      setUserForm(emptyUserForm);
      setAvatarLocalFile(null);
      setReloadKey((key) => key + 1);
    } catch (error) {
      userModalState.setNotice(error instanceof Error ? error.message : "用户保存失败");
    } finally {
      setIsSavingUser(false);
    }
  }

  const userToolbarActions: DataTableToolbarAction<UserRow>[] = [
    {
      confirmation: "none",
      icon: "people",
      label: "新建用户",
      onPress: ({ setNotice }) => {
        setUserForm(emptyUserForm);
        setAvatarLocalFile(null);
        setUserModalState({ mode: "create", setNotice });
      },
    },
    {
      access: "read",
      icon: "refresh",
      label: "刷新",
      onPress: ({ setNotice }) => {
        setReloadKey((key) => key + 1);
        setNotice("用户列表已刷新");
      },
    },
  ];

  const userBulkActions: DataTableBulkAction<UserRow>[] = [
    {
      access: "danger",
      confirmationDescription: (rows) =>
        `这是批量删除，将移除所选 ${rows.length} 个账号的评论、登录会话和安全记录；所写文章保留，但作者会清空。`,
      icon: "trash",
      label: "删除",
      onPress: async (rows, { clearSelection, setNotice }) => {
        try {
          await Promise.all(
            rows.map((row) => adminFetch(`/admin/users/${row.id}`, { method: "DELETE" })),
          );
          clearSelection();
          setNotice(`已删除 ${rows.length} 个用户`);
          setReloadKey((key) => key + 1);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "用户删除失败");
        }
      },
    },
  ];

  const userRowActions: DataTableRowAction<UserRow>[] = [
    {
      confirmation: "none",
      icon: "pencil",
      label: "编辑",
      onPress: async (row, { setNotice }) => {
        try {
          const response = await adminFetch<{ user: AdminUserItem }>(`/admin/users/${row.id}`);
          const user = response.user;
          setUserForm({
            avatarUrl: user.avatarUrl ?? "",
            blogUrl: user.blogUrl ?? "",
            description: user.description,
            email: user.email ?? "",
            name: user.name ?? "",
            password: "",
            role: user.role,
            tags: user.tags.join("，"),
            username: user.username,
          });
          setAvatarLocalFile(null);
          setUserModalState({ mode: "edit", setNotice, userId: row.id });
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "用户读取失败");
        }
      },
    },
    {
      access: "danger",
      confirmationDescription: (row) =>
        `删除「${row.name}」后，会移除该账号的评论、登录会话和安全记录；所写文章保留，但作者会清空。`,
      icon: "trash",
      isDisabled: (row) => row.role === "admin",
      label: "删除",
      onPress: async (row, { setNotice }) => {
        try {
          await adminFetch(`/admin/users/${row.id}`, { method: "DELETE" });
          setNotice("用户已删除");
          setReloadKey((key) => key + 1);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "用户删除失败");
        }
      },
    },
  ];
  const adminCount = userRows.filter((row) => row.role === "admin").length;
  const userCount = userRows.filter((row) => row.role === "user").length;

  return (
    <AdminDataPage
      description="用户管理保留角色/状态筛选、搜索、排序、分页和写操作只读禁用。"
      eyebrow="系统"
      icon="people"
      metrics={[
        { label: "管理员", value: String(adminCount) },
        { label: "普通用户", value: String(userCount) },
      ]}
      title="用户管理"
      wide
    >
      <AdminFormModal
        confirmDescription="将保存用户角色、头像、邮箱、密码和个人资料等变更。"
        description={
          userModalState?.mode === "edit"
            ? "角色、头像、邮箱、密码和个人资料都在这里统一修改。"
            : "创建普通用户或管理员账户。"
        }
        icon={userModalState?.mode === "edit" ? "pencil" : "people"}
        isBodyScrollable
        isOpen={userModalState !== null}
        isSubmitting={isSavingUser}
        onOpenChange={(isOpen) => {
          if (isOpen) return;
          setUserModalState(null);
        }}
        onSubmit={submitUserForm}
        size="lg"
        submitLabel={userModalState?.mode === "edit" ? "保存用户" : "新建用户"}
        title={userModalState?.mode === "edit" ? "编辑用户" : "新建用户"}
      >
        <div className="admin-form-modal__grid">
          {userModalState?.mode === "create" ? (
            <AdminInputGroupField
              autoComplete="username"
              icon="personAdd"
              isRequired
              label="用户名"
              onChange={(value) => updateUserForm("username", value)}
              placeholder="输入用户名"
              value={userForm.username}
            />
          ) : null}
          <AdminInputGroupField
            autoComplete={userModalState?.mode === "create" ? "new-password" : "off"}
            icon="lockClosed"
            isRequired={userModalState?.mode === "create"}
            label={userModalState?.mode === "create" ? "初始密码" : "新密码"}
            onChange={(value) => updateUserForm("password", value)}
            placeholder={userModalState?.mode === "create" ? "至少 8 位" : "留空则不修改"}
            type="password"
            value={userForm.password}
          />
          <AdminSelectGroupField
            icon="shield"
            label="角色"
            onChange={updateUserRole}
            options={userRoleOptions}
            value={userForm.role}
          />
          <AdminInputGroupField
            autoComplete="email"
            icon="mail"
            label="邮箱"
            onChange={(value) => updateUserForm("email", value)}
            placeholder="name@example.com"
            type="email"
            value={userForm.email}
          />
          <AdminInputGroupField
            autoComplete="name"
            icon="personCircle"
            label="昵称 / 姓名"
            onChange={(value) => updateUserForm("name", value)}
            placeholder="展示名称"
            value={userForm.name}
          />
          <div className="admin-form-modal__field admin-form-modal__field--span">
            <MediaAssetField
              folderSlug="avatars"
              label="头像"
              localFile={avatarLocalFile}
              onChange={(value) => updateUserForm("avatarUrl", value)}
              onLocalFileChange={setAvatarLocalFile}
              value={userForm.avatarUrl}
            />
          </div>
          <AdminInputGroupField
            icon="link"
            label="博客链接"
            onChange={(value) => updateUserForm("blogUrl", value)}
            placeholder="https://..."
            type="url"
            value={userForm.blogUrl}
          />
          <AdminInputGroupField
            icon="pricetags"
            label="标签"
            onChange={(value) => updateUserForm("tags", value)}
            placeholder="作者，读者，朋友"
            value={userForm.tags}
          />
        </div>
        <AdminTextAreaGroupField
          icon="documentText"
          label="描述"
          onChange={(value) => updateUserForm("description", value)}
          placeholder="输入用户描述"
          value={userForm.description}
        />
      </AdminFormModal>
      <DataTable
        ariaLabel="用户管理表格"
        bulkActions={userBulkActions}
        columns={userColumns}
        defaultSort={{ column: "lastLogin", direction: "desc" }}
        filters={userFilters}
        rowActions={userRowActions}
        rows={userRows}
        searchPlaceholder="搜索用户名、昵称、邮箱、登录地点"
        toolbarActions={userToolbarActions}
        emptyText="暂无用户记录"
      />
    </AdminDataPage>
  );
}
