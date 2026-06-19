import {
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  Label,
  parseColor,
} from "@heroui/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AdminDataPage } from "../shared/AdminDataPage";
import {
  AdminFormModal,
  AdminInputGroupField,
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
import { adminFetch } from "../shared/admin-api";

type TagRow = DataTableRow & {
  articles: number;
  color: string;
  group: "内容" | "技术" | "站点";
  name: string;
  slug: string;
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

type TagEditorModalState =
  | {
      mode: "create";
      setNotice: (message: string) => void;
    }
  | {
      mode: "rename";
      row: TagRow;
      setNotice: (message: string) => void;
    };

type BatchTagModalState = {
  setNotice: (message: string) => void;
};

type TagFormState = {
  color: string;
  name: string;
  slug: string;
};

const defaultTagColor = "#ec4899";

const tagStatusMeta = {
  active: { label: "常规", tone: "default" },
  cleanup: { label: "待清理", tone: "warning" },
  featured: { label: "高频", tone: "accent" },
} as const;

function normalizeTagColor(color: string | null | undefined) {
  const value = color?.trim();

  if (value && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    return value;
  }

  return defaultTagColor;
}

function optionalFormValue(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function parseBatchTagNames(value: string) {
  const names = value
    .split(/[\n,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return [...new Set(names)];
}

const tagColumns: DataTableColumn<TagRow>[] = [
  {
    header: "标签",
    id: "name",
    isRowHeader: true,
    render: (row) => (
      <span className="data-table-primary-cell">
        <strong title={row.name}>{truncateDataTablePrimaryText(row.name)}</strong>
        <small>{row.group}</small>
      </span>
    ),
    searchValue: (row) => `${row.name} ${row.slug} ${row.group}`,
    sortable: true,
    value: (row) => row.name,
  },
  {
    header: "颜色",
    id: "color",
    render: (row) => (
      <span className="tag-color-cell">
        <span className="tag-color-cell__swatch" style={{ backgroundColor: row.color }} />
        <span>{row.color}</span>
      </span>
    ),
    sortable: true,
    value: (row) => row.color,
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
    color: normalizeTagColor(item.color),
    group: "内容",
    id: item.id,
    name: item.name,
    slug: item.slug,
    status: isFeatured ? "featured" : "active",
    trend: 0,
    updatedAt: new Date(item.updatedAt).toLocaleString("zh-CN"),
  };
}

export function TagsPage() {
  const navigate = useNavigate();
  const [tagRows, setTagRows] = useState<TagRow[]>([]);
  const [tagModalState, setTagModalState] = useState<TagEditorModalState | null>(null);
  const [batchTagModalState, setBatchTagModalState] = useState<BatchTagModalState | null>(null);
  const [batchTagNames, setBatchTagNames] = useState("");
  const [tagForm, setTagForm] = useState<TagFormState>({
    color: defaultTagColor,
    name: "",
    slug: "",
  });
  const [tagColor, setTagColor] = useState(parseColor(defaultTagColor));
  const [isSavingName, setIsSavingName] = useState(false);
  const [isBatchCreating, setIsBatchCreating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  async function loadTags() {
    const response = await adminFetch<{ items: AdminTagItem[] }>("/admin/content/tags");
    setTagRows(response.items.map(toTagRow));
  }

  useEffect(() => {
    void loadTags();
  }, [reloadKey]);

  async function submitTagName() {
    if (!tagModalState) return;

    const name = tagForm.name.trim();
    if (!name) {
      tagModalState.setNotice("标签名称不能为空");
      return;
    }

    try {
      setIsSavingName(true);

      if (tagModalState.mode === "create") {
        await adminFetch("/admin/content/tags", {
          body: { name, slug: optionalFormValue(tagForm.slug) ?? undefined },
          method: "POST",
        });
        tagModalState.setNotice("标签已创建");
      } else {
        const color = tagColor.toString("hex");

        await adminFetch(`/admin/content/tags/${tagModalState.row.id}`, {
          body: { color, name, slug: optionalFormValue(tagForm.slug) ?? undefined },
          method: "PATCH",
        });
        tagModalState.setNotice("标签已更新");
      }

      setTagModalState(null);
      setTagForm({ color: defaultTagColor, name: "", slug: "" });
      setTagColor(parseColor(defaultTagColor));
      setReloadKey((key) => key + 1);
    } catch (error) {
      tagModalState.setNotice(error instanceof Error ? error.message : "标签保存失败");
    } finally {
      setIsSavingName(false);
    }
  }

  async function submitBatchTags() {
    if (!batchTagModalState) return;

    const names = parseBatchTagNames(batchTagNames);
    if (names.length === 0) {
      batchTagModalState.setNotice("标签名称不能为空");
      return;
    }

    try {
      setIsBatchCreating(true);
      const response = await adminFetch<{ items: AdminTagItem[] }>("/admin/content/tags/batch", {
        body: { items: names.map((name) => ({ name })) },
        method: "POST",
      });

      setBatchTagModalState(null);
      setBatchTagNames("");
      setReloadKey((key) => key + 1);
      batchTagModalState.setNotice(`已创建 ${response.items.length} 个标签`);
    } catch (error) {
      batchTagModalState.setNotice(error instanceof Error ? error.message : "批量创建标签失败");
    } finally {
      setIsBatchCreating(false);
    }
  }

  const tagToolbarActions: DataTableToolbarAction<TagRow>[] = [
    {
      confirmation: "none",
      icon: "pricetags",
      label: "新建标签",
      onPress: ({ setNotice }) => {
        setTagForm({ color: defaultTagColor, name: "", slug: "" });
        setTagColor(parseColor(defaultTagColor));
        setTagModalState({ mode: "create", setNotice });
      },
    },
    {
      confirmation: "none",
      icon: "pricetags",
      label: "批量创建",
      onPress: ({ setNotice }) => {
        setBatchTagNames("");
        setBatchTagModalState({ setNotice });
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
      confirmationDescription: (rows) => {
        const articleCount = rows.reduce((total, row) => total + row.articles, 0);

        return `这是批量删除，将解除所选标签与共 ${articleCount} 篇文章的标签关联。文章本身不会删除。`;
      },
      icon: "trash",
      label: "删除",
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
      onPress: (row) => {
        void navigate(`/admin/content/tags/${row.id}/articles`);
      },
    },
    {
      confirmation: "none",
      icon: "pencil",
      label: "编辑",
      onPress: (row, { setNotice }) => {
        setTagForm({ color: row.color, name: row.name, slug: row.slug });
        setTagColor(parseColor(row.color));
        setTagModalState({ mode: "rename", row, setNotice });
      },
    },
    {
      access: "danger",
      confirmationDescription: (row) =>
        `删除「${row.name}」后，会解除其与 ${row.articles} 篇文章的标签关联。文章本身不会删除。`,
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
  const isTagColorEditable = tagModalState !== null && tagModalState.mode === "rename";

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
        confirmDescription="将保存标签名称、Slug 和颜色，并同步更新后台标签列表。"
        description="标签名称和 Slug 会用于文章聚合、前台筛选和标签链接，颜色会展示在前台标签页。"
        icon="pricetags"
        isOpen={tagModalState !== null}
        isSubmitting={isSavingName}
        onOpenChange={(isOpen) => {
          if (isOpen) return;
          setTagModalState(null);
          setTagForm({ color: defaultTagColor, name: "", slug: "" });
          setTagColor(parseColor(defaultTagColor));
        }}
        onSubmit={submitTagName}
        submitLabel={isTagColorEditable ? "保存标签" : "创建标签"}
        title={isTagColorEditable ? "编辑标签" : "新建标签"}
      >
        <AdminInputGroupField
          icon="pricetags"
          isRequired
          label="标签名称"
          onChange={(name) => setTagForm((form) => ({ ...form, name }))}
          placeholder="输入标签名称"
          value={tagForm.name}
        />
        <AdminInputGroupField
          description="留空时后端会按名称自动生成，已有标签留空则保持原 Slug。"
          icon="link"
          label="Slug"
          onChange={(slug) => setTagForm((form) => ({ ...form, slug }))}
          placeholder="tools"
          value={tagForm.slug}
        />
        {isTagColorEditable ? (
          <div className="admin-tag-color-field">
            <Label>标签颜色</Label>
            <ColorPicker value={tagColor} onChange={setTagColor}>
              <ColorPicker.Trigger className="admin-tag-color-trigger">
                <ColorSwatch className="admin-tag-color-trigger__swatch" />
                <span>{tagColor.toString("hex")}</span>
              </ColorPicker.Trigger>
              <ColorPicker.Popover className="admin-tag-color-popover">
                <ColorArea colorSpace="hsb" xChannel="saturation" yChannel="brightness">
                  <ColorArea.Thumb />
                </ColorArea>
                <ColorSlider aria-label="色相" channel="hue" colorSpace="hsb">
                  <ColorSlider.Track>
                    <ColorSlider.Thumb />
                  </ColorSlider.Track>
                </ColorSlider>
                <ColorField aria-label="标签颜色值">
                  <ColorField.Group variant="secondary">
                    <ColorField.Prefix>
                      <ColorSwatch size="xs" />
                    </ColorField.Prefix>
                    <ColorField.Input />
                  </ColorField.Group>
                </ColorField>
              </ColorPicker.Popover>
            </ColorPicker>
          </div>
        ) : null}
      </AdminFormModal>
      <AdminFormModal
        confirmDescription="将按输入顺序创建多个标签，Slug 由后端自动生成，颜色由系统随机分配。"
        description="支持每行一个标签，也支持用逗号分隔。"
        icon="pricetags"
        isOpen={batchTagModalState !== null}
        isSubmitting={isBatchCreating}
        onOpenChange={(isOpen) => {
          if (isOpen) return;
          setBatchTagModalState(null);
          setBatchTagNames("");
        }}
        onSubmit={submitBatchTags}
        submitLabel="批量创建"
        title="批量创建标签"
      >
        <AdminTextAreaGroupField
          description="重复名称会自动忽略。"
          icon="pricetags"
          isRequired
          label="标签名称"
          onChange={setBatchTagNames}
          placeholder={"Docker\nNginx\nPostgreSQL"}
          rows={8}
          value={batchTagNames}
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
