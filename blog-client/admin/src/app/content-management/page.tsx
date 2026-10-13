import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  FolderTree,
  MessageCircle,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Tags,
  Trash2,
  UserRound,
} from "lucide-react";

import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Grid, GridSpan } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { IconButton } from "@astryxdesign/core/IconButton";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { MultiSelector } from "@astryxdesign/core/MultiSelector";
import type {
  MultiSelectorOptionType,
  MultiSelectorPresentation,
} from "@astryxdesign/core/MultiSelector";
import { Pagination } from "@astryxdesign/core/Pagination";
import { Selector } from "@astryxdesign/core/Selector";
import { Spinner } from "@astryxdesign/core/Spinner";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Switch } from "@astryxdesign/core/Switch";
import {
  Table,
  pixel,
  useTableSortable,
  useTableSortableState,
  useTableStickyColumns,
} from "@astryxdesign/core/Table";
import type { TableColumn } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";

import type {
  ArticleCategory,
  ArticleCategoryPayload,
  ArticleContributor,
  ArticleContributorPayload,
  ArticleContributorRelation,
  ArticleContent,
  ArticleContentList,
  ArticleContentPayload,
  ArticleRelation,
  ArticleStatus,
  ArticleTag,
  ArticleTagPayload,
  CommentItem,
  CommentList,
  CommentStatus,
} from "../../../../shared/admin-api";
import {
  createArticleCategory,
  createArticleContributor,
  createArticleContent,
  createArticleTag,
  deleteAdminComment,
  deleteArticleCategory,
  deleteArticleContributor,
  deleteArticleContent,
  deleteArticleTag,
  getAdminComments,
  getAdminArticles,
  getArticleCategories,
  getArticleContributors,
  getArticleTags,
  reviewAdminComment,
  resolveAdminAssetUrl,
  updateArticleCategory,
  updateArticleContributor,
  updateArticleContent,
  updateArticleTag,
  uploadMediaAsset,
} from "../../../../shared/admin-api";
import type { AppLanguage } from "../../../../shared/i18n";
import { normalizeLanguage } from "../../../../shared/i18n";
import { formatDateTimeInTimeZone } from "../../../../shared/time-zone";
import { AdminActionTooltip } from "../components/admin-action-tooltip";
import {
  AdminFeedbackBanner,
  createAdminFeedbackBanner,
} from "../components/admin-feedback-banner";
import type { AdminFeedbackBannerState } from "../components/admin-feedback-banner";
import { AdminFormDialog } from "../components/admin-form-dialog";
import { MdxEditorField } from "../components/mdx-editor-field";
import { allowedMdxJsxComponentNames } from "../components/mdx-whitelist";
import { MediaAssetField } from "../components/media-asset-field";

type ContentView = "articles" | "categories" | "comments" | "contributors" | "tags";
type ArticleTableRow = ArticleContent &
  Record<string, unknown> & {
    categoryText: string;
    contributorText: string;
    tagText: string;
    titleText: string;
  };
type CategoryTableRow = ArticleCategory &
  Record<string, unknown> & {
    descriptionText: string;
    nameText: string;
  };
type TagTableRow = ArticleTag &
  Record<string, unknown> & {
    descriptionText: string;
    nameText: string;
  };
type ContributorTableRow = ArticleContributor &
  Record<string, unknown> & {
    linkText: string;
    nameText: string;
  };
type CommentTableRow = CommentItem &
  Record<string, unknown> & {
    articleText: string;
    authorText: string;
  };
type ArticleSortKey =
  | "categoryText"
  | "commentCount"
  | "contributorText"
  | "readCount"
  | "status"
  | "tagText"
  | "titleText"
  | "updatedAt";
type CategorySortKey = "articleCount" | "descriptionText" | "nameText" | "sortOrder" | "updatedAt";
type TagSortKey = "articleCount" | "descriptionText" | "nameText" | "updatedAt";
type ContributorSortKey = "articleCount" | "linkText" | "nameText" | "updatedAt";
type CommentSortKey = "articleText" | "authorText" | "createdAt" | "location" | "status";

type DialogState =
  | {
      mode: "create";
      type: "category";
    }
  | {
      category: ArticleCategory;
      mode: "edit";
      type: "category";
    }
  | {
      mode: "create";
      type: "tag";
    }
  | {
      mode: "edit";
      tag: ArticleTag;
      type: "tag";
    }
  | {
      mode: "create";
      type: "contributor";
    }
  | {
      contributor: ArticleContributor;
      mode: "edit";
      type: "contributor";
    };

type ArticleEditorState =
  | {
      mode: "create";
    }
  | {
      article: ArticleContent;
      mode: "edit";
    };

type DeleteTarget =
  | {
      id: string;
      label: string;
      type: "article";
    }
  | {
      id: string;
      label: string;
      type: "category";
    }
  | {
      id: string;
      label: string;
      type: "tag";
    }
  | {
      id: string;
      label: string;
      type: "contributor";
    }
  | {
      id: string;
      label: string;
      type: "comment";
    };

type ArticleFormState = {
  categoryIds: string[];
  contentMdx: string;
  contentMdxEn: string;
  contributorIds: string[];
  coverImageUrl: string;
  isPinned: boolean;
  publishedAt: string;
  scheduledPublishAt: string;
  slug: string;
  status: ArticleStatus;
  summary: string;
  summaryEn: string;
  tagIds: string[];
  title: string;
  titleEn: string;
};
type ArticleRelationIdField = "categoryIds" | "contributorIds" | "tagIds";

type TaxonomyFormState = {
  color: string;
  description: string;
  descriptionEn: string;
  name: string;
  nameEn: string;
  slug: string;
};

type ContributorFormState = {
  avatarUrl: string;
  linkUrl: string;
  name: string;
};

type ContentManagementPageProps = {
  authToken: string;
  initialView: ContentView;
  isNarrow: boolean;
  timeZone: string;
};

const PAGE_SIZE = 12;
const PAGE_SIZE_OPTIONS = [PAGE_SIZE];
const STATUS_VALUES: Array<ArticleStatus | "all"> = ["all", "draft", "published", "scheduled"];
const ARTICLE_STATUS_VALUES: ArticleStatus[] = ["draft", "published", "scheduled"];
const COMMENT_STATUS_VALUES: Array<CommentStatus | "all"> = [
  "all",
  "pending",
  "approved",
  "rejected",
];
const COMMENT_STATUS_BADGE_VARIANTS: Record<CommentStatus, "neutral" | "pink" | "success"> = {
  approved: "success",
  pending: "pink",
  rejected: "neutral",
};
const DEFAULT_TAG_COLOR = "#ec4899";
const TAG_COLOR_OPTIONS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
];
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const EMPTY_ARTICLE_LIST: ArticleContentList = {
  items: [],
  ok: true,
  pageInfo: {
    page: 1,
    pageSize: PAGE_SIZE,
    totalItems: 0,
    totalPages: 1,
  },
};

const EMPTY_COMMENT_LIST: CommentList = {
  items: [],
  ok: true,
  pageInfo: {
    page: 1,
    pageSize: PAGE_SIZE,
    totalItems: 0,
    totalPages: 1,
  },
};

const pageStyle: CSSProperties = {
  width: "100%",
};

const summaryIconStyle: CSSProperties = {
  color: "var(--color-text-secondary)",
};

const toolbarStyle: CSSProperties = {
  width: "100%",
};

const toolbarRowStyle: CSSProperties = {
  alignItems: "flex-end",
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  width: "100%",
};

const toolbarSearchStyle: CSSProperties = {
  flex: "1 1 320px",
  minWidth: 0,
};

const toolbarFilterStyle: CSSProperties = {
  flex: "0 1 240px",
  minWidth: 180,
};

const toolbarSwitchStyle: CSSProperties = {
  alignSelf: "flex-end",
  flex: "0 0 auto",
  paddingBottom: 6,
};

const toolbarActionsStyle: CSSProperties = {
  display: "flex",
  flex: "0 0 auto",
  gap: 8,
  marginLeft: "auto",
};

const tableCardStyle: CSSProperties = {
  overflow: "hidden",
  width: "100%",
};

const articleCoverStyle: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  display: "block",
  height: 44,
  objectFit: "cover",
  width: 68,
};

const tableViewportStyle: CSSProperties = {
  overflowX: "auto",
  width: "100%",
};

const contentAdaptiveTableStyle: CSSProperties = {
  minWidth: "max-content",
  width: "100%",
};

const tableFooterStyle: CSSProperties = {
  borderTop: "1px solid var(--color-border)",
  padding: 16,
};

const actionsCellStyle: CSSProperties = {
  alignItems: "center",
  display: "flex",
  justifyContent: "center",
  width: "100%",
};

const summaryValueStyle: CSSProperties = {
  lineHeight: 1,
};

const tableIdentityStyle: CSSProperties = {
  justifyContent: "center",
  minWidth: 0,
};

const tableIdentityTextStyle: CSSProperties = {
  minWidth: 0,
  textAlign: "center",
};

const tableCenteredStackStyle: CSSProperties = {
  alignItems: "center",
  minWidth: 0,
  textAlign: "center",
};

const tableCenteredTextStyle: CSSProperties = {
  textAlign: "center",
};

const taxonomyColorStyle: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 999,
  display: "inline-block",
  height: 12,
  width: 12,
};

const tagColorInputStyle: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  cursor: "pointer",
  height: 42,
  padding: 4,
  width: 56,
};

const tagColorSwatchButtonStyle: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 999,
  cursor: "pointer",
  height: 28,
  width: 28,
};

const articleEditorHeaderStyle: CSSProperties = {
  alignItems: "flex-start",
  width: "100%",
};

const articleEditorActionsStyle: CSSProperties = {
  flexShrink: 0,
};

const articleEditorLayoutStyle: CSSProperties = {
  alignItems: "start",
  display: "grid",
  gap: 16,
  gridTemplateColumns: "minmax(260px, 0.42fr) minmax(0, 1fr)",
  width: "100%",
};

const articleEditorSingleColumnStyle: CSSProperties = {
  alignItems: "start",
  display: "grid",
  gap: 16,
  gridTemplateColumns: "1fr",
  width: "100%",
};

const articleEditorCardStyle: CSSProperties = {
  minWidth: 0,
  width: "100%",
};

const articleEditorMdxCardStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  width: "100%",
};

const articleRelationSelectorRowStyle: CSSProperties = {
  alignItems: "flex-end",
  display: "flex",
  gap: 8,
  minWidth: 0,
  width: "100%",
};

const articleRelationSelectorFieldStyle: CSSProperties = {
  flex: "1 1 auto",
  minWidth: 0,
};

const articleRelationSelectorTriggerStyle: CSSProperties = {
  minHeight: 36,
};

const mdxToolbarChipListStyle: CSSProperties = {
  marginBottom: 12,
};

type ArticleRelationSelectorFieldProps = {
  createLabel: string;
  emptySearchText: string;
  emptyText: string;
  label: string;
  onChange: (value: string[]) => void;
  onCreate: () => void;
  options: MultiSelectorOptionType[];
  placeholder: string;
  presentation: MultiSelectorPresentation;
  searchPlaceholder: string;
  value: string[];
};

const ArticleRelationSelectorField = ({
  createLabel,
  emptySearchText,
  emptyText,
  label,
  onChange,
  onCreate,
  options,
  placeholder,
  presentation,
  searchPlaceholder,
  value,
}: ArticleRelationSelectorFieldProps) => (
  <div style={articleRelationSelectorRowStyle}>
    <div style={articleRelationSelectorFieldStyle}>
      <MultiSelector
        emptySearchText={emptySearchText}
        emptyText={emptyText}
        hasClear
        hasSearch
        label={label}
        maxBadges={1}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        presentation={presentation}
        searchPlaceholder={searchPlaceholder}
        style={articleRelationSelectorTriggerStyle}
        triggerDisplay="badges"
        value={value}
        width="100%"
      />
    </div>
    <IconButton
      icon={<Plus size={16} />}
      label={createLabel}
      onClick={onCreate}
      size="md"
      tooltip={createLabel}
      variant="secondary"
    />
  </div>
);

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;

