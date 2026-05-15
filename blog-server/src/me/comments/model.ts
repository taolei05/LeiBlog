import { t } from "elysia";

import { CommentItemSchema } from "../../shared/types/comment";

export const CommentParams = t.Object({
  id: t.String(),
});

export const UpdateCommentBody = t.Object({
  content: t.String({ minLength: 1, maxLength: 5000 }),
});

export const CommentResponse = t.Object({
  ok: t.Boolean(),
  item: CommentItemSchema,
});

export const OkResponse = t.Object({
  ok: t.Boolean(),
});
