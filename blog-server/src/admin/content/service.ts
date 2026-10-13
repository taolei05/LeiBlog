import type { Sql, TransactionSql } from "postgres";

import { getSql } from "../../shared/db/postgres";
import { queueArticleNotifications } from "../../shared/email-notifications";
import { createDeepLPreferredSlug, createPinyinSlug, normalizeSlug } from "../../shared/slug";
import { CONTENT_FAILURE, ContentError, ContentInputError } from "./errors";
import { normalizeContentUrl, parsePublicationDate } from "./input-policy";
import { upsertArticleEn, upsertCategoryEn, upsertTagEn } from "./localizations";

export { CONTENT_FAILURE, ContentError } from "./errors";
export type { ContentFailure } from "./errors";

type ContentSql = Sql | TransactionSql;

export const ARTICLE_STATUS = {
  Draft: "draft",
  Published: "published",
  Scheduled: "scheduled",
} as const;

export type ArticleStatus = (typeof ARTICLE_STATUS)[keyof typeof ARTICLE_STATUS];

export type ArticleRelation = {
  color: string | null;
  description: string | null;
  id: string;
  localizations: TaxonomyLocalizations;
  name: string;
  slug: string;
};

export type ArticleContributorRelation = {
  avatarUrl: string | null;
  id: string;
  linkUrl: string | null;
  name: string;
};

export type TaxonomyLocalization = {
  description: string;
  name: string;
};

export type TaxonomyLocalizations = {
  en: TaxonomyLocalization;
  zhCN: TaxonomyLocalization;
};

export type ArticleLocalization = {
  contentMdx: string;
  summary: string;
  title: string;
};

export type ArticleLocalizations = {
  en: ArticleLocalization;
  zhCN: ArticleLocalization;
};

export type ArticleCategory = {
  articleCount: number;
  createdAt: string;
  description: string | null;
  id: string;
  localizations: TaxonomyLocalizations;
  name: string;
  slug: string;
  sortOrder: number;
  updatedAt: string;
};

export type ArticleTag = {
  articleCount: number;
  color: string | null;
  createdAt: string;
  description: string | null;
  id: string;
  localizations: TaxonomyLocalizations;
  name: string;
  slug: string;
  updatedAt: string;
};

export type ArticleContributor = ArticleContributorRelation & {
  articleCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Article = {
  authorId: string | null;
  authorName: string | null;
  categories: ArticleRelation[];
  commentCount: number;
  contributors: ArticleContributorRelation[];
  contentMdx: string;
  coverImageUrl: string | null;
  createdAt: string;
  id: string;
  isPinned: boolean;
  localizations: ArticleLocalizations;
  publishedAt: string | null;
  readCount: number;
  scheduledPublishAt: string | null;
  slug: string;
  status: ArticleStatus;
  summary: string | null;
  tags: ArticleRelation[];
  title: string;
  updatedAt: string;
};

export type ContentPageInfo = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type ArticleList = {
  items: Article[];
  ok: true;
  pageInfo: ContentPageInfo;
};

export type CategoryList = {
  items: ArticleCategory[];
  ok: true;
  pageInfo: ContentPageInfo;
};

export type TagList = {
  items: ArticleTag[];
  ok: true;
  pageInfo: ContentPageInfo;
};

export type ContributorList = {
  items: ArticleContributor[];
  ok: true;
  pageInfo: ContentPageInfo;
};

export type ArticleInput = {
  categoryIds?: string[];
  contentMdx?: string;
  contributorIds?: string[];
  coverImageUrl?: string | null;
  isPinned?: boolean;
  localizations?: {
    en?: Partial<Record<keyof ArticleLocalization, string | null>>;
  };
  publishedAt?: string | null;
  scheduledPublishAt?: string | null;
  slug?: string;
  status?: ArticleStatus;
  summary?: string | null;
  tagIds?: string[];
  title: string;
};

export type ArticlePatchInput = Partial<ArticleInput>;

export type CategoryInput = {
  description?: string | null;
  localizations?: {
    en?: Partial<Record<keyof TaxonomyLocalization, string | null>>;
  };
  name: string;
  slug?: string;
};

export type TagInput = CategoryInput & {
  color?: string | null;
};

export type ContributorInput = {
  avatarUrl?: string | null;
  linkUrl?: string | null;
  name: string;
};

export type ContentListQuery = {
  page?: number;
  pageSize?: number;
  query?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export type ArticleListQuery = ContentListQuery & {
  categorySlug?: string;
  isPinned?: boolean;
  publicOnly?: boolean;
  status?: ArticleStatus | "all";
  tagSlug?: string;
};

type ArticleRow = {
  authorId: string | null;
  authorName: string | null;
  categories: unknown;
  commentCount: number | string | bigint | null;
  contributors: unknown;
  contentMdx: string;
  contentMdxEn: string | null;
  coverImageUrl: string | null;
  createdAt: Date | string;
  id: string;
  isPinned: boolean;
  publishedAt: Date | string | null;
  readCount: number | string | bigint;
  scheduledPublishAt: Date | string | null;
  slug: string;
  status: ArticleStatus;
  summary: string | null;
  summaryEn: string | null;
  tags: unknown;
  title: string;
  titleEn: string | null;
  updatedAt: Date | string;
};

type CategoryRow = {
  articleCount: number | string | bigint | null;
  createdAt: Date | string;
  description: string | null;
  descriptionEn: string | null;
  id: string;
  name: string;
  nameEn: string | null;
  slug: string;
  sortOrder: number;
  updatedAt: Date | string;
};

type TagRow = {
  articleCount: number | string | bigint | null;
  color: string | null;
  createdAt: Date | string;
  description: string | null;
  descriptionEn: string | null;
  id: string;
  name: string;
  nameEn: string | null;
  slug: string;
  updatedAt: Date | string;
};

type ContributorRow = {
  articleCount: number | string | bigint | null;
  avatarUrl: string | null;
  createdAt: Date | string;
  id: string;
  linkUrl: string | null;
  name: string;
  updatedAt: Date | string;
};

type CountRow = {
  total: number | string | bigint;
};

type SqlParameterValue = boolean | number | string;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 100;

const randomTagColors = [
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

const randomTagColor = () =>
  randomTagColors[Math.floor(Math.random() * randomTagColors.length)] ?? "#ec4899";

const toTimestamp = (value: Date | string | null) => {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

const cleanText = (value: string) => value.trim();

const cleanOptionalText = (value: string | null | undefined) => {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue.length > 0 ? trimmedValue : null;
};

const cleanIdList = (values: readonly string[] | undefined) =>
  Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));

const toPage = ({ page, pageSize }: ContentListQuery): ContentPageInfo => {
  const safePage =
    page === undefined || !Number.isFinite(page) ? DEFAULT_PAGE : Math.max(1, Math.floor(page));
  const safePageSize =
    pageSize === undefined || !Number.isFinite(pageSize)
      ? DEFAULT_PAGE_SIZE
      : Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSize)));

  return {
    page: safePage,
    pageSize: safePageSize,
    totalItems: 0,
    totalPages: 1,
  };
};