const CONTENT_MANAGEMENT_ERROR_KEYS: Record<string, string> = {
  "slug 已存在。": "admin.contentManagement.errors.slugExists",
  "slug 格式无效。": "admin.contentManagement.errors.invalidSlug",
  "仍有关联文章，不能删除。": "admin.contentManagement.errors.taxonomyInUse",
  "分类不存在。": "admin.contentManagement.errors.categoryNotFound",
  "名称不能为空。": "admin.contentManagement.errors.invalidTitle",
  "文章不存在。": "admin.contentManagement.errors.articleNotFound",
  "文章状态无效。": "admin.contentManagement.errors.invalidStatus",
  "标签不存在。": "admin.contentManagement.errors.tagNotFound",
  "贡献者不存在。": "admin.contentManagement.errors.contributorNotFound",
};

const cleanOptionalText = (value: string) => {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
};

const readOptionalText = (value?: string | null) => {
  const trimmedValue = value?.trim();
  return trimmedValue !== undefined && trimmedValue.length > 0 ? trimmedValue : undefined;
};

const readFirstText = (values: ReadonlyArray<string | null | undefined>, fallback: string) =>
  values.map(readOptionalText).find((value) => value !== undefined) ?? fallback;

const normalizeTagColor = (color: string) => {
  const trimmedColor = color.trim();
  return HEX_COLOR_PATTERN.test(trimmedColor) ? trimmedColor : DEFAULT_TAG_COLOR;
};

const toColorInputValue = (color: string) => {
  const normalizedColor = normalizeTagColor(color);
  if (normalizedColor.length === 4) {
    const red = normalizedColor[1] ?? "0";
    const green = normalizedColor[2] ?? "0";
    const blue = normalizedColor[3] ?? "0";
    return `#${red}${red}${green}${green}${blue}${blue}`;
  }

  return normalizedColor;
};

const createEmptyArticleForm = (): ArticleFormState => ({
  categoryIds: [],
  contentMdx: "",
  contentMdxEn: "",
  contributorIds: [],
  coverImageUrl: "",
  isPinned: false,
  publishedAt: "",
  scheduledPublishAt: "",
  slug: "",
  status: "draft",
  summary: "",
  summaryEn: "",
  tagIds: [],
  title: "",
  titleEn: "",
});

const createArticleForm = (article: ArticleContent): ArticleFormState => ({
  categoryIds: article.categories.map((category) => category.id),
  contentMdx: article.localizations.zhCN.contentMdx,
  contentMdxEn: article.localizations.en.contentMdx,
  contributorIds: article.contributors.map((contributor) => contributor.id),
  coverImageUrl: article.coverImageUrl ?? "",
  isPinned: article.isPinned,
  publishedAt: article.publishedAt ?? "",
  scheduledPublishAt: article.scheduledPublishAt ?? "",
  slug: article.slug,
  status: article.status,
  summary: article.localizations.zhCN.summary,
  summaryEn: article.localizations.en.summary,
  tagIds: article.tags.map((tag) => tag.id),
  title: article.localizations.zhCN.title,
  titleEn: article.localizations.en.title,
});

const createEmptyTaxonomyForm = (): TaxonomyFormState => ({
  color: "",
  description: "",
  descriptionEn: "",
  name: "",
  nameEn: "",
  slug: "",
});

const createEmptyContributorForm = (): ContributorFormState => ({
  avatarUrl: "",
  linkUrl: "",
  name: "",
});

const createContributorForm = (contributor: ArticleContributor): ContributorFormState => ({
  avatarUrl: contributor.avatarUrl ?? "",
  linkUrl: contributor.linkUrl ?? "",
  name: contributor.name,
});

const createCategoryForm = (category: ArticleCategory): TaxonomyFormState => ({
  color: DEFAULT_TAG_COLOR,
  description: category.localizations.zhCN.description,
  descriptionEn: category.localizations.en.description,
  name: category.localizations.zhCN.name,
  nameEn: category.localizations.en.name,
  slug: category.slug,
});

const createTagForm = (tag: ArticleTag): TaxonomyFormState => ({
  color: tag.color ?? DEFAULT_TAG_COLOR,
  description: tag.localizations.zhCN.description,
  descriptionEn: tag.localizations.en.description,
  name: tag.localizations.zhCN.name,
  nameEn: tag.localizations.en.name,
  slug: tag.slug,
});

const readArticlePayload = async ({
  authToken,
  coverFile,
  form,
}: {
  authToken: string;
  coverFile?: File;
  form: ArticleFormState;
}): Promise<ArticleContentPayload> => {
  const coverImageUrl =
    coverFile === undefined
      ? cleanOptionalText(form.coverImageUrl)
      : (
          await uploadMediaAsset({
            file: coverFile,
            fileName: coverFile.name,
            folderSlug: "article-covers",
            token: authToken,
          })
        ).accessUrl;

  return {
    categoryIds: form.categoryIds,
    contentMdx: form.contentMdx.trim(),
    contributorIds: form.contributorIds,
    coverImageUrl,
    isPinned: form.isPinned,
    localizations: {
      en: {
        contentMdx: cleanOptionalText(form.contentMdxEn) ?? undefined,
        summary: cleanOptionalText(form.summaryEn) ?? undefined,
        title: cleanOptionalText(form.titleEn) ?? undefined,
      },
    },
    publishedAt: cleanOptionalText(form.publishedAt),
    scheduledPublishAt: cleanOptionalText(form.scheduledPublishAt),
    slug: form.slug.trim(),
    status: form.status,
    summary: cleanOptionalText(form.summary),
    tagIds: form.tagIds,
    title: form.title.trim(),
  };
};

const readCategoryPayload = (form: TaxonomyFormState): ArticleCategoryPayload => ({
  description: cleanOptionalText(form.description),
  localizations: {
    en: {
      description: cleanOptionalText(form.descriptionEn) ?? undefined,
      name: cleanOptionalText(form.nameEn) ?? undefined,
    },
  },
  name: form.name.trim(),
  slug: form.slug.trim(),
});

const readTagPayload = (form: TaxonomyFormState): ArticleTagPayload => ({
  ...readCategoryPayload(form),
  color: cleanOptionalText(form.color),
});

const readContributorPayload = async ({
  authToken,
  avatarFile,
  form,
}: {
  authToken: string;
  avatarFile?: File;
  form: ContributorFormState;
}): Promise<ArticleContributorPayload> => {
  const avatarUrl =
    avatarFile === undefined
      ? cleanOptionalText(form.avatarUrl)
      : (
          await uploadMediaAsset({
            file: avatarFile,
            fileName: avatarFile.name,
            folderSlug: "avatars",
            token: authToken,
          })
        ).accessUrl;

  return {
    avatarUrl,
    linkUrl: cleanOptionalText(form.linkUrl),
    name: form.name.trim(),
  };
};

const getArticleStatusBadgeVariant = (status: ArticleStatus) => {
  switch (status) {
    case "draft":
      return "neutral";
    case "published":
      return "success";
    case "scheduled":
      return "pink";
    default: {
      const exhaustiveStatus: never = status;
      return exhaustiveStatus;
    }
  }
};

const compareText = (left: string, right: string) => left.localeCompare(right, "zh-CN");

const compareDate = (left: string, right: string) =>
  new Date(left).getTime() - new Date(right).getTime();

const getTaxonomyName = ({
  fallback,
  language,
  taxonomy,
}: {
  fallback: string;
  language: AppLanguage;
  taxonomy: ArticleCategory | ArticleRelation | ArticleTag;
}) => {
  if (language === "en") {
    return readFirstText([taxonomy.localizations.en.name, taxonomy.name], fallback);
  }

  return readFirstText(
    [taxonomy.name, taxonomy.localizations.zhCN.name, taxonomy.localizations.en.name],
    fallback,
  );
};

const getTaxonomyDescription = ({
  fallback,
  language,
  taxonomy,
}: {
  fallback: string;
  language: AppLanguage;
  taxonomy: ArticleCategory | ArticleTag;
}) => {
  if (language === "en") {
    return readFirstText(
      [
        taxonomy.localizations.en.description,
        taxonomy.description,
        taxonomy.localizations.zhCN.description,
      ],
      fallback,
    );
  }

  return readFirstText(
    [
      taxonomy.description,
      taxonomy.localizations.zhCN.description,
      taxonomy.localizations.en.description,
    ],
    fallback,
  );
};

const getArticleTitle = ({
  article,
  fallback,
  language,
}: {
  article: ArticleContent;
  fallback: string;
  language: AppLanguage;
}) => {
  if (language === "en") {
    return readFirstText([article.localizations.en.title, article.title], fallback);
  }

  return readFirstText(
    [article.title, article.localizations.zhCN.title, article.localizations.en.title],
    fallback,
  );
};

const getArticleRelationText = ({
  fallback,
  language,
  relations,
}: {
  fallback: string;
  language: AppLanguage;
  relations: ReadonlyArray<ArticleContributorRelation | ArticleRelation>;
}) =>
  relations.length > 0
    ? relations
        .map((relation) =>
          "localizations" in relation
            ? getTaxonomyName({ fallback, language, taxonomy: relation })
            : relation.name,
        )
        .join(" / ")
    : fallback;

const getCommentAuthorName = (comment: CommentItem) =>
  comment.author.name ?? comment.author.username;

const getCommentLocation = ({ comment, fallback }: { comment: CommentItem; fallback: string }) =>
  comment.location ?? fallback;

const createArticleRow = ({
  article,
  fallback,
  language,
}: {
  article: ArticleContent;
  fallback: string;
  language: AppLanguage;
}): ArticleTableRow => ({
  ...article,
  categoryText: getArticleRelationText({ fallback, language, relations: article.categories }),
  contributorText: getArticleRelationText({ fallback, language, relations: article.contributors }),
  tagText: getArticleRelationText({ fallback, language, relations: article.tags }),
  titleText: getArticleTitle({ article, fallback, language }),
});

const createCategoryRow = ({
  category,
  fallback,
  language,
}: {
  category: ArticleCategory;
  fallback: string;
  language: AppLanguage;
}): CategoryTableRow => ({
  ...category,
  descriptionText: getTaxonomyDescription({ fallback, language, taxonomy: category }),
  nameText: getTaxonomyName({ fallback, language, taxonomy: category }),
});

const createTagRow = ({
  fallback,
  language,
  tag,
}: {
  fallback: string;
  language: AppLanguage;
  tag: ArticleTag;
}): TagTableRow => ({
  ...tag,
  descriptionText: getTaxonomyDescription({ fallback, language, taxonomy: tag }),
  nameText: getTaxonomyName({ fallback, language, taxonomy: tag }),
});

const createContributorRow = ({
  contributor,
  fallback,
}: {
  contributor: ArticleContributor;
  fallback: string;
}): ContributorTableRow => ({
  ...contributor,
  linkText: contributor.linkUrl ?? fallback,
  nameText: contributor.name,
});

const createCommentRow = ({
  comment,
  fallback,
}: {
  comment: CommentItem;
  fallback: string;
}): CommentTableRow => ({
  ...comment,
  articleText: comment.articleTitle ?? fallback,
  authorText: getCommentAuthorName(comment),
});

type SummaryCardProps = {
  description: string;
  icon: ReactNode;
  label: string;
  value: number | string;
};

const SummaryCard = ({ description, icon, label, value }: SummaryCardProps) => (
  <Card padding={4}>
    <VStack gap={3}>
      <HStack gap={2} vAlign="center">
        <span style={summaryIconStyle}>{icon}</span>
        <Text color="secondary" type="label">
          {label}
        </Text>
      </HStack>
      <Heading level={3} style={summaryValueStyle}>
        {value}
      </Heading>
      <Text color="secondary" type="supporting">
        {description}
      </Text>
    </VStack>
  </Card>
);

type RowActionItem = {
  icon: ReactNode;
  id: string;
  isDisabled?: boolean;
  label: string;
  onClick: () => void;
  variant?: "destructive";
};

type RowActionsCellProps = {
  isNarrow: boolean;
  items: RowActionItem[];
  label: string;
};

