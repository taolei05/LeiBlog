import { Elysia } from "elysia";

import {
  ArticleCommentsParams,
  CommentListResponse,
  CommentResponse,
  CreateCommentBody,
  PublicCommentQuery,
} from "./model";
import { createPublicComment, listPublicComments } from "./service";
import { authContext } from "../../shared/auth/plugin";

export const publicCommentsModule = new Elysia()
  .get(
    "/articles/:articleId/comments",
    ({ params, query }) => listPublicComments(params.articleId, query),
    {
      params: ArticleCommentsParams,
      query: PublicCommentQuery,
      response: { 200: CommentListResponse },
    }
  )
  .use(authContext)
  .post(
    "/articles/:articleId/comments",
    async ({ currentUser, params, body }) => ({
      ok: true,
      item: await createPublicComment(currentUser, params.articleId, body),
    }),
    {
      params: ArticleCommentsParams,
      body: CreateCommentBody,
      response: { 200: CommentResponse },
    }
  );
