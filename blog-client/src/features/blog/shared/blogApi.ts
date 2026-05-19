import type { AppIconName } from "../../../shared/icons";
import { getPublicApiBaseUrl, resolveApiAssetUrl } from "../../../shared/api/api-base-url";

export type BlogTaxonomy = {
  color?: string | null;
  id: string;
  name: string;
  slug: string;
};

export type BlogArticleTocItem = {
  id: string;
  title: string;
};

export type BlogArticle = {
  categories: BlogTaxonomy[];
  category: string;
  categorySlug: string;
  commentCount: number;
  contentMdx?: string;
  cover: string | null;
  date: string;
  excerpt: string;
  id: string;
  isPinned: boolean;
  publishedAt: string | null;
  readCount: number;
  readTime: string;
  slug: string;
  tags: BlogTaxonomy[];
  title: string;
  toc: BlogArticleTocItem[];
};

export type BlogCategory = {
  count: number;
  description: string;
  icon: AppIconName;
  name: string;
  slug: string;
};

export type BlogTag = {
  color?: string | null;
  count: number;
  name: string;
  slug: string;
};

export type BlogArchiveGroup = {
  articles: BlogArticle[];
  label: string;
};

export type BlogComment = {
  author: {
    avatarUrl: string | null;
    name: string | null;
    role: "admin" | "demo" | "user";
    tags: string[];
    username: string;
  };
  content: string;
  createdAt: string;
  id: string;
  parentId: string | null;
};

export type PublicArticleListParams = {
  categorySlug?: string | null;
  isPinned?: boolean;
  page?: number;
  pageSize?: number;
  search?: string | null;
  sortBy?: "createdAt" | "publishedAt" | "readCount" | "title";
  sortOrder?: "asc" | "desc";
  tagSlug?: string | null;
};

type ApiRelationItem = {
  color?: string | null;
  id: string;
  name: string;
  slug?: string;
};

type ApiArticleSummary = {
  categories: ApiRelationItem[];
  commentCount: number;
  coverImageUrl: string | null;
  createdAt: string;
  id: string;
  isPinned: boolean;
  publishedAt: string | null;
  readCount: number;
  slug: string;
  summary: string | null;
  tags: ApiRelationItem[];
  title: string;
  updatedAt: string;
};

type ApiArticleDetail = ApiArticleSummary & {
  contentMdx: string;
};

type ApiCommentItem = {
  author: {
    avatarUrl: string | null;
    name: string | null;
    role: "admin" | "demo" | "user";
    tags: string[];
    username: string;
  };
  content: string;
  createdAt: string;
  id: string;
  parentId: string | null;
};

const apiBaseUrl = getPublicApiBaseUrl();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  if (typeof value !== "string") throw new Error(`接口字段 ${key} 不是字符串`);
  return value;
}

function readNullableString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`接口字段 ${key} 不是字符串`);
  return value;
}

function readNumber(source: Record<string, unknown>, key: string) {
  const value = source[key];
  if (typeof value !== "number") throw new Error(`接口字段 ${key} 不是数字`);
  return value;
}

function readBoolean(source: Record<string, unknown>, key: string) {
  const value = source[key];
  if (typeof value !== "boolean") throw new Error(`接口字段 ${key} 不是布尔值`);
  return value;
}

function readArray(source: Record<string, unknown>, key: string) {
  const value = source[key];
  if (!Array.isArray(value)) throw new Error(`接口字段 ${key} 不是数组`);
  return value;
}

function readRole(value: unknown) {
  if (value === "admin" || value === "demo" || value === "user") return value;
  throw new Error("评论作者角色无效");
}

function toRelationItem(value: unknown): ApiRelationItem {
  if (!isRecord(value)) throw new Error("文章关联项格式无效");

  return {
    color: readNullableString(value, "color"),
    id: readString(value, "id"),
    name: readString(value, "name"),
    slug: readNullableString(value, "slug") ?? undefined,
  };
}

