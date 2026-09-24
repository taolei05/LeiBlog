import { jwt } from "@elysiajs/jwt";
import { Elysia, status, t } from "elysia";

import { createAdminSession } from "../auth/service";
import { USER_ROLE } from "../auth/types";
import { env } from "../../shared/env";
import {
  completeInitialSetup,
  getAdminSetupStatus,
  INITIAL_SETUP_FAILURE,
} from "./service";

const socialLinkSchema = t.Object({
  label: t.String(),
  url: t.String(),
});

const filingRecordSchema = t.Object({
  number: t.String(),
  url: t.String(),
});

const initialSetupSchema = t.Object({
  admin: t.Object({
    name: t.String(),
    username: t.String({ minLength: 1 }),
    password: t.String({ minLength: 8 }),
    email: t.String({ minLength: 1 }),
    avatarUrl: t.String(),
    bio: t.String(),
    tags: t.Array(t.String()),
    tagLocale: t.Union([t.Literal("zh-CN"), t.Literal("en")]),
    socialLinks: t.Array(socialLinkSchema),
    blogUrl: t.String(),
    commentEmailNotifications: t.Boolean(),
    newPostEmailNotifications: t.Boolean(),
  }),
  site: t.Object({
    siteName: t.String(),
    foundedAt: t.String(),
    siteDescription: t.String(),
    coverUrls: t.Array(t.String()),
    homepageCopy: t.String(),
    lightLogoUrl: t.String(),
    darkLogoUrl: t.String(),
    faviconUrl: t.String(),
  }),
  basics: t.Object({
    seoTitle: t.String(),
    seoDescription: t.String(),
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

export const adminSetupRoutes = new Elysia({ prefix: "/api/admin/setup" })
  .use(
    jwt({
      name: "jwt",
      secret: env.jwtSecret,
      exp: `${env.sessionTtlSeconds}s`,
      schema: t.Object({
        sub: t.String(),
        sid: t.String(),
        username: t.String(),
        role: t.Literal(USER_ROLE.Admin),
      }),
    }),
  )
  .get(
    "/status",
    async () => getAdminSetupStatus(),
    {
      response: t.Object({
        hasAdmin: t.Boolean(),
        requiresSetup: t.Boolean(),
      }),
    },
  )
  .post(
    "/initial",
    async ({ body, jwt }) => {
      const result = await completeInitialSetup(body);
      if (!result.ok) {
        if (result.reason === INITIAL_SETUP_FAILURE.AdminExists) {
          return status(409, { message: "Administrator already exists." });
        }

        if (result.reason === INITIAL_SETUP_FAILURE.InvalidFoundedAt) {
          return status(400, { message: "Founded time must use YYYY-MM-DD HH:mm." });
        }

        return status(500, { message: "Initial setup failed." });
      }

      const session = await createAdminSession({ user: result.user });
      const token = await jwt.sign({
        sub: result.user.id,
        sid: session.sessionId,
        username: result.user.username,
        role: USER_ROLE.Admin,
      });

      return { token, user: result.user };
    },
    {
      body: initialSetupSchema,
    },
  );