const completePageInfo = ({
  page,
  pageSize,
  totalItems,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
}): ContentPageInfo => ({
  page,
  pageSize,
  totalItems,
  totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
});

const createSlugBase = async ({
  fallback,
  shouldTranslate,
  sql,
  value,
}: {
  fallback: string;
  shouldTranslate: boolean;
  sql: ContentSql;
  value: string;
}) => {
  if (shouldTranslate) {
    return createDeepLPreferredSlug({ fallback, sql, value });
  }

  return normalizeSlug(value) || createPinyinSlug(value) || fallback;
};

const readStatus = (status: string | undefined): ArticleStatus => {
  if (status === undefined) {
    return ARTICLE_STATUS.Draft;
  }

  if (
    status === ARTICLE_STATUS.Draft ||
    status === ARTICLE_STATUS.Published ||
    status === ARTICLE_STATUS.Scheduled
  ) {
    return status;
  }

  throw new ContentError(CONTENT_FAILURE.InvalidStatus, "Article status is invalid.");
};

const parseRelations = (value: unknown): ArticleRelation[] => {
  if (Array.isArray(value)) {
    return value.filter(isArticleRelation);
  }

  if (typeof value === "string") {
    const parsedValue: unknown = JSON.parse(value);
    return Array.isArray(parsedValue) ? parsedValue.filter(isArticleRelation) : [];
  }

  return [];
};

const parseContributorRelations = (value: unknown): ArticleContributorRelation[] => {
  if (Array.isArray(value)) {
    return value.filter(isArticleContributorRelation);
  }

  if (typeof value === "string") {
    const parsedValue: unknown = JSON.parse(value);
    return Array.isArray(parsedValue) ? parsedValue.filter(isArticleContributorRelation) : [];
  }

  return [];
};

const isArticleRelation = (value: unknown): value is ArticleRelation => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.slug === "string" &&
    (typeof record.description === "string" || record.description === null) &&
    (typeof record.color === "string" || record.color === null) &&
    typeof record.localizations === "object" &&
    record.localizations !== null
  );
};

const isArticleContributorRelation = (value: unknown): value is ArticleContributorRelation => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    (typeof record.avatarUrl === "string" || record.avatarUrl === null) &&
    (typeof record.linkUrl === "string" || record.linkUrl === null)
  );
};

const toTaxonomyLocalizations = ({
  description,
  descriptionEn,
  name,
  nameEn,
}: {
  description: string | null;
  descriptionEn: string | null;
  name: string;
  nameEn: string | null;
}): TaxonomyLocalizations => ({
  en: {
    description: descriptionEn ?? description ?? "",
    name: nameEn ?? name,
  },
  zhCN: {
    description: description ?? "",
    name,
  },
});

const toArticleLocalizations = (row: ArticleRow): ArticleLocalizations => ({
  en: {
    contentMdx: row.contentMdxEn ?? row.contentMdx,
    summary: row.summaryEn ?? row.summary ?? "",
    title: row.titleEn ?? row.title,
  },
  zhCN: {
    contentMdx: row.contentMdx,
    summary: row.summary ?? "",
    title: row.title,
  },
});

const toArticle = (row: ArticleRow): Article => ({
  authorId: row.authorId,
  authorName: row.authorName,
  categories: parseRelations(row.categories),
  commentCount: Number(row.commentCount ?? 0),
  contributors: parseContributorRelations(row.contributors),
  contentMdx: row.contentMdx,
  coverImageUrl: row.coverImageUrl,
  createdAt: toTimestamp(row.createdAt) ?? "",
  id: row.id,
  isPinned: row.isPinned,
  localizations: toArticleLocalizations(row),
  publishedAt: toTimestamp(row.publishedAt),
  readCount: Number(row.readCount),
  scheduledPublishAt: toTimestamp(row.scheduledPublishAt),
  slug: row.slug,
  status: row.status,
  summary: row.summary,
  tags: parseRelations(row.tags),
  title: row.title,
  updatedAt: toTimestamp(row.updatedAt) ?? "",
});

const toCategory = (row: CategoryRow): ArticleCategory => ({
  articleCount: Number(row.articleCount ?? 0),
  createdAt: toTimestamp(row.createdAt) ?? "",
  description: row.description,
  id: row.id,
  localizations: toTaxonomyLocalizations(row),
  name: row.name,
  slug: row.slug,
  sortOrder: Number(row.sortOrder),
  updatedAt: toTimestamp(row.updatedAt) ?? "",
});

