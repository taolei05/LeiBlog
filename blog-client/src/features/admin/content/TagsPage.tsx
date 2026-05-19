import { useEffect, useState } from "react";

import { AdminDataPage } from "../shared/AdminDataPage";
import { AdminFormModal, AdminInputGroupField } from "../shared/admin-form-modal";
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

type TagRow = DataTableRow & {
  articles: number;
  group: "内容" | "技术" | "站点";
  name: string;
  status: "active" | "cleanup" | "featured";
  trend: number;
  updatedAt: string;
};

type AdminTagItem = {
  articleCount: number;
  color: string | null;
  createdAt: string;
  id: string;
  name: string;
  slug: string;
  updatedAt: string;
};

type TagNameModalState =
  | {
      mode: "create";
      setNotice: (message: string) => void;
    }
  | {
      mode: "rename";
      row: TagRow;
      setNotice: (message: string) => void;
    };

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

function toTagRow(item: AdminTagItem): TagRow {
  const isFeatured = item.articleCount >= 3;

  return {
    articles: item.articleCount,
    group: "内容",
    id: item.id,
    name: item.name,
    status: isFeatured ? "featured" : "active",
    trend: 0,
    updatedAt: new Date(item.updatedAt).toLocaleString("zh-CN"),
  };
}

export function TagsPage() {
  const [tagRows, setTagRows] = useState<TagRow[]>([]);
  const [nameModalState, setNameModalState] = useState<TagNameModalState | null>(null);
  const [tagName, setTagName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  async function loadTags() {
    const response = await adminFetch<{ items: AdminTagItem[] }>("/admin/content/tags");
    setTagRows(response.items.map(toTagRow));
  }

  useEffect(() => {
    void loadTags();
  }, [reloadKey]);

  async function submitTagName() {
    if (!nameModalState) return;

    const name = tagName.trim();
    if (!name) {
      nameModalState.setNotice("标签名称不能为空");
      return;
    }

    try {
      setIsSavingName(true);

      if (nameModalState.mode === "create") {
        await adminFetch("/admin/content/tags", {
          body: { name },
          method: "POST",
        });
        nameModalState.setNotice("标签已创建");
      } else {
        await adminFetch(`/admin/content/tags/${nameModalState.row.id}`, {
          body: { name },
          method: "PATCH",
        });
        nameModalState.setNotice("标签已更新");
      }

      setNameModalState(null);
      setTagName("");
      setReloadKey((key) => key + 1);
    } catch (error) {
      nameModalState.setNotice(error instanceof Error ? error.message : "标签保存失败");
    } finally {
      setIsSavingName(false);
    }
  }

  const tagToolbarActions: DataTableToolbarAction<TagRow>[] = [
    {
      confirmation: "none",
      icon: "pricetags",
      label: "新建标签",
      onPress: ({ setNotice }) => {
        setTagName("");
        setNameModalState({ mode: "create", setNotice });
      },
    },
    {
      access: "read",
      icon: "refresh",
      label: "刷新",
      onPress: ({ setNotice }) => {
        setReloadKey((key) => key + 1);
        setNotice("标签列表已刷新");
      },
    },
  ];

  const tagBulkActions: DataTableBulkAction<TagRow>[] = [
    {
      access: "danger",
      icon: "trash",
      label: "批量删除",
      onPress: async (rows, { clearSelection, setNotice }) => {
        try {
          await Promise.all(
            rows.map((row) => adminFetch(`/admin/content/tags/${row.id}`, { method: "DELETE" })),
          );
          clearSelection();
          setNotice(`已删除 ${rows.length} 个标签`);
          setReloadKey((key) => key + 1);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "标签删除失败");
        }
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
      confirmation: "none",
      icon: "pencil",
      label: "重命名",
      onPress: (row, { setNotice }) => {
        setTagName(row.name);
        setNameModalState({ mode: "rename", row, setNotice });
      },
    },
    {
      access: "danger",
      icon: "trash",
      label: "删除",
      onPress: async (row, { setNotice }) => {
        try {
          await adminFetch(`/admin/content/tags/${row.id}`, { method: "DELETE" });
          setNotice("标签已删除");
          setReloadKey((key) => key + 1);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "标签删除失败");
        }
      },
    },
  ];
  const featuredCount = tagRows.filter((row) => row.status === "featured").length;
  const cleanupCount = tagRows.filter((row) => row.status === "cleanup").length;

  return (
    <AdminDataPage
      description="标签管理保留搜索、分组/状态筛选、引用和趋势排序，以及批量合并操作。"
      eyebrow="内容管理"
      icon="pricetags"
      metrics={[
        { label: "标签总数", value: String(tagRows.length) },
        { label: "高频标签", value: String(featuredCount) },
        { label: "待清理", value: String(cleanupCount) },
      ]}
      title="标签管理"
      wide
    >
      <AdminFormModal
        confirmDescription="将保存标签名称，并同步更新后台标签列表。"
        description="标签名称会用于文章聚合和前台筛选。"
        icon="pricetags"
        isOpen={nameModalState !== null}
        isSubmitting={isSavingName}
        onOpenChange={(isOpen) => {
          if (isOpen) return;
          setNameModalState(null);
        }}
        onSubmit={submitTagName}
        submitLabel={nameModalState?.mode === "rename" ? "保存标签" : "创建标签"}
        title={nameModalState?.mode === "rename" ? "重命名标签" : "新建标签"}
      >
        <AdminInputGroupField
          icon="pricetags"
          isRequired
          label="标签名称"
          onChange={setTagName}
          placeholder="输入标签名称"
          value={tagName}
        />
      </AdminFormModal>
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
        emptyText="暂无标签记录"
      />
    </AdminDataPage>
  );
}
