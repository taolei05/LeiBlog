import type { Cookie } from "elysia";
import { Elysia, status, t } from "elysia";

import { env } from "../../shared/env";
import { getRequestMeta } from "../../shared/request-meta";
import type { LoginMethod } from "../../shared/login-metadata";
import { readAuthProvider } from "../../shared/auth-providers";
import {
  MEDIA_FILE_TYPES,
  MEDIA_LIBRARY_FAILURE,
  MediaLibraryError,
  uploadMediaAsset,
} from "../../admin/media/service";
import type { MediaLibraryFailure } from "../../admin/media/service";
import { readAltchaFailureMessage, verifyAltchaPayload } from "../../shared/altcha";
import {
  BlogAuthError,
  changeBlogUserEmail,
  changeBlogUserPassword,
  createBlogAccountEmailCode,
  createBlogSession,
  createEmailCode,
  getBlogUserBySession,
  loginBlogUser,
  logoutBlogSession,
  recordBlogUserLogin,
  registerBlogUser,
  resetBlogUserPassword,
  updateBlogUserProfile,
} from "./service";
import type { BlogAuthSession, BlogUserProfile } from "./service";
import {
  completeOAuthLogin,
  createOAuthAuthorization,
  createOAuthResultRedirectUrl,
  listPublicOAuthProviders,
} from "./oauth";

const BLOG_SESSION_COOKIE_NAME = "leiblog_blog_session";
const oauthStateCookieName = (provider: string) => `leiblog_oauth_state_${provider}`;

type BlogSessionCookieJar = Record<string, Cookie<unknown>>;

const createSessionSecret = () => crypto.randomUUID();

const encodeSessionCookie = ({ sessionId, sessionSecret }: BlogAuthSession) =>
  `${sessionId}.${sessionSecret}`;

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

const setSessionCookie = (cookie: BlogSessionCookieJar, session: BlogAuthSession) => {
  cookie[BLOG_SESSION_COOKIE_NAME].set({
    httpOnly: true,
    maxAge: env.sessionTtlSeconds,
    path: "/",
    sameSite: "lax",
    secure: Bun.env.NODE_ENV === "production",
    value: encodeSessionCookie(session),
  });
};

const clearSessionCookie = (cookie: BlogSessionCookieJar) => {
  cookie[BLOG_SESSION_COOKIE_NAME].remove();
};

const createUserSessionResponse = async ({
  cookie,
  loginMethod = "password",
  requestMeta,
  user,
}: {
  cookie: BlogSessionCookieJar;
  loginMethod?: LoginMethod;
  requestMeta: ReturnType<typeof getRequestMeta>;
  user: BlogUserProfile;
}) => {
  const session = await createBlogSession({
    loginMethod,
    requestMeta,
    sessionId: crypto.randomUUID(),
    sessionSecret: createSessionSecret(),
    user,
  });

  setSessionCookie(cookie, session);

  return {
    ok: true,
    user,
  };
};

const createAuthErrorResponse = (error: unknown) => {
  if (error instanceof BlogAuthError) {
    return status(error.statusCode, {
      message: error.message,
      reason: error.reason,
    });
  }

  throw error;
};

const createAltchaVerificationResponse = async ({
  locale,
  payload,
}: {
  locale?: string | null;
  payload: string;
}) => {
  const verification = await verifyAltchaPayload(payload);
  if (verification.ok) {
    return undefined;
  }

  return status(400, {
    message: readAltchaFailureMessage({ locale, reason: verification.reason }),
    reason: verification.reason,
  });
};

const readOAuthErrorReason = (error: unknown) => {
  if (error instanceof BlogAuthError) {
    return error.reason;
  }

  return "invalid-identity";
};