function toArticleSummary(value: unknown): ApiArticleSummary {
  if (!isRecord(value)) throw new Error("文章列表项格式无效");

  return {
    categories: readArray(value, "categories").map(toRelationItem),
    commentCount: readNumber(value, "commentCount"),
    coverImageUrl: readNullableString(value, "coverImageUrl"),
    createdAt: readString(value, "createdAt"),
    id: readString(value, "id"),
    isPinned: readBoolean(value, "isPinned"),
    publishedAt: readNullableString(value, "publishedAt"),
    readCount: readNumber(value, "readCount"),
    slug: readString(value, "slug"),
    summary: readNullableString(value, "summary"),
    tags: readArray(value, "tags").map(toRelationItem),
    title: readString(value, "title"),
    updatedAt: readString(value, "updatedAt"),
  };
}

function toArticleDetail(value: unknown): ApiArticleDetail {
  if (!isRecord(value)) throw new Error("文章详情格式无效");

  return {
    ...toArticleSummary(value),
    contentMdx: readString(value, "contentMdx"),
  };
}

function toCommentItem(value: unknown): ApiCommentItem {
  if (!isRecord(value)) throw new Error("评论项格式无效");
  const authorValue = value.author;
  if (!isRecord(authorValue)) throw new Error("评论作者格式无效");

  return {
    author: {
      avatarUrl: resolveApiAssetUrl(readNullableString(authorValue, "avatarUrl")) ?? null,
      name: readNullableString(authorValue, "name"),
      role: readRole(authorValue.role),
      tags: readArray(authorValue, "tags").map((tag) => {
        if (typeof tag !== "string") throw new Error("评论作者标签格式无效");
        return tag;
      }),
      username: readString(authorValue, "username"),
    },
    content: readString(value, "content"),
    createdAt: readString(value, "createdAt"),
    id: readString(value, "id"),
    parentId: readNullableString(value, "parentId"),
  };
}

async function fetchJson(url: URL) {
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`接口请求失败：${response.status}`);
  return response.json() as Promise<unknown>;
}

function appendOptionalParam(
  params: URLSearchParams,
  key: string,
  value: boolean | number | string | null | undefined,
) {
  if (value === null || value === undefined || value === "") return;
  params.set(key, String(value));
}

function normalizeRelation(item: ApiRelationItem): BlogTaxonomy {
  return {
    color: item.color ?? null,
    id: item.id,
    name: item.name,
    slug: item.slug ?? item.name,
  };
}

function formatDate(value: string | null) {
  if (!value) return "未发布";

  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  })
    .format(new Date(value))
    .replace(/\//g, "-");
}

export function createHeadingId(title: string, index: number) {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "");

  return normalized || `section-${index + 1}`;
}