const toTag = (row: TagRow): ArticleTag => ({
  articleCount: Number(row.articleCount ?? 0),
  color: row.color,
  createdAt: toTimestamp(row.createdAt) ?? "",
  description: row.description,
  id: row.id,
  localizations: toTaxonomyLocalizations(row),
  name: row.name,
  slug: row.slug,
  updatedAt: toTimestamp(row.updatedAt) ?? "",
});

const toContributor = (row: ContributorRow): ArticleContributor => ({
  articleCount: Number(row.articleCount ?? 0),
  avatarUrl: row.avatarUrl,
  createdAt: toTimestamp(row.createdAt) ?? "",
  id: row.id,
  linkUrl: row.linkUrl,
  name: row.name,
  updatedAt: toTimestamp(row.updatedAt) ?? "",
});

const articleSelectSql = `
  SELECT
    a.id,
    a.author_id,
    coalesce(u.name, u.username) AS author_name,
    a.title,
    ae.title AS title_en,
    a.slug,
    a.summary,
    ae.summary AS summary_en,
    a.content_mdx,
    ae.content_mdx AS content_mdx_en,
    a.cover_image_url,
    a.status,
    a.read_count,
    (
      SELECT count(*)
      FROM comments c
      WHERE c.article_id = a.id
        AND c.deleted_at IS NULL
    ) AS comment_count,
    a.is_pinned,
    a.created_at,
    a.updated_at,
    a.published_at,
    a.scheduled_publish_at,
    COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', c.id,
          'name', c.name,
          'slug', c.slug,
          'description', c.description,
          'color', null,
          'localizations', json_build_object(
            'zhCN', json_build_object(
              'name', c.name,
              'description', coalesce(c.description, '')
            ),
            'en', json_build_object(
              'name', coalesce(ce.name, c.name),
              'description', coalesce(ce.description, c.description, '')
            )
          )
        )
        ORDER BY c.sort_order ASC, c.created_at ASC
      )
      FROM article_category_links acl
      JOIN article_categories c ON c.id = acl.category_id
      LEFT JOIN article_categories_en ce ON ce.category_id = c.id
      WHERE acl.article_id = a.id
    ), '[]'::json) AS categories,
    COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', t.id,
          'name', t.name,
          'slug', t.slug,
          'description', t.description,
          'color', t.color,
          'localizations', json_build_object(
            'zhCN', json_build_object(
              'name', t.name,
              'description', coalesce(t.description, '')
            ),
            'en', json_build_object(
              'name', coalesce(te.name, t.name),
              'description', coalesce(te.description, t.description, '')
            )
          )
        )
        ORDER BY lower(t.name) ASC, t.created_at ASC
      )
      FROM article_tag_links atl
      JOIN article_tags t ON t.id = atl.tag_id
      LEFT JOIN article_tags_en te ON te.tag_id = t.id
      WHERE atl.article_id = a.id
    ), '[]'::json) AS tags,
    COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', c.id,
          'name', c.name,
          'avatarUrl', c.avatar_url,
          'linkUrl', c.link_url
        )
        ORDER BY lower(c.name) ASC, c.created_at ASC
      )
      FROM article_contributor_links acl
      JOIN article_contributors c ON c.id = acl.contributor_id
      WHERE acl.article_id = a.id
    ), '[]'::json) AS contributors
  FROM articles a
  LEFT JOIN users u ON u.id = a.author_id
  LEFT JOIN articles_en ae ON ae.article_id = a.id
`;

const readArticleOrderSql = ({
  sortBy,
  sortOrder,
}: {
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) => {
  const order = sortOrder === "asc" ? "ASC" : "DESC";
  const column =
    sortBy === "title"
      ? "lower(a.title)"
      : sortBy === "readCount"
        ? "a.read_count"
        : sortBy === "publishedAt"
          ? "a.published_at"
          : sortBy === "updatedAt"
            ? "a.updated_at"
            : "a.created_at";

  return `${column} ${order} NULLS LAST, a.is_pinned DESC, a.created_at DESC`;
};

const buildArticleWhereSql = (query: ArticleListQuery) => {
  const values: SqlParameterValue[] = [];
  const conditions = ["1 = 1"];

  const addValue = (value: SqlParameterValue) => {
    values.push(value);
    return `$${values.length}`;
  };

  const search = query.query?.trim();
  if (search !== undefined && search.length > 0) {
    const placeholder = addValue(`%${search}%`);
    conditions.push(
      `(a.title ILIKE ${placeholder} OR a.summary ILIKE ${placeholder} OR a.content_mdx ILIKE ${placeholder})`,
    );
  }

  if (query.publicOnly === true) {
    conditions.push("a.status = 'published'");
    conditions.push("(a.published_at IS NULL OR a.published_at <= now())");
  } else if (query.status !== undefined && query.status !== "all") {
    conditions.push(`a.status = ${addValue(query.status)}`);
  }

  if (query.categorySlug !== undefined && query.categorySlug.trim().length > 0) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM article_category_links acl
        JOIN article_categories c ON c.id = acl.category_id
        WHERE acl.article_id = a.id AND lower(c.slug) = lower(${addValue(query.categorySlug)})
      )
    `);
  }

  if (query.tagSlug !== undefined && query.tagSlug.trim().length > 0) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM article_tag_links atl
        JOIN article_tags t ON t.id = atl.tag_id
        WHERE atl.article_id = a.id AND lower(t.slug) = lower(${addValue(query.tagSlug)})
      )
    `);
  }

  if (query.isPinned !== undefined) {
    conditions.push(`a.is_pinned = ${addValue(query.isPinned)}`);
  }

  return {
    sql: conditions.join(" AND "),
    values,
  };
};

const ensureSlugAvailable = async ({
  exceptId,
  slug,
  sql,
  table,
}: {
  exceptId?: string;
  slug: string;
  sql: ContentSql;
  table: "article_categories" | "article_tags" | "articles";
}) => {
  const [row] = await sql.unsafe<{ id: string }[]>(
    `
      SELECT id
      FROM ${table}
      WHERE lower(slug) = lower($1)
        AND ($2::uuid IS NULL OR id <> $2)
      LIMIT 1
    `,
    [slug, exceptId ?? null],
  );

  if (row !== undefined) {
    throw new ContentError(CONTENT_FAILURE.SlugExists, "Slug already exists.");
  }
};

