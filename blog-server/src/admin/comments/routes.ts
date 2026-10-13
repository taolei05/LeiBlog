import { jwt } from "@elysiajs/jwt";
import { Elysia, status, t } from "elysia";

import { env } from "../../shared/env";
import type { CommentStatus, CommentTargetType } from "../../shared/comment";
import { adminJwtSchema, extractBearerToken, isAuthJwtPayload } from "../auth/session";
import { readAdminSession } from "../auth/service";
import {
  ADMIN_COMMENT_FAILURE,
  AdminCommentError,
  deleteCommentByAdmin,
  listAdminComments,
  reviewComment,
} from "./service";
import type { AdminCommentFailure } from "./service";

type AdminJwtVerifier = {
  verify: (token: string) => Promise<unknown>;
};

type ResolveAuthenticatedAdminParameters = {
  authorization?: string;
  jwt: AdminJwtVerifier;
};

const resolveAuthenticatedAdmin = async ({
  authorization,
  jwt,
}: ResolveAuthenticatedAdminParameters) => {
  const token = extractBearerToken(authorization);
  if (token === undefined) {
    return {
      ok: false as const,
      response: status(401, { message: "Missing bearer token." }),
    };
  }

  const payload = await jwt.verify(token);
  if (!isAuthJwtPayload(payload)) {
    return {
      ok: false as const,
      response: status(401, { message: "Invalid bearer token." }),
    };
  }

  const session = await readAdminSession({ sessionId: payload.sid });
  if (session === undefined || session.userId !== payload.sub) {
    return {
      ok: false as const,
      response: status(401, { message: "Session expired." }),
    };
  }

  return {
    ok: true as const,
    userId: session.userId,
  };
};

const authHeadersSchema = t.Object({
  authorization: t.Optional(t.String()),
});

const idParamsSchema = t.Object({
  id: t.String(),
});

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

const readCommentFailureMessage = (reason: AdminCommentFailure) => {
  switch (reason) {
    case ADMIN_COMMENT_FAILURE.InvalidStatus:
      return "评论状态无效。";
    case ADMIN_COMMENT_FAILURE.NotFound:
      return "评论不存在。";
    default: {
      const exhaustiveReason: never = reason;
      return exhaustiveReason;
    }
  }
};

const createCommentFailureResponse = (error: AdminCommentError) => {
  const message = readCommentFailureMessage(error.reason);

  switch (error.reason) {
    case ADMIN_COMMENT_FAILURE.NotFound:
      return status(404, { message, reason: error.reason });
    case ADMIN_COMMENT_FAILURE.InvalidStatus:
      return status(400, { message, reason: error.reason });
    default: {
      const exhaustiveReason: never = error.reason;
      return exhaustiveReason;
    }
  }
};

const withCommentErrors = async <Result>(work: () => Promise<Result>) => {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AdminCommentError) {
      return createCommentFailureResponse(error);
    }

    throw error;
  }
};

const isCommentStatus = (value: string | undefined): value is CommentStatus | "all" =>
  value === undefined ||
  value === "all" ||
  value === "pending" ||
  value === "approved" ||
  value === "rejected";

const isCommentTargetType = (value: string | undefined): value is CommentTargetType | "all" =>
  value === undefined || value === "all" || value === "article" || value === "guestbook";

export const adminCommentsRoutes = new Elysia({ prefix: "/api/admin/comments" })
  .use(
    jwt({
      name: "jwt",
      secret: env.jwtSecret,
      exp: `${env.sessionTtlSeconds}s`,
      schema: adminJwtSchema,
    }),
  )
  .get(
    "/",
    async ({ headers, jwt, query }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return listAdminComments({
        articleId: query.articleId,
        includeDeleted: query.includeDeleted === "true",
        page: parsePositiveInteger({ fallback: 1, value: query.page }),
        pageSize: parsePositiveInteger({ fallback: 20, value: query.pageSize }),
        query: query.query,
        sortBy: query.sortBy === "updatedAt" ? "updatedAt" : "createdAt",
        sortOrder: query.sortOrder === "asc" ? "asc" : "desc",
        status: isCommentStatus(query.status) ? query.status : "all",
        targetType: isCommentTargetType(query.targetType) ? query.targetType : "all",
        userId: query.userId,
      });
    },
    {
      headers: authHeadersSchema,
      query: t.Object({
        articleId: t.Optional(t.String()),
        includeDeleted: t.Optional(t.String()),
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        query: t.Optional(t.String()),
        sortBy: t.Optional(t.String()),
        sortOrder: t.Optional(t.String()),
        status: t.Optional(t.String()),
        targetType: t.Optional(t.String()),
        userId: t.Optional(t.String()),
      }),
    },
  )
  .patch(
    "/:id/status",
    async ({ body, headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withCommentErrors(() =>
        reviewComment({
          commentId: params.id,
          nextStatus: body.status,
        }),
      );
    },
    {
      body: t.Object({
        status: t.Union([t.Literal("approved"), t.Literal("pending"), t.Literal("rejected")]),
      }),
      headers: authHeadersSchema,
      params: idParamsSchema,
    },
  )
  .delete(
    "/:id",
    async ({ headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withCommentErrors(() => deleteCommentByAdmin({ commentId: params.id }));
    },
    {
      headers: authHeadersSchema,
      params: idParamsSchema,
    },
  );
