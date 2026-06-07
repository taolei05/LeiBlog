import { cacheRememberJson, createCacheHash } from "../../shared/cache";
import { db, type DbClient } from "../../shared/db";
import { notFound } from "../../shared/errors";
import { redisKeys } from "../../shared/redis";

type SortOrder = "asc" | "desc";

export interface PublicArticleQuery {
  search?: string;
  page?: number;
  pageSize?: number;
  categorySlug?: string;
  tagSlug?: string;
  isPinned?: boolean;
  sortBy?: "createdAt" | "publishedAt" | "title" | "readCount";
  sortOrder?: SortOrder;
}

interface RelationItem {
  id: string;
  name: string;
  slug?: string;
  color?: string | null;
  avatarUrl?: string | null;
  linkUrl?: string | null;
}

interface ArticleSummaryRow {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  cover_image_url: string | null;
  read_count: string | number | bigint;
  is_pinned: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  published_at: Date | string | null;
  comment_count: string | number | bigint;
  categories: string | RelationItem[];
  tags: string | RelationItem[];
}

interface ArticleDetailRow extends ArticleSummaryRow {
  content_mdx: string;
  contributors: string | RelationItem[];
}

function toIso(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function parseRelations(value: string | RelationItem[]) {
  if (Array.isArray(value)) return value;
  return JSON.parse(value) as RelationItem[];
}

function toPage(input: PublicArticleQuery) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 12;
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

function articleOrder(sortBy: PublicArticleQuery["sortBy"], sortOrder: SortOrder | undefined) {
  const order = sortOrder === "asc" ? "ASC" : "DESC";
  const column =
    sortBy === "title"
      ? "lower(a.title)"
      : sortBy === "createdAt"
        ? "a.created_at"
        : sortBy === "readCount"
          ? "a.read_count"
          : "a.published_at";

  return `a.is_pinned DESC, ${column} ${order} NULLS LAST, a.published_at DESC, a.created_at DESC`;
}

const publicArticleSearchCondition = `
  (
    $1::text IS NULL
    OR lower(a.title) LIKE $1
    OR lower(a.slug) LIKE $1
    OR lower(coalesce(a.summary, '')) LIKE $1
    OR lower(coalesce(a.content_mdx, '')) LIKE $1
    OR EXISTS (
      SELECT 1
      FROM article_category_links acl
      JOIN article_categories c ON c.id = acl.category_id
      WHERE acl.article_id = a.id
        AND (lower(c.name) LIKE $1 OR lower(c.slug) LIKE $1)
    )
    OR EXISTS (
      SELECT 1
      FROM article_tag_links atl
      JOIN article_tags t ON t.id = atl.tag_id
      WHERE atl.article_id = a.id
        AND (lower(t.name) LIKE $1 OR lower(t.slug) LIKE $1)
    )
  )
`;

function toArticleSummary(row: ArticleSummaryRow) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    coverImageUrl: row.cover_image_url,
    readCount: Number(row.read_count),
    isPinned: row.is_pinned,
    createdAt: toIso(row.created_at) ?? "",
    updatedAt: toIso(row.updated_at) ?? "",
    publishedAt: toIso(row.published_at),
    commentCount: Number(row.comment_count),
    categories: parseRelations(row.categories),
    tags: parseRelations(row.tags),
  };
}

function toArticleDetail(row: ArticleDetailRow) {
  return {
    ...toArticleSummary(row),
    contentMdx: row.content_mdx,
    contributors: parseRelations(row.contributors),
  };
}