const createUniqueSlug = async ({
  exceptId,
  fallback,
  shouldTranslate = true,
  sql,
  table,
  value,
}: {
  exceptId?: string;
  fallback: string;
  shouldTranslate?: boolean;
  sql: ContentSql;
  table: "article_categories" | "article_tags" | "articles";
  value: string;
}) => {
  const baseSlug = await createSlugBase({ fallback, shouldTranslate, sql, value });

  for (let index = 0; index < 1000; index += 1) {
    const candidate = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
    try {
      await ensureSlugAvailable({ exceptId, slug: candidate, sql, table });
      return candidate;
    } catch (error) {
      if (!(error instanceof ContentError) || error.reason !== CONTENT_FAILURE.SlugExists) {
        throw error;
      }
    }
  }

  throw new ContentError(CONTENT_FAILURE.SlugExists, "Slug already exists.");
};

const readArticleRow = async ({ articleId, sql }: { articleId: string; sql: ContentSql }) => {
  const [row] = await sql.unsafe<ArticleRow[]>(
    `
      ${articleSelectSql}
      WHERE a.id = $1
      LIMIT 1
    `,
    [articleId],
  );

  if (row === undefined) {
    throw new ContentError(CONTENT_FAILURE.NotFound, "Article was not found.");
  }

  return row;
};

const readCategoryRow = async ({ categoryId, sql }: { categoryId: string; sql: ContentSql }) => {
  const [row] = await sql<CategoryRow[]>`
    SELECT
      c.id,
      c.name,
      ce.name AS name_en,
      c.slug,
      c.description,
      ce.description AS description_en,
      c.sort_order,
      c.created_at,
      c.updated_at,
      count(acl.article_id) AS article_count
    FROM article_categories c
    LEFT JOIN article_categories_en ce ON ce.category_id = c.id
    LEFT JOIN article_category_links acl ON acl.category_id = c.id
    WHERE c.id = ${categoryId}
    GROUP BY c.id, ce.name, ce.description
  `;

  if (row === undefined) {
    throw new ContentError(CONTENT_FAILURE.CategoryNotFound, "Category was not found.");
  }

  return row;
};

const readTagRow = async ({ sql, tagId }: { sql: ContentSql; tagId: string }) => {
  const [row] = await sql<TagRow[]>`
    SELECT
      t.id,
      t.name,
      te.name AS name_en,
      t.slug,
      t.color,
      t.description,
      te.description AS description_en,
      t.created_at,
      t.updated_at,
      count(atl.article_id) AS article_count
    FROM article_tags t
    LEFT JOIN article_tags_en te ON te.tag_id = t.id
    LEFT JOIN article_tag_links atl ON atl.tag_id = t.id
    WHERE t.id = ${tagId}
    GROUP BY t.id, te.name, te.description
  `;

  if (row === undefined) {
    throw new ContentError(CONTENT_FAILURE.TagNotFound, "Tag was not found.");
  }

  return row;
};

const readContributorRow = async ({
  contributorId,
  sql,
}: {
  contributorId: string;
  sql: ContentSql;
}) => {
  const [row] = await sql<ContributorRow[]>`
    SELECT
      c.id,
      c.name,
      c.avatar_url,
      c.link_url,
      c.created_at,
      c.updated_at,
      count(acl.article_id) AS article_count
    FROM article_contributors c
    LEFT JOIN article_contributor_links acl ON acl.contributor_id = c.id
    WHERE c.id = ${contributorId}
    GROUP BY c.id
  `;

  if (row === undefined) {
    throw new ContentError(CONTENT_FAILURE.ContributorNotFound, "Contributor was not found.");
  }

  return row;
};

const ensureRelationsExist = async ({
  categoryIds,
  contributorIds,
  sql,
  tagIds,
}: {
  categoryIds: readonly string[];
  contributorIds: readonly string[];
  sql: ContentSql;
  tagIds: readonly string[];
}) => {
  if (categoryIds.length > 0) {
    const rows = await sql<{ id: string }[]>`
      SELECT id
      FROM article_categories
      WHERE id = ANY(${categoryIds})
    `;
    if (rows.length !== categoryIds.length) {
      throw new ContentError(CONTENT_FAILURE.CategoryNotFound, "Category was not found.");
    }
  }

  if (tagIds.length > 0) {
    const rows = await sql<{ id: string }[]>`
      SELECT id
      FROM article_tags
      WHERE id = ANY(${tagIds})
    `;
    if (rows.length !== tagIds.length) {
      throw new ContentError(CONTENT_FAILURE.TagNotFound, "Tag was not found.");
    }
  }

  if (contributorIds.length > 0) {
    const rows = await sql<{ id: string }[]>`
      SELECT id
      FROM article_contributors
      WHERE id = ANY(${contributorIds})
    `;
    if (rows.length !== contributorIds.length) {
      throw new ContentError(CONTENT_FAILURE.ContributorNotFound, "Contributor was not found.");
    }
  }
};

const replaceArticleRelations = async ({
  articleId,
  categoryIds,
  contributorIds,
  sql,
  tagIds,
}: {
  articleId: string;
  categoryIds: readonly string[];
  contributorIds: readonly string[];
  sql: ContentSql;
  tagIds: readonly string[];
}) => {
  await sql`DELETE FROM article_category_links WHERE article_id = ${articleId}`;
  await sql`DELETE FROM article_tag_links WHERE article_id = ${articleId}`;
  await sql`DELETE FROM article_contributor_links WHERE article_id = ${articleId}`;

  for (const categoryId of categoryIds) {
    await sql`
      INSERT INTO article_category_links (article_id, category_id)
      VALUES (${articleId}, ${categoryId})
      ON CONFLICT DO NOTHING
    `;
  }

  for (const tagId of tagIds) {
    await sql`
      INSERT INTO article_tag_links (article_id, tag_id)
      VALUES (${articleId}, ${tagId})
      ON CONFLICT DO NOTHING
    `;
  }

  for (const contributorId of contributorIds) {
    await sql`
      INSERT INTO article_contributor_links (article_id, contributor_id)
      VALUES (${articleId}, ${contributorId})
      ON CONFLICT DO NOTHING
    `;
  }
};

