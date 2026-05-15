import { t } from "elysia";

const ArticleRelationItem = t.Object({
  id: t.String(),
  name: t.String(),
  slug: t.Optional(t.String()),
  color: t.Optional(t.Nullable(t.String())),
  avatarUrl: t.Optional(t.Nullable(t.String())),
  linkUrl: t.Optional(t.Nullable(t.String())),
});

export const ArticleQuery = t.Object({
  search: t.Optional(t.String({ maxLength: 160 })),
  page: t.Optional(t.String()),
  pageSize: t.Optional(t.String()),
  categorySlug: t.Optional(t.String({ maxLength: 160 })),
  tagSlug: t.Optional(t.String({ maxLength: 160 })),
  isPinned: t.Optional(t.String()),
  sortBy: t.Optional(
    t.Union([
      t.Literal("createdAt"),
      t.Literal("publishedAt"),
      t.Literal("title"),
      t.Literal("readCount"),
    ])
  ),
  sortOrder: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
});

export const SlugParams = t.Object({
  slug: t.String({ minLength: 1, maxLength: 200 }),
});

export const ArticleSummaryItem = t.Object({
  id: t.String(),
  title: t.String(),
  slug: t.String(),
  summary: t.Nullable(t.String()),
  coverImageUrl: t.Nullable(t.String()),
  readCount: t.Number(),
  isPinned: t.Boolean(),
  createdAt: t.String(),
  updatedAt: t.String(),
  publishedAt: t.Nullable(t.String()),
  commentCount: t.Number(),
  categories: t.Array(ArticleRelationItem),
  tags: t.Array(ArticleRelationItem),
});

export const ArticleDetailItem = t.Object({
  ...ArticleSummaryItem.properties,
  contentMdx: t.String(),
  contributors: t.Array(ArticleRelationItem),
});

export const ArticleListResponse = t.Object({
  ok: t.Boolean(),
  items: t.Array(ArticleSummaryItem),
  page: t.Number(),
  pageSize: t.Number(),
  total: t.Number(),
});

export const ArticleDetailResponse = t.Object({
  ok: t.Boolean(),
  item: ArticleDetailItem,
});
