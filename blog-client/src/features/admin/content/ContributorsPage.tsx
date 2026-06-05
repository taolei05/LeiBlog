import { Avatar } from "@heroui/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { resolveApiAssetUrl } from "../../../shared/api/api-base-url";
import { AdminDataPage } from "../shared/AdminDataPage";
import { AdminFormModal, AdminInputGroupField } from "../shared/admin-form-modal";
import { uploadAdminMediaFile, adminFetch } from "../shared/admin-api";
import type {
  DataTableBulkAction,
  DataTableColumn,
  DataTableRow,
  DataTableRowAction,
  DataTableToolbarAction,
} from "../shared/DataTable";
import { DataTable, truncateDataTablePrimaryText } from "../shared/DataTable";
import { MediaAssetField } from "../shared/media-asset-field";

type ContributorRow = DataTableRow & {
  articleCount: number;
  avatarUrl: string | null;
  linkUrl: string | null;
  name: string;
  updatedAt: string;
};

type AdminContributorItem = {
  articleCount: number;
  avatarUrl: string | null;
  createdAt: string;
  id: string;
  linkUrl: string | null;
  name: string;
  updatedAt: string;
};

type ContributorFormState = {
  avatarUrl: string;
  linkUrl: string;
  name: string;
};

type ContributorModalState =
  | {
      mode: "create";
      setNotice: (message: string) => void;
    }
  | {
      mode: "edit";
      row: ContributorRow;
      setNotice: (message: string) => void;
    };

const emptyContributorForm: ContributorFormState = {
  avatarUrl: "",
  linkUrl: "",
  name: "",
};

const contributorColumns: DataTableColumn<ContributorRow>[] = [
  {
    header: "贡献者",
    id: "name",
    isRowHeader: true,
    render: (row) => (
      <span className="user-table-cell">
        <Avatar size="sm">
          {row.avatarUrl ? <Avatar.Image src={row.avatarUrl} /> : null}
          <Avatar.Fallback>{row.name.slice(0, 1)}</Avatar.Fallback>
        </Avatar>
        <span className="data-table-primary-cell">
          <strong title={row.name}>{truncateDataTablePrimaryText(row.name)}</strong>
          <small>{row.avatarUrl ? "已配置头像" : "未配置头像"}</small>
        </span>
      </span>
    ),
    searchValue: (row) => `${row.name} ${row.linkUrl ?? ""}`,
    sortable: true,
    value: (row) => row.name,
  },
  {
    header: "链接",
    id: "linkUrl",
    render: (row) => (
      <span title={row.linkUrl ?? "未填写"}>
        {truncateDataTablePrimaryText(row.linkUrl ?? "未填写")}
      </span>
    ),
    sortable: true,
    value: (row) => row.linkUrl ?? "",
  },
  {
    header: "关联文章",
    id: "articleCount",
    sortable: true,
    value: (row) => row.articleCount,
  },
  {
    header: "更新时间",
    id: "updatedAt",
    sortable: true,
    value: (row) => row.updatedAt,
  },
];