const readArticlePublication = ({
  existing,
  input,
}: {
  existing?: Article;
  input: ArticleInput | ArticlePatchInput;
}) => {
  const nextStatus = readStatus(input.status ?? existing?.status);
  const publishedAtInput = parsePublicationDate(input.publishedAt);
  const scheduledPublishAtInput = parsePublicationDate(input.scheduledPublishAt);
  const publishedAt =
    publishedAtInput !== undefined
      ? publishedAtInput
      : nextStatus === ARTICLE_STATUS.Published
        ? existing?.publishedAt === null || existing?.publishedAt === undefined
          ? new Date()
          : new Date(existing.publishedAt)
        : existing?.publishedAt === undefined
          ? null
          : existing.publishedAt === null
            ? null
            : new Date(existing.publishedAt);
  const scheduledPublishAt =
    scheduledPublishAtInput !== undefined
      ? scheduledPublishAtInput
      : existing?.scheduledPublishAt === undefined || existing.scheduledPublishAt === null
        ? null
        : new Date(existing.scheduledPublishAt);
  if (nextStatus === ARTICLE_STATUS.Scheduled && scheduledPublishAt === null) {
    throw new ContentInputError("invalid-date", "Scheduled articles require a publication date.");
  }

  return {
    publishedAt: nextStatus === ARTICLE_STATUS.Published ? publishedAt : null,
    scheduledPublishAt: nextStatus === ARTICLE_STATUS.Scheduled ? scheduledPublishAt : null,
    status: nextStatus,
  };
};

export const listArticles = async (query: ArticleListQuery = {}): Promise<ArticleList> => {
  const sql = getSql();
  const pageInfo = toPage(query);
  const offset = (pageInfo.page - 1) * pageInfo.pageSize;
  const where = buildArticleWhereSql(query);
  const orderSql = readArticleOrderSql({
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  });
  const rows = await sql.unsafe<ArticleRow[]>(
    `
      ${articleSelectSql}
      WHERE ${where.sql}
      ORDER BY ${orderSql}
      LIMIT $${where.values.length + 1}
      OFFSET $${where.values.length + 2}
    `,
    [...where.values, pageInfo.pageSize, offset],
  );
  const [countRow] = await sql.unsafe<CountRow[]>(
    `
      SELECT count(*) AS total
      FROM articles a
      WHERE ${where.sql}
    `,
    where.values,
  );
  const totalItems = Number(countRow?.total ?? 0);

  return {
    items: rows.map(toArticle),
    ok: true,
    pageInfo: completePageInfo({
      page: pageInfo.page,
      pageSize: pageInfo.pageSize,
      totalItems,
    }),
  };
};

export const getArticle = async ({ articleId }: { articleId: string }) => {
  const sql = getSql();
  return toArticle(await readArticleRow({ articleId, sql }));
};

export const getPublicArticleBySlug = async ({ slug }: { slug: string }) => {
  const sql = getSql();
  const [row] = await sql.unsafe<ArticleRow[]>(
    `
      ${articleSelectSql}
      WHERE lower(a.slug) = lower($1)
        AND a.status = 'published'
        AND (a.published_at IS NULL OR a.published_at <= now())
      LIMIT 1
    `,
    [slug],
  );

  if (row === undefined) {
    throw new ContentError(CONTENT_FAILURE.NotFound, "Article was not found.");
  }

  await sql`UPDATE articles SET read_count = read_count + 1 WHERE id = ${row.id}`;

  return {
    item: {
      ...toArticle(row),
      readCount: Number(row.readCount) + 1,
    },
    ok: true,
  };
};

export const createArticle = async ({
  authorId,
  input,
}: {
  authorId: string;
  input: ArticleInput;
}) => {
  const sql = getSql();
  const title = cleanText(input.title);
  if (title.length === 0) {
    throw new ContentError(CONTENT_FAILURE.InvalidTitle, "Article title is required.");
  }

  return sql.begin(async (transaction) => {
    const explicitSlug = input.slug?.trim();
    const slug = await createUniqueSlug({
      fallback: "article",
      shouldTranslate: explicitSlug === undefined || explicitSlug.length === 0,
      sql: transaction,
      table: "articles",
      value: explicitSlug === undefined || explicitSlug.length === 0 ? title : explicitSlug,
    });
    const categoryIds = cleanIdList(input.categoryIds);
    const contributorIds = cleanIdList(input.contributorIds);
    const tagIds = cleanIdList(input.tagIds);
    await ensureRelationsExist({ categoryIds, contributorIds, sql: transaction, tagIds });
    const publication = readArticlePublication({ input });
    const [row] = await transaction<{ id: string }[]>`
      INSERT INTO articles (
        author_id,
        title,
        slug,
        summary,
        content_mdx,
        cover_image_url,
        status,
        is_pinned,
        published_at,
        scheduled_publish_at
      )
      VALUES (
        ${authorId},
        ${title},
        ${slug},
        ${cleanOptionalText(input.summary)},
        ${input.contentMdx ?? ""},
        ${normalizeContentUrl(input.coverImageUrl)},
        ${publication.status},
        ${input.isPinned ?? false},
        ${publication.publishedAt},
        ${publication.scheduledPublishAt}
      )
      RETURNING *
    `;
    await replaceArticleRelations({
      articleId: row.id,
      categoryIds,
      contributorIds,
      sql: transaction,
      tagIds,
    });
    await upsertArticleEn({
      articleId: row.id,
      input,
      sql: transaction,
    });
    await queueArticleNotifications({ articleId: row.id, sql: transaction });

    return {
      item: toArticle(await readArticleRow({ articleId: row.id, sql: transaction })),
      ok: true,
    };
  });
};

