import { describeLocation } from "./login-metadata";

export type CommentStatus = "approved" | "pending" | "rejected";
export type CommentTargetType = "article" | "guestbook";

export type CommentAuthor = {
  avatarUrl: string | null;
  blogUrl: string | null;
  id: string;
  name: string | null;
  role: "admin" | "user";
  tags: string[];
  username: string;
};

export type CommentItem = {
  articleId: string | null;
  articleTitle: string | null;
  author: CommentAuthor;
  content: string;
  createdAt: string;
  deletedAt: string | null;
  id: string;
  location: string | null;
  parentId: string | null;
  status: CommentStatus;
  targetType: CommentTargetType;
  updatedAt: string;
  userId: string;
};

export type CommentRow = {
  articleId: string | null;
  articleTitle?: string | null;
  avatarUrl: string | null;
  blogUrl: string | null;
  commentLocation?: unknown;
  content: string;
  createdAt: Date | string;
  deletedAt: Date | string | null;
  id: string;
  name: string | null;
  parentId: string | null;
  role: "admin" | "user";
  status: CommentStatus;
  tags: string[];
  targetType: CommentTargetType;
  updatedAt: Date | string;
  userId: string;
  username: string;
};

const toIsoString = (value: Date | string | null) => {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

export const toCommentItem = (row: CommentRow): CommentItem => ({
  articleId: row.articleId,
  articleTitle: row.articleTitle ?? null,
  author: {
    avatarUrl: row.avatarUrl,
    blogUrl: row.blogUrl,
    id: row.userId,
    name: row.name,
    role: row.role,
    tags: row.tags ?? [],
    username: row.username,
  },
  content: row.content,
  createdAt: toIsoString(row.createdAt) ?? "",
  deletedAt: toIsoString(row.deletedAt),
  id: row.id,
  location: describeLocation(row.commentLocation),
  parentId: row.parentId,
  status: row.status,
  targetType: row.targetType,
  updatedAt: toIsoString(row.updatedAt) ?? "",
  userId: row.userId,
});
