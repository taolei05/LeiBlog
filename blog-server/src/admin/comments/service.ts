import {
  assertWritableAdmin,
  requireAdminOrDemo,
  type AuthUser,
} from "../../shared/auth";
import { clearArticleCacheById } from "../../shared/cache/content";
import { db, type DbClient } from "../../shared/db";
import { notFound } from "../../shared/errors";
import {
  toCommentItem,
  type CommentRow,
  type CommentStatus,
} from "../../shared/types/comment";

export interface AdminCommentQuery {
  search?: string;
  articleId?: string;
  userId?: string;
  status?: CommentStatus;
  includeDeleted?: string;
  page?: string;
  pageSize?: string;
  sortBy?: "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

function parsePositiveInt(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function parseBoolean(value: string | undefined) {
  return value === "true";
}

function orderClause(sortBy: AdminCommentQuery["sortBy"], sortOrder: AdminCommentQuery["sortOrder"]) {
  const order = sortOrder === "asc" ? "ASC" : "DESC";
  const column = sortBy === "updatedAt" ? "c.updated_at" : "c.created_at";
  return `${column} ${order}, c.created_at DESC`;
}

function toPage(input: AdminCommentQuery) {
  const page = parsePositiveInt(input.page, 1, 10_000);
  const pageSize = parsePositiveInt(input.pageSize, 20, 100);
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

async function getCommentById(commentId: string, client: DbClient = db) {
  const [row] = await client<CommentRow[]>`
    SELECT c.id, c.article_id, c.user_id, c.parent_id, c.content, c.status,
           c.created_at, c.updated_at, c.deleted_at,
           u.username, u.name, u.role, u.avatar_url, u.tags, u.blog_url
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.id = ${commentId}
  `;

  if (!row) throw notFound("评论不存在");
  return toCommentItem(row);
}

export async function listAdminComments(
  currentUser: AuthUser,
  query: AdminCommentQuery,
  client: DbClient = db
) {
  requireAdminOrDemo(currentUser);

  const { page, pageSize, offset } = toPage(query);
  const search = query.search?.trim()
    ? `%${query.search.trim().toLowerCase()}%`
    : null;
  const articleId = query.articleId ?? null;
  const userId = query.userId ?? null;
  const status = query.status ?? null;
  const includeDeleted = parseBoolean(query.includeDeleted);
  const orderBy = orderClause(query.sortBy, query.sortOrder);

  const rows = await client.unsafe<CommentRow[]>(
    `
      SELECT c.id, c.article_id, c.user_id, c.parent_id, c.content, c.status,
             c.created_at, c.updated_at, c.deleted_at,
             u.username, u.name, u.role, u.avatar_url, u.tags, u.blog_url
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE ($1::text IS NULL OR lower(c.content) LIKE $1 OR lower(u.username) LIKE $1 OR lower(coalesce(u.name, '')) LIKE $1)
        AND ($2::uuid IS NULL OR c.article_id = $2)
        AND ($3::uuid IS NULL OR c.user_id = $3)
        AND ($4::comment_status IS NULL OR c.status = $4)
        AND ($5::boolean = true OR c.deleted_at IS NULL)
      ORDER BY ${orderBy}
      LIMIT $6 OFFSET $7
    `,
    [search, articleId, userId, status, includeDeleted, pageSize, offset]
  );

  const [count] = await client.unsafe<{ total: string }[]>(
    `
      SELECT count(*) AS total
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE ($1::text IS NULL OR lower(c.content) LIKE $1 OR lower(u.username) LIKE $1 OR lower(coalesce(u.name, '')) LIKE $1)
        AND ($2::uuid IS NULL OR c.article_id = $2)
        AND ($3::uuid IS NULL OR c.user_id = $3)
        AND ($4::comment_status IS NULL OR c.status = $4)
        AND ($5::boolean = true OR c.deleted_at IS NULL)
    `,
    [search, articleId, userId, status, includeDeleted]
  );

  return {
    ok: true,
    items: rows.map(toCommentItem),
    page,
    pageSize,
    total: Number(count?.total ?? 0),
  };
}

export async function reviewComment(
  currentUser: AuthUser,
  commentId: string,
  status: CommentStatus,
  client: DbClient = db
) {
  assertWritableAdmin(currentUser);
  const existing = await getCommentById(commentId, client);

  await client`
    UPDATE comments
    SET status = ${status}
    WHERE id = ${commentId}
  `;

  const updated = await getCommentById(commentId, client);
  await clearArticleCacheById(existing.articleId, client);
  return updated;
}

export async function deleteCommentByAdmin(
  currentUser: AuthUser,
  commentId: string,
  client: DbClient = db
) {
  assertWritableAdmin(currentUser);
  const existing = await getCommentById(commentId, client);

  await client`
    UPDATE comments
    SET deleted_at = now()
    WHERE id = ${commentId}
  `;

  await clearArticleCacheById(existing.articleId, client);
  return { ok: true };
}

export { getCommentById };