export async function listPublishedArticles(
  query: PublicArticleQuery,
  client: DbClient = db
) {
  const { page, pageSize, offset } = toPage(query);
  const normalizedQuery = {
    search: query.search?.trim().toLowerCase() || null,
    page,
    pageSize,
    categorySlug: query.categorySlug?.trim().toLowerCase() || null,
    tagSlug: query.tagSlug?.trim().toLowerCase() || null,
    isPinned: query.isPinned ?? null,
    sortBy: query.sortBy ?? "publishedAt",
    sortOrder: query.sortOrder ?? "desc",
  };
  const cacheKey = redisKeys.postList(createCacheHash(normalizedQuery));

  return cacheRememberJson(cacheKey, async () => {
    const search = normalizedQuery.search ? `%${normalizedQuery.search}%` : null;
    const orderBy = articleOrder(normalizedQuery.sortBy, normalizedQuery.sortOrder);

    const rows = await client.unsafe<ArticleSummaryRow[]>(
      `
        SELECT
          a.id, a.title, a.slug, a.summary, a.cover_image_url,
          a.read_count, a.is_pinned, a.created_at, a.updated_at, a.published_at,
          (
            SELECT count(*)
            FROM comments c
            WHERE c.article_id = a.id
              AND c.target_type = 'article'
              AND c.status = 'approved'
              AND c.deleted_at IS NULL
          ) AS comment_count,
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug) ORDER BY c.name)
            FROM article_category_links acl
            JOIN article_categories c ON c.id = acl.category_id
            WHERE acl.article_id = a.id
          ), '[]'::jsonb) AS categories,
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug, 'color', t.color) ORDER BY t.name)
            FROM article_tag_links atl
            JOIN article_tags t ON t.id = atl.tag_id
            WHERE atl.article_id = a.id
          ), '[]'::jsonb) AS tags
        FROM articles a
        WHERE a.status = 'published'
          AND ${publicArticleSearchCondition}
          AND ($2::text IS NULL OR EXISTS (
            SELECT 1
            FROM article_category_links acl
            JOIN article_categories c ON c.id = acl.category_id
            WHERE acl.article_id = a.id AND lower(c.slug) = $2
          ))
          AND ($3::text IS NULL OR EXISTS (
            SELECT 1
            FROM article_tag_links atl
            JOIN article_tags t ON t.id = atl.tag_id
            WHERE atl.article_id = a.id AND lower(t.slug) = $3
          ))
          AND ($4::boolean IS NULL OR a.is_pinned = $4)
        ORDER BY ${orderBy}
        LIMIT $5 OFFSET $6
      `,
      [
        search,
        normalizedQuery.categorySlug,
        normalizedQuery.tagSlug,
        normalizedQuery.isPinned,
        pageSize,
        offset,
      ]
    );

    const [count] = await client.unsafe<{ total: string }[]>(
      `
        SELECT count(*) AS total
        FROM articles a
        WHERE a.status = 'published'
          AND ${publicArticleSearchCondition}
          AND ($2::text IS NULL OR EXISTS (
            SELECT 1
            FROM article_category_links acl
            JOIN article_categories c ON c.id = acl.category_id
            WHERE acl.article_id = a.id AND lower(c.slug) = $2
          ))
          AND ($3::text IS NULL OR EXISTS (
            SELECT 1
            FROM article_tag_links atl
            JOIN article_tags t ON t.id = atl.tag_id
            WHERE atl.article_id = a.id AND lower(t.slug) = $3
          ))
          AND ($4::boolean IS NULL OR a.is_pinned = $4)
      `,
      [
        search,
        normalizedQuery.categorySlug,
        normalizedQuery.tagSlug,
        normalizedQuery.isPinned,
      ]
    );

    return {
      ok: true,
      items: rows.map(toArticleSummary),
      page,
      pageSize,
      total: Number(count?.total ?? 0),
    };
  });
}

export async function getPublishedArticleBySlug(slug: string, client: DbClient = db) {
  const normalizedSlug = slug.trim().toLowerCase();

  return cacheRememberJson(redisKeys.post(normalizedSlug), async () => {
    const [row] = await client<ArticleDetailRow[]>`
      SELECT
        a.id, a.title, a.slug, a.summary, a.content_mdx, a.cover_image_url,
        a.read_count, a.is_pinned, a.created_at, a.updated_at, a.published_at,
        (
          SELECT count(*)
          FROM comments c
          WHERE c.article_id = a.id
            AND c.target_type = 'article'
            AND c.status = 'approved'
            AND c.deleted_at IS NULL
        ) AS comment_count,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug) ORDER BY c.name)
          FROM article_category_links acl
          JOIN article_categories c ON c.id = acl.category_id
          WHERE acl.article_id = a.id
        ), '[]'::jsonb) AS categories,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug, 'color', t.color) ORDER BY t.name)
          FROM article_tag_links atl
          JOIN article_tags t ON t.id = atl.tag_id
          WHERE atl.article_id = a.id
        ), '[]'::jsonb) AS tags,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'avatarUrl', c.avatar_url, 'linkUrl', c.link_url) ORDER BY c.name)
          FROM article_contributor_links acl
          JOIN article_contributors c ON c.id = acl.contributor_id
          WHERE acl.article_id = a.id
        ), '[]'::jsonb) AS contributors
      FROM articles a
      WHERE lower(a.slug) = ${normalizedSlug}
        AND a.status = 'published'
    `;

    if (!row) throw notFound("文章不存在或未发布");
    return toArticleDetail(row);
  });
}
