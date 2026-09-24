import { jwt } from "@elysiajs/jwt";
import { Elysia, status, t } from "elysia";

import { adminJwtSchema, extractBearerToken, isAuthJwtPayload } from "../auth/session";
import { readAdminSession } from "../auth/service";
import {
  ADMIN_SETTINGS_FAILURE,
  getAdminSettings,
  getSiteSettings,
  SITE_SETTINGS_FAILURE,
  updateAdminSettings,
  updateSiteSettings,
} from "./service";
import { env } from "../../shared/env";
import { USER_PROFILE_LOCALE_HEADER } from "../../shared/profile-tags";

type AdminJwtVerifier = {
  verify: (token: string) => Promise<unknown>;
};

const socialLinkSchema = t.Object({
  label: t.String(),
  url: t.String(),
});

const profileLocalizationSchema = t.Object({
  name: t.String(),
  bio: t.String(),
  tags: t.Array(t.String()),
});

const siteLocalizationSchema = t.Object({
  siteName: t.String(),
  siteDescription: t.String(),
  homepageCopy: t.String(),
  seoTitle: t.String(),
  seoDescription: t.String(),
});

const filingRecordSchema = t.Object({
  number: t.String(),
  url: t.String(),
});

const updateAdminSettingsSchema = t.Object({
  profileLocalizations: t.Object({
    zhCN: profileLocalizationSchema,
    en: profileLocalizationSchema,
  }),
  username: t.String({ minLength: 1 }),
  email: t.String({ minLength: 1 }),
  avatarUrl: t.String(),
  tagLocale: t.Union([t.Literal("zh-CN"), t.Literal("en")]),
  socialLinks: t.Array(socialLinkSchema),
  blogUrl: t.String(),
  commentEmailNotifications: t.Boolean(),
  newPostEmailNotifications: t.Boolean(),
  currentPassword: t.String(),
  newPassword: t.String(),
});

const updateSiteSettingsSchema = t.Object({
  siteLocalizations: t.Object({
    zhCN: siteLocalizationSchema,
    en: siteLocalizationSchema,
  }),
  site: t.Object({
    foundedAt: t.String(),
    coverUrls: t.Array(t.String()),
    lightLogoUrl: t.String(),
    darkLogoUrl: t.String(),
    faviconUrl: t.String(),
  }),
  basics: t.Object({
    seoKeywords: t.Array(t.String()),
    copyright: t.String(),
    commentsEnabled: t.Boolean(),
    resendDomain: t.String(),
    resendApiKey: t.String(),
    deeplApiKey: t.String(),
    ipGeolocationApiKey: t.String(),
  }),
  filings: t.Object({
    icpRecords: t.Array(filingRecordSchema),
    policeRecordNumber: t.String(),
    policeRecordUrl: t.String(),
  }),
});

const resolveAuthenticatedAdmin = async ({
  authorization,
  jwt,
}: {
  authorization?: string;
  jwt: AdminJwtVerifier;
}) => {
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
    userId: payload.sub,
  };
};

export const adminSettingsRoutes = new Elysia({ prefix: "/api/admin/settings" })
  .use(
    jwt({
      name: "jwt",
      secret: env.jwtSecret,
      exp: `${env.sessionTtlSeconds}s`,
      schema: adminJwtSchema,
    }),
  )
  .get(
    "/administrator",
    async ({ headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      const settings = await getAdminSettings({
        locale: headers[USER_PROFILE_LOCALE_HEADER],
        userId: auth.userId,
      });
      if (settings === undefined) {
        return status(404, { message: "Administrator no longer exists." });
      }

      return settings;
    },
    {
      headers: t.Object({
        authorization: t.Optional(t.String()),
        [USER_PROFILE_LOCALE_HEADER]: t.Optional(t.String()),
      }),
    },
  )
  .put(
    "/administrator",
    async ({ body, headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      const result = await updateAdminSettings({
        userId: auth.userId,
        input: body,
      });
      if (result.ok) {
        return result.settings;
      }

      if (result.reason === ADMIN_SETTINGS_FAILURE.NotFound) {
        return status(404, { message: "Administrator no longer exists." });
      }

      if (result.reason === ADMIN_SETTINGS_FAILURE.InvalidIdentity) {
        return status(400, { message: "Username and email are required." });
      }

      if (result.reason === ADMIN_SETTINGS_FAILURE.UsernameExists) {
        return status(409, { message: "Username is already in use." });
      }

      if (result.reason === ADMIN_SETTINGS_FAILURE.EmailExists) {
        return status(409, { message: "Email is already in use." });
      }

      if (result.reason === ADMIN_SETTINGS_FAILURE.InvalidCurrentPassword) {
        return status(400, { message: "Current password is incorrect." });
      }

      if (result.reason === ADMIN_SETTINGS_FAILURE.PasswordTooShort) {
        return status(400, { message: "New password must be at least 8 characters." });
      }

      return status(500, { message: "Administrator settings update failed." });
    },
    {
      headers: t.Object({
        authorization: t.Optional(t.String()),
      }),
      body: updateAdminSettingsSchema,
    },
  )
  .get(
    "/site",
    async ({ headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      return getSiteSettings();
    },
    {
      headers: t.Object({
        authorization: t.Optional(t.String()),
      }),
    },
  )
  .put(
    "/site",
    async ({ body, headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      const result = await updateSiteSettings(body);
      if (result.ok) {
        return result.settings;
      }

      if (result.reason === SITE_SETTINGS_FAILURE.InvalidFoundedAt) {
        return status(400, { message: "Founded time must use YYYY-MM-DD HH:mm." });
      }

      return status(500, { message: "Site settings update failed." });
    },
    {
      headers: t.Object({
        authorization: t.Optional(t.String()),
      }),
      body: updateSiteSettingsSchema,
    },
  );
