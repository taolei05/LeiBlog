import type { Cookie } from "elysia";
import { Elysia, status, t } from "elysia";

import {
  MEDIA_FILE_TYPES,
  MEDIA_LIBRARY_FAILURE,
  MediaLibraryError,
  uploadMediaAsset,
} from "../../admin/media/service";
import type { MediaLibraryFailure } from "../../admin/media/service";
import { getBlogUserBySession } from "../auth/service";
import { readAltchaFailureMessage, verifyAltchaPayload } from "../../shared/altcha";
import { getRequestMeta } from "../../shared/request-meta";
import {
  createPublicGuestbookComment,
  createPublicComment,
  ensureCommentsEnabled,
  listPublicGuestbookComments,
  listPublicComments,
  PUBLIC_COMMENT_FAILURE,
  PublicCommentError,
} from "./service";
import type { PublicCommentFailure } from "./service";

const BLOG_SESSION_COOKIE_NAME = "leiblog_blog_session";

type BlogSessionCookieJar = Record<string, Cookie<unknown>>;

const readSessionCookie = (cookie: BlogSessionCookieJar) => {
  const value = cookie[BLOG_SESSION_COOKIE_NAME].value;
  if (typeof value !== "string") {
    return undefined;
  }

  const [sessionId, sessionSecret, ...rest] = value.split(".");
  if (
    sessionId === undefined ||
    sessionSecret === undefined ||
    rest.length > 0 ||
    sessionId.length === 0 ||
    sessionSecret.length === 0
  ) {
    return undefined;
  }

  return { sessionId, sessionSecret };
};

const clearSessionCookie = (cookie: BlogSessionCookieJar) => {
  cookie[BLOG_SESSION_COOKIE_NAME].remove();
};

const resolveBlogUser = async (cookie: BlogSessionCookieJar) => {
  const session = readSessionCookie(cookie);
  if (session === undefined) {
    return undefined;
  }

  const user = await getBlogUserBySession(session);
  if (user === undefined) {
    clearSessionCookie(cookie);
  }

  return user;
};

const parsePositiveInteger = ({ fallback, value }: { fallback: number; value?: string }) => {
  if (value === undefined) {
    return fallback;
  }

  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return parsedValue;
};

const readPublicCommentFailureMessage = (reason: PublicCommentFailure) => {
  switch (reason) {
    case PUBLIC_COMMENT_FAILURE.ArticleNotFound:
      return "文章不存在或未发布。";
    case PUBLIC_COMMENT_FAILURE.CommentsDisabled:
      return "评论系统已关闭。";
    case PUBLIC_COMMENT_FAILURE.EmptyContent:
      return "评论内容不能为空。";
    case PUBLIC_COMMENT_FAILURE.ParentNotFound:
      return "父评论不存在。";
    case PUBLIC_COMMENT_FAILURE.Unauthorized:
      return "请先登录后再评论。";
    default: {
      const exhaustiveReason: never = reason;
      return exhaustiveReason;
    }
  }
};

const createPublicCommentFailureResponse = (error: PublicCommentError) => {
  const message = readPublicCommentFailureMessage(error.reason);

  switch (error.reason) {
    case PUBLIC_COMMENT_FAILURE.ArticleNotFound:
    case PUBLIC_COMMENT_FAILURE.ParentNotFound:
      return status(404, { message, reason: error.reason });
    case PUBLIC_COMMENT_FAILURE.Unauthorized:
      return status(401, { message, reason: error.reason });
    case PUBLIC_COMMENT_FAILURE.CommentsDisabled:
      return status(403, { message, reason: error.reason });
    case PUBLIC_COMMENT_FAILURE.EmptyContent:
      return status(400, { message, reason: error.reason });
    default: {
      const exhaustiveReason: never = error.reason;
      return exhaustiveReason;
    }
  }
};

