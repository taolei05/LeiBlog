import { t } from "elysia";

import { CommentItemSchema, CommentStatusSchema } from "../../shared/types/comment";

export const AdminCommentQuery = t.Object({
  search: t.Optional(t.String({ maxLength: 160 })),
  articleId: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  status: t.Optional(CommentStatusSchema),
  includeDeleted: t.Optional(t.String()),
  page: t.Optional(t.String()),
  pageSize: t.Optional(t.String()),
  sortBy: t.Optional(t.Union([t.Literal("createdAt"), t.Literal("updatedAt")])),
  sortOrder: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
});

export const CommentParams = t.Object({
  id: t.String(),
});

export const ReviewCommentBody = t.Object({
  status: CommentStatusSchema,
});

export const CommentListResponse = t.Object({
  ok: t.Boolean(),
  items: t.Array(CommentItemSchema),
  page: t.Number(),
  pageSize: t.Number(),
  total: t.Number(),
});

export const CommentResponse = t.Object({
  ok: t.Boolean(),
  item: CommentItemSchema,
});

export const OkResponse = t.Object({
  ok: t.Boolean(),
});
