export type ArticleStatus = "draft" | "offline" | "published";

export type AdminArticleCategory = {
  id: string;
  name: string;
  slug?: string;
};

export type AdminArticleContributor = {
  avatarUrl?: string | null;
  id: string;
  linkUrl?: string | null;
  name: string;
};

export type AdminArticleTag = {
  color?: string | null;
  id: string;
  name: string;
  slug?: string;
};

export type AdminArticleDetail = {
  categories: AdminArticleCategory[];
  contentMdx: string;
  contributors: AdminArticleContributor[];
  coverImageUrl: string | null;
  id: string;
  isPinned: boolean;
  scheduledPublishAt: string | null;
  slug: string;
  status: ArticleStatus;
  summary: string | null;
  tags: AdminArticleTag[];
  title: string;
  updatedAt: string;
};

export type ArticleFormState = {
  categoryId: string;
  contentMdx: string;
  contributorIds: string[];
  coverImageUrl: string;
  isPinned: boolean;
  scheduledPublishAt: string;
  slug: string;
  status: ArticleStatus;
  summary: string;
  tagIds: string[];
  title: string;
};

export const emptyFormState: ArticleFormState = {
  categoryId: "",
  contentMdx: "",
  contributorIds: [],
  coverImageUrl: "",
  isPinned: false,
  scheduledPublishAt: "",
  slug: "",
  status: "draft",
  summary: "",
  tagIds: [],
  title: "",
};

function toOptional(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function toLocalDateTimeValue(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function toIsoDateTimeValue(value: string) {
  const trimmed = value.trim();
  return trimmed ? new Date(trimmed).toISOString() : null;
}

export function toFormState(article: AdminArticleDetail): ArticleFormState {
  return {
    categoryId: article.categories[0]?.id ?? "",
    contentMdx: article.contentMdx,
    contributorIds: article.contributors.map((contributor) => contributor.id),
    coverImageUrl: article.coverImageUrl ?? "",
    isPinned: article.isPinned,
    scheduledPublishAt: toLocalDateTimeValue(article.scheduledPublishAt),
    slug: article.slug,
    status: article.status,
    summary: article.summary ?? "",
    tagIds: article.tags.map((tag) => tag.id),
    title: article.title,
  };
}

export function buildArticleRequestBody(
  formState: ArticleFormState,
  statusOverride?: ArticleStatus,
) {
  return {
    categoryIds: formState.categoryId ? [formState.categoryId] : [],
    contentMdx: formState.contentMdx,
    coverImageUrl: toOptional(formState.coverImageUrl),
    contributorIds: formState.contributorIds,
    isPinned: formState.isPinned,
    scheduledPublishAt:
      statusOverride === "published" ? null : toIsoDateTimeValue(formState.scheduledPublishAt),
    slug: formState.slug,
    status: statusOverride ?? formState.status,
    summary: toOptional(formState.summary),
    tagIds: formState.tagIds,
    title: formState.title.trim(),
  };
}