const readMediaLibraryFailureMessage = (reason: MediaLibraryFailure) => {
  switch (reason) {
    case MEDIA_LIBRARY_FAILURE.EmptyFile:
      return "文件为空。";
    case MEDIA_LIBRARY_FAILURE.FileTooLarge:
      return "文件过大。";
    case MEDIA_LIBRARY_FAILURE.FolderNotFound:
      return "媒体文件夹不存在。";
    case MEDIA_LIBRARY_FAILURE.FolderSlugExists:
      return "媒体文件夹标识已存在。";
    case MEDIA_LIBRARY_FAILURE.NotFound:
      return "媒体资源不存在。";
    case MEDIA_LIBRARY_FAILURE.ProtectedFolder:
      return "受保护的媒体文件夹不能删除。";
    case MEDIA_LIBRARY_FAILURE.R2ConfigurationIncomplete:
      return "Cloudflare R2 存储配置不完整。";
    case MEDIA_LIBRARY_FAILURE.RemoteStorageUnsupported:
      return "暂不支持下载远程媒体。";
    case MEDIA_LIBRARY_FAILURE.UnsupportedFileType:
      return "头像只能上传图片文件。";
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

export const blogOAuthCallbackRoutes = new Elysia()
  .get(
    "/oauth/:provider/callback",
    async ({ cookie, headers, params, query, request, server }) => {
      const provider = readAuthProvider(params.provider);
      const stateCookie =
        provider === undefined ? undefined : cookie[oauthStateCookieName(provider)];
      const browserState = stateCookie?.value;
      stateCookie?.remove();
      if (
        query.error !== undefined ||
        query.code === undefined ||
        query.state === undefined ||
        typeof browserState !== "string" ||
        browserState !== query.state
      ) {
        return Response.redirect(
          createOAuthResultRedirectUrl({
            provider,
            reason: "invalid-identity",
            status: "error",
          }),
          302,
        );
      }

      try {
        const requestMeta = getRequestMeta({
          headers,
          requestIp: server?.requestIP(request)?.address ?? null,
        });
        const result = await completeOAuthLogin({
          code: query.code,
          providerValue: params.provider,
          requestMeta,
          state: query.state,
        });

        await createUserSessionResponse({
          cookie,
          loginMethod: result.provider,
          requestMeta,
          user: result.user,
        });

        return Response.redirect(
          createOAuthResultRedirectUrl({
            provider: result.provider,
            returnTo: result.returnTo,
            status: "success",
          }),
          302,
        );
      } catch (error) {
        return Response.redirect(
          createOAuthResultRedirectUrl({
            provider,
            reason: readOAuthErrorReason(error),
            status: "error",
          }),
          302,
        );
      }
    },
    {
      params: t.Object({
        provider: t.String({ maxLength: 20 }),
      }),
      query: t.Object({
        authuser: t.Optional(t.String({ maxLength: 64 })),
        code: t.Optional(t.String({ minLength: 1, maxLength: 2048 })),
        error: t.Optional(t.String({ maxLength: 256 })),
        error_description: t.Optional(t.String({ maxLength: 2048 })),
        prompt: t.Optional(t.String({ maxLength: 256 })),
        scope: t.Optional(t.String({ maxLength: 2048 })),
        state: t.Optional(t.String({ minLength: 1, maxLength: 2048 })),
      }),
      headers: t.Object({
        "user-agent": t.Optional(t.String()),
        "x-forwarded-for": t.Optional(t.String()),
        "x-real-ip": t.Optional(t.String()),
      }),
    },
  );

export const blogAuthRoutes = new Elysia({ prefix: "/auth" })
  .get("/providers", () => listPublicOAuthProviders())
  .get(
    "/oauth/:provider/start",
    ({ set }) => {
      set.headers.Allow = "POST";
      return status(405, { message: "Complete human verification before starting OAuth." });
    },
  )
  .post(
    "/oauth/:provider/start",
    async ({ body, cookie, params }) => {
      const altchaResponse = await createAltchaVerificationResponse({
        locale: body.locale,
        payload: body.altcha,
      });
      if (altchaResponse !== undefined) {
        return altchaResponse;
      }

      try {
        const authorization = await createOAuthAuthorization({
          providerValue: params.provider,
          returnTo: body.returnTo,
        });

        cookie[oauthStateCookieName(authorization.provider)].set({
          httpOnly: true,
          maxAge: 10 * 60,
          path: "/",
          sameSite: "lax",
          secure: Bun.env.NODE_ENV === "production",
          value: authorization.state,
        });

        return { ok: true, authorizationUrl: authorization.authorizationUrl };
      } catch (error) {
        return createAuthErrorResponse(error);
      }
    },
    {
      params: t.Object({
        provider: t.String({ maxLength: 20 }),
      }),
      body: t.Object({
        altcha: t.String({ minLength: 1, maxLength: 20_000 }),
        locale: t.Optional(t.String({ maxLength: 12 })),
        returnTo: t.Optional(t.String({ maxLength: 2048 })),
      }),
    },
  )
  .use(blogOAuthCallbackRoutes)
  .post(
    "/email-code",
    async ({ body }) => {
      const altchaResponse = await createAltchaVerificationResponse({
        locale: body.locale,
        payload: body.altcha,
      });
      if (altchaResponse !== undefined) {
        return altchaResponse;
      }

      const { altcha: _altcha, ...input } = body;
      try {
        return await createEmailCode(input);
      } catch (error) {
        return createAuthErrorResponse(error);
      }
    },
    {
      body: t.Object({
        email: t.String({ format: "email", maxLength: 254 }),
        altcha: t.String({ minLength: 1, maxLength: 20_000 }),
        locale: t.Optional(t.String({ maxLength: 12 })),
        purpose: t.Union([t.Literal("register"), t.Literal("password_reset")]),
      }),
    },
  )
  .post(
    "/register",
    async ({ body, cookie, headers, request, server }) => {
      const altchaResponse = await createAltchaVerificationResponse({
        payload: body.altcha,
      });
      if (altchaResponse !== undefined) {
        return altchaResponse;
      }

      try {
        const { altcha: _altcha, ...input } = body;
        const requestMeta = getRequestMeta({
          headers,
          requestIp: server?.requestIP(request)?.address ?? null,
        });
        const user = await recordBlogUserLogin({
          requestMeta,
          user: await registerBlogUser(input),
        });

        return await createUserSessionResponse({
          cookie,
          requestMeta,
          user,
        });
      } catch (error) {
        return createAuthErrorResponse(error);
      }
    },
    {
      body: t.Object({
        username: t.String({ minLength: 2, maxLength: 60 }),
        altcha: t.String({ minLength: 1, maxLength: 20_000 }),
        password: t.String({ minLength: 8, maxLength: 128 }),
        email: t.String({ format: "email", maxLength: 254 }),
        emailCode: t.String({ minLength: 4, maxLength: 12 }),
        name: t.Optional(t.String({ maxLength: 80 })),
      }),
      headers: t.Object({
        "user-agent": t.Optional(t.String()),
        "x-forwarded-for": t.Optional(t.String()),
        "x-real-ip": t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/login",
    async ({ body, cookie, headers, request, server }) => {
      const altchaResponse = await createAltchaVerificationResponse({
        payload: body.altcha,
      });
      if (altchaResponse !== undefined) {
        return altchaResponse;
      }

      try {
        const { altcha: _altcha, ...input } = body;
        const requestMeta = getRequestMeta({
          headers,
          requestIp: server?.requestIP(request)?.address ?? null,
        });
        const user = await loginBlogUser({ ...input, requestMeta });

        return await createUserSessionResponse({
          cookie,
          requestMeta,
          user,
        });
      } catch (error) {
        return createAuthErrorResponse(error);
      }
    },
    {
      body: t.Object({
        identifier: t.String({ minLength: 1, maxLength: 254 }),
        altcha: t.String({ minLength: 1, maxLength: 20_000 }),
        password: t.String({ minLength: 1, maxLength: 128 }),
      }),
      headers: t.Object({
        "user-agent": t.Optional(t.String()),
        "x-forwarded-for": t.Optional(t.String()),
        "x-real-ip": t.Optional(t.String()),
      }),
    },
  )
  .get("/me", async ({ cookie }) => {
    const session = readSessionCookie(cookie);
    if (session === undefined) {
      return status(401, { message: "未登录或会话已过期。" });
    }

    const user = await getBlogUserBySession(session);
    if (user === undefined) {
      clearSessionCookie(cookie);
      return status(401, { message: "未登录或会话已过期。" });
    }

    return { user };
  })
  .patch(
    "/me",
    async ({ body, cookie }) => {
      const session = readSessionCookie(cookie);
      if (session === undefined) {
        return status(401, { message: "未登录或会话已过期。" });
      }

      const currentUser = await getBlogUserBySession(session);
      if (currentUser === undefined) {
        clearSessionCookie(cookie);
        return status(401, { message: "未登录或会话已过期。" });
      }

      try {
        const user = await updateBlogUserProfile({
          ...body,
          userId: currentUser.id,
        });

        return { user };
      } catch (error) {
        return createAuthErrorResponse(error);
      }
    },
    {
      body: t.Object({
        avatarUrl: t.Optional(t.String({ maxLength: 512 })),
        profileLocalizations: t.Optional(t.Object({
          zhCN: t.Object({ name: t.String({ maxLength: 80 }), bio: t.String({ maxLength: 500 }), tags: t.Array(t.String({ maxLength: 40 }), { maxItems: 12 }) }),
          en: t.Object({ name: t.String({ maxLength: 80 }), bio: t.String({ maxLength: 500 }), tags: t.Array(t.String({ maxLength: 40 }), { maxItems: 12 }) }),
        })),
        bio: t.Optional(t.String({ maxLength: 500 })),
        blogUrl: t.Optional(t.String({ maxLength: 512 })),
        commentEmailNotifications: t.Optional(t.Boolean()),
        name: t.Optional(t.String({ maxLength: 80 })),
        newPostEmailNotifications: t.Optional(t.Boolean()),
        notificationEmailLocale: t.Optional(t.Union([t.Literal("en"), t.Literal("zh-CN")])),
        tags: t.Optional(t.Array(t.String({ maxLength: 40 }), { maxItems: 12 })),
        username: t.Optional(t.String({ minLength: 2, maxLength: 60 })),
      }),
    },
  )
  .post(
    "/me/avatar",
    async ({ body, cookie }) => {
      const session = readSessionCookie(cookie);
      if (session === undefined) {
        return status(401, { message: "未登录或会话已过期。" });
      }

      const currentUser = await getBlogUserBySession(session);
      if (currentUser === undefined) {
        clearSessionCookie(cookie);
        return status(401, { message: "未登录或会话已过期。" });
      }

      try {
        const item = await uploadMediaAsset({
          acceptedFileTypes: [MEDIA_FILE_TYPES.Image],
          file: body.file,
          fileName: body.fileName,
          folderSlug: "avatars",
          uploadedBy: currentUser.id,
        });

        return { item, ok: true };
      } catch (error) {
        if (error instanceof MediaLibraryError) {
          return createMediaLibraryFailureResponse(error);
        }

        throw error;
      }
    },
    {
      body: t.Object({
        file: t.File(),
        fileName: t.Optional(t.String({ maxLength: 255 })),
      }),
    },
  )
  .post(
    "/me/email-code",
    async ({ body, cookie }) => {
      const session = readSessionCookie(cookie);
      if (session === undefined) {
        return status(401, { message: "未登录或会话已过期。" });
      }

      const user = await getBlogUserBySession(session);
      if (user === undefined) {
        clearSessionCookie(cookie);
        return status(401, { message: "未登录或会话已过期。" });
      }

      try {
        const altchaResponse = await createAltchaVerificationResponse({
          locale: body.locale,
          payload: body.altcha,
        });
        if (altchaResponse !== undefined) {
          return altchaResponse;
        }

        const { altcha: _altcha, ...input } = body;
        return await createBlogAccountEmailCode({ ...input, user });
      } catch (error) {
        return createAuthErrorResponse(error);
      }
    },
    {
      body: t.Union([
        t.Object({
          altcha: t.String({ minLength: 1, maxLength: 20_000 }),
          locale: t.Optional(t.String({ maxLength: 12 })),
          purpose: t.Literal("email_change_current"),
        }),
        t.Object({
          email: t.String({ format: "email", maxLength: 254 }),
          altcha: t.String({ minLength: 1, maxLength: 20_000 }),
          locale: t.Optional(t.String({ maxLength: 12 })),
          purpose: t.Literal("email_change_new"),
        }),
        t.Object({
          altcha: t.String({ minLength: 1, maxLength: 20_000 }),
          locale: t.Optional(t.String({ maxLength: 12 })),
          purpose: t.Literal("password_change"),
        }),
      ]),
    },
  )
  .patch(
    "/me/email",
    async ({ body, cookie }) => {
      const session = readSessionCookie(cookie);
      if (session === undefined) {
        return status(401, { message: "未登录或会话已过期。" });
      }

      const user = await getBlogUserBySession(session);
      if (user === undefined) {
        clearSessionCookie(cookie);
        return status(401, { message: "未登录或会话已过期。" });
      }

      try {
        const updatedUser = await changeBlogUserEmail({ ...body, user });

        return { user: updatedUser };
      } catch (error) {
        return createAuthErrorResponse(error);
      }
    },
    {
      body: t.Object({
        currentEmailCode: t.String({ minLength: 4, maxLength: 12 }),
        newEmail: t.String({ format: "email", maxLength: 254 }),
        newEmailCode: t.String({ minLength: 4, maxLength: 12 }),
      }),
    },
  )
  .patch(
    "/me/password",
    async ({ body, cookie }) => {
      const session = readSessionCookie(cookie);
      if (session === undefined) {
        return status(401, { message: "未登录或会话已过期。" });
      }

      const user = await getBlogUserBySession(session);
      if (user === undefined) {
        clearSessionCookie(cookie);
        return status(401, { message: "未登录或会话已过期。" });
      }

      try {
        const result = await changeBlogUserPassword({ ...body, user });
        clearSessionCookie(cookie);

        return result;
      } catch (error) {
        return createAuthErrorResponse(error);
      }
    },
    {
      body: t.Union([
        t.Object({
          currentPassword: t.String({ minLength: 1, maxLength: 128 }),
          method: t.Literal("password"),
          newPassword: t.String({ minLength: 8, maxLength: 128 }),
        }),
        t.Object({
          emailCode: t.String({ minLength: 4, maxLength: 12 }),
          method: t.Literal("email_code"),
          newPassword: t.String({ minLength: 8, maxLength: 128 }),
        }),
      ]),
    },
  )
  .post("/logout", async ({ cookie }) => {
    const session = readSessionCookie(cookie);
    clearSessionCookie(cookie);

    if (session === undefined) {
      return { ok: true };
    }

    return logoutBlogSession(session);
  })
  .post(
    "/password/reset",
    async ({ body }) => {
      const altchaResponse = await createAltchaVerificationResponse({
        payload: body.altcha,
      });
      if (altchaResponse !== undefined) {
        return altchaResponse;
      }

      try {
        const { altcha: _altcha, ...input } = body;
        return await resetBlogUserPassword(input);
      } catch (error) {
        return createAuthErrorResponse(error);
      }
    },
    {
      body: t.Object({
        email: t.String({ format: "email", maxLength: 254 }),
        altcha: t.String({ minLength: 1, maxLength: 20_000 }),
        emailCode: t.String({ minLength: 4, maxLength: 12 }),
        password: t.String({ minLength: 8, maxLength: 128 }),
      }),
    },
  );