export const updateArticle = async ({
  articleId,
  input,
}: {
  articleId: string;
  input: ArticlePatchInput;
}) => {
  const sql = getSql();

  return sql.begin(async (transaction) => {
    const existing = toArticle(await readArticleRow({ articleId, sql: transaction }));
    const title = input.title === undefined ? existing.title : cleanText(input.title);
    if (title.length === 0) {
      throw new ContentError(CONTENT_FAILURE.InvalidTitle, "Article title is required.");
    }

    const slug =
      input.slug === undefined
        ? existing.slug
        : await createUniqueSlug({
            exceptId: articleId,
            fallback: "article",
            shouldTranslate: input.slug.trim().length === 0,
            sql: transaction,
            table: "articles",
            value: input.slug.trim().length === 0 ? title : input.slug.trim(),
          });
    const categoryIds =
      input.categoryIds === undefined
        ? existing.categories.map((category) => category.id)
        : cleanIdList(input.categoryIds);
    const contributorIds =
      input.contributorIds === undefined
        ? existing.contributors.map((contributor) => contributor.id)
        : cleanIdList(input.contributorIds);
    const tagIds =
      input.tagIds === undefined ? existing.tags.map((tag) => tag.id) : cleanIdList(input.tagIds);
    await ensureRelationsExist({ categoryIds, contributorIds, sql: transaction, tagIds });
    const publication = readArticlePublication({ existing, input });
    await transaction`
      UPDATE articles
      SET title = ${title},
          slug = ${slug},
          summary = ${input.summary === undefined ? existing.summary : cleanOptionalText(input.summary)},
          content_mdx = ${input.contentMdx ?? existing.contentMdx},
          cover_image_url = ${
            input.coverImageUrl === undefined
              ? existing.coverImageUrl
              : normalizeContentUrl(input.coverImageUrl)
          },
          status = ${publication.status},
          is_pinned = ${input.isPinned ?? existing.isPinned},
          published_at = ${publication.publishedAt},
          scheduled_publish_at = ${publication.scheduledPublishAt}
      WHERE id = ${articleId}
    `;
    await replaceArticleRelations({
      articleId,
      categoryIds,
      contributorIds,
      sql: transaction,
      tagIds,
    });
    await upsertArticleEn({
      articleId,
      input,
      sql: transaction,
    });
    await queueArticleNotifications({ articleId, sql: transaction });

    return {
      item: toArticle(await readArticleRow({ articleId, sql: transaction })),
      ok: true,
    };
  });
};

export const deleteArticle = async ({ articleId }: { articleId: string }) => {
  const sql = getSql();
  await readArticleRow({ articleId, sql });
  await sql`DELETE FROM articles WHERE id = ${articleId}`;

  return { ok: true };
};

export const listCategories = async (query: ContentListQuery = {}): Promise<CategoryList> => {
  const sql = getSql();
  const pageInfo = toPage(query);
  const offset = (pageInfo.page - 1) * pageInfo.pageSize;
  const search = query.query?.trim() ?? "";
  const order =
    query.sortBy === "name"
      ? `lower(c.name) ${query.sortOrder === "desc" ? "DESC" : "ASC"}`
      : "c.sort_order ASC, c.created_at ASC";
  const rows = await sql.unsafe<CategoryRow[]>(
    `
      SELECT
        c.id,
        c.name,
        ce.name AS name_en,
        c.slug,
        c.description,
        ce.description AS description_en,
        c.sort_order,
        c.created_at,
        c.updated_at,
        count(acl.article_id) AS article_count
      FROM article_categories c
      LEFT JOIN article_categories_en ce ON ce.category_id = c.id
      LEFT JOIN article_category_links acl ON acl.category_id = c.id
      WHERE ($1 = '' OR c.name ILIKE $2 OR c.slug ILIKE $2 OR c.description ILIKE $2)
      GROUP BY c.id, ce.name, ce.description
      ORDER BY ${order}
      LIMIT $3
      OFFSET $4
    `,
    [search, `%${search}%`, pageInfo.pageSize, offset],
  );
  const [countRow] = await sql<CountRow[]>`
    SELECT count(*) AS total
    FROM article_categories c
    WHERE ${search} = '' OR c.name ILIKE ${`%${search}%`} OR c.slug ILIKE ${`%${search}%`} OR c.description ILIKE ${`%${search}%`}
  `;
  const totalItems = Number(countRow?.total ?? 0);

  return {
    items: rows.map(toCategory),
    ok: true,
    pageInfo: completePageInfo({
      page: pageInfo.page,
      pageSize: pageInfo.pageSize,
      totalItems,
    }),
  };
};

export const listPublicCategories = async (): Promise<CategoryList> => {
  const sql = getSql();
  const rows = await sql<CategoryRow[]>`
    SELECT
      c.id,
      c.name,
      ce.name AS name_en,
      c.slug,
      c.description,
      ce.description AS description_en,
      c.sort_order,
      c.created_at,
      c.updated_at,
      count(a.id) AS article_count
    FROM article_categories c
    LEFT JOIN article_categories_en ce ON ce.category_id = c.id
    LEFT JOIN article_category_links acl ON acl.category_id = c.id
    LEFT JOIN articles a
      ON a.id = acl.article_id
      AND a.status = 'published'
      AND (a.published_at IS NULL OR a.published_at <= now())
    GROUP BY c.id, ce.name, ce.description
    ORDER BY c.sort_order ASC, c.created_at ASC
  `;

  return {
    items: rows.map(toCategory),
    ok: true,
    pageInfo: completePageInfo({
      page: 1,
      pageSize: Math.max(1, rows.length),
      totalItems: rows.length,
    }),
  };
};

