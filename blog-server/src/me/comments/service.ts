import type { AuthUser } from "../../shared/auth";
import { clearArticleCacheById } from "../../shared/cache/content";
import { db, type DbClient } from "../../shared/db";
import { forbidden, notFound, validationError } from "../../shared/errors";
import { toCommentItem, type CommentRow } from "../../shared/types/comment";

async function getOwnComment(
  currentUser: AuthUser,
  commentId: string,
  client: DbClient
) {
  const [row] = await client<CommentRow[]>`
    SELECT c.id, c.article_id, c.user_id, c.parent_id, c.content, c.status,
           c.created_at, c.updated_at, c.deleted_at,
           u.username, u.name, u.role, u.avatar_url, u.tags, u.blog_url
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.id = ${commentId}
  `;

  if (!row) throw notFound("评论不存在");
  if (row.user_id !== currentUser.id) throw forbidden("只能操作自己的评论");
  if (row.deleted_at) throw notFound("评论不存在");

  return row;
}

export async function updateMyComment(
  currentUser: AuthUser,
  commentId: string,
  input: { content: string },
  client: DbClient = db
) {
  const content = input.content.trim();
  if (!content) throw validationError("评论内容不能为空");

  const existing = await getOwnComment(currentUser, commentId, client);

  await client`
    UPDATE comments
    SET content = ${content}
    WHERE id = ${commentId}
  `;

  const updated = await getOwnComment(currentUser, commentId, client);
  await clearArticleCacheById(existing.article_id, client);
  return toCommentItem(updated);
}

export async function deleteMyComment(
  currentUser: AuthUser,
  commentId: string,
  client: DbClient = db
) {
  const existing = await getOwnComment(currentUser, commentId, client);

  await client`
    UPDATE comments
    SET deleted_at = now()
    WHERE id = ${commentId}
  `;

  await clearArticleCacheById(existing.article_id, client);
  return { ok: true };
}