function optionalValue(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function toContributorRow(item: AdminContributorItem): ContributorRow {
  return {
    articleCount: item.articleCount,
    avatarUrl: resolveApiAssetUrl(item.avatarUrl) ?? null,
    id: item.id,
    linkUrl: item.linkUrl,
    name: item.name,
    updatedAt: new Date(item.updatedAt).toLocaleString("zh-CN"),
  };
}

function openContributorLink(linkUrl: string) {
  window.open(linkUrl, "_blank", "noopener,noreferrer");
}

export function ContributorsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ContributorRow[]>([]);
  const [formState, setFormState] = useState(emptyContributorForm);
  const [modalState, setModalState] = useState<ContributorModalState | null>(null);
  const [avatarLocalFile, setAvatarLocalFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    async function loadContributors() {
      const response = await adminFetch<{ items: AdminContributorItem[] }>(
        "/admin/content/contributors?pageSize=100",
      );
      setRows(response.items.map(toContributorRow));
    }

    void loadContributors();
  }, [reloadKey]);

  function updateForm(key: keyof ContributorFormState, value: string) {
    setFormState((state) => ({ ...state, [key]: value }));
  }

  async function saveContributor() {
    if (!modalState) return;

    const name = formState.name.trim();
    if (!name) {
      modalState.setNotice("贡献者名字不能为空");
      return;
    }

    try {
      setIsSaving(true);
      const avatarUrl = avatarLocalFile
        ? (
            await uploadAdminMediaFile({
              file: avatarLocalFile,
              folderSlug: "avatars",
            })
          ).item.accessUrl
        : formState.avatarUrl;
      const body = {
        avatarUrl: optionalValue(avatarUrl),
        linkUrl: optionalValue(formState.linkUrl),
        name,
      };

      if (modalState.mode === "create") {
        await adminFetch("/admin/content/contributors", {
          body,
          method: "POST",
        });
        modalState.setNotice("贡献者已创建");
      } else {
        await adminFetch(`/admin/content/contributors/${modalState.row.id}`, {
          body,
          method: "PATCH",
        });
        modalState.setNotice("贡献者已更新");
      }

      setModalState(null);
      setFormState(emptyContributorForm);
      setAvatarLocalFile(null);
      setReloadKey((key) => key + 1);
    } catch (error) {
      modalState.setNotice(error instanceof Error ? error.message : "贡献者保存失败");
    } finally {
      setIsSaving(false);
    }
  }

  const toolbarActions: DataTableToolbarAction<ContributorRow>[] = [
    {
      confirmation: "none",
      icon: "personAdd",
      label: "新建贡献者",
      onPress: ({ setNotice }) => {
        setFormState(emptyContributorForm);
        setAvatarLocalFile(null);
        setModalState({ mode: "create", setNotice });
      },
    },
    {
      access: "read",
      icon: "refresh",
      label: "刷新",
      onPress: ({ setNotice }) => {
        setReloadKey((key) => key + 1);
        setNotice("贡献者列表已刷新");
      },
    },
  ];

  const bulkActions: DataTableBulkAction<ContributorRow>[] = [
    {
      access: "danger",
      confirmationDescription: (selectedRows) => {
        const articleCount = selectedRows.reduce((total, row) => total + row.articleCount, 0);

        return `这是批量删除，将解除所选贡献者与共 ${articleCount} 篇文章的关联。文章本身不会删除。`;
      },
      icon: "trash",
      label: "删除",
      onPress: async (selectedRows, { clearSelection, setNotice }) => {
        try {
          await Promise.all(
            selectedRows.map((row) =>
              adminFetch(`/admin/content/contributors/${row.id}`, { method: "DELETE" }),
            ),
          );
          clearSelection();
          setNotice(`已删除 ${selectedRows.length} 位贡献者`);
          setReloadKey((key) => key + 1);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "贡献者删除失败");
        }
      },
    },
  ];

  const rowActions: DataTableRowAction<ContributorRow>[] = [
    {
      access: "read",
      icon: "eye",
      label: "查看文章",
      onPress: (row) => {
        void navigate(`/admin/content/contributors/${row.id}/articles`);
      },
    },
    {
      access: "read",
      confirmation: "none",
      icon: "open",
      isDisabled: (row) => !row.linkUrl,
      label: "打开链接",
      onPress: (row) => {
        if (row.linkUrl) openContributorLink(row.linkUrl);
      },
    },
    {
      confirmation: "none",
      icon: "pencil",
      label: "编辑",
      onPress: (row, { setNotice }) => {
        setFormState({
          avatarUrl: row.avatarUrl ?? "",
          linkUrl: row.linkUrl ?? "",
          name: row.name,
        });
        setAvatarLocalFile(null);
        setModalState({ mode: "edit", row, setNotice });
      },
    },
    {
      access: "danger",
      confirmationDescription: (row) =>
        `删除「${row.name}」后，会解除其与 ${row.articleCount} 篇文章的关联。文章本身不会删除。`,
      icon: "trash",
      label: "删除",
      onPress: async (row, { setNotice }) => {
        try {
          await adminFetch(`/admin/content/contributors/${row.id}`, { method: "DELETE" });
          setNotice("贡献者已删除");
          setReloadKey((key) => key + 1);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "贡献者删除失败");
        }
      },
    },
  ];

  const avatarCount = rows.filter((row) => row.avatarUrl).length;
  const linkCount = rows.filter((row) => row.linkUrl).length;

  return (
    <AdminDataPage
      description="维护参与文章内容贡献的人，并在文章编辑时关联到对应文章。"
      eyebrow="内容管理"
      icon="personAdd"
      metrics={[
        { label: "贡献者", value: String(rows.length) },
        { label: "已配头像", value: String(avatarCount) },
        { label: "已配链接", value: String(linkCount) },
      ]}
      title="贡献者管理"
      wide
    >
      <AdminFormModal
        confirmDescription="将保存贡献者名字、头像链接和关联链接。"
        description="贡献者会出现在已关联文章的评论区上方。"
        icon="personAdd"
        isOpen={modalState !== null}
        isSubmitting={isSaving}
        onOpenChange={(isOpen) => {
          if (isOpen) return;
          setModalState(null);
          setFormState(emptyContributorForm);
          setAvatarLocalFile(null);
        }}
        onSubmit={saveContributor}
        submitLabel={modalState?.mode === "edit" ? "保存贡献者" : "创建贡献者"}
        title={modalState?.mode === "edit" ? "编辑贡献者" : "新建贡献者"}
      >
        <AdminInputGroupField
          icon="personCircle"
          isRequired
          label="名字"
          onChange={(value) => updateForm("name", value)}
          placeholder="输入贡献者名字"
          value={formState.name}
        />
        <MediaAssetField
          folderSlug="avatars"
          label="头像"
          localFile={avatarLocalFile}
          onChange={(value) => updateForm("avatarUrl", value)}
          onLocalFileChange={setAvatarLocalFile}
          value={formState.avatarUrl}
        />
        <AdminInputGroupField
          icon="link"
          label="关联链接"
          onChange={(value) => updateForm("linkUrl", value)}
          placeholder="GitHub、GitLab 或个人主页"
          type="url"
          value={formState.linkUrl}
        />
      </AdminFormModal>
      <DataTable
        ariaLabel="贡献者管理表格"
        bulkActions={bulkActions}
        columns={contributorColumns}
        defaultSort={{ column: "updatedAt", direction: "desc" }}
        emptyText="暂无贡献者记录"
        rowActions={rowActions}
        rows={rows}
        searchPlaceholder="搜索贡献者或链接"
        toolbarActions={toolbarActions}
      />
    </AdminDataPage>
  );
}
