import { requireAdmin, type AuthUser } from "../../shared/auth";
import { decryptSecret, type StoredEncryptedSecret } from "../../shared/crypto";
import {
  clearAllArticleCache,
  clearArticleCache,
} from "../../shared/cache/content";
import { db, withTransaction, type DbClient } from "../../shared/db";
import { conflict, notFound, validationError } from "../../shared/errors";
import { createArticleSummary } from "../../shared/mdx/summary";
import { createPinyinSlug, normalizeSlug, withSlugSuffix } from "../../shared/slug";

type ArticleStatus = "draft" | "published" | "offline";
type SortOrder = "asc" | "desc";
type SlugTable = "article_categories" | "article_tags" | "articles";

export interface ListQuery {
  search?: string;
  page?: string;
  pageSize?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface ArticleListQuery extends ListQuery {
  status?: ArticleStatus;
  categoryId?: string;
  tagId?: string;
  contributorId?: string;
  isPinned?: string;
}

export interface CategoryInput {
  name: string;
  slug?: string;
}

export interface TagInput extends CategoryInput {
  color?: string | null;
}

export interface ContributorInput {
  name: string;
  avatarUrl?: string | null;
  linkUrl?: string | null;
}

export interface ArticleInput {
  title: string;
  slug?: string;
  summary?: string | null;
  contentMdx?: string;
  coverImageUrl?: string | null;
  status?: ArticleStatus;
  isPinned?: boolean;
  publishedAt?: string | null;
  categoryIds?: string[];
  tagIds?: string[];
  contributorIds?: string[];
}

export type ArticleUpdateInput = Partial<ArticleInput>;

interface TaxonomyRow {
  article_count?: string | number | bigint;
  id: string;
  name: string;
  slug: string;
  color?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ContributorRow {
  article_count?: string | number | bigint;
  id: string;
  name: string;
  avatar_url: string | null;
  link_url: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ArticleRow {
  id: string;
  author_id: string | null;
  author_name: string | null;
  title: string;
  slug: string;
  summary: string | null;
  content_mdx: string;
  cover_image_url: string | null;
  status: ArticleStatus;
  read_count: string | number | bigint;
  comment_count: string | number | bigint;
  is_pinned: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  published_at: Date | string | null;
  categories: string | RelationItem[];
  tags: string | RelationItem[];
  contributors: string | RelationItem[];
}

interface RelationItem {
  id: string;
  name: string;
  slug?: string;
  color?: string | null;
  avatarUrl?: string | null;
  linkUrl?: string | null;
}

interface DeepLConfigRow {
  deepl_api_key_encrypted: StoredEncryptedSecret | null;
}

function toIso(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function cleanOptional(value: string | null | undefined) {
  if (value === null) return null;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanIdList(values: string[] | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function parsePositiveInt(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function parseBoolean(value: string | undefined) {
  if (value === undefined) return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function parseDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw validationError("发布时间格式无效");
  return date;
}

function toPage(input: ListQuery) {
  const page = parsePositiveInt(input.page, 1, 10_000);
  const pageSize = parsePositiveInt(input.pageSize, 20, 100);
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

function taxonomyOrder(sortBy: string | undefined, sortOrder: SortOrder | undefined) {
  const order = sortOrder === "asc" ? "ASC" : "DESC";
  const column =
    sortBy === "name" ? "lower(name)" : sortBy === "slug" ? "lower(slug)" : "created_at";
  return `${column} ${order}, created_at DESC`;
}

function contributorOrder(sortBy: string | undefined, sortOrder: SortOrder | undefined) {
  const order = sortOrder === "asc" ? "ASC" : "DESC";
  const column = sortBy === "name" ? "lower(name)" : "created_at";
  return `${column} ${order}, created_at DESC`;
}

function articleOrder(sortBy: string | undefined, sortOrder: SortOrder | undefined) {
  const order = sortOrder === "asc" ? "ASC" : "DESC";
  const column =
    sortBy === "title"
      ? "lower(a.title)"
      : sortBy === "updatedAt"
        ? "a.updated_at"
        : sortBy === "publishedAt"
          ? "a.published_at"
          : sortBy === "readCount"
            ? "a.read_count"
            : "a.created_at";

  return `${column} ${order} NULLS LAST, a.created_at DESC`;
}

function toCategory(row: TaxonomyRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    articleCount: Number(row.article_count ?? 0),
    createdAt: toIso(row.created_at) ?? "",
    updatedAt: toIso(row.updated_at) ?? "",
  };
}

function toTag(row: TaxonomyRow) {
  return {
    ...toCategory(row),
    color: row.color ?? null,
  };
}

function toContributor(row: ContributorRow) {
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url,
    linkUrl: row.link_url,
    articleCount: Number(row.article_count ?? 0),
    createdAt: toIso(row.created_at) ?? "",
    updatedAt: toIso(row.updated_at) ?? "",
  };
}

function parseRelations(value: string | RelationItem[]) {
  if (Array.isArray(value)) return value;
  return JSON.parse(value) as RelationItem[];
}

function toArticle(row: ArticleRow) {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    contentMdx: row.content_mdx,
    coverImageUrl: row.cover_image_url,
    status: row.status,
    readCount: Number(row.read_count),
    commentCount: Number(row.comment_count),
    isPinned: row.is_pinned,
    createdAt: toIso(row.created_at) ?? "",
    updatedAt: toIso(row.updated_at) ?? "",
    publishedAt: toIso(row.published_at),
    categories: parseRelations(row.categories),
    tags: parseRelations(row.tags),
    contributors: parseRelations(row.contributors),
  };
}

async function slugExists(
  client: DbClient,
  table: SlugTable,
  slug: string,
  exceptId?: string
) {
  const [row] = await client.unsafe<{ id: string }[]>(
    `
      SELECT id
      FROM ${table}
      WHERE lower(slug) = lower($1)
        AND ($2::uuid IS NULL OR id <> $2)
      LIMIT 1
    `,
    [slug, exceptId ?? null]
  );

  return Boolean(row);
}

async function createUniqueManagedSlug(
  client: DbClient,
  table: SlugTable,
  baseValue: string,
  exceptId?: string
) {
  const baseSlug = normalizeSlug(baseValue) || createPinyinSlug(baseValue) || "item";

  for (let index = 1; index < 1000; index += 1) {
    const candidate = withSlugSuffix(baseSlug, index);
    if (!(await slugExists(client, table, candidate, exceptId))) return candidate;
  }

  throw conflict("slug 已存在");
}

async function translateTitleForSlug(title: string, client: DbClient) {
  const [config] = await client<DeepLConfigRow[]>`
    SELECT deepl_api_key_encrypted
    FROM site_config
    WHERE id = 1
  `;
  const apiKey = decryptSecret(config?.deepl_api_key_encrypted);
  if (!apiKey) return null;

  const endpoint = apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: [title],
        target_lang: "EN",
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      translations?: Array<{ text?: string }>;
    };
    return data.translations?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

async function createArticleSlugBase(
  title: string,
  explicitSlug: string | undefined,
  client: DbClient
) {
  if (explicitSlug?.trim()) return normalizeSlug(explicitSlug);

  const translated = await translateTitleForSlug(title, client);
  return normalizeSlug(translated ?? createPinyinSlug(title)) || "article";
}

async function getCategoryById(id: string, client: DbClient = db) {
  const [row] = await client<TaxonomyRow[]>`
    SELECT c.id, c.name, c.slug, c.created_at, c.updated_at,
           count(acl.article_id) AS article_count
    FROM article_categories c
    LEFT JOIN article_category_links acl ON acl.category_id = c.id
    WHERE c.id = ${id}
    GROUP BY c.id
  `;
  if (!row) throw notFound("分类不存在");
  return toCategory(row);
}

async function getTagById(id: string, client: DbClient = db) {
  const [row] = await client<TaxonomyRow[]>`
    SELECT t.id, t.name, t.slug, t.color, t.created_at, t.updated_at,
           count(atl.article_id) AS article_count
    FROM article_tags t
    LEFT JOIN article_tag_links atl ON atl.tag_id = t.id
    WHERE t.id = ${id}
    GROUP BY t.id
  `;
  if (!row) throw notFound("标签不存在");
  return toTag(row);
}

async function getContributorById(id: string, client: DbClient = db) {
  const [row] = await client<ContributorRow[]>`
    SELECT
      c.id, c.name, c.avatar_url, c.link_url, c.created_at, c.updated_at,
      (
        SELECT count(*)
        FROM article_contributor_links acl
        WHERE acl.contributor_id = c.id
      ) AS article_count
    FROM article_contributors c
    WHERE c.id = ${id}
  `;
  if (!row) throw notFound("贡献者不存在");
  return toContributor(row);
}

export async function listCategories(
  currentUser: AuthUser,
  query: ListQuery,
  client: DbClient = db
) {
  requireAdmin(currentUser);
  const { page, pageSize, offset } = toPage(query);
  const search = query.search?.trim()
    ? `%${query.search.trim().toLowerCase()}%`
    : null;
  const orderBy = taxonomyOrder(query.sortBy, query.sortOrder);

  const rows = await client.unsafe<TaxonomyRow[]>(
    `
      SELECT c.id, c.name, c.slug, c.created_at, c.updated_at,
             count(acl.article_id) AS article_count
      FROM article_categories c
      LEFT JOIN article_category_links acl ON acl.category_id = c.id
      WHERE ($1::text IS NULL OR lower(c.name) LIKE $1 OR lower(c.slug) LIKE $1)
      GROUP BY c.id
      ORDER BY ${orderBy}
      LIMIT $2 OFFSET $3
    `,
    [search, pageSize, offset]
  );
  const [count] = await client.unsafe<{ total: string }[]>(
    `
      SELECT count(*) AS total
      FROM article_categories c
      WHERE ($1::text IS NULL OR lower(c.name) LIKE $1 OR lower(c.slug) LIKE $1)
    `,
    [search]
  );

  return { ok: true, items: rows.map(toCategory), page, pageSize, total: Number(count?.total ?? 0) };
}

export async function createCategory(
  currentUser: AuthUser,
  input: CategoryInput,
  client: DbClient = db
) {
  requireAdmin(currentUser);
  const slug = await createUniqueManagedSlug(client, "article_categories", input.slug ?? input.name);
  const [row] = await client<TaxonomyRow[]>`
    INSERT INTO article_categories (name, slug)
    VALUES (${input.name.trim()}, ${slug})
    RETURNING id, name, slug, created_at, updated_at
  `;
  await clearAllArticleCache();
  return toCategory(row);
}

export async function updateCategory(
  currentUser: AuthUser,
  id: string,
  input: CategoryInput,
  client: DbClient = db
) {
  requireAdmin(currentUser);
  await getCategoryById(id, client);
  const slug = input.slug
    ? await createUniqueManagedSlug(client, "article_categories", input.slug, id)
    : undefined;

  await client`
    UPDATE article_categories
    SET name = ${input.name.trim()},
        slug = COALESCE(${slug ?? null}, slug)
    WHERE id = ${id}
  `;
  await clearAllArticleCache();
  return getCategoryById(id, client);
}

export async function deleteCategory(currentUser: AuthUser, id: string, client: DbClient = db) {
  requireAdmin(currentUser);
  await getCategoryById(id, client);
  await client`DELETE FROM article_categories WHERE id = ${id}`;
  await clearAllArticleCache();
  return { ok: true };
}

export async function listTags(currentUser: AuthUser, query: ListQuery, client: DbClient = db) {
  requireAdmin(currentUser);
  const { page, pageSize, offset } = toPage(query);
  const search = query.search?.trim()
    ? `%${query.search.trim().toLowerCase()}%`
    : null;
  const orderBy = taxonomyOrder(query.sortBy, query.sortOrder);

  const rows = await client.unsafe<TaxonomyRow[]>(
    `
      SELECT t.id, t.name, t.slug, t.color, t.created_at, t.updated_at,
             count(atl.article_id) AS article_count
      FROM article_tags t
      LEFT JOIN article_tag_links atl ON atl.tag_id = t.id
      WHERE ($1::text IS NULL OR lower(t.name) LIKE $1 OR lower(t.slug) LIKE $1)
      GROUP BY t.id
      ORDER BY ${orderBy}
      LIMIT $2 OFFSET $3
    `,
    [search, pageSize, offset]
  );
  const [count] = await client.unsafe<{ total: string }[]>(
    `
      SELECT count(*) AS total
      FROM article_tags t
      WHERE ($1::text IS NULL OR lower(t.name) LIKE $1 OR lower(t.slug) LIKE $1)
    `,
    [search]
  );

  return { ok: true, items: rows.map(toTag), page, pageSize, total: Number(count?.total ?? 0) };
}

export async function createTag(currentUser: AuthUser, input: TagInput, client: DbClient = db) {
  requireAdmin(currentUser);
  const slug = await createUniqueManagedSlug(client, "article_tags", input.slug ?? input.name);
  const [row] = await client<TaxonomyRow[]>`
    INSERT INTO article_tags (name, slug, color)
    VALUES (${input.name.trim()}, ${slug}, ${cleanOptional(input.color)})
    RETURNING id, name, slug, color, created_at, updated_at
  `;
  await clearAllArticleCache();
  return toTag(row);
}

export async function updateTag(
  currentUser: AuthUser,
  id: string,
  input: TagInput,
  client: DbClient = db
) {
  requireAdmin(currentUser);
  await getTagById(id, client);
  const slug = input.slug
    ? await createUniqueManagedSlug(client, "article_tags", input.slug, id)
    : undefined;

  await client`
    UPDATE article_tags
    SET name = ${input.name.trim()},
        slug = COALESCE(${slug ?? null}, slug),
        color = ${cleanOptional(input.color)}
    WHERE id = ${id}
  `;
  await clearAllArticleCache();
  return getTagById(id, client);
}

export async function deleteTag(currentUser: AuthUser, id: string, client: DbClient = db) {
  requireAdmin(currentUser);
  await getTagById(id, client);
  await client`DELETE FROM article_tags WHERE id = ${id}`;
  await clearAllArticleCache();
  return { ok: true };
}

export async function listContributors(
  currentUser: AuthUser,
  query: ListQuery,
  client: DbClient = db
) {
  requireAdmin(currentUser);
  const { page, pageSize, offset } = toPage(query);
  const search = query.search?.trim()
    ? `%${query.search.trim().toLowerCase()}%`
    : null;
  const orderBy = contributorOrder(query.sortBy, query.sortOrder);

  const rows = await client.unsafe<ContributorRow[]>(
    `
      SELECT
        c.id, c.name, c.avatar_url, c.link_url, c.created_at, c.updated_at,
        (
          SELECT count(*)
          FROM article_contributor_links acl
          WHERE acl.contributor_id = c.id
        ) AS article_count
      FROM article_contributors c
      WHERE ($1::text IS NULL OR lower(c.name) LIKE $1 OR lower(coalesce(c.link_url, '')) LIKE $1)
      ORDER BY ${orderBy}
      LIMIT $2 OFFSET $3
    `,
    [search, pageSize, offset]
  );
  const [count] = await client.unsafe<{ total: string }[]>(
    `
      SELECT count(*) AS total
      FROM article_contributors c
      WHERE ($1::text IS NULL OR lower(c.name) LIKE $1 OR lower(coalesce(c.link_url, '')) LIKE $1)
    `,
    [search]
  );

  return { ok: true, items: rows.map(toContributor), page, pageSize, total: Number(count?.total ?? 0) };
}

export async function createContributor(
  currentUser: AuthUser,
  input: ContributorInput,
  client: DbClient = db
) {
  requireAdmin(currentUser);
  const [row] = await client<{ id: string }[]>`
    INSERT INTO article_contributors (name, avatar_url, link_url)
    VALUES (${input.name.trim()}, ${cleanOptional(input.avatarUrl)}, ${cleanOptional(input.linkUrl)})
    RETURNING id
  `;
  await clearAllArticleCache();
  return getContributorById(row.id, client);
}

export async function updateContributor(
  currentUser: AuthUser,
  id: string,
  input: ContributorInput,
  client: DbClient = db
) {
  requireAdmin(currentUser);
  await getContributorById(id, client);
  await client`
    UPDATE article_contributors
    SET name = ${input.name.trim()},
        avatar_url = ${cleanOptional(input.avatarUrl)},
        link_url = ${cleanOptional(input.linkUrl)}
    WHERE id = ${id}
  `;
  await clearAllArticleCache();
  return getContributorById(id, client);
}

export async function deleteContributor(currentUser: AuthUser, id: string, client: DbClient = db) {
  requireAdmin(currentUser);
  await getContributorById(id, client);
  await client`DELETE FROM article_contributors WHERE id = ${id}`;
  await clearAllArticleCache();
  return { ok: true };
}

async function replaceArticleRelations(
  client: DbClient,
  articleId: string,
  categoryIds?: string[],
  tagIds?: string[],
  contributorIds?: string[]
) {
  if (categoryIds !== undefined) {
    const ids = cleanIdList(categoryIds).slice(0, 1);
    await client`DELETE FROM article_category_links WHERE article_id = ${articleId}`;
    if (ids.length > 0) {
      await client`
        INSERT INTO article_category_links (article_id, category_id)
        SELECT ${articleId}, input.category_id
        FROM unnest(${client.array(ids, "UUID")}) AS input(category_id)
      `;
    }
  }

  if (tagIds !== undefined) {
    const ids = cleanIdList(tagIds);
    await client`DELETE FROM article_tag_links WHERE article_id = ${articleId}`;
    if (ids.length > 0) {
      await client`
        INSERT INTO article_tag_links (article_id, tag_id)
        SELECT ${articleId}, input.tag_id
        FROM unnest(${client.array(ids, "UUID")}) AS input(tag_id)
      `;
    }
  }

  if (contributorIds !== undefined) {
    const ids = cleanIdList(contributorIds);
    await client`DELETE FROM article_contributor_links WHERE article_id = ${articleId}`;
    if (ids.length > 0) {
      await client`
        INSERT INTO article_contributor_links (article_id, contributor_id)
        SELECT ${articleId}, input.contributor_id
        FROM unnest(${client.array(ids, "UUID")}) AS input(contributor_id)
      `;
    }
  }
}

export async function getArticleById(id: string, client: DbClient = db) {
  const [row] = await client<ArticleRow[]>`
    SELECT
      a.id, a.author_id,
      (
        SELECT COALESCE(NULLIF(trim(u.name), ''), u.username)
        FROM users u
        WHERE u.id = a.author_id
      ) AS author_name,
      a.title, a.slug, a.summary, a.content_mdx,
      a.cover_image_url, a.status, a.read_count,
      (
        SELECT count(*)
        FROM comments c
        WHERE c.article_id = a.id
          AND c.deleted_at IS NULL
      ) AS comment_count,
      a.is_pinned,
      a.created_at, a.updated_at, a.published_at,
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
    WHERE a.id = ${id}
  `;

  if (!row) throw notFound("文章不存在");
  return toArticle(row);
}

export async function listArticles(
  currentUser: AuthUser,
  query: ArticleListQuery,
  client: DbClient = db
) {
  requireAdmin(currentUser);
  const { page, pageSize, offset } = toPage(query);
  const search = query.search?.trim()
    ? `%${query.search.trim().toLowerCase()}%`
    : null;
  const status = query.status ?? null;
  const categoryId = query.categoryId ?? null;
  const tagId = query.tagId ?? null;
  const contributorId = query.contributorId ?? null;
  const isPinned = parseBoolean(query.isPinned);
  const orderBy = articleOrder(query.sortBy, query.sortOrder);

  const rows = await client.unsafe<ArticleRow[]>(
    `
      SELECT
        a.id, a.author_id,
        (
          SELECT COALESCE(NULLIF(trim(u.name), ''), u.username)
          FROM users u
          WHERE u.id = a.author_id
        ) AS author_name,
        a.title, a.slug, a.summary, a.content_mdx,
        a.cover_image_url, a.status, a.read_count,
        (
          SELECT count(*)
          FROM comments c
          WHERE c.article_id = a.id
            AND c.deleted_at IS NULL
        ) AS comment_count,
        a.is_pinned,
        a.created_at, a.updated_at, a.published_at,
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
      WHERE ($1::text IS NULL OR lower(a.title) LIKE $1 OR lower(a.slug) LIKE $1 OR lower(coalesce(a.summary, '')) LIKE $1)
        AND ($2::article_status IS NULL OR a.status = $2)
        AND ($3::uuid IS NULL OR EXISTS (
          SELECT 1 FROM article_category_links acl
          WHERE acl.article_id = a.id AND acl.category_id = $3
        ))
        AND ($4::uuid IS NULL OR EXISTS (
          SELECT 1 FROM article_tag_links atl
          WHERE atl.article_id = a.id AND atl.tag_id = $4
        ))
        AND ($5::uuid IS NULL OR EXISTS (
          SELECT 1 FROM article_contributor_links acl
          WHERE acl.article_id = a.id AND acl.contributor_id = $5
        ))
        AND ($6::boolean IS NULL OR a.is_pinned = $6)
      ORDER BY ${orderBy}
      LIMIT $7 OFFSET $8
    `,
    [search, status, categoryId, tagId, contributorId, isPinned, pageSize, offset]
  );

  const [count] = await client.unsafe<{ total: string }[]>(
    `
      SELECT count(*) AS total
      FROM articles a
      WHERE ($1::text IS NULL OR lower(a.title) LIKE $1 OR lower(a.slug) LIKE $1 OR lower(coalesce(a.summary, '')) LIKE $1)
        AND ($2::article_status IS NULL OR a.status = $2)
        AND ($3::uuid IS NULL OR EXISTS (
          SELECT 1 FROM article_category_links acl
          WHERE acl.article_id = a.id AND acl.category_id = $3
        ))
        AND ($4::uuid IS NULL OR EXISTS (
          SELECT 1 FROM article_tag_links atl
          WHERE atl.article_id = a.id AND atl.tag_id = $4
        ))
        AND ($5::uuid IS NULL OR EXISTS (
          SELECT 1 FROM article_contributor_links acl
          WHERE acl.article_id = a.id AND acl.contributor_id = $5
        ))
        AND ($6::boolean IS NULL OR a.is_pinned = $6)
    `,
    [search, status, categoryId, tagId, contributorId, isPinned]
  );

  return { ok: true, items: rows.map(toArticle), page, pageSize, total: Number(count?.total ?? 0) };
}

export async function createArticle(
  currentUser: AuthUser,
  input: ArticleInput,
  client: DbClient = db
) {
  requireAdmin(currentUser);
  const contentMdx = input.contentMdx ?? "";
  const status = input.status ?? "draft";
  const publishedAtInput = parseDate(input.publishedAt);
  const publishedAt =
    publishedAtInput !== undefined
      ? publishedAtInput
      : status === "published"
        ? new Date()
        : null;
  const baseSlug = await createArticleSlugBase(input.title, input.slug, client);
  let articleId = "";

  await withTransaction(async (tx) => {
    const slug = await createUniqueManagedSlug(tx, "articles", baseSlug);
    const [row] = await tx<{ id: string }[]>`
      INSERT INTO articles (
        author_id, title, slug, summary, content_mdx, cover_image_url,
        status, is_pinned, published_at
      )
      VALUES (
        ${currentUser.id},
        ${input.title.trim()},
        ${slug},
        ${createArticleSummary(input.summary, contentMdx)},
        ${contentMdx},
        ${cleanOptional(input.coverImageUrl)},
        ${status},
        ${input.isPinned ?? false},
        ${publishedAt}
      )
      RETURNING id
    `;
    articleId = row.id;

    await replaceArticleRelations(
      tx,
      articleId,
      input.categoryIds ?? [],
      input.tagIds ?? [],
      input.contributorIds ?? []
    );
  }, client);

  const article = await getArticleById(articleId, client);
  await clearArticleCache([article.slug]);
  return article;
}

export async function updateArticle(
  currentUser: AuthUser,
  id: string,
  input: ArticleUpdateInput,
  client: DbClient = db
) {
  requireAdmin(currentUser);
  const existing = await getArticleById(id, client);
  const title = input.title?.trim() ?? existing.title;
  const contentMdx = input.contentMdx ?? existing.contentMdx;
  const summary =
    input.summary === undefined
      ? existing.summary
      : createArticleSummary(input.summary, contentMdx);
  const coverImageUrl =
    input.coverImageUrl === undefined
      ? existing.coverImageUrl
      : cleanOptional(input.coverImageUrl);
  const status = input.status ?? existing.status;
  const parsedPublishedAt = parseDate(input.publishedAt);
  const publishedAt =
    parsedPublishedAt !== undefined
      ? parsedPublishedAt
      : status === "published" && !existing.publishedAt
        ? new Date()
        : existing.publishedAt
          ? new Date(existing.publishedAt)
          : null;
  const slug =
    input.slug?.trim()
      ? await createUniqueManagedSlug(client, "articles", input.slug, id)
      : undefined;

  await withTransaction(async (tx) => {
    await tx`
      INSERT INTO article_revisions (
        article_id, editor_id, title, slug, summary, content_mdx, cover_image_url, status
      )
      SELECT id, ${currentUser.id}, title, slug, summary, content_mdx, cover_image_url, status
      FROM articles
      WHERE id = ${id}
    `;

    await tx`
      UPDATE articles
      SET author_id = COALESCE(author_id, ${currentUser.id}),
          title = ${title},
          slug = COALESCE(${slug ?? null}, slug),
          summary = ${summary},
          content_mdx = ${contentMdx},
          cover_image_url = ${coverImageUrl},
          status = ${status},
          is_pinned = ${input.isPinned ?? existing.isPinned},
          published_at = ${publishedAt}
      WHERE id = ${id}
    `;

    await replaceArticleRelations(
      tx,
      id,
      input.categoryIds,
      input.tagIds,
      input.contributorIds
    );
  }, client);

  const updated = await getArticleById(id, client);
  await clearArticleCache([existing.slug, updated.slug]);
  return updated;
}

export async function deleteArticle(currentUser: AuthUser, id: string, client: DbClient = db) {
  requireAdmin(currentUser);
  const existing = await getArticleById(id, client);
  await client`DELETE FROM articles WHERE id = ${id}`;
  await clearArticleCache([existing.slug]);
  return { ok: true };
}

export {
  getCategoryById,
  getTagById,
  getContributorById,
};