const RowActionsCell = ({ isNarrow, items, label }: RowActionsCellProps) => {
  if (isNarrow) {
    return (
      <div style={actionsCellStyle}>
        <MoreMenu
          alignment="end"
          className="admin-list-actions-menu"
          icon={<MoreHorizontal size={16} />}
          items={items.map((item) => ({
            icon: item.icon,
            id: item.id,
            isDisabled: item.isDisabled,
            label: item.label,
            onClick: item.onClick,
            variant: item.variant,
          }))}
          label={label}
          presentation="adaptive"
        />
      </div>
    );
  }

  return (
    <HStack gap={1} hAlign="center" style={actionsCellStyle}>
      {items.map((item) => (
        <AdminActionTooltip key={item.id} label={item.label}>
          <IconButton
            icon={item.icon}
            isDisabled={item.isDisabled}
            label={item.label}
            onClick={item.onClick}
            size="sm"
            variant="ghost"
          />
        </AdminActionTooltip>
      ))}
    </HStack>
  );
};

type TagColorFieldProps = {
  onChange: (color: string) => void;
  value: string;
};

const TagColorField = ({ onChange, value }: TagColorFieldProps) => {
  const { t } = useTranslation();
  const selectedColor = normalizeTagColor(value);

  return (
    <VStack gap={2}>
      <Text type="label">{t("admin.contentManagement.fields.color")}</Text>
      <HStack gap={2} vAlign="end" wrap="wrap">
        <input
          aria-label={t("admin.contentManagement.fields.color")}
          onChange={(event) => onChange(event.currentTarget.value)}
          style={tagColorInputStyle}
          type="color"
          value={toColorInputValue(value)}
        />
        <TextInput
          label={t("admin.contentManagement.fields.hexColor")}
          onChange={onChange}
          placeholder={DEFAULT_TAG_COLOR}
          startIcon={<Palette size={16} />}
          value={value}
        />
      </HStack>
      <HStack gap={1} wrap="wrap">
        {TAG_COLOR_OPTIONS.map((color) => (
          <button
            aria-label={t("admin.contentManagement.fields.selectColor", { color })}
            key={color}
            onClick={() => onChange(color)}
            style={{
              ...tagColorSwatchButtonStyle,
              backgroundColor: color,
              boxShadow:
                selectedColor.toLowerCase() === color
                  ? "0 0 0 2px var(--color-background-card), 0 0 0 4px var(--color-accent)"
                  : "none",
            }}
            type="button"
          />
        ))}
      </HStack>
    </VStack>
  );
};

