import type { AuthUser } from "../../shared/auth";
import { clearArticleCacheById } from "../../shared/cache/content";
import { db, withTransaction, type DbClient } from "../../shared/db";
import { forbidden, notFound, validationError } from "../../shared/errors";
import { toCommentItem, type CommentRow } from "../../shared/types/comment";

export interface PublicCommentQuery {
  page?: string;
  pageSize?: string;
  parentId?: string;
}

export interface CreateCommentInput {
  content: string;
  parentId?: string | null;
}

function parsePositiveInt(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function toPage(input: PublicCommentQuery) {
  const page = parsePositiveInt(input.page, 1, 10_000);
  const pageSize = parsePositiveInt(input.pageSize, 50, 100);
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

async function ensureCommentsEnabled(client: DbClient) {
  const [config] = await client<{ comments_enabled: boolean }[]>`
    SELECT comments_enabled
    FROM site_config
    WHERE id = 1
  `;

  if (config && !config.comments_enabled) {
    throw forbidden("评论系统已关闭");
  }
}

async function ensurePublishedArticle(articleId: string, client: DbClient) {
  const [article] = await client<{ id: string }[]>`
    SELECT id
    FROM articles
    WHERE id = ${articleId}
      AND status = 'published'
  `;

  if (!article) throw notFound("文章不存在或未发布");
}

async function ensureParentComment(
  articleId: string,
  parentId: string | null | undefined,
  client: DbClient
) {
  if (!parentId) return null;

  const [parent] = await client<{ id: string }[]>`
    SELECT id
    FROM comments
    WHERE id = ${parentId}
      AND article_id = ${articleId}
      AND status = 'approved'
      AND deleted_at IS NULL
  `;

  if (!parent) throw validationError("父评论不存在");
  return parent.id;
}

async function getCommentById(id: string, client: DbClient = db) {
  const [row] = await client<CommentRow[]>`
    SELECT c.id, c.article_id, c.user_id, c.parent_id, c.content, c.status,
           c.created_at, c.updated_at, c.deleted_at,
           u.username, u.name, u.role, u.avatar_url, u.tags, u.blog_url
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.id = ${id}
  `;

  if (!row) throw notFound("评论不存在");
  return toCommentItem(row);
}

export async function listPublicComments(
  articleId: string,
  query: PublicCommentQuery,
  client: DbClient = db
) {
  await ensurePublishedArticle(articleId, client);

  const { page, pageSize, offset } = toPage(query);
  const parentId = query.parentId ?? null;

  const rows = await client.unsafe<CommentRow[]>(
    `
      SELECT c.id, c.article_id, c.user_id, c.parent_id, c.content, c.status,
             c.created_at, c.updated_at, c.deleted_at,
             u.username, u.name, u.role, u.avatar_url, u.tags, u.blog_url
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.article_id = $1
        AND c.status = 'approved'
        AND c.deleted_at IS NULL
        AND ($2::uuid IS NULL OR c.parent_id = $2)
      ORDER BY c.created_at ASC
      LIMIT $3 OFFSET $4
    `,
    [articleId, parentId, pageSize, offset]
  );

  const [count] = await client.unsafe<{ total: string }[]>(
    `
      SELECT count(*) AS total
      FROM comments c
      WHERE c.article_id = $1
        AND c.status = 'approved'
        AND c.deleted_at IS NULL
        AND ($2::uuid IS NULL OR c.parent_id = $2)
    `,
    [articleId, parentId]
  );

  return {
    ok: true,
    items: rows.map(toCommentItem),
    page,
    pageSize,
    total: Number(count?.total ?? 0),
  };
}

export async function createPublicComment(
  currentUser: AuthUser,
  articleId: string,
  input: CreateCommentInput,
  client: DbClient = db
) {
  const content = input.content.trim();
  if (!content) throw validationError("评论内容不能为空");

  let commentId = "";

  await withTransaction(async (tx) => {
    await ensureCommentsEnabled(tx);
    await ensurePublishedArticle(articleId, tx);
    const parentId = await ensureParentComment(articleId, input.parentId, tx);

    const [created] = await tx<{ id: string }[]>`
      INSERT INTO comments (article_id, user_id, parent_id, content)
      VALUES (${articleId}, ${currentUser.id}, ${parentId}, ${content})
      RETURNING id
    `;

    commentId = created.id;
  }, client);

  const comment = await getCommentById(commentId, client);
  await clearArticleCacheById(articleId, client);
  return comment;
}

export { getCommentById, ensureCommentsEnabled, ensurePublishedArticle };
