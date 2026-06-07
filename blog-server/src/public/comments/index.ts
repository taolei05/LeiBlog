import { Elysia } from "elysia";

import {
  ArticleCommentsParams,
  CommentImageUploadBody,
  CommentImageUploadResponse,
  CommentListResponse,
  CommentResponse,
  CreateCommentBody,
  PublicCommentQuery,
} from "./model";
import {
  createGuestbookComment,
  createPublicComment,
  listGuestbookComments,
  listPublicComments,
} from "./service";
import { uploadCommentImage } from "../../admin/media/service";
import { authContext } from "../../shared/auth/plugin";
import { db } from "../../shared/db";
import { requestContext } from "../../shared/http/plugin";
import {
  enforceCommentWriteRateLimit,
  enforceUploadRateLimit,
} from "../../shared/http/rate-limit";

export const publicCommentsModule = new Elysia()
  .use(requestContext)
  .get(
    "/articles/:articleId/comments",
    ({ params, query }) => listPublicComments(params.articleId, query),
    {
      params: ArticleCommentsParams,
      query: PublicCommentQuery,
      response: { 200: CommentListResponse },
    }
  )
  .get(
    "/guestbook/comments",
    ({ query }) => listGuestbookComments(query),
    {
      query: PublicCommentQuery,
      response: { 200: CommentListResponse },
    }
  )
  .use(authContext)
  .post(
    "/comments/images",
    async ({ currentUser, body, requestMeta }) => {
      await enforceUploadRateLimit("comment-image", currentUser.id, requestMeta);
      const item = await uploadCommentImage(currentUser.id, body);

      return {
        ok: true,
        accessUrl: item.accessUrl,
      };
    },
    {
      body: CommentImageUploadBody,
      response: { 200: CommentImageUploadResponse },
    }
  )
  .post(
    "/articles/:articleId/comments",
    async ({ currentUser, params, body, requestMeta }) => {
      await enforceCommentWriteRateLimit(currentUser.id, requestMeta);
      return {
        ok: true,
        item: await createPublicComment(currentUser, params.articleId, body, db, requestMeta),
      };
    },
    {
      params: ArticleCommentsParams,
      body: CreateCommentBody,
      response: { 200: CommentResponse },
    }
  )
  .post(
    "/guestbook/comments",
    async ({ currentUser, body, requestMeta }) => {
      await enforceCommentWriteRateLimit(currentUser.id, requestMeta);
      return {
        ok: true,
        item: await createGuestbookComment(currentUser, body, db, requestMeta),
      };
    },
    {
      body: CreateCommentBody,
      response: { 200: CommentResponse },
    }
  );