export function ContentManagementPage({
  authToken,
  initialView,
  isNarrow,
  timeZone,
}: ContentManagementPageProps) {
  const { i18n, t } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const unsetLabel = t("admin.contentManagement.placeholders.unset");
  const noDescriptionLabel = t("admin.contentManagement.placeholders.noDescription");
  const [activeView, setActiveView] = useState<ContentView>(initialView);
  const [articleList, setArticleList] = useState<ArticleContentList>(EMPTY_ARTICLE_LIST);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [commentList, setCommentList] = useState<CommentList>(EMPTY_COMMENT_LIST);
  const [contributors, setContributors] = useState<ArticleContributor[]>([]);
  const [tags, setTags] = useState<ArticleTag[]>([]);
  const [query, setQuery] = useState("");
  const [commentStatusFilter, setCommentStatusFilter] = useState<CommentStatus | "all">("all");
  const [includeDeletedComments, setIncludeDeletedComments] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>();
  const [articleEditorState, setArticleEditorState] = useState<ArticleEditorState>();
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>();
  const [feedbackBanner, setFeedbackBanner] = useState<AdminFeedbackBannerState>();
  const [articleForm, setArticleForm] = useState<ArticleFormState>(() => createEmptyArticleForm());
  const [contributorForm, setContributorForm] = useState<ContributorFormState>(() =>
    createEmptyContributorForm(),
  );
  const [taxonomyForm, setTaxonomyForm] = useState<TaxonomyFormState>(() =>
    createEmptyTaxonomyForm(),
  );
  const [contributorAvatarFile, setContributorAvatarFile] = useState<File | undefined>(undefined);
  const [coverFile, setCoverFile] = useState<File | undefined>(undefined);
  const isArticleView = activeView === "articles";
  const isCommentsView = activeView === "comments";
  const titleByView: Record<ContentView, string> = {
    articles: t("admin.contentManagement.views.articles"),
    categories: t("admin.contentManagement.views.categories"),
    comments: t("admin.contentManagement.views.comments"),
    contributors: t("admin.contentManagement.views.contributors"),
    tags: t("admin.contentManagement.views.tags"),
  };
  const articleCount = articleList.pageInfo.totalItems;
  const categoryCount = categories.length;
  const commentCount = commentList.pageInfo.totalItems;
  const contributorCount = contributors.length;
  const tagCount = tags.length;
  const articleRows = useMemo<ArticleTableRow[]>(
    () =>
      articleList.items.map((article) =>
        createArticleRow({ article, fallback: unsetLabel, language }),
      ),
    [articleList.items, language, unsetLabel],
  );
  const categoryRows = useMemo<CategoryTableRow[]>(
    () =>
      categories.map((category) =>
        createCategoryRow({ category, fallback: noDescriptionLabel, language }),
      ),
    [categories, language, noDescriptionLabel],
  );
  const tagRows = useMemo<TagTableRow[]>(
    () => tags.map((tag) => createTagRow({ fallback: noDescriptionLabel, language, tag })),
    [language, noDescriptionLabel, tags],
  );
  const contributorRows = useMemo<ContributorTableRow[]>(
    () =>
      contributors.map((contributor) =>
        createContributorRow({ contributor, fallback: unsetLabel }),
      ),
    [contributors, unsetLabel],
  );
  const commentRows = useMemo<CommentTableRow[]>(
    () =>
      commentList.items.map((comment) =>
        createCommentRow({
          comment,
          fallback: t("admin.contentManagement.placeholders.unlinkedArticle"),
        }),
      ),
    [commentList.items, t],
  );
  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        description: category.slug,
        label: getTaxonomyName({ fallback: unsetLabel, language, taxonomy: category }),
        value: category.id,
      })),
    [categories, language, unsetLabel],
  );
  const tagOptions = useMemo(
    () =>
      tags.map((tag) => ({
        description: tag.slug,
        icon: (
          <span
            aria-hidden="true"
            style={{
              ...taxonomyColorStyle,
              backgroundColor: normalizeTagColor(tag.color ?? DEFAULT_TAG_COLOR),
            }}
          />
        ),
        label: getTaxonomyName({ fallback: unsetLabel, language, taxonomy: tag }),
        value: tag.id,
      })),
    [language, tags, unsetLabel],
  );
  const contributorOptions = useMemo(
    () =>
      contributors.map((contributor) => {
        const avatarUrl = contributor.avatarUrl?.trim();

        return {
          description: contributor.linkUrl ?? undefined,
          icon:
            avatarUrl === undefined || avatarUrl.length === 0 ? (
              <UserRound size={14} />
            ) : (
              <Avatar name={contributor.name} size="sm" src={resolveAdminAssetUrl(avatarUrl)} />
            ),
          label: contributor.name,
          value: contributor.id,
        };
      }),
    [contributors],
  );
  const articleStatusOptions = useMemo(
    () =>
      STATUS_VALUES.map((status) => ({
        label:
          status === "all"
            ? t("admin.contentManagement.statusFilters.all")
            : t(`admin.contentManagement.articleStatuses.${status}`),
        value: status,
      })),
    [t],
  );
  const articleEditorStatusOptions = useMemo(
    () =>
      ARTICLE_STATUS_VALUES.map((status) => ({
        label: t(`admin.contentManagement.articleStatuses.${status}`),
        value: status,
      })),
    [t],
  );
  const commentStatusOptions = useMemo(
    () =>
      COMMENT_STATUS_VALUES.map((status) => ({
        label:
          status === "all"
            ? t("admin.contentManagement.commentStatusFilters.all")
            : t(`admin.contentManagement.commentStatuses.${status}`),
        value: status,
      })),
    [t],
  );
  const getArticleStatusLabel = useCallback(
    (status: ArticleStatus) => t(`admin.contentManagement.articleStatuses.${status}`),
    [t],
  );
  const getCommentStatusLabel = useCallback(
    (status: CommentStatus) => t(`admin.contentManagement.commentStatuses.${status}`),
    [t],
  );
  const { sortConfig: articleSortConfig, sortedData: sortedArticleRows } = useTableSortableState<
    ArticleTableRow,
    ArticleSortKey
  >({
    allowUnsortedState: false,
    comparators: {
      categoryText: (left, right) => compareText(left.categoryText, right.categoryText),
      commentCount: (left, right) => left.commentCount - right.commentCount,
      contributorText: (left, right) => compareText(left.contributorText, right.contributorText),
      readCount: (left, right) => left.readCount - right.readCount,
      status: (left, right) =>
        compareText(getArticleStatusLabel(left.status), getArticleStatusLabel(right.status)),
      tagText: (left, right) => compareText(left.tagText, right.tagText),
      titleText: (left, right) => compareText(left.titleText, right.titleText),
      updatedAt: (left, right) => compareDate(left.updatedAt, right.updatedAt),
    },
    data: articleRows,
    defaultSort: [{ direction: "descending", sortKey: "updatedAt" }],
  });
  const { sortConfig: categorySortConfig, sortedData: sortedCategoryRows } = useTableSortableState<
    CategoryTableRow,
    CategorySortKey
  >({
    allowUnsortedState: false,
    comparators: {
      articleCount: (left, right) => left.articleCount - right.articleCount,
      descriptionText: (left, right) => compareText(left.descriptionText, right.descriptionText),
      nameText: (left, right) => compareText(left.nameText, right.nameText),
      sortOrder: (left, right) => left.sortOrder - right.sortOrder,
      updatedAt: (left, right) => compareDate(left.updatedAt, right.updatedAt),
    },
    data: categoryRows,
    defaultSort: [{ direction: "ascending", sortKey: "sortOrder" }],
  });
  const { sortConfig: tagSortConfig, sortedData: sortedTagRows } = useTableSortableState<
    TagTableRow,
    TagSortKey
  >({
    allowUnsortedState: false,
    comparators: {
      articleCount: (left, right) => left.articleCount - right.articleCount,
      descriptionText: (left, right) => compareText(left.descriptionText, right.descriptionText),
      nameText: (left, right) => compareText(left.nameText, right.nameText),
      updatedAt: (left, right) => compareDate(left.updatedAt, right.updatedAt),
    },
    data: tagRows,
    defaultSort: [{ direction: "descending", sortKey: "articleCount" }],
  });
  const { sortConfig: contributorSortConfig, sortedData: sortedContributorRows } =
    useTableSortableState<ContributorTableRow, ContributorSortKey>({
      allowUnsortedState: false,
      comparators: {
        articleCount: (left, right) => left.articleCount - right.articleCount,
        linkText: (left, right) => compareText(left.linkText, right.linkText),
        nameText: (left, right) => compareText(left.nameText, right.nameText),
        updatedAt: (left, right) => compareDate(left.updatedAt, right.updatedAt),
      },
      data: contributorRows,
      defaultSort: [{ direction: "descending", sortKey: "updatedAt" }],
    });
  const { sortConfig: commentSortConfig, sortedData: sortedCommentRows } = useTableSortableState<
    CommentTableRow,
    CommentSortKey
  >({
    allowUnsortedState: false,
    comparators: {
      articleText: (left, right) => compareText(left.articleText, right.articleText),
      authorText: (left, right) => compareText(left.authorText, right.authorText),
      createdAt: (left, right) => compareDate(left.createdAt, right.createdAt),
      location: (left, right) =>
        compareText(
          getCommentLocation({
            comment: left,
            fallback: t("admin.contentManagement.placeholders.unknownLocation"),
          }),
          getCommentLocation({
            comment: right,
            fallback: t("admin.contentManagement.placeholders.unknownLocation"),
          }),
        ),
      status: (left, right) =>
        compareText(getCommentStatusLabel(left.status), getCommentStatusLabel(right.status)),
    },
    data: commentRows,
    defaultSort: [{ direction: "descending", sortKey: "createdAt" }],
  });
  const articleSortablePlugin = useTableSortable<ArticleTableRow, ArticleSortKey>(
    articleSortConfig,
  );
  const categorySortablePlugin = useTableSortable<CategoryTableRow, CategorySortKey>(
    categorySortConfig,
  );
  const tagSortablePlugin = useTableSortable<TagTableRow, TagSortKey>(tagSortConfig);
  const contributorSortablePlugin = useTableSortable<ContributorTableRow, ContributorSortKey>(
    contributorSortConfig,
  );
  const commentSortablePlugin = useTableSortable<CommentTableRow, CommentSortKey>(
    commentSortConfig,
  );
  const articleStickyColumnsPlugin = useTableStickyColumns<ArticleTableRow>({
    endKeys: ["actions"],
  });
  const categoryStickyColumnsPlugin = useTableStickyColumns<CategoryTableRow>({
    endKeys: ["actions"],
  });
  const tagStickyColumnsPlugin = useTableStickyColumns<TagTableRow>({ endKeys: ["actions"] });
  const contributorStickyColumnsPlugin = useTableStickyColumns<ContributorTableRow>({
    endKeys: ["actions"],
  });
  const commentStickyColumnsPlugin = useTableStickyColumns<CommentTableRow>({
    endKeys: ["actions"],
  });

  const showFeedbackBanner = (title: string, status: "error" | "success" = "success") => {
    setFeedbackBanner(createAdminFeedbackBanner({ status, title }));
  };

  const readContentManagementErrorMessage = useCallback(
    (error: unknown, fallback: string) => {
      const message = getErrorMessage(error, fallback);
      const translationKey = CONTENT_MANAGEMENT_ERROR_KEYS[message];

      return translationKey === undefined ? message : t(translationKey);
    },
    [t],
  );

  const loadContent = useCallback(
    async (options: { preserveFeedbackBanner?: boolean } = {}) => {
      setIsLoading(true);
      if (!options.preserveFeedbackBanner) {
        setFeedbackBanner(undefined);
      }
      try {
        const [nextArticles, nextCategories, nextTags, nextContributors, nextComments] =
          await Promise.all([
            getAdminArticles({
              page,
              pageSize: PAGE_SIZE,
              query,
              sortBy: "updatedAt",
              sortOrder: "desc",
              status: statusFilter,
              token: authToken,
            }),
            getArticleCategories({
              page: 1,
              pageSize: 100,
              query: activeView === "categories" ? query : "",
              token: authToken,
            }),
            getArticleTags({
              page: 1,
              pageSize: 100,
              query: activeView === "tags" ? query : "",
              token: authToken,
            }),
            getArticleContributors({
              page: 1,
              pageSize: 100,
              query: activeView === "contributors" ? query : "",
              token: authToken,
            }),
            getAdminComments({
              includeDeleted: includeDeletedComments,
              page,
              pageSize: PAGE_SIZE,
              query: activeView === "comments" ? query : "",
              sortBy: "createdAt",
              sortOrder: "desc",
              status: commentStatusFilter,
              targetType: "all",
              token: authToken,
            }),
          ]);
        setArticleList(nextArticles);
        setCategories(nextCategories.items);
        setTags(nextTags.items);
        setContributors(nextContributors.items);
        setCommentList(nextComments);
      } catch (error) {
        setFeedbackBanner(
          createAdminFeedbackBanner({
            status: "error",
            title: readContentManagementErrorMessage(
              error,
              t("admin.contentManagement.notices.loadFailed"),
            ),
          }),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      activeView,
      authToken,
      commentStatusFilter,
      includeDeletedComments,
      page,
      query,
      readContentManagementErrorMessage,
      statusFilter,
      t,
    ],
  );

  useEffect(() => {
    setActiveView(initialView);
    setArticleEditorState(undefined);
    setCoverFile(undefined);
    setIsSaving(false);
    setIsDeleting(false);
    setPage(1);
    setQuery("");
  }, [initialView]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const openArticleCreate = () => {
    setArticleForm(createEmptyArticleForm());
    setCoverFile(undefined);
    setArticleEditorState({ mode: "create" });
  };

  const openArticleEdit = (article: ArticleContent) => {
    setArticleForm(createArticleForm(article));
    setCoverFile(undefined);
    setArticleEditorState({ article, mode: "edit" });
  };

  const openCategoryCreate = () => {
    setTaxonomyForm(createEmptyTaxonomyForm());
    setDialogState({ mode: "create", type: "category" });
  };

  const openCategoryEdit = (category: ArticleCategory) => {
    setTaxonomyForm(createCategoryForm(category));
    setDialogState({ category, mode: "edit", type: "category" });
  };

  const openTagCreate = () => {
    setTaxonomyForm(createEmptyTaxonomyForm());
    setDialogState({ mode: "create", type: "tag" });
  };

  const openTagEdit = (tag: ArticleTag) => {
    setTaxonomyForm(createTagForm(tag));
    setDialogState({ mode: "edit", tag, type: "tag" });
  };

  const openContributorCreate = () => {
    setContributorForm(createEmptyContributorForm());
    setContributorAvatarFile(undefined);
    setDialogState({ mode: "create", type: "contributor" });
  };

  const openContributorEdit = (contributor: ArticleContributor) => {
    setContributorForm(createContributorForm(contributor));
    setContributorAvatarFile(undefined);
    setDialogState({ contributor, mode: "edit", type: "contributor" });
  };

  const closeDialog = () => {
    setDialogState(undefined);
    setContributorAvatarFile(undefined);
    setIsSaving(false);
  };

  const closeArticleEditor = () => {
    setArticleEditorState(undefined);
    setCoverFile(undefined);
    setIsSaving(false);
  };

  const appendArticleRelationId = (field: ArticleRelationIdField, id: string) => {
    setArticleForm((current) => {
      if (current[field].includes(id)) {
        return current;
      }

      return {
        ...current,
        [field]: [...current[field], id],
      };
    });
  };

  const uploadArticleMdxImage = useCallback(
    async (file: File) => {
      const asset = await uploadMediaAsset({
        file,
        fileName: file.name,
        folderSlug: "article-covers",
        token: authToken,
      });

      return resolveAdminAssetUrl(asset.accessUrl);
    },
    [authToken],
  );

  const saveArticle = async () => {
    if (articleEditorState === undefined) {
      return;
    }

    if (articleForm.title.trim().length === 0) {
      showFeedbackBanner(t("admin.contentManagement.notices.articleTitleRequired"), "error");
      return;
    }

    const isUpdatingArticle = articleEditorState.mode === "edit";
    setIsSaving(true);
    try {
      const payload = await readArticlePayload({ authToken, coverFile, form: articleForm });
      if (isUpdatingArticle) {
        await updateArticleContent({
          articleId: articleEditorState.article.id,
          payload,
          token: authToken,
        });
      } else {
        await createArticleContent({ payload, token: authToken });
      }
      showFeedbackBanner(
        t(
          isUpdatingArticle
            ? "admin.contentManagement.notices.articleUpdated"
            : "admin.contentManagement.notices.articleCreated",
        ),
      );
      closeArticleEditor();
      await loadContent({ preserveFeedbackBanner: true });
    } catch (error) {
      showFeedbackBanner(
        readContentManagementErrorMessage(
          error,
          t(
            isUpdatingArticle
              ? "admin.contentManagement.notices.articleUpdateFailed"
              : "admin.contentManagement.notices.articleCreateFailed",
          ),
        ),
        "error",
      );
      setIsSaving(false);
    }
  };

  const saveCategory = async () => {
    if (taxonomyForm.name.trim().length === 0) {
      showFeedbackBanner(t("admin.contentManagement.notices.categoryNameRequired"), "error");
      return;
    }

    const isUpdatingCategory = dialogState?.type === "category" && dialogState.mode === "edit";
    setIsSaving(true);
    try {
      const payload = readCategoryPayload(taxonomyForm);
      const savedCategory = isUpdatingCategory
        ? await updateArticleCategory({
            categoryId: dialogState.category.id,
            payload,
            token: authToken,
          })
        : await createArticleCategory({ payload, token: authToken });

      if (!isUpdatingCategory && articleEditorState !== undefined) {
        appendArticleRelationId("categoryIds", savedCategory.id);
      }
      showFeedbackBanner(
        t(
          isUpdatingCategory
            ? "admin.contentManagement.notices.categoryUpdated"
            : "admin.contentManagement.notices.categoryCreated",
        ),
      );
      closeDialog();
      await loadContent({ preserveFeedbackBanner: true });
    } catch (error) {
      showFeedbackBanner(
        readContentManagementErrorMessage(
          error,
          t(
            isUpdatingCategory
              ? "admin.contentManagement.notices.categoryUpdateFailed"
              : "admin.contentManagement.notices.categoryCreateFailed",
          ),
        ),
        "error",
      );
      setIsSaving(false);
    }
  };

  const saveTag = async () => {
    if (taxonomyForm.name.trim().length === 0) {
      showFeedbackBanner(t("admin.contentManagement.notices.tagNameRequired"), "error");
      return;
    }

    const isUpdatingTag = dialogState?.type === "tag" && dialogState.mode === "edit";
    setIsSaving(true);
    try {
      const payload = readTagPayload(taxonomyForm);
      const savedTag = isUpdatingTag
        ? await updateArticleTag({
            payload,
            tagId: dialogState.tag.id,
            token: authToken,
          })
        : await createArticleTag({ payload, token: authToken });

      if (!isUpdatingTag && articleEditorState !== undefined) {
        appendArticleRelationId("tagIds", savedTag.id);
      }
      showFeedbackBanner(
        t(
          isUpdatingTag
            ? "admin.contentManagement.notices.tagUpdated"
            : "admin.contentManagement.notices.tagCreated",
        ),
      );
      closeDialog();
      await loadContent({ preserveFeedbackBanner: true });
    } catch (error) {
      showFeedbackBanner(
        readContentManagementErrorMessage(
          error,
          t(
            isUpdatingTag
              ? "admin.contentManagement.notices.tagUpdateFailed"
              : "admin.contentManagement.notices.tagCreateFailed",
          ),
        ),
        "error",
      );
      setIsSaving(false);
    }
  };

  const saveContributor = async () => {
    if (contributorForm.name.trim().length === 0) {
      showFeedbackBanner(t("admin.contentManagement.notices.contributorNameRequired"), "error");
      return;
    }

    const isUpdatingContributor =
      dialogState?.type === "contributor" && dialogState.mode === "edit";
    setIsSaving(true);
    try {
      const payload = await readContributorPayload({
        authToken,
        avatarFile: contributorAvatarFile,
        form: contributorForm,
      });
      const savedContributor = isUpdatingContributor
        ? await updateArticleContributor({
            contributorId: dialogState.contributor.id,
            payload,
            token: authToken,
          })
        : await createArticleContributor({ payload, token: authToken });

      if (!isUpdatingContributor && articleEditorState !== undefined) {
        appendArticleRelationId("contributorIds", savedContributor.id);
      }
      showFeedbackBanner(
        t(
          isUpdatingContributor
            ? "admin.contentManagement.notices.contributorUpdated"
            : "admin.contentManagement.notices.contributorCreated",
        ),
      );
      closeDialog();
      await loadContent({ preserveFeedbackBanner: true });
    } catch (error) {
      showFeedbackBanner(
        readContentManagementErrorMessage(
          error,
          t(
            isUpdatingContributor
              ? "admin.contentManagement.notices.contributorUpdateFailed"
              : "admin.contentManagement.notices.contributorCreateFailed",
          ),
        ),
        "error",
      );
      setIsSaving(false);
    }
  };

  const updateCommentStatus = async ({
    comment,
    nextStatus,
  }: {
    comment: CommentItem;
    nextStatus: CommentStatus;
  }) => {
    try {
      await reviewAdminComment({
        commentId: comment.id,
        status: nextStatus,
        token: authToken,
      });
      showFeedbackBanner(t("admin.contentManagement.notices.commentUpdated"));
      await loadContent({ preserveFeedbackBanner: true });
    } catch (error) {
      showFeedbackBanner(
        readContentManagementErrorMessage(
          error,
          t("admin.contentManagement.notices.commentUpdateFailed"),
        ),
        "error",
      );
    }
  };

  const confirmDelete = async () => {
    if (deleteTarget === undefined) {
      return;
    }

    const target = deleteTarget;
    setIsDeleting(true);
    try {
      if (target.type === "article") {
        await deleteArticleContent({ articleId: target.id, token: authToken });
      } else if (target.type === "category") {
        await deleteArticleCategory({ categoryId: target.id, token: authToken });
      } else if (target.type === "contributor") {
        await deleteArticleContributor({ contributorId: target.id, token: authToken });
      } else if (target.type === "comment") {
        await deleteAdminComment({ commentId: target.id, token: authToken });
      } else {
        await deleteArticleTag({ tagId: target.id, token: authToken });
      }
      showFeedbackBanner(t(`admin.contentManagement.notices.${target.type}Deleted`));
      setDeleteTarget(undefined);
      await loadContent({ preserveFeedbackBanner: true });
    } catch (error) {
      showFeedbackBanner(
        readContentManagementErrorMessage(
          error,
          t(`admin.contentManagement.notices.${target.type}DeleteFailed`),
        ),
        "error",
      );
      setDeleteTarget(undefined);
    } finally {
      setIsDeleting(false);
    }
  };

  const articleColumns = useMemo<TableColumn<ArticleTableRow>[]>(
    () => [
      {
        align: "center",
        key: "titleText",
        header: t("admin.contentManagement.columns.article"),
        sortable: true,
        width: pixel(isNarrow ? 300 : 420),
        renderCell: (article) => {
          const coverUrl = article.coverImageUrl?.trim();
          const articleTitle = getArticleTitle({ article, fallback: unsetLabel, language });

          return (
            <HStack gap={3} hAlign="center" vAlign="center" style={tableIdentityStyle}>
              {coverUrl === undefined || coverUrl.length === 0 ? (
                <Badge icon={<FileText size={14} />} label="MDX" variant="neutral" />
              ) : (
                <img
                  alt={articleTitle}
                  src={resolveAdminAssetUrl(coverUrl)}
                  style={articleCoverStyle}
                />
              )}
              <VStack gap={0} style={tableIdentityTextStyle}>
                <Text maxLines={1} type="body" weight="semibold">
                  {articleTitle}
                </Text>
                <Text color="secondary" maxLines={1} type="supporting">
                  {article.slug}
                </Text>
              </VStack>
            </HStack>
          );
        },
      },
      {
        align: "center",
        key: "status",
        header: t("admin.contentManagement.columns.status"),
        sortable: true,
        width: pixel(120),
        renderCell: (article) => (
          <HStack gap={1} hAlign="center" wrap="wrap">
            <Badge
              label={getArticleStatusLabel(article.status)}
              variant={getArticleStatusBadgeVariant(article.status)}
            />
            {article.isPinned ? (
              <Badge label={t("admin.contentManagement.articleStatuses.pinned")} variant="pink" />
            ) : null}
          </HStack>
        ),
      },
      {
        align: "center",
        key: "categoryText",
        header: t("admin.contentManagement.columns.category"),
        sortable: true,
        width: pixel(180),
        renderCell: (article) => (
          <Text maxLines={2} type="body">
            {article.categoryText}
          </Text>
        ),
      },
      {
        align: "center",
        key: "tagText",
        header: t("admin.contentManagement.columns.tags"),
        sortable: true,
        width: pixel(220),
        renderCell: (article) => (
          <HStack gap={1} hAlign="center" wrap="wrap">
            {article.tags.length === 0 ? (
              <Text color="secondary" type="supporting">
                {unsetLabel}
              </Text>
            ) : (
              article.tags.slice(0, 3).map((tag) => (
                <Badge
                  key={tag.id}
                  label={getTaxonomyName({ fallback: unsetLabel, language, taxonomy: tag })}
                  variant="neutral"
                  icon={
                    <span
                      style={{
                        ...taxonomyColorStyle,
                        background: tag.color ?? DEFAULT_TAG_COLOR,
                      }}
                    />
                  }
                />
              ))
            )}
          </HStack>
        ),
      },
      {
        align: "center",
        key: "contributorText",
        header: t("admin.contentManagement.columns.contributors"),
        sortable: true,
        width: pixel(180),
        renderCell: (article) => (
          <Text maxLines={2} type="body">
            {article.contributorText}
          </Text>
        ),
      },
      {
        align: "center",
        key: "readCount",
        header: t("admin.contentManagement.columns.readCount"),
        sortable: true,
        width: pixel(96),
        renderCell: (article) => <Text type="body">{article.readCount}</Text>,
      },
      {
        align: "center",
        key: "commentCount",
        header: t("admin.contentManagement.columns.comments"),
        sortable: true,
        width: pixel(96),
        renderCell: (article) => <Text type="body">{article.commentCount}</Text>,
      },
      {
        align: "center",
        key: "updatedAt",
        header: t("admin.contentManagement.columns.updatedAt"),
        sortable: true,
        width: pixel(180),
        renderCell: (article) => (
          <Text maxLines={1} type="body">
            {formatDateTimeInTimeZone({
              language,
              timeZone,
              value: article.updatedAt,
            })}
          </Text>
        ),
      },
      {
        align: "center",
        key: "actions",
        header: t("admin.contentManagement.columns.actions"),
        resizable: false,
        width: pixel(isNarrow ? 72 : 128),
        renderCell: (article) => (
          <RowActionsCell
            isNarrow={isNarrow}
            label={t("admin.contentManagement.actions.postActions")}
            items={[
              {
                icon: <Eye size={16} />,
                id: "view",
                label: t("admin.contentManagement.actions.view"),
                onClick: () => {
                  window.open(
                    `/articles/${encodeURIComponent(article.slug)}`,
                    "_blank",
                    "noopener,noreferrer",
                  );
                },
              },
              {
                icon: <Pencil size={16} />,
                id: "edit",
                label: t("admin.contentManagement.actions.edit"),
                onClick: () => openArticleEdit(article),
              },
              {
                icon: <Trash2 size={16} />,
                id: "delete",
                label: t("admin.contentManagement.actions.delete"),
                onClick: () =>
                  setDeleteTarget({
                    id: article.id,
                    label: article.title,
                    type: "article",
                  }),
                variant: "destructive",
              },
            ]}
          />
        ),
      },
    ],
    [isNarrow, t, timeZone],
  );

  const categoryColumns = useMemo<TableColumn<CategoryTableRow>[]>(
    () => [
      {
        align: "center",
        key: "nameText",
        header: t("admin.contentManagement.columns.category"),
        sortable: true,
        width: pixel(260),
        renderCell: (category) => (
          <VStack gap={0} style={tableCenteredStackStyle}>
            <Text maxLines={1} type="body" weight="semibold">
              {category.nameText}
            </Text>
            <Text color="secondary" maxLines={1} type="supporting">
              {category.slug}
            </Text>
          </VStack>
        ),
      },
      {
        align: "center",
        key: "descriptionText",
        header: t("admin.contentManagement.columns.description"),
        sortable: true,
        width: pixel(320),
        renderCell: (category) => (
          <Text
            color={category.descriptionText.length === 0 ? "secondary" : undefined}
            maxLines={2}
            style={tableCenteredTextStyle}
            type="body"
          >
            {category.descriptionText}
          </Text>
        ),
      },
      {
        align: "center",
        key: "articleCount",
        header: t("admin.contentManagement.columns.articles"),
        sortable: true,
        width: pixel(110),
        renderCell: (category) => (
          <Badge
            label={t("admin.contentManagement.counts.article", { count: category.articleCount })}
            variant="neutral"
          />
        ),
      },
      {
        align: "center",
        key: "sortOrder",
        header: t("admin.contentManagement.columns.sortOrder"),
        sortable: true,
        width: pixel(100),
        renderCell: (category) => <Text type="body">{category.sortOrder}</Text>,
      },
      {
        align: "center",
        key: "updatedAt",
        header: t("admin.contentManagement.columns.updatedAt"),
        sortable: true,
        width: pixel(180),
        renderCell: (category) => (
          <Text maxLines={1} type="body">
            {formatDateTimeInTimeZone({
              language,
              timeZone,
              value: category.updatedAt,
            })}
          </Text>
        ),
      },
      {
        align: "center",
        key: "actions",
        header: t("admin.contentManagement.columns.actions"),
        resizable: false,
        width: pixel(isNarrow ? 72 : 112),
        renderCell: (category) => (
          <RowActionsCell
            isNarrow={isNarrow}
            label={t("admin.contentManagement.actions.categoryActions")}
            items={[
              {
                icon: <Pencil size={16} />,
                id: "edit",
                label: t("admin.contentManagement.actions.edit"),
                onClick: () => openCategoryEdit(category),
              },
              {
                icon: <Trash2 size={16} />,
                id: "delete",
                label: t("admin.contentManagement.actions.delete"),
                onClick: () =>
                  setDeleteTarget({
                    id: category.id,
                    label: category.name,
                    type: "category",
                  }),
                variant: "destructive",
              },
            ]}
          />
        ),
      },
    ],
    [isNarrow, t, timeZone],
  );

  const tagColumns = useMemo<TableColumn<TagTableRow>[]>(
    () => [
      {
        align: "center",
        key: "nameText",
        header: t("admin.contentManagement.columns.tags"),
        sortable: true,
        width: pixel(260),
        renderCell: (tag) => (
          <HStack gap={2} hAlign="center" vAlign="center">
            <span style={{ ...taxonomyColorStyle, background: tag.color ?? DEFAULT_TAG_COLOR }} />
            <VStack gap={0} style={tableCenteredStackStyle}>
              <Text maxLines={1} type="body" weight="semibold">
                {tag.nameText}
              </Text>
              <Text color="secondary" maxLines={1} type="supporting">
                {tag.slug}
              </Text>
            </VStack>
          </HStack>
        ),
      },
      {
        align: "center",
        key: "descriptionText",
        header: t("admin.contentManagement.columns.description"),
        sortable: true,
        width: pixel(320),
        renderCell: (tag) => (
          <Text
            color={tag.descriptionText.length === 0 ? "secondary" : undefined}
            maxLines={2}
            style={tableCenteredTextStyle}
            type="body"
          >
            {tag.descriptionText}
          </Text>
        ),
      },
      {
        align: "center",
        key: "articleCount",
        header: t("admin.contentManagement.columns.articles"),
        sortable: true,
        width: pixel(110),
        renderCell: (tag) => (
          <Badge
            label={t("admin.contentManagement.counts.article", { count: tag.articleCount })}
            variant="neutral"
          />
        ),
      },
      {
        align: "center",
        key: "updatedAt",
        header: t("admin.contentManagement.columns.updatedAt"),
        sortable: true,
        width: pixel(180),
        renderCell: (tag) => (
          <Text maxLines={1} type="body">
            {formatDateTimeInTimeZone({
              language,
              timeZone,
              value: tag.updatedAt,
            })}
          </Text>
        ),
      },
      {
        align: "center",
        key: "actions",
        header: t("admin.contentManagement.columns.actions"),
        resizable: false,
        width: pixel(isNarrow ? 72 : 112),
        renderCell: (tag) => (
          <RowActionsCell
            isNarrow={isNarrow}
            label={t("admin.contentManagement.actions.tagActions")}
            items={[
              {
                icon: <Pencil size={16} />,
                id: "edit",
                label: t("admin.contentManagement.actions.edit"),
                onClick: () => openTagEdit(tag),
              },
              {
                icon: <Trash2 size={16} />,
                id: "delete",
                label: t("admin.contentManagement.actions.delete"),
                onClick: () =>
                  setDeleteTarget({
                    id: tag.id,
                    label: tag.name,
                    type: "tag",
                  }),
                variant: "destructive",
              },
            ]}
          />
        ),
      },
    ],
    [isNarrow, t, timeZone],
  );

  const contributorColumns = useMemo<TableColumn<ContributorTableRow>[]>(
    () => [
      {
        align: "center",
        key: "nameText",
        header: t("admin.contentManagement.columns.contributors"),
        sortable: true,
        width: pixel(280),
        renderCell: (contributor) => {
          const avatarUrl =
            contributor.avatarUrl === null
              ? undefined
              : resolveAdminAssetUrl(contributor.avatarUrl);

          return (
            <HStack gap={3} hAlign="center" vAlign="center" style={tableIdentityStyle}>
              <Avatar name={contributor.name} size="sm" src={avatarUrl} />
              <VStack gap={0} style={tableIdentityTextStyle}>
                <Text maxLines={1} type="body" weight="semibold">
                  {contributor.name}
                </Text>
                <Text color="secondary" maxLines={1} type="supporting">
                  {contributor.linkText}
                </Text>
              </VStack>
            </HStack>
          );
        },
      },
      {
        align: "center",
        key: "articleCount",
        header: t("admin.contentManagement.columns.articles"),
        sortable: true,
        width: pixel(110),
        renderCell: (contributor) => (
          <Badge
            label={t("admin.contentManagement.counts.article", { count: contributor.articleCount })}
            variant="neutral"
          />
        ),
      },
      {
        align: "center",
        key: "updatedAt",
        header: t("admin.contentManagement.columns.updatedAt"),
        sortable: true,
        width: pixel(180),
        renderCell: (contributor) => (
          <Text maxLines={1} type="body">
            {formatDateTimeInTimeZone({
              language,
              timeZone,
              value: contributor.updatedAt,
            })}
          </Text>
        ),
      },
      {
        align: "center",
        key: "actions",
        header: t("admin.contentManagement.columns.actions"),
        resizable: false,
        width: pixel(isNarrow ? 72 : 144),
        renderCell: (contributor) => (
          <RowActionsCell
            isNarrow={isNarrow}
            label={t("admin.contentManagement.actions.contributorActions")}
            items={[
              {
                icon: <ExternalLink size={16} />,
                id: "open",
                isDisabled: contributor.linkUrl === null,
                label: t("admin.contentManagement.actions.openLink"),
                onClick: () => {
                  if (contributor.linkUrl !== null) {
                    window.open(contributor.linkUrl, "_blank", "noopener,noreferrer");
                  }
                },
              },
              {
                icon: <Pencil size={16} />,
                id: "edit",
                label: t("admin.contentManagement.actions.edit"),
                onClick: () => openContributorEdit(contributor),
              },
              {
                icon: <Trash2 size={16} />,
                id: "delete",
                label: t("admin.contentManagement.actions.delete"),
                onClick: () =>
                  setDeleteTarget({
                    id: contributor.id,
                    label: contributor.name,
                    type: "contributor",
                  }),
                variant: "destructive",
              },
            ]}
          />
        ),
      },
    ],
    [isNarrow, t, timeZone],
  );

  const commentColumns = useMemo<TableColumn<CommentTableRow>[]>(
    () => [
      {
        align: "center",
        key: "authorText",
        header: t("admin.contentManagement.columns.commenter"),
        sortable: true,
        width: pixel(240),
        renderCell: (comment) => {
          const avatarUrl =
            comment.author.avatarUrl === null
              ? undefined
              : resolveAdminAssetUrl(comment.author.avatarUrl);

          return (
            <HStack gap={3} hAlign="center" vAlign="center" style={tableIdentityStyle}>
              <Avatar name={comment.authorText} size="sm" src={avatarUrl} />
              <VStack gap={0} style={tableIdentityTextStyle}>
                <Text maxLines={1} type="body" weight="semibold">
                  {comment.authorText}
                </Text>
                <Text color="secondary" maxLines={1} type="supporting">
                  @{comment.author.username}
                </Text>
              </VStack>
            </HStack>
          );
        },
      },
      {
        align: "center",
        key: "content",
        header: t("admin.contentManagement.columns.content"),
        width: pixel(isNarrow ? 300 : 420),
        renderCell: (comment) => (
          <Text maxLines={2} style={tableCenteredTextStyle} type="body">
            {comment.content}
          </Text>
        ),
      },
      {
        align: "center",
        key: "articleText",
        header: t("admin.contentManagement.columns.source"),
        sortable: true,
        width: pixel(190),
        renderCell: (comment) => (
          <Badge icon={<FileText size={14} />} label={comment.articleText} />
        ),
      },
      {
        align: "center",
        key: "status",
        header: t("admin.contentManagement.columns.status"),
        sortable: true,
        width: pixel(120),
        renderCell: (comment) => {
          const variant = COMMENT_STATUS_BADGE_VARIANTS[comment.status];

          return <Badge label={getCommentStatusLabel(comment.status)} variant={variant} />;
        },
      },
      {
        align: "center",
        key: "location",
        header: t("admin.contentManagement.columns.location"),
        sortable: true,
        width: pixel(140),
        renderCell: (comment) => (
          <Text maxLines={1} type="body">
            {getCommentLocation({
              comment,
              fallback: t("admin.contentManagement.placeholders.unknownLocation"),
            })}
          </Text>
        ),
      },
      {
        align: "center",
        key: "createdAt",
        header: t("admin.contentManagement.columns.createdAt"),
        sortable: true,
        width: pixel(180),
        renderCell: (comment) => (
          <Text maxLines={1} type="body">
            {formatDateTimeInTimeZone({
              language,
              timeZone,
              value: comment.createdAt,
            })}
          </Text>
        ),
      },
      {
        align: "center",
        key: "actions",
        header: t("admin.contentManagement.columns.actions"),
        resizable: false,
        width: pixel(isNarrow ? 72 : 168),
        renderCell: (comment) => {
          const authorName = getCommentAuthorName(comment);

          return (
            <RowActionsCell
              isNarrow={isNarrow}
              label={t("admin.contentManagement.actions.commentActions")}
              items={[
                {
                  icon: <CheckCircle2 size={16} />,
                  id: "approve",
                  isDisabled: comment.status === "approved",
                  label: t("admin.contentManagement.actions.approve"),
                  onClick: () => {
                    void updateCommentStatus({ comment, nextStatus: "approved" });
                  },
                },
                {
                  icon: <Clock size={16} />,
                  id: "pending",
                  isDisabled: comment.status === "pending",
                  label: t("admin.contentManagement.actions.markPending"),
                  onClick: () => {
                    void updateCommentStatus({ comment, nextStatus: "pending" });
                  },
                },
                {
                  icon: <Ban size={16} />,
                  id: "reject",
                  isDisabled: comment.status === "rejected",
                  label: t("admin.contentManagement.actions.reject"),
                  onClick: () => {
                    void updateCommentStatus({ comment, nextStatus: "rejected" });
                  },
                },
                {
                  icon: <Trash2 size={16} />,
                  id: "delete",
                  label: t("admin.contentManagement.actions.delete"),
                  onClick: () =>
                    setDeleteTarget({
                      id: comment.id,
                      label: t("admin.contentManagement.delete.commentLabel", {
                        author: authorName,
                      }),
                      type: "comment",
                    }),
                  variant: "destructive",
                },
              ]}
            />
          );
        },
      },
    ],
    [isNarrow, t, timeZone, updateCommentStatus],
  );

  const summaryMetrics = useMemo(() => {
    if (activeView === "articles") {
      return [
        {
          description: t("admin.contentManagement.summary.articleTotalDescription"),
          icon: <FileText size={18} />,
          label: t("admin.contentManagement.summary.articleTotal"),
          value: articleCount,
        },
        {
          description: t("admin.contentManagement.summary.publishedDescription"),
          icon: <CheckCircle2 size={18} />,
          label: t("admin.contentManagement.summary.published"),
          value: articleRows.filter((article) => article.status === "published").length,
        },
        {
          description: t("admin.contentManagement.summary.commentsDescription"),
          icon: <MessageCircle size={18} />,
          label: t("admin.contentManagement.summary.comments"),
          value: articleRows.reduce((total, article) => total + article.commentCount, 0),
        },
      ];
    }

    if (activeView === "categories") {
      return [
        {
          description: t("admin.contentManagement.summary.categoriesDescription"),
          icon: <FolderTree size={18} />,
          label: t("admin.contentManagement.summary.categories"),
          value: categoryCount,
        },
        {
          description: t("admin.contentManagement.summary.linkedArticlesDescription"),
          icon: <FileText size={18} />,
          label: t("admin.contentManagement.summary.linkedArticles"),
          value: categoryRows.reduce((total, category) => total + category.articleCount, 0),
        },
        {
          description: t("admin.contentManagement.summary.unlinkedCategoriesDescription"),
          icon: <Clock size={18} />,
          label: t("admin.contentManagement.summary.pendingOrganize"),
          value: categoryRows.filter((category) => category.articleCount === 0).length,
        },
      ];
    }

    if (activeView === "tags") {
      return [
        {
          description: t("admin.contentManagement.summary.tagsDescription"),
          icon: <Tags size={18} />,
          label: t("admin.contentManagement.summary.tags"),
          value: tagCount,
        },
        {
          description: t("admin.contentManagement.summary.linkedArticlesDescription"),
          icon: <FileText size={18} />,
          label: t("admin.contentManagement.summary.linkedArticles"),
          value: tagRows.reduce((total, tag) => total + tag.articleCount, 0),
        },
        {
          description: t("admin.contentManagement.summary.coloredTagsDescription"),
          icon: <Palette size={18} />,
          label: t("admin.contentManagement.summary.colors"),
          value: tagRows.filter((tag) => tag.color !== null).length,
        },
      ];
    }

    if (activeView === "contributors") {
      return [
        {
          description: t("admin.contentManagement.summary.contributorsDescription"),
          icon: <UserRound size={18} />,
          label: t("admin.contentManagement.summary.contributors"),
          value: contributorCount,
        },
        {
          description: t("admin.contentManagement.summary.avatarsDescription"),
          icon: <UserRound size={18} />,
          label: t("admin.contentManagement.summary.avatars"),
          value: contributorRows.filter((contributor) => contributor.avatarUrl !== null).length,
        },
        {
          description: t("admin.contentManagement.summary.linksDescription"),
          icon: <ExternalLink size={18} />,
          label: t("admin.contentManagement.summary.links"),
          value: contributorRows.filter((contributor) => contributor.linkUrl !== null).length,
        },
      ];
    }

    return [
      {
        description: t("admin.contentManagement.summary.commentTotalDescription"),
        icon: <MessageCircle size={18} />,
        label: t("admin.contentManagement.summary.comments"),
        value: commentCount,
      },
      {
        description: t("admin.contentManagement.summary.pendingCommentsDescription"),
        icon: <Clock size={18} />,
        label: t("admin.contentManagement.summary.pendingComments"),
        value: commentRows.filter((comment) => comment.status === "pending").length,
      },
      {
        description: t("admin.contentManagement.summary.approvedCommentsDescription"),
        icon: <CheckCircle2 size={18} />,
        label: t("admin.contentManagement.summary.approvedComments"),
        value: commentRows.filter((comment) => comment.status === "approved").length,
      },
    ];
  }, [
    activeView,
    articleCount,
    articleRows,
    categoryCount,
    categoryRows,
    commentCount,
    commentRows,
    contributorCount,
    contributorRows,
    tagCount,
    tagRows,
    t,
  ]);

  const activeTable =
    activeView === "articles" ? (
      <Table<ArticleTableRow>
        columns={articleColumns}
        data={sortedArticleRows}
        density={isNarrow ? "compact" : "balanced"}
        dividers="rows"
        hasHover
        idKey="id"
        plugins={{
          sort: articleSortablePlugin,
          stickyColumns: articleStickyColumnsPlugin,
        }}
        rowCount={articleList.pageInfo.totalItems}
        style={contentAdaptiveTableStyle}
        textOverflow="wrap"
        verticalAlign="middle"
      />
    ) : activeView === "categories" ? (
      <Table<CategoryTableRow>
        columns={categoryColumns}
        data={sortedCategoryRows}
        density={isNarrow ? "compact" : "balanced"}
        dividers="rows"
        hasHover
        idKey="id"
        plugins={{
          sort: categorySortablePlugin,
          stickyColumns: categoryStickyColumnsPlugin,
        }}
        rowCount={sortedCategoryRows.length}
        style={contentAdaptiveTableStyle}
        textOverflow="wrap"
        verticalAlign="middle"
      />
    ) : activeView === "tags" ? (
      <Table<TagTableRow>
        columns={tagColumns}
        data={sortedTagRows}
        density={isNarrow ? "compact" : "balanced"}
        dividers="rows"
        hasHover
        idKey="id"
        plugins={{
          sort: tagSortablePlugin,
          stickyColumns: tagStickyColumnsPlugin,
        }}
        rowCount={sortedTagRows.length}
        style={contentAdaptiveTableStyle}
        textOverflow="wrap"
        verticalAlign="middle"
      />
    ) : activeView === "contributors" ? (
      <Table<ContributorTableRow>
        columns={contributorColumns}
        data={sortedContributorRows}
        density={isNarrow ? "compact" : "balanced"}
        dividers="rows"
        hasHover
        idKey="id"
        plugins={{
          sort: contributorSortablePlugin,
          stickyColumns: contributorStickyColumnsPlugin,
        }}
        rowCount={sortedContributorRows.length}
        style={contentAdaptiveTableStyle}
        textOverflow="wrap"
        verticalAlign="middle"
      />
    ) : (
      <Table<CommentTableRow>
        columns={commentColumns}
        data={sortedCommentRows}
        density={isNarrow ? "compact" : "balanced"}
        dividers="rows"
        hasHover
        idKey="id"
        plugins={{
          sort: commentSortablePlugin,
          stickyColumns: commentStickyColumnsPlugin,
        }}
        rowCount={commentList.pageInfo.totalItems}
        style={contentAdaptiveTableStyle}
        textOverflow="wrap"
        verticalAlign="middle"
      />
    );
  const activeRowCount =
    activeView === "articles"
      ? sortedArticleRows.length
      : activeView === "categories"
        ? sortedCategoryRows.length
        : activeView === "tags"
          ? sortedTagRows.length
          : activeView === "contributors"
            ? sortedContributorRows.length
            : sortedCommentRows.length;
  const activeTotalItems =
    activeView === "articles"
      ? articleList.pageInfo.totalItems
      : activeView === "comments"
        ? commentList.pageInfo.totalItems
        : activeRowCount;
  const activeTotalPages =
    activeView === "articles"
      ? articleList.pageInfo.totalPages
      : activeView === "comments"
        ? commentList.pageInfo.totalPages
        : 1;
  const hasInitialLoadingState = isLoading && activeRowCount === 0;
  const hasPagination =
    (activeView === "articles" || activeView === "comments") && activeTotalItems > 0;
  const emptyText =
    activeView === "articles"
      ? t("admin.contentManagement.empty.articles")
      : activeView === "categories"
        ? t("admin.contentManagement.empty.categories")
        : activeView === "contributors"
          ? t("admin.contentManagement.empty.contributors")
          : activeView === "comments"
            ? t("admin.contentManagement.empty.comments")
            : t("admin.contentManagement.empty.tags");
  const contentFormDialogs = (
    <>
      {dialogState?.type === "category" || dialogState?.type === "tag" ? (
        <AdminFormDialog
          cancelLabel={t("actions.cancel")}
          closeLabel={t("actions.close")}
          description={
            dialogState.type === "category"
              ? t("admin.contentManagement.dialogs.categoryDescription")
              : t("admin.contentManagement.dialogs.tagDescription")
          }
          isNarrow={isNarrow}
          isPrimaryDisabled={isSaving}
          isPrimaryLoading={isSaving}
          onClose={closeDialog}
          onSubmit={() => {
            if (dialogState.type === "category") {
              void saveCategory();
              return;
            }
            void saveTag();
          }}
          primaryIcon={dialogState.mode === "create" ? <Plus size={15} /> : <Save size={15} />}
          primaryLabel={
            dialogState.mode === "create"
              ? t("admin.contentManagement.actions.create")
              : t("actions.save")
          }
          title={
            dialogState.type === "category"
              ? dialogState.mode === "create"
                ? t("admin.contentManagement.dialogs.newCategory")
                : t("admin.contentManagement.dialogs.editCategory")
              : dialogState.mode === "create"
                ? t("admin.contentManagement.dialogs.newTag")
                : t("admin.contentManagement.dialogs.editTag")
          }
          width={720}
        >
          <Grid columns={{ minWidth: 240, repeat: "fit" }} gap={3}>
            <TextInput
              label={t("admin.contentManagement.fields.nameZh")}
              onChange={(name) => setTaxonomyForm((current) => ({ ...current, name }))}
              value={taxonomyForm.name}
            />
            <TextInput
              label={t("admin.contentManagement.fields.nameEn")}
              onChange={(nameEn) => setTaxonomyForm((current) => ({ ...current, nameEn }))}
              value={taxonomyForm.nameEn}
            />
            <TextInput
              label="Slug"
              onChange={(slug) => setTaxonomyForm((current) => ({ ...current, slug }))}
              placeholder={t("admin.contentManagement.placeholders.slugFromName")}
              value={taxonomyForm.slug}
            />
            {dialogState.type === "tag" && dialogState.mode === "edit" ? (
              <GridSpan columns="full">
                <TagColorField
                  onChange={(color) => setTaxonomyForm((current) => ({ ...current, color }))}
                  value={taxonomyForm.color}
                />
              </GridSpan>
            ) : null}
            <GridSpan columns="full">
              <TextArea
                label={t("admin.contentManagement.fields.descriptionZh")}
                onChange={(description) =>
                  setTaxonomyForm((current) => ({ ...current, description }))
                }
                rows={3}
                value={taxonomyForm.description}
              />
            </GridSpan>
            <GridSpan columns="full">
              <TextArea
                label={t("admin.contentManagement.fields.descriptionEn")}
                onChange={(descriptionEn) =>
                  setTaxonomyForm((current) => ({ ...current, descriptionEn }))
                }
                rows={3}
                value={taxonomyForm.descriptionEn}
              />
            </GridSpan>
          </Grid>
        </AdminFormDialog>
      ) : null}

      {dialogState?.type === "contributor" ? (
        <AdminFormDialog
          cancelLabel={t("actions.cancel")}
          closeLabel={t("actions.close")}
          description={t("admin.contentManagement.dialogs.contributorDescription")}
          isNarrow={isNarrow}
          isPrimaryDisabled={isSaving}
          isPrimaryLoading={isSaving}
          onClose={closeDialog}
          onSubmit={() => {
            void saveContributor();
          }}
          primaryIcon={dialogState.mode === "create" ? <Plus size={15} /> : <Save size={15} />}
          primaryLabel={
            dialogState.mode === "create"
              ? t("admin.contentManagement.actions.createContributor")
              : t("admin.contentManagement.actions.saveContributor")
          }
          title={
            dialogState.mode === "create"
              ? t("admin.contentManagement.dialogs.newContributor")
              : t("admin.contentManagement.dialogs.editContributor")
          }
          width={720}
        >
          <Grid columns={{ minWidth: 240, repeat: "fit" }} gap={3}>
            <TextInput
              label={t("admin.contentManagement.fields.name")}
              onChange={(name) => setContributorForm((current) => ({ ...current, name }))}
              placeholder={t("admin.contentManagement.placeholders.contributorName")}
              value={contributorForm.name}
            />
            <TextInput
              label={t("admin.contentManagement.fields.linkUrl")}
              onChange={(linkUrl) => setContributorForm((current) => ({ ...current, linkUrl }))}
              placeholder="https://example.com"
              startIcon={<ExternalLink size={16} />}
              value={contributorForm.linkUrl}
            />
            <GridSpan columns="full">
              <MediaAssetField
                folderSlug="avatars"
                label={t("admin.contentManagement.fields.avatar")}
                localFile={contributorAvatarFile}
                localImageEditorKind="avatar"
                onChange={(avatarUrl) =>
                  setContributorForm((current) => ({ ...current, avatarUrl }))
                }
                onLocalFileChange={setContributorAvatarFile}
                placeholder={t("admin.contentManagement.placeholders.assetUrl")}
                token={authToken}
                value={contributorForm.avatarUrl}
              />
            </GridSpan>
          </Grid>
        </AdminFormDialog>
      ) : null}
    </>
  );

  if (articleEditorState !== undefined) {
    const articleEditorTitle =
      articleEditorState.mode === "create"
        ? t("admin.contentManagement.editor.createTitle")
        : t("admin.contentManagement.editor.editTitle");
    const articleEditorDescription =
      articleEditorState.mode === "create"
        ? t("admin.contentManagement.editor.createDescription")
        : t("admin.contentManagement.editor.editDescription", {
            title:
              articleForm.title.trim().length > 0
                ? articleForm.title
                : t("admin.contentManagement.placeholders.unnamedArticle"),
          });
    const primaryLabel =
      articleEditorState.mode === "create"
        ? t("admin.contentManagement.editor.createAction")
        : t("admin.contentManagement.editor.updateAction");

    return (
      <VStack gap={4} style={pageStyle}>
        <AdminFeedbackBanner
          banner={feedbackBanner}
          onDismiss={() => {
            setFeedbackBanner(undefined);
          }}
        />

        <HStack
          gap={3}
          hAlign="between"
          vAlign="center"
          wrap="wrap"
          style={articleEditorHeaderStyle}
        >
          <VStack gap={1}>
            <Heading level={2}>{articleEditorTitle}</Heading>
            <Text color="secondary" type="supporting">
              {articleEditorDescription}
            </Text>
          </VStack>
          <HStack gap={2} wrap="wrap" style={articleEditorActionsStyle}>
            <Button
              icon={<ArrowLeft size={16} />}
              label={t("admin.contentManagement.actions.backToList")}
              onClick={closeArticleEditor}
              variant="secondary"
            />
            <Button
              icon={<Save size={16} />}
              isDisabled={isSaving}
              isLoading={isSaving}
              label={primaryLabel}
              onClick={() => {
                void saveArticle();
              }}
              variant="primary"
            />
          </HStack>
        </HStack>

        <div style={isNarrow ? articleEditorSingleColumnStyle : articleEditorLayoutStyle}>
          <Card padding={4} style={articleEditorCardStyle}>
            <VStack gap={4}>
              <VStack gap={1}>
                <HStack gap={2} vAlign="center">
                  <FileText size={18} />
                  <Heading level={3}>{t("admin.contentManagement.editor.basicInfo")}</Heading>
                </HStack>
                <Text color="secondary" type="supporting">
                  {t("admin.contentManagement.editor.basicInfoDescription")}
                </Text>
              </VStack>

              <Grid columns={{ minWidth: isNarrow ? 180 : 220, repeat: "fit" }} gap={3}>
                <TextInput
                  label={t("admin.contentManagement.fields.titleZh")}
                  onChange={(title) => setArticleForm((current) => ({ ...current, title }))}
                  placeholder={t("admin.contentManagement.placeholders.articleTitle")}
                  value={articleForm.title}
                />
                <TextInput
                  label={t("admin.contentManagement.fields.titleEn")}
                  onChange={(titleEn) => setArticleForm((current) => ({ ...current, titleEn }))}
                  placeholder="Article title"
                  value={articleForm.titleEn}
                />
                <TextInput
                  label="Slug"
                  onChange={(slug) => setArticleForm((current) => ({ ...current, slug }))}
                  placeholder={t("admin.contentManagement.placeholders.slugFromTitle")}
                  value={articleForm.slug}
                />
                <Selector
                  label={t("admin.contentManagement.filters.articleStatus")}
                  onChange={(status) => {
                    if (status === "draft" || status === "published" || status === "scheduled") {
                      setArticleForm((current) => ({ ...current, status }));
                    }
                  }}
                  options={articleEditorStatusOptions}
                  value={articleForm.status}
                />
                <TextInput
                  label={t("admin.contentManagement.fields.publishedAt")}
                  onChange={(publishedAt) =>
                    setArticleForm((current) => ({ ...current, publishedAt }))
                  }
                  placeholder="2026-10-05T12:00:00+08:00"
                  startIcon={<CalendarClock size={16} />}
                  value={articleForm.publishedAt}
                />
                <TextInput
                  label={t("admin.contentManagement.fields.scheduledPublishAt")}
                  onChange={(scheduledPublishAt) =>
                    setArticleForm((current) => ({ ...current, scheduledPublishAt }))
                  }
                  placeholder="2026-10-05T12:00:00+08:00"
                  startIcon={<CalendarClock size={16} />}
                  value={articleForm.scheduledPublishAt}
                />
                <GridSpan columns="full">
                  <MediaAssetField
                    folderSlug="article-covers"
                    label={t("admin.contentManagement.fields.cover")}
                    localFile={coverFile}
                    localImageEditorKind="article-cover"
                    onChange={(coverImageUrl) =>
                      setArticleForm((current) => ({ ...current, coverImageUrl }))
                    }
                    onLocalFileChange={setCoverFile}
                    placeholder={t("admin.contentManagement.placeholders.assetUrl")}
                    token={authToken}
                    value={articleForm.coverImageUrl}
                  />
                </GridSpan>
                <GridSpan columns="full">
                  <Switch
                    label={t("admin.contentManagement.fields.pinned")}
                    labelPosition="start"
                    labelSpacing="spread"
                    onChange={(isPinned) => setArticleForm((current) => ({ ...current, isPinned }))}
                    value={articleForm.isPinned}
                  />
                </GridSpan>
                <GridSpan columns="full">
                  <TextArea
                    label={t("admin.contentManagement.fields.summaryZh")}
                    onChange={(summary) => setArticleForm((current) => ({ ...current, summary }))}
                    rows={3}
                    value={articleForm.summary}
                  />
                </GridSpan>
                <GridSpan columns="full">
                  <TextArea
                    label={t("admin.contentManagement.fields.summaryEn")}
                    onChange={(summaryEn) =>
                      setArticleForm((current) => ({ ...current, summaryEn }))
                    }
                    rows={3}
                    value={articleForm.summaryEn}
                  />
                </GridSpan>
              </Grid>

              <VStack gap={3}>
                <ArticleRelationSelectorField
                  createLabel={t("admin.contentManagement.actions.newCategory")}
                  emptySearchText={t("admin.contentManagement.empty.noCategoryMatches")}
                  emptyText={t("admin.contentManagement.empty.noCategories")}
                  label={t("admin.contentManagement.fields.categories")}
                  onChange={(categoryIds) =>
                    setArticleForm((current) => ({ ...current, categoryIds }))
                  }
                  onCreate={openCategoryCreate}
                  options={categoryOptions}
                  placeholder={t("admin.contentManagement.placeholders.selectCategories")}
                  presentation={isNarrow ? "bottom-sheet" : "popover"}
                  searchPlaceholder={t("admin.contentManagement.placeholders.searchCategories")}
                  value={articleForm.categoryIds}
                />

                <ArticleRelationSelectorField
                  createLabel={t("admin.contentManagement.actions.newTag")}
                  emptySearchText={t("admin.contentManagement.empty.noTagMatches")}
                  emptyText={t("admin.contentManagement.empty.noTags")}
                  label={t("admin.contentManagement.fields.tags")}
                  onChange={(tagIds) => setArticleForm((current) => ({ ...current, tagIds }))}
                  onCreate={openTagCreate}
                  options={tagOptions}
                  placeholder={t("admin.contentManagement.placeholders.selectTags")}
                  presentation={isNarrow ? "bottom-sheet" : "popover"}
                  searchPlaceholder={t("admin.contentManagement.placeholders.searchTags")}
                  value={articleForm.tagIds}
                />

                <ArticleRelationSelectorField
                  createLabel={t("admin.contentManagement.actions.newContributor")}
                  emptySearchText={t("admin.contentManagement.empty.noContributorMatches")}
                  emptyText={t("admin.contentManagement.empty.noContributors")}
                  label={t("admin.contentManagement.fields.contributors")}
                  onChange={(contributorIds) =>
                    setArticleForm((current) => ({ ...current, contributorIds }))
                  }
                  onCreate={openContributorCreate}
                  options={contributorOptions}
                  placeholder={t("admin.contentManagement.placeholders.selectContributors")}
                  presentation={isNarrow ? "bottom-sheet" : "popover"}
                  searchPlaceholder={t("admin.contentManagement.placeholders.searchContributors")}
                  value={articleForm.contributorIds}
                />
              </VStack>
            </VStack>
          </Card>

          <VStack gap={4} style={articleEditorCardStyle}>
            <Card padding={4} style={articleEditorMdxCardStyle}>
              <VStack gap={2}>
                <VStack gap={1}>
                  <HStack gap={2} vAlign="center">
                    <FileText size={18} />
                    <Heading level={3}>{t("admin.contentManagement.editor.mdxZh")}</Heading>
                  </HStack>
                  <Text color="secondary" type="supporting">
                    {t("admin.contentManagement.editor.mdxZhDescription")}
                  </Text>
                </VStack>
                <HStack gap={1} wrap="wrap" style={mdxToolbarChipListStyle}>
                  {allowedMdxJsxComponentNames.map((name) => (
                    <Badge key={name} label={name} variant="neutral" />
                  ))}
                </HStack>
                <MdxEditorField
                  aria-label={t("admin.contentManagement.editor.mdxZhAria")}
                  imageUploadHandler={uploadArticleMdxImage}
                  mediaLibraryFolderSlug="article-covers"
                  mediaLibraryToken={authToken}
                  onChange={(contentMdx) =>
                    setArticleForm((current) => ({ ...current, contentMdx }))
                  }
                  placeholder={t("admin.contentManagement.placeholders.writeZhMdx")}
                  value={articleForm.contentMdx}
                />
              </VStack>
            </Card>

            <Card padding={4} style={articleEditorMdxCardStyle}>
              <VStack gap={2}>
                <VStack gap={1}>
                  <HStack gap={2} vAlign="center">
                    <FileText size={18} />
                    <Heading level={3}>{t("admin.contentManagement.editor.mdxEn")}</Heading>
                  </HStack>
                  <Text color="secondary" type="supporting">
                    {t("admin.contentManagement.editor.mdxEnDescription")}
                  </Text>
                </VStack>
                <MdxEditorField
                  aria-label={t("admin.contentManagement.editor.mdxEnAria")}
                  imageUploadHandler={uploadArticleMdxImage}
                  mediaLibraryFolderSlug="article-covers"
                  mediaLibraryToken={authToken}
                  onChange={(contentMdxEn) =>
                    setArticleForm((current) => ({ ...current, contentMdxEn }))
                  }
                  placeholder="Write the English content..."
                  value={articleForm.contentMdxEn}
                />
              </VStack>
            </Card>
          </VStack>
        </div>
        {contentFormDialogs}
      </VStack>
    );
  }

  return (
    <VStack gap={4} style={pageStyle}>
      <AdminFeedbackBanner
        banner={feedbackBanner}
        onDismiss={() => {
          setFeedbackBanner(undefined);
        }}
      />

      <Grid columns={{ minWidth: isNarrow ? 180 : 220, repeat: "fit" }} gap={3}>
        {summaryMetrics.map((metric) => (
          <SummaryCard
            description={metric.description}
            icon={metric.icon}
            key={metric.label}
            label={metric.label}
            value={metric.value}
          />
        ))}
      </Grid>

      <Card padding={4}>
        <div style={toolbarStyle}>
          <div style={toolbarRowStyle}>
            <div style={toolbarSearchStyle}>
              <TextInput
                label={t("admin.contentManagement.filters.search")}
                onChange={(value) => {
                  setQuery(value);
                  setPage(1);
                }}
                placeholder={t("admin.contentManagement.placeholders.search")}
                startIcon={<Search size={16} />}
                value={query}
              />
            </div>
            {isArticleView ? (
              <div style={toolbarFilterStyle}>
                <Selector
                  label={t("admin.contentManagement.filters.articleStatus")}
                  onChange={(value) => {
                    if (
                      value === "all" ||
                      value === "draft" ||
                      value === "published" ||
                      value === "scheduled"
                    ) {
                      setStatusFilter(value);
                      setPage(1);
                    }
                  }}
                  options={articleStatusOptions}
                  value={statusFilter}
                />
              </div>
            ) : null}
            {isCommentsView ? (
              <div style={toolbarFilterStyle}>
                <Selector
                  label={t("admin.contentManagement.filters.commentStatus")}
                  onChange={(value) => {
                    if (
                      value === "all" ||
                      value === "pending" ||
                      value === "approved" ||
                      value === "rejected"
                    ) {
                      setCommentStatusFilter(value);
                      setPage(1);
                    }
                  }}
                  options={commentStatusOptions}
                  value={commentStatusFilter}
                />
              </div>
            ) : null}
            {isCommentsView ? (
              <div style={toolbarSwitchStyle}>
                <Switch
                  label={t("admin.contentManagement.filters.includeDeleted")}
                  labelPosition="start"
                  labelSpacing="spread"
                  onChange={(checked) => {
                    setIncludeDeletedComments(checked);
                    setPage(1);
                  }}
                  value={includeDeletedComments}
                />
              </div>
            ) : null}
            <div style={toolbarActionsStyle}>
              <Button
                icon={<RefreshCw size={16} />}
                label={t("admin.contentManagement.actions.refresh")}
                onClick={() => {
                  void loadContent();
                }}
                isLoading={isLoading && activeRowCount > 0}
                variant="secondary"
              />
              {activeView === "comments" ? null : (
                <Button
                  icon={<Plus size={16} />}
                  label={
                    activeView === "articles"
                      ? t("admin.contentManagement.actions.newArticle")
                      : activeView === "categories"
                        ? t("admin.contentManagement.actions.newCategory")
                        : activeView === "contributors"
                          ? t("admin.contentManagement.actions.newContributor")
                          : t("admin.contentManagement.actions.newTag")
                  }
                  onClick={
                    activeView === "articles"
                      ? openArticleCreate
                      : activeView === "categories"
                        ? openCategoryCreate
                        : activeView === "contributors"
                          ? openContributorCreate
                          : openTagCreate
                  }
                  variant="primary"
                />
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card padding={0} style={tableCardStyle}>
        {hasInitialLoadingState ? (
          <HStack gap={2} vAlign="center" style={{ padding: isNarrow ? 16 : 24 }}>
            <Spinner size="sm" />
            <Text color="secondary" type="supporting">
              {t("admin.contentManagement.loading")}
            </Text>
          </HStack>
        ) : activeRowCount === 0 ? (
          <EmptyState
            actions={
              activeView === "comments" ? undefined : (
                <Button
                  icon={<Plus size={16} />}
                  label={
                    activeView === "articles"
                      ? t("admin.contentManagement.actions.newArticle")
                      : activeView === "categories"
                        ? t("admin.contentManagement.actions.newCategory")
                        : activeView === "contributors"
                          ? t("admin.contentManagement.actions.newContributor")
                          : t("admin.contentManagement.actions.newTag")
                  }
                  onClick={
                    activeView === "articles"
                      ? openArticleCreate
                      : activeView === "categories"
                        ? openCategoryCreate
                        : activeView === "contributors"
                          ? openContributorCreate
                          : openTagCreate
                  }
                  variant="primary"
                />
              )
            }
            description={t("admin.contentManagement.empty.adjustFilters")}
            icon={<Search size={32} />}
            title={emptyText}
          />
        ) : (
          <div style={tableViewportStyle}>{activeTable}</div>
        )}
        {hasPagination ? (
          <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap" style={tableFooterStyle}>
            <Text color="secondary" type="supporting">
              {t("admin.contentManagement.pagination.summary", {
                count: activeTotalItems,
                page,
                totalPages: activeTotalPages,
              })}
            </Text>
            <Pagination
              isDisabled={isLoading}
              label={t("admin.contentManagement.pagination.label", {
                title: titleByView[activeView],
              })}
              onChange={setPage}
              onPageSizeChange={() => {}}
              page={page}
              pageLabel={t("admin.contentManagement.pagination.pageLabel")}
              pageSize={PAGE_SIZE}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              totalItems={activeTotalItems}
              variant={isNarrow ? "compact" : "pages"}
            />
          </HStack>
        ) : null}
      </Card>

      {contentFormDialogs}

      {deleteTarget === undefined ? null : (
        <AlertDialog
          actionLabel={t("admin.contentManagement.delete.action")}
          actionVariant="destructive"
          cancelLabel={t("actions.cancel")}
          description={t("admin.contentManagement.delete.description", {
            label: deleteTarget.label,
            type: t(`admin.contentManagement.delete.types.${deleteTarget.type}`),
          })}
          isOpen
          isActionLoading={isDeleting}
          onAction={() => {
            void confirmDelete();
          }}
          onOpenChange={(isOpen) => {
            if (!isOpen && !isDeleting) {
              setDeleteTarget(undefined);
            }
          }}
          title={t("admin.contentManagement.delete.title", {
            type: t(`admin.contentManagement.delete.types.${deleteTarget.type}`),
          })}
        />
      )}
    </VStack>
  );
}