const readMediaLibraryFailureMessage = (reason: MediaLibraryFailure) => {
  switch (reason) {
    case MEDIA_LIBRARY_FAILURE.EmptyFile:
      return "图片文件不能为空。";
    case MEDIA_LIBRARY_FAILURE.FileTooLarge:
      return "图片文件过大。";
    case MEDIA_LIBRARY_FAILURE.FolderNotFound:
      return "评论图片文件夹不存在。";
    case MEDIA_LIBRARY_FAILURE.UnsupportedFileType:
      return "评论只支持上传图片。";
    case MEDIA_LIBRARY_FAILURE.FolderSlugExists:
    case MEDIA_LIBRARY_FAILURE.NotFound:
    case MEDIA_LIBRARY_FAILURE.ProtectedFolder:
    case MEDIA_LIBRARY_FAILURE.R2ConfigurationIncomplete:
    case MEDIA_LIBRARY_FAILURE.RemoteStorageUnsupported:
      return "评论图片上传失败。";
    default: {
      const exhaustiveReason: never = reason;
      return exhaustiveReason;
    }
  }
};

const createMediaLibraryFailureResponse = (error: MediaLibraryError) => {
  const message = readMediaLibraryFailureMessage(error.reason);

  switch (error.reason) {
    case MEDIA_LIBRARY_FAILURE.FolderNotFound:
    case MEDIA_LIBRARY_FAILURE.NotFound:
      return status(404, { message, reason: error.reason });
    case MEDIA_LIBRARY_FAILURE.EmptyFile:
    case MEDIA_LIBRARY_FAILURE.FileTooLarge:
    case MEDIA_LIBRARY_FAILURE.FolderSlugExists:
    case MEDIA_LIBRARY_FAILURE.ProtectedFolder:
    case MEDIA_LIBRARY_FAILURE.R2ConfigurationIncomplete:
    case MEDIA_LIBRARY_FAILURE.RemoteStorageUnsupported:
    case MEDIA_LIBRARY_FAILURE.UnsupportedFileType:
      return status(400, { message, reason: error.reason });
    default: {
      const exhaustiveReason: never = error.reason;
      return exhaustiveReason;
    }
  }
};

const withPublicCommentErrors = async <Result>(work: () => Promise<Result>) => {
  try {
    return await work();
  } catch (error) {
    if (error instanceof PublicCommentError) {
      return createPublicCommentFailureResponse(error);
    }

    throw error;
  }
};

const verifyCommentAltcha = async ({ locale, payload }: { locale?: string; payload: string }) => {
  const verification = await verifyAltchaPayload(payload);
  if (verification.ok) {
    return undefined;
  }

  return status(400, {
    message: readAltchaFailureMessage({ locale, reason: verification.reason }),
    reason: verification.reason,
  });
};

const commentParamsSchema = t.Object({
  slug: t.String({ minLength: 1 }),
});

