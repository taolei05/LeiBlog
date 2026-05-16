import { t } from "elysia";

import { UserRoleSchema } from "./user";

export const CommentStatusSchema = t.Union([
  t.Literal("pending"),
  t.Literal("approved"),
  t.Literal("rejected"),
]);

export const CommentTargetTypeSchema = t.Union([
  t.Literal("article"),
  t.Literal("guestbook"),
]);

export const CommentAuthorSchema = t.Object({
  id: t.String(),
  username: t.String(),
  name: t.Nullable(t.String()),
  role: UserRoleSchema,
  avatarUrl: t.Nullable(t.String()),
  tags: t.Array(t.String()),
  blogUrl: t.Nullable(t.String()),
});

export const CommentItemSchema = t.Object({
  id: t.String(),
  targetType: CommentTargetTypeSchema,
  articleId: t.Nullable(t.String()),
  userId: t.String(),
  parentId: t.Nullable(t.String()),
  content: t.String(),
  status: CommentStatusSchema,
  createdAt: t.String(),
  updatedAt: t.String(),
  deletedAt: t.Nullable(t.String()),
  author: CommentAuthorSchema,
});

export type CommentStatus = "pending" | "approved" | "rejected";
export type CommentTargetType = "article" | "guestbook";

export interface CommentRow {
  id: string;
  target_type: CommentTargetType;
  article_id: string | null;
  user_id: string;
  parent_id: string | null;
  content: string;
  status: CommentStatus;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
  username: string;
  name: string | null;
  role: "admin" | "user" | "demo";
  avatar_url: string | null;
  tags: string[];
  blog_url: string | null;
}

function toIso(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export function toCommentItem(row: CommentRow) {
  return {
    id: row.id,
    targetType: row.target_type,
    articleId: row.article_id,
    userId: row.user_id,
    parentId: row.parent_id,
    content: row.content,
    status: row.status,
    createdAt: toIso(row.created_at) ?? "",
    updatedAt: toIso(row.updated_at) ?? "",
    deletedAt: toIso(row.deleted_at),
    author: {
      id: row.user_id,
      username: row.username,
      name: row.name,
      role: row.role,
      avatarUrl: row.avatar_url,
      tags: row.tags ?? [],
      blogUrl: row.blog_url,
    },
  };
}