export const createCategory = async ({ input }: { input: CategoryInput }) => {
  const sql = getSql();
  const name = cleanText(input.name);
  if (name.length === 0) {
    throw new ContentError(CONTENT_FAILURE.InvalidTitle, "Category name is required.");
  }

  const slug = await createUniqueSlug({
    fallback: "category",
    shouldTranslate: input.slug === undefined || input.slug.trim().length === 0,
    sql,
    table: "article_categories",
    value: input.slug === undefined || input.slug.trim().length === 0 ? name : input.slug.trim(),
  });
  const [row] = await sql<CategoryRow[]>`
    INSERT INTO article_categories (name, slug, description, sort_order)
    VALUES (
      ${name},
      ${slug},
      ${cleanOptionalText(input.description)},
      (SELECT coalesce(max(sort_order), -1) + 1 FROM article_categories)
    )
    RETURNING id
  `;
  await upsertCategoryEn({
    categoryId: row.id,
    input,
    sql,
  });

  return { item: toCategory(await readCategoryRow({ categoryId: row.id, sql })), ok: true };
};

export const updateCategory = async ({
  categoryId,
  input,
}: {
  categoryId: string;
  input: CategoryInput;
}) => {
  const sql = getSql();
  await readCategoryRow({ categoryId, sql });
  const name = cleanText(input.name);
  if (name.length === 0) {
    throw new ContentError(CONTENT_FAILURE.InvalidTitle, "Category name is required.");
  }

  const slug = await createUniqueSlug({
    exceptId: categoryId,
    fallback: "category",
    shouldTranslate: input.slug === undefined || input.slug.trim().length === 0,
    sql,
    table: "article_categories",
    value: input.slug === undefined || input.slug.trim().length === 0 ? name : input.slug.trim(),
  });
  await sql`
    UPDATE article_categories
    SET name = ${name},
        slug = ${slug},
        description = ${cleanOptionalText(input.description)}
    WHERE id = ${categoryId}
  `;
  await upsertCategoryEn({
    categoryId,
    input,
    sql,
  });

  return { item: toCategory(await readCategoryRow({ categoryId, sql })), ok: true };
};

export const deleteCategory = async ({ categoryId }: { categoryId: string }) => {
  const sql = getSql();
  await readCategoryRow({ categoryId, sql });
  const [countRow] = await sql<CountRow[]>`
    SELECT count(*) AS total
    FROM article_category_links
    WHERE category_id = ${categoryId}
  `;
  if (Number(countRow?.total ?? 0) > 0) {
    throw new ContentError(CONTENT_FAILURE.TaxonomyInUse, "Category is used by articles.");
  }

  await sql`DELETE FROM article_categories WHERE id = ${categoryId}`;
  return { ok: true };
};

export const listTags = async (query: ContentListQuery = {}): Promise<TagList> => {
  const sql = getSql();
  const pageInfo = toPage(query);
  const offset = (pageInfo.page - 1) * pageInfo.pageSize;
  const search = query.query?.trim() ?? "";
  const order =
    query.sortBy === "name"
      ? `lower(t.name) ${query.sortOrder === "desc" ? "DESC" : "ASC"}`
      : "t.created_at DESC";
  const rows = await sql.unsafe<TagRow[]>(
    `
      SELECT
        t.id,
        t.name,
        te.name AS name_en,
        t.slug,
        t.color,
        t.description,
        te.description AS description_en,
        t.created_at,
        t.updated_at,
        count(atl.article_id) AS article_count
      FROM article_tags t
      LEFT JOIN article_tags_en te ON te.tag_id = t.id
      LEFT JOIN article_tag_links atl ON atl.tag_id = t.id
      WHERE ($1 = '' OR t.name ILIKE $2 OR t.slug ILIKE $2 OR t.description ILIKE $2)
      GROUP BY t.id, te.name, te.description
      ORDER BY ${order}
      LIMIT $3
      OFFSET $4
    `,
    [search, `%${search}%`, pageInfo.pageSize, offset],
  );
  const [countRow] = await sql<CountRow[]>`
    SELECT count(*) AS total
    FROM article_tags t
    WHERE ${search} = '' OR t.name ILIKE ${`%${search}%`} OR t.slug ILIKE ${`%${search}%`} OR t.description ILIKE ${`%${search}%`}
  `;
  const totalItems = Number(countRow?.total ?? 0);

  return {
    items: rows.map(toTag),
    ok: true,
    pageInfo: completePageInfo({
      page: pageInfo.page,
      pageSize: pageInfo.pageSize,
      totalItems,
    }),
  };
};

export const listPublicTags = async (): Promise<TagList> => {
  const sql = getSql();
  const rows = await sql<TagRow[]>`
    SELECT
      t.id,
      t.name,
      te.name AS name_en,
      t.slug,
      t.color,
      t.description,
      te.description AS description_en,
      t.created_at,
      t.updated_at,
      count(a.id) AS article_count
    FROM article_tags t
    LEFT JOIN article_tags_en te ON te.tag_id = t.id
    LEFT JOIN article_tag_links atl ON atl.tag_id = t.id
    LEFT JOIN articles a
      ON a.id = atl.article_id
      AND a.status = 'published'
      AND (a.published_at IS NULL OR a.published_at <= now())
    GROUP BY t.id, te.name, te.description
    ORDER BY lower(t.name) ASC, t.created_at ASC
  `;

  return {
    items: rows.map(toTag),
    ok: true,
    pageInfo: completePageInfo({
      page: 1,
      pageSize: Math.max(1, rows.length),
      totalItems: rows.length,
    }),
  };
};

