import { Elysia } from "elysia";

import {
  AdminCommentQuery,
  CommentListResponse,
  CommentParams,
  CommentResponse,
  OkResponse,
  ReviewCommentBody,
} from "./model";
import {
  deleteCommentByAdmin,
  getCommentById,
  listAdminComments,
  reviewComment,
} from "./service";
import { requireAdmin } from "../../shared/auth";
import { adminContext } from "../../shared/auth/plugin";

export const adminCommentsModule = new Elysia({ prefix: "/comments" })
  .use(adminContext)
  .get("/", ({ currentUser, query }) => listAdminComments(currentUser, query), {
    query: AdminCommentQuery,
    response: { 200: CommentListResponse },
  })
  .get("/:id", async ({ currentUser, params }) => {
    requireAdmin(currentUser);
    return { ok: true, item: await getCommentById(params.id) };
  }, {
    params: CommentParams,
    response: { 200: CommentResponse },
  })
  .patch("/:id/review", async ({ currentUser, params, body }) => ({
    ok: true,
    item: await reviewComment(currentUser, params.id, body.status),
  }), {
    params: CommentParams,
    body: ReviewCommentBody,
    response: { 200: CommentResponse },
  })
  .delete("/:id", ({ currentUser, params }) => deleteCommentByAdmin(currentUser, params.id), {
    params: CommentParams,
    response: { 200: OkResponse },
  });
