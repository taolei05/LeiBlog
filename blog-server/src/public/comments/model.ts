import { t } from "elysia";

import { CommentItemSchema } from "../../shared/types/comment";

export const ArticleCommentsParams = t.Object({
  articleId: t.String(),
});

export const PublicCommentQuery = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 10_000 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
  parentId: t.Optional(t.String()),
});

export const CreateCommentBody = t.Object({
  content: t.String({ minLength: 1, maxLength: 5000 }),
  parentId: t.Optional(t.Nullable(t.String())),
});

export const CommentImageUploadBody = t.Object({
  file: t.File(),
  fileName: t.Optional(t.String({ maxLength: 255 })),
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

export const CommentImageUploadResponse = t.Object({
  ok: t.Boolean(),
  accessUrl: t.String(),
});
