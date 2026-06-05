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
import { getRequestMeta } from "../../auth/service";
import { uploadCommentImage } from "../../admin/media/service";
import { authContext } from "../../shared/auth/plugin";
import { db } from "../../shared/db";

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
    async ({ currentUser, body }) => {
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
    async ({ currentUser, params, body, headers, request, server }) => {
      const meta = getRequestMeta({
        headers,
        requestIp: server?.requestIP(request)?.address,
      });

      return {
        ok: true,
        item: await createPublicComment(currentUser, params.articleId, body, db, meta),
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
    async ({ currentUser, body, headers, request, server }) => {
      const meta = getRequestMeta({
        headers,
        requestIp: server?.requestIP(request)?.address,
      });

      return {
        ok: true,
        item: await createGuestbookComment(currentUser, body, db, meta),
      };
    },
    {
      body: CreateCommentBody,
      response: { 200: CommentResponse },
    }
  );