export const createTag = async ({ input }: { input: TagInput }) => {
  const sql = getSql();
  const name = cleanText(input.name);
  if (name.length === 0) {
    throw new ContentError(CONTENT_FAILURE.InvalidTitle, "Tag name is required.");
  }

  const slug = await createUniqueSlug({
    fallback: "tag",
    shouldTranslate: input.slug === undefined || input.slug.trim().length === 0,
    sql,
    table: "article_tags",
    value: input.slug === undefined || input.slug.trim().length === 0 ? name : input.slug.trim(),
  });
  const [row] = await sql<TagRow[]>`
    INSERT INTO article_tags (name, slug, color, description)
    VALUES (
        ${name},
        ${slug},
        ${cleanOptionalText(input.color) ?? randomTagColor()},
        ${cleanOptionalText(input.description)}
      )
    RETURNING id
  `;
  await upsertTagEn({
    input,
    sql,
    tagId: row.id,
  });

  return { item: toTag(await readTagRow({ sql, tagId: row.id })), ok: true };
};

export const updateTag = async ({ input, tagId }: { input: TagInput; tagId: string }) => {
  const sql = getSql();
  await readTagRow({ sql, tagId });
  const name = cleanText(input.name);
  if (name.length === 0) {
    throw new ContentError(CONTENT_FAILURE.InvalidTitle, "Tag name is required.");
  }

  const slug = await createUniqueSlug({
    exceptId: tagId,
    fallback: "tag",
    shouldTranslate: input.slug === undefined || input.slug.trim().length === 0,
    sql,
    table: "article_tags",
    value: input.slug === undefined || input.slug.trim().length === 0 ? name : input.slug.trim(),
  });
  await sql`
    UPDATE article_tags
    SET name = ${name},
        slug = ${slug},
        color = ${cleanOptionalText(input.color)},
        description = ${cleanOptionalText(input.description)}
    WHERE id = ${tagId}
  `;
  await upsertTagEn({
    input,
    sql,
    tagId,
  });

  return { item: toTag(await readTagRow({ sql, tagId })), ok: true };
};

export const deleteTag = async ({ tagId }: { tagId: string }) => {
  const sql = getSql();
  await readTagRow({ sql, tagId });
  const [countRow] = await sql<CountRow[]>`
    SELECT count(*) AS total
    FROM article_tag_links
    WHERE tag_id = ${tagId}
  `;
  if (Number(countRow?.total ?? 0) > 0) {
    throw new ContentError(CONTENT_FAILURE.TaxonomyInUse, "Tag is used by articles.");
  }

  await sql`DELETE FROM article_tags WHERE id = ${tagId}`;
  return { ok: true };
};

export const listContributors = async (query: ContentListQuery = {}): Promise<ContributorList> => {
  const sql = getSql();
  const pageInfo = toPage(query);
  const offset = (pageInfo.page - 1) * pageInfo.pageSize;
  const search = query.query?.trim() ?? "";
  const order =
    query.sortBy === "name"
      ? `lower(c.name) ${query.sortOrder === "desc" ? "DESC" : "ASC"}`
      : "c.created_at DESC";
  const rows = await sql.unsafe<ContributorRow[]>(
    `
      SELECT
        c.id,
        c.name,
        c.avatar_url,
        c.link_url,
        c.created_at,
        c.updated_at,
        count(acl.article_id) AS article_count
      FROM article_contributors c
      LEFT JOIN article_contributor_links acl ON acl.contributor_id = c.id
      WHERE ($1 = '' OR c.name ILIKE $2 OR c.link_url ILIKE $2)
      GROUP BY c.id
      ORDER BY ${order}
      LIMIT $3
      OFFSET $4
    `,
    [search, `%${search}%`, pageInfo.pageSize, offset],
  );
  const [countRow] = await sql<CountRow[]>`
    SELECT count(*) AS total
    FROM article_contributors c
    WHERE ${search} = '' OR c.name ILIKE ${`%${search}%`} OR c.link_url ILIKE ${`%${search}%`}
  `;
  const totalItems = Number(countRow?.total ?? 0);

  return {
    items: rows.map(toContributor),
    ok: true,
    pageInfo: completePageInfo({
      page: pageInfo.page,
      pageSize: pageInfo.pageSize,
      totalItems,
    }),
  };
};

export const createContributor = async ({ input }: { input: ContributorInput }) => {
  const sql = getSql();
  const name = cleanText(input.name);
  if (name.length === 0) {
    throw new ContentError(CONTENT_FAILURE.InvalidTitle, "Contributor name is required.");
  }

  const [row] = await sql<{ id: string }[]>`
    INSERT INTO article_contributors (name, avatar_url, link_url)
    VALUES (
      ${name},
      ${normalizeContentUrl(input.avatarUrl)},
      ${normalizeContentUrl(input.linkUrl)}
    )
    RETURNING id
  `;

  return {
    item: toContributor(await readContributorRow({ contributorId: row.id, sql })),
    ok: true,
  };
};

export const updateContributor = async ({
  contributorId,
  input,
}: {
  contributorId: string;
  input: ContributorInput;
}) => {
  const sql = getSql();
  await readContributorRow({ contributorId, sql });
  const name = cleanText(input.name);
  if (name.length === 0) {
    throw new ContentError(CONTENT_FAILURE.InvalidTitle, "Contributor name is required.");
  }

  await sql`
    UPDATE article_contributors
    SET name = ${name},
        avatar_url = ${normalizeContentUrl(input.avatarUrl)},
        link_url = ${normalizeContentUrl(input.linkUrl)}
    WHERE id = ${contributorId}
  `;

  return {
    item: toContributor(await readContributorRow({ contributorId, sql })),
    ok: true,
  };
};

export const deleteContributor = async ({ contributorId }: { contributorId: string }) => {
  const sql = getSql();
  await readContributorRow({ contributorId, sql });
  await sql`DELETE FROM article_contributors WHERE id = ${contributorId}`;
  return { ok: true };
};