export const blogCommentRoutes = new Elysia()
  .post(
    "/comments/images",
    async ({ body, cookie }) => {
      const user = await resolveBlogUser(cookie);
      if (user === undefined) {
        return createPublicCommentFailureResponse(
          new PublicCommentError(
            PUBLIC_COMMENT_FAILURE.Unauthorized,
            "Authentication is required.",
          ),
        );
      }

      try {
        await ensureCommentsEnabled();
        const item = await uploadMediaAsset({
          acceptedFileTypes: [MEDIA_FILE_TYPES.Image],
          file: body.file,
          fileName: body.fileName,
          folderSlug: "comments",
          uploadedBy: user.id,
        });

        return {
          accessUrl: item.accessUrl,
          ok: true as const,
        };
      } catch (error) {
        if (error instanceof PublicCommentError) {
          return createPublicCommentFailureResponse(error);
        }
        if (error instanceof MediaLibraryError) {
          return createMediaLibraryFailureResponse(error);
        }

        throw error;
      }
    },
    {
      body: t.Object({
        file: t.File({
          type: "image",
        }),
        fileName: t.Optional(t.String({ maxLength: 255 })),
      }),
    },
  )
  .get(
    "/guestbook/comments",
    ({ query }) =>
      withPublicCommentErrors(() =>
        listPublicGuestbookComments({
          query: {
            locale: query.locale,
            page: parsePositiveInteger({ fallback: 1, value: query.page }),
            pageSize: parsePositiveInteger({ fallback: 50, value: query.pageSize }),
            parentId: query.parentId,
          },
        }),
      ),
    {
      query: t.Object({
        page: t.Optional(t.String({ pattern: "^[1-9][0-9]{0,5}$" })),
        pageSize: t.Optional(t.String({ pattern: "^[1-9][0-9]{0,2}$" })),
        locale: t.Optional(t.String({ maxLength: 12 })),
        parentId: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )
  .post(
    "/guestbook/comments",
    async ({ body, cookie, headers, query, request, server }) =>
      withPublicCommentErrors(async () => {
        const altchaResponse = await verifyCommentAltcha({
          locale: query.locale,
          payload: body.altcha,
        });
        if (altchaResponse !== undefined) {
          return altchaResponse;
        }

        const user = await resolveBlogUser(cookie);
        if (user === undefined) {
          throw new PublicCommentError(
            PUBLIC_COMMENT_FAILURE.Unauthorized,
            "Authentication is required.",
          );
        }

        const { altcha: _altcha, ...input } = body;
        return createPublicGuestbookComment({
          input,
          locale: query.locale,
          meta: getRequestMeta({
            headers,
            requestIp: server?.requestIP(request)?.address ?? null,
          }),
          user,
        });
      }),
    {
      body: t.Object({
        altcha: t.String({ minLength: 1, maxLength: 20_000 }),
        content: t.String({ minLength: 1, maxLength: 10_000 }),
        parentId: t.Optional(t.Nullable(t.String({ format: "uuid" }))),
      }),
      query: t.Object({
        locale: t.Optional(t.String({ maxLength: 12 })),
      }),
    },
  )
  .get(
    "/articles/:slug/comments",
    ({ params, query }) =>
      withPublicCommentErrors(() =>
        listPublicComments({
          articleSlug: params.slug,
          query: {
            locale: query.locale,
            page: parsePositiveInteger({ fallback: 1, value: query.page }),
            pageSize: parsePositiveInteger({ fallback: 50, value: query.pageSize }),
            parentId: query.parentId,
          },
        }),
      ),
    {
      params: commentParamsSchema,
      query: t.Object({
        page: t.Optional(t.String({ pattern: "^[1-9][0-9]{0,5}$" })),
        pageSize: t.Optional(t.String({ pattern: "^[1-9][0-9]{0,2}$" })),
        locale: t.Optional(t.String({ maxLength: 12 })),
        parentId: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )
  .post(
    "/articles/:slug/comments",
    async ({ body, cookie, headers, params, query, request, server }) =>
      withPublicCommentErrors(async () => {
        const altchaResponse = await verifyCommentAltcha({
          locale: query.locale,
          payload: body.altcha,
        });
        if (altchaResponse !== undefined) {
          return altchaResponse;
        }

        const user = await resolveBlogUser(cookie);
        if (user === undefined) {
          throw new PublicCommentError(
            PUBLIC_COMMENT_FAILURE.Unauthorized,
            "Authentication is required.",
          );
        }

        const { altcha: _altcha, ...input } = body;
        return createPublicComment({
          articleSlug: params.slug,
          input,
          locale: query.locale,
          meta: getRequestMeta({
            headers,
            requestIp: server?.requestIP(request)?.address ?? null,
          }),
          user,
        });
      }),
    {
      body: t.Object({
        altcha: t.String({ minLength: 1, maxLength: 20_000 }),
        content: t.String({ minLength: 1, maxLength: 10_000 }),
        parentId: t.Optional(t.Nullable(t.String({ format: "uuid" }))),
      }),
      params: commentParamsSchema,
      query: t.Object({
        locale: t.Optional(t.String({ maxLength: 12 })),
      }),
    },
  );
