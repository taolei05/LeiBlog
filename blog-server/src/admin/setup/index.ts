import { Elysia } from "elysia";

import {
  SetupAdminBody,
  SetupDemoSessionResponse,
  SetupFilingBody,
  SetupSiteConfigBody,
  SetupSiteInfoBody,
  SetupStatusResponse,
} from "./model";
import {
  completeSetup,
  configureAdmin,
  configureFiling,
  configureSiteConfig,
  configureSiteInfo,
  getOrCreateSetupDemoUser,
  getSetupStatus,
} from "./service";
import { createAuthSession, getRequestMeta } from "../../auth/service";
import { jwtPlugin } from "../../shared/auth/plugin";

export const setupModule = new Elysia({ prefix: "/setup" })
  .use(jwtPlugin)
  .get("/status", () => getSetupStatus(), {
    response: {
      200: SetupStatusResponse,
    },
  })
  .post(
    "/demo-session",
    async ({ headers, jwt }) => {
      const { signableUser, user } = await getOrCreateSetupDemoUser();
      const token = await jwt.sign({
        sub: signableUser.id,
        role: signableUser.role,
        username: signableUser.username,
        type: "access",
        exp: "7d",
      });

      await createAuthSession(signableUser, token, getRequestMeta(headers));

      return {
        ok: true,
        token,
        user,
      };
    },
    {
      response: {
        200: SetupDemoSessionResponse,
      },
    }
  )
  .post("/admin", ({ body }) => configureAdmin(body), {
    body: SetupAdminBody,
    response: {
      200: SetupStatusResponse,
    },
  })
  .post("/site-info", ({ body }) => configureSiteInfo(body), {
    body: SetupSiteInfoBody,
    response: {
      200: SetupStatusResponse,
    },
  })
  .post("/site-config", ({ body }) => configureSiteConfig(body), {
    body: SetupSiteConfigBody,
    response: {
      200: SetupStatusResponse,
    },
  })
  .post("/filing", ({ body }) => configureFiling(body), {
    body: SetupFilingBody,
    response: {
      200: SetupStatusResponse,
    },
  })
  .post("/complete", () => completeSetup(), {
    response: {
      200: SetupStatusResponse,
    },
  });
