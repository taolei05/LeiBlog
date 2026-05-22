import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

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
import { DataStatusChip, DataTable, truncateDataTablePrimaryText } from "../shared/DataTable";
import { adminFetch } from "../shared/admin-api";

type CategoryRow = DataTableRow & {
  articleCount: number;
  level: "一级" | "二级";
  name: string;
  parent: string;
  sort: number;
  status: "active" | "hidden";
  updatedAt: string;
};

type AdminCategoryItem = {
  articleCount: number;
  createdAt: string;
  id: string;
  name: string;
  slug: string;
  updatedAt: string;
};

type CategoryNameModalState =
  | {
      mode: "create";
      setNotice: (message: string) => void;
    }
  | {
      mode: "rename";
      row: CategoryRow;
      setNotice: (message: string) => void;
    };

const categoryColumns: DataTableColumn<CategoryRow>[] = [
  {
    header: "分类",
    id: "name",
    isRowHeader: true,
    render: (row) => (
      <span className="data-table-primary-cell">
        <strong title={row.name}>{truncateDataTablePrimaryText(row.name)}</strong>
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

function toCategoryRow(item: AdminCategoryItem): CategoryRow {
  return {
    articleCount: item.articleCount,
    id: item.id,
    level: "一级",
    name: item.name,
    parent: "根分类",
    sort: 0,
    status: "active",
    updatedAt: new Date(item.updatedAt).toLocaleString("zh-CN"),
  };
}

export function CategoriesPage() {
  const navigate = useNavigate();
  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([]);
  const [nameModalState, setNameModalState] = useState<CategoryNameModalState | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  async function loadCategories() {
    const response = await adminFetch<{ items: AdminCategoryItem[] }>("/admin/content/categories");
    setCategoryRows(response.items.map(toCategoryRow));
  }

  useEffect(() => {
    void loadCategories();
  }, [reloadKey]);

  async function submitCategoryName() {
    if (!nameModalState) return;

    const name = categoryName.trim();
    if (!name) {
      nameModalState.setNotice("分类名称不能为空");
      return;
    }

    try {
      setIsSavingName(true);

      if (nameModalState.mode === "create") {
        await adminFetch("/admin/content/categories", {
          body: { name },
          method: "POST",
        });
        nameModalState.setNotice("分类已创建");
      } else {
        await adminFetch(`/admin/content/categories/${nameModalState.row.id}`, {
          body: { name },
          method: "PATCH",
        });
        nameModalState.setNotice("分类已更新");
      }

      setNameModalState(null);
      setCategoryName("");
      setReloadKey((key) => key + 1);
    } catch (error) {
      nameModalState.setNotice(error instanceof Error ? error.message : "分类保存失败");
    } finally {
      setIsSavingName(false);
    }
  }

  const categoryToolbarActions: DataTableToolbarAction<CategoryRow>[] = [
    {
      confirmation: "none",
      icon: "albums",
      label: "新建分类",
      onPress: ({ setNotice }) => {
        setCategoryName("");
        setNameModalState({ mode: "create", setNotice });
      },
    },
    {
      access: "read",
      icon: "refresh",
      label: "刷新",
      onPress: ({ setNotice }) => {
        setReloadKey((key) => key + 1);
        setNotice("分类列表已刷新");
      },
    },
  ];

  const categoryBulkActions: DataTableBulkAction<CategoryRow>[] = [
    {
      access: "danger",
      confirmationDescription: (rows) => {
        const articleCount = rows.reduce((total, row) => total + row.articleCount, 0);

        return `这是批量删除，将解除所选分类与共 ${articleCount} 篇文章的分类关联。文章本身不会删除。`;
      },
      icon: "trash",
      label: "删除",
      onPress: async (rows, { clearSelection, setNotice }) => {
        try {
          await Promise.all(
            rows.map((row) =>
              adminFetch(`/admin/content/categories/${row.id}`, { method: "DELETE" }),
            ),
          );
          clearSelection();
          setNotice(`已删除 ${rows.length} 个分类`);
          setReloadKey((key) => key + 1);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "分类删除失败");
        }
      },
    },
  ];

  const categoryRowActions: DataTableRowAction<CategoryRow>[] = [
    {
      access: "read",
      icon: "eye",
      label: "查看",
      onPress: (row) => {
        void navigate(`/admin/content/categories/${row.id}/articles`);
      },
    },
    {
      confirmation: "none",
      icon: "pencil",
      label: "重命名",
      onPress: (row, { setNotice }) => {
        setCategoryName(row.name);
        setNameModalState({ mode: "rename", row, setNotice });
      },
    },
    {
      access: "danger",
      confirmationDescription: (row) =>
        `删除「${row.name}」后，会解除其与 ${row.articleCount} 篇文章的分类关联。文章本身不会删除。`,
      icon: "trash",
      label: "删除",
      onPress: async (row, { setNotice }) => {
        try {
          await adminFetch(`/admin/content/categories/${row.id}`, { method: "DELETE" });
          setNotice("分类已删除");
          setReloadKey((key) => key + 1);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "分类删除失败");
        }
      },
    },
  ];

  const activeCount = categoryRows.filter((row) => row.status === "active").length;
  const relatedArticleCount = categoryRows.reduce((total, row) => total + row.articleCount, 0);

  return (
    <AdminDataPage
      description="分类管理保留层级/状态筛选、统计列排序和合并清理操作。"
      eyebrow="内容管理"
      icon="albums"
      metrics={[
        { label: "一级分类", value: String(activeCount) },
        { label: "子分类", value: "0" },
        { label: "关联文章", value: String(relatedArticleCount) },
      ]}
      title="分类管理"
      wide
    >
      <AdminFormModal
        confirmDescription="将保存分类名称，并同步更新后台分类列表。"
        description="分类名称会用于前台分类导航和文章归档。"
        icon="albums"
        isOpen={nameModalState !== null}
        isSubmitting={isSavingName}
        onOpenChange={(isOpen) => {
          if (isOpen) return;
          setNameModalState(null);
        }}
        onSubmit={submitCategoryName}
        submitLabel={nameModalState?.mode === "rename" ? "保存分类" : "创建分类"}
        title={nameModalState?.mode === "rename" ? "重命名分类" : "新建分类"}
      >
        <AdminInputGroupField
          icon="albums"
          isRequired
          label="分类名称"
          onChange={setCategoryName}
          placeholder="输入分类名称"
          value={categoryName}
        />
      </AdminFormModal>
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
        emptyText="暂无分类记录"
      />
    </AdminDataPage>
  );
}