export function extractArticleToc(contentMdx: string | undefined): BlogArticleTocItem[] {
  if (!contentMdx) return [];

  return contentMdx
    .split("\n")
    .map((line) => line.match(/^##\s+(.+)$/)?.[1]?.trim())
    .filter((title): title is string => Boolean(title))
    .map((title, index) => ({
      id: createHeadingId(title, index),
      title,
    }));
}

function estimateReadTime(contentMdx: string | undefined, summary: string | null) {
  const cleanText = (contentMdx ?? summary ?? "").replace(/[^\p{Letter}\p{Number}]+/gu, "");
  const minutes = Math.max(1, Math.ceil(cleanText.length / 500));
  return `${minutes} 分钟`;
}

function toBlogArticle(article: ApiArticleDetail | ApiArticleSummary): BlogArticle {
  const categories = article.categories.map(normalizeRelation);
  const tags = article.tags.map(normalizeRelation);
  const primaryCategory = categories[0] ?? {
    id: "uncategorized",
    name: "未分类",
    slug: "uncategorized",
  };
  const contentMdx = "contentMdx" in article ? article.contentMdx : undefined;

  return {
    categories,
    category: primaryCategory.name,
    categorySlug: primaryCategory.slug,
    commentCount: article.commentCount,
    contentMdx,
    cover: resolveApiAssetUrl(article.coverImageUrl) ?? null,
    date: formatDate(article.publishedAt ?? article.createdAt),
    excerpt: article.summary ?? "",
    id: article.id,
    isPinned: article.isPinned,
    publishedAt: article.publishedAt,
    readCount: article.readCount,
    readTime: estimateReadTime(contentMdx, article.summary),
    slug: article.slug,
    tags,
    title: article.title,
    toc: extractArticleToc(contentMdx),
  };
}

function categoryDescription(name: string) {
  const descriptions: Record<string, string> = {
    工程实践: "发布、部署和日常工程维护。",
    摄影手记: "照片、器材和城市观察。",
    生活观察: "慢一点的生活片段与写作。",
    阅读笔记: "阅读方法、摘录和书桌流程。",
  };

  return descriptions[name] ?? "按这个主题继续阅读。";
}

function categoryIcon(name: string): AppIconName {
  const icons: Record<string, AppIconName> = {
    工程实践: "terminal",
    摄影手记: "image",
    生活观察: "heart",
    阅读笔记: "library",
  };

  return icons[name] ?? "albums";
}

export function deriveBlogCategories(articles: BlogArticle[]): BlogCategory[] {
  const categories = new Map<string, BlogCategory>();

  for (const article of articles) {
    for (const category of article.categories) {
      const existing = categories.get(category.slug);
      categories.set(category.slug, {
        count: (existing?.count ?? 0) + 1,
        description: categoryDescription(category.name),
        icon: categoryIcon(category.name),
        name: category.name,
        slug: category.slug,
      });
    }
  }

  return [...categories.values()].sort((left, right) => right.count - left.count);
}

export function deriveBlogTags(articles: BlogArticle[]): BlogTag[] {
  const tags = new Map<string, BlogTag>();

  for (const article of articles) {
    for (const tag of article.tags) {
      const existing = tags.get(tag.slug);
      tags.set(tag.slug, {
        color: tag.color,
        count: (existing?.count ?? 0) + 1,
        name: tag.name,
        slug: tag.slug,
      });
    }
  }

  return [...tags.values()].sort((left, right) => right.count - left.count);
}

export function groupArticlesByMonth(articles: BlogArticle[]): BlogArchiveGroup[] {
  const groups = new Map<string, BlogArticle[]>();

  for (const article of articles) {
    const date = article.publishedAt ? new Date(article.publishedAt) : null;
    const label = date
      ? new Intl.DateTimeFormat("zh-CN", {
          month: "long",
          timeZone: "Asia/Shanghai",
          year: "numeric",
        }).format(date)
      : "未发布";
    groups.set(label, [...(groups.get(label) ?? []), article]);
  }

  return [...groups.entries()].map(([label, groupArticles]) => ({
    articles: groupArticles,
    label,
  }));
}

export async function fetchPublicArticles(params: PublicArticleListParams = {}) {
  const url = new URL(`${apiBaseUrl}/articles/`);

  appendOptionalParam(url.searchParams, "categorySlug", params.categorySlug);
  appendOptionalParam(url.searchParams, "isPinned", params.isPinned);
  appendOptionalParam(url.searchParams, "page", params.page);
  appendOptionalParam(url.searchParams, "pageSize", params.pageSize);
  appendOptionalParam(url.searchParams, "search", params.search?.trim());
  appendOptionalParam(url.searchParams, "sortBy", params.sortBy);
  appendOptionalParam(url.searchParams, "sortOrder", params.sortOrder);
  appendOptionalParam(url.searchParams, "tagSlug", params.tagSlug);

  const payload = await fetchJson(url);
  if (!isRecord(payload)) throw new Error("文章列表响应格式无效");

  return readArray(payload, "items").map((item) => toBlogArticle(toArticleSummary(item)));
}

export async function fetchPublicArticleBySlug(slug: string) {
  const url = new URL(`${apiBaseUrl}/articles/slug/${encodeURIComponent(slug)}`);
  const payload = await fetchJson(url);
  if (!isRecord(payload)) throw new Error("文章详情响应格式无效");

  const item = payload.item;
  return toBlogArticle(toArticleDetail(item));
}

export async function fetchPublicComments({
  articleId,
  target,
}: {
  articleId?: string;
  target: "article" | "guestbook";
}) {
  const path =
    target === "article"
      ? `/articles/${encodeURIComponent(articleId ?? "")}/comments`
      : "/guestbook/comments";
  const url = new URL(`${apiBaseUrl}${path}`);
  url.searchParams.set("pageSize", "100");

  const payload = await fetchJson(url);
  if (!isRecord(payload)) throw new Error("评论列表响应格式无效");

  return readArray(payload, "items").map((item) => toCommentItem(item));
}
