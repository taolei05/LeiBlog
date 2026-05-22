import { t } from "elysia";

const ArticleStatus = t.Union([
  t.Literal("draft"),
  t.Literal("published"),
  t.Literal("offline"),
]);

const PaginationQuery = {
  search: t.Optional(t.String({ maxLength: 160 })),
  page: t.Optional(t.String()),
  pageSize: t.Optional(t.String()),
  sortOrder: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
};

const IdParams = t.Object({
  id: t.String(),
});

export const TaxonomyQuery = t.Object({
  ...PaginationQuery,
  sortBy: t.Optional(
    t.Union([t.Literal("name"), t.Literal("slug"), t.Literal("createdAt")])
  ),
});

export const ContributorQuery = t.Object({
  ...PaginationQuery,
  sortBy: t.Optional(t.Union([t.Literal("name"), t.Literal("createdAt")])),
});

export const CategoryBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 80 }),
  slug: t.Optional(t.String({ maxLength: 160 })),
});

export const TagBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 80 }),
  slug: t.Optional(t.String({ maxLength: 160 })),
  color: t.Optional(t.Nullable(t.String({ maxLength: 32 }))),
});

export const ContributorBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  avatarUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
  linkUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
});

export const ArticleQuery = t.Object({
  ...PaginationQuery,
  status: t.Optional(ArticleStatus),
  categoryId: t.Optional(t.String()),
  tagId: t.Optional(t.String()),
  contributorId: t.Optional(t.String()),
  isPinned: t.Optional(t.String()),
  sortBy: t.Optional(
    t.Union([
      t.Literal("createdAt"),
      t.Literal("updatedAt"),
      t.Literal("publishedAt"),
      t.Literal("title"),
      t.Literal("readCount"),
    ])
  ),
});

export const ArticleBody = t.Object({
  title: t.String({ minLength: 1, maxLength: 180 }),
  slug: t.Optional(t.String({ maxLength: 200 })),
  summary: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
  contentMdx: t.Optional(t.String()),
  coverImageUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
  status: t.Optional(ArticleStatus),
  isPinned: t.Optional(t.Boolean()),
  publishedAt: t.Optional(t.Nullable(t.String())),
  categoryIds: t.Optional(t.Array(t.String())),
  tagIds: t.Optional(t.Array(t.String())),
  contributorIds: t.Optional(t.Array(t.String())),
});

export const ArticleUpdateBody = t.Object({
  title: t.Optional(t.String({ minLength: 1, maxLength: 180 })),
  slug: t.Optional(t.String({ maxLength: 200 })),
  summary: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
  contentMdx: t.Optional(t.String()),
  coverImageUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
  status: t.Optional(ArticleStatus),
  isPinned: t.Optional(t.Boolean()),
  publishedAt: t.Optional(t.Nullable(t.String())),
  categoryIds: t.Optional(t.Array(t.String())),
  tagIds: t.Optional(t.Array(t.String())),
  contributorIds: t.Optional(t.Array(t.String())),
});

export const CategoryResponseItem = t.Object({
  id: t.String(),
  name: t.String(),
  slug: t.String(),
  articleCount: t.Number(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const TagResponseItem = t.Object({
  id: t.String(),
  name: t.String(),
  slug: t.String(),
  color: t.Nullable(t.String()),
  articleCount: t.Number(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const ContributorResponseItem = t.Object({
  id: t.String(),
  name: t.String(),
  avatarUrl: t.Nullable(t.String()),
  linkUrl: t.Nullable(t.String()),
  articleCount: t.Number(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

const ArticleRelationItem = t.Object({
  id: t.String(),
  name: t.String(),
  slug: t.Optional(t.String()),
  color: t.Optional(t.Nullable(t.String())),
  avatarUrl: t.Optional(t.Nullable(t.String())),
  linkUrl: t.Optional(t.Nullable(t.String())),
});

export const ArticleResponseItem = t.Object({
  id: t.String(),
  authorId: t.Nullable(t.String()),
  title: t.String(),
  slug: t.String(),
  summary: t.Nullable(t.String()),
  contentMdx: t.String(),
  coverImageUrl: t.Nullable(t.String()),
  status: ArticleStatus,
  readCount: t.Number(),
  commentCount: t.Number(),
  isPinned: t.Boolean(),
  createdAt: t.String(),
  updatedAt: t.String(),
  publishedAt: t.Nullable(t.String()),
  categories: t.Array(ArticleRelationItem),
  tags: t.Array(ArticleRelationItem),
  contributors: t.Array(ArticleRelationItem),
});

export const CategoryListResponse = t.Object({
  ok: t.Boolean(),
  items: t.Array(CategoryResponseItem),
  page: t.Number(),
  pageSize: t.Number(),
  total: t.Number(),
});

export const TagListResponse = t.Object({
  ok: t.Boolean(),
  items: t.Array(TagResponseItem),
  page: t.Number(),
  pageSize: t.Number(),
  total: t.Number(),
});

export const ContributorListResponse = t.Object({
  ok: t.Boolean(),
  items: t.Array(ContributorResponseItem),
  page: t.Number(),
  pageSize: t.Number(),
  total: t.Number(),
});

export const ArticleListResponse = t.Object({
  ok: t.Boolean(),
  items: t.Array(ArticleResponseItem),
  page: t.Number(),
  pageSize: t.Number(),
  total: t.Number(),
});

export const CategoryResponse = t.Object({
  ok: t.Boolean(),
  item: CategoryResponseItem,
});

export const TagResponse = t.Object({
  ok: t.Boolean(),
  item: TagResponseItem,
});

export const ContributorResponse = t.Object({
  ok: t.Boolean(),
  item: ContributorResponseItem,
});

export const ArticleResponse = t.Object({
  ok: t.Boolean(),
  item: ArticleResponseItem,
});

export const OkResponse = t.Object({
  ok: t.Boolean(),
});

export { IdParams };
