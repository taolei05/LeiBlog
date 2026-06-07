import { t } from "elysia";

import {
  CommentItemSchema,
  CommentStatusSchema,
  CommentTargetTypeSchema,
} from "../../shared/types/comment";

export const AdminCommentQuery = t.Object({
  search: t.Optional(t.String({ maxLength: 160 })),
  targetType: t.Optional(CommentTargetTypeSchema),
  articleId: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  status: t.Optional(CommentStatusSchema),
  includeDeleted: t.Optional(t.Boolean()),
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 10_000 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
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
