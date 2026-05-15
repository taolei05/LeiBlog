import { Elysia } from "elysia";

import { CommentParams, CommentResponse, OkResponse, UpdateCommentBody } from "./model";
import { deleteMyComment, updateMyComment } from "./service";
import { authContext } from "../../shared/auth/plugin";

export const meCommentsModule = new Elysia({ prefix: "/comments" })
  .use(authContext)
  .patch(
    "/:id",
    async ({ currentUser, params, body }) => ({
      ok: true,
      item: await updateMyComment(currentUser, params.id, body),
    }),
    {
      params: CommentParams,
      body: UpdateCommentBody,
      response: { 200: CommentResponse },
    }
  )
  .delete("/:id", ({ currentUser, params }) => deleteMyComment(currentUser, params.id), {
    params: CommentParams,
    response: { 200: OkResponse },
  });
