import type { AuthUser } from "../../shared/auth";
import { clearArticleCacheById } from "../../shared/cache/content";
import { db, withTransaction, type DbClient } from "../../shared/db";
import { forbidden, notFound, validationError } from "../../shared/errors";
import { toCommentItem, type CommentRow } from "../../shared/types/comment";
import { resolveLoginLocation, type RequestMeta } from "../../auth/service";

export interface PublicCommentQuery {
  page?: number;
  pageSize?: number;
  parentId?: string;
}

export interface CreateCommentInput {
  content: string;
  parentId?: string | null;
}

type CommentTarget =
  | {
      articleId: string;
      targetType: "article";
    }
  | {
      articleId: null;
      targetType: "guestbook";
    };

function toPage(input: PublicCommentQuery) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 50;
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
  target: CommentTarget,
  parentId: string | null | undefined,
  client: DbClient
) {
  if (!parentId) return null;

  const [parent] = await client.unsafe<{ id: string }[]>(
    `
      SELECT id
      FROM comments
      WHERE id = $1
        AND target_type = $2::comment_target_type
        AND (($2::comment_target_type = 'article' AND article_id = $3::uuid)
          OR ($2::comment_target_type = 'guestbook' AND article_id IS NULL))
        AND status = 'approved'
        AND deleted_at IS NULL
    `,
    [parentId, target.targetType, target.articleId]
  );

  if (!parent) throw validationError("父评论不存在");
  return parent.id;
}

async function getCommentById(id: string, client: DbClient = db) {
  const [row] = await client<CommentRow[]>`
    SELECT c.id, c.target_type, c.article_id, c.user_id, c.parent_id, c.content, c.status,
           c.created_at, c.updated_at, c.deleted_at,
           u.username, u.name, u.role, u.avatar_url, u.tags, u.blog_url,
           c.comment_location AS comment_location
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.id = ${id}
  `;

  if (!row) throw notFound("评论不存在");
  return toCommentItem(row);
}

async function listCommentsForTarget(
  target: CommentTarget,
  query: PublicCommentQuery,
  client: DbClient = db
) {
  if (target.targetType === "article") {
    await ensurePublishedArticle(target.articleId, client);
  }

  const { page, pageSize, offset } = toPage(query);
  const parentId = query.parentId ?? null;

  const rows = await client.unsafe<CommentRow[]>(
    `
      SELECT c.id, c.target_type, c.article_id, c.user_id, c.parent_id, c.content, c.status,
             c.created_at, c.updated_at, c.deleted_at,
             u.username, u.name, u.role, u.avatar_url, u.tags, u.blog_url,
             c.comment_location AS comment_location
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.target_type = $1::comment_target_type
        AND (($1::comment_target_type = 'article' AND c.article_id = $2::uuid)
          OR ($1::comment_target_type = 'guestbook' AND c.article_id IS NULL))
        AND c.status = 'approved'
        AND c.deleted_at IS NULL
        AND ($3::uuid IS NULL OR c.parent_id = $3)
      ORDER BY c.created_at ASC
      LIMIT $4 OFFSET $5
    `,
    [target.targetType, target.articleId, parentId, pageSize, offset]
  );

  const [count] = await client.unsafe<{ total: string }[]>(
    `
      SELECT count(*) AS total
      FROM comments c
      WHERE c.target_type = $1::comment_target_type
        AND (($1::comment_target_type = 'article' AND c.article_id = $2::uuid)
          OR ($1::comment_target_type = 'guestbook' AND c.article_id IS NULL))
        AND c.status = 'approved'
        AND c.deleted_at IS NULL
        AND ($3::uuid IS NULL OR c.parent_id = $3)
    `,
    [target.targetType, target.articleId, parentId]
  );

  return {
    ok: true,
    items: rows.map(toCommentItem),
    page,
    pageSize,
    total: Number(count?.total ?? 0),
  };
}

async function createCommentForTarget(
  currentUser: AuthUser,
  target: CommentTarget,
  input: CreateCommentInput,
  client: DbClient = db,
  meta: RequestMeta | null = null
) {
  const content = input.content.trim();
  if (!content) throw validationError("评论内容不能为空");

  let commentId = "";

  await withTransaction(async (tx) => {
    await ensureCommentsEnabled(tx);
    if (target.targetType === "article") {
      await ensurePublishedArticle(target.articleId, tx);
    }
    const parentId = await ensureParentComment(target, input.parentId, tx);
    const location = meta ? await resolveLoginLocation(meta, tx) : null;
    const device = meta?.userAgent ? { userAgent: meta.userAgent } : null;

    const [created] = await tx<{ id: string }[]>`
      INSERT INTO comments (
        target_type, article_id, user_id, parent_id, content,
        comment_ip, comment_location, comment_device
      )
      VALUES (
        ${target.targetType}, ${target.articleId}, ${currentUser.id}, ${parentId}, ${content},
        ${meta?.ip ?? null}, ${location}::jsonb, ${device}::jsonb
      )
      RETURNING id
    `;

    commentId = created.id;
  }, client);

  const comment = await getCommentById(commentId, client);
  if (target.articleId) {
    await clearArticleCacheById(target.articleId, client);
  }
  return comment;
}

export function listPublicComments(
  articleId: string,
  query: PublicCommentQuery,
  client: DbClient = db
) {
  return listCommentsForTarget({ targetType: "article", articleId }, query, client);
}

export function listGuestbookComments(
  query: PublicCommentQuery,
  client: DbClient = db
) {
  return listCommentsForTarget({ targetType: "guestbook", articleId: null }, query, client);
}

export function createPublicComment(
  currentUser: AuthUser,
  articleId: string,
  input: CreateCommentInput,
  client: DbClient = db,
  meta: RequestMeta | null = null
) {
  return createCommentForTarget(
    currentUser,
    { targetType: "article", articleId },
    input,
    client,
    meta
  );
}

export function createGuestbookComment(
  currentUser: AuthUser,
  input: CreateCommentInput,
  client: DbClient = db,
  meta: RequestMeta | null = null
) {
  return createCommentForTarget(
    currentUser,
    { targetType: "guestbook", articleId: null },
    input,
    client,
    meta
  );
}

export { getCommentById, ensureCommentsEnabled, ensurePublishedArticle };
