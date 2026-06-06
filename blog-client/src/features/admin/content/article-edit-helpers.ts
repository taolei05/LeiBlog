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
  slug: string;
  status: ArticleStatus;
  summary: string | null;
  tags: AdminArticleTag[];
  title: string;
  updatedAt: string;
};

export type ArticleFormState = {
  categoryIds: string[];
  contentMdx: string;
  contributorIds: string[];
  coverImageUrl: string;
  isPinned: boolean;
  slug: string;
  status: ArticleStatus;
  summary: string;
  tagIds: string[];
  title: string;
};

export const emptyFormState: ArticleFormState = {
  categoryIds: [],
  contentMdx: "",
  contributorIds: [],
  coverImageUrl: "",
  isPinned: false,
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

export function toFormState(article: AdminArticleDetail): ArticleFormState {
  return {
    categoryIds: article.categories.map((category) => category.id),
    contentMdx: article.contentMdx,
    contributorIds: article.contributors.map((contributor) => contributor.id),
    coverImageUrl: article.coverImageUrl ?? "",
    isPinned: article.isPinned,
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
    categoryIds: formState.categoryIds,
    contentMdx: formState.contentMdx,
    coverImageUrl: toOptional(formState.coverImageUrl),
    contributorIds: formState.contributorIds,
    isPinned: formState.isPinned,
    slug: formState.slug,
    status: statusOverride ?? formState.status,
    summary: toOptional(formState.summary),
    tagIds: formState.tagIds,
    title: formState.title.trim(),
  };
}
