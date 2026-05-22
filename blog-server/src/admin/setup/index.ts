import { Elysia } from "elysia";

import {
  SetupAdminBody,
  SetupDemoSessionResponse,
  SetupFilingBody,
  SetupSiteConfigBody,
  SetupSiteInfoBody,
  SetupStatusResponse,
  SetupUploadBody,
  SetupUploadResponse,
} from "./model";
import {
  completeSetup,
  configureAdmin,
  configureFiling,
  configureSiteConfig,
  configureSiteInfo,
  getOrCreateSetupDemoUser,
  getSetupStatus,
  uploadSetupAsset,
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
    async ({ headers, jwt, request, server }) => {
      const { signableUser, user } = await getOrCreateSetupDemoUser();
      const token = await jwt.sign({
        sub: signableUser.id,
        role: signableUser.role,
        username: signableUser.username,
        type: "access",
        exp: "7d",
      });
      const meta = getRequestMeta({
        headers,
        requestIp: server?.requestIP(request)?.address,
      });

      await createAuthSession(signableUser, token, meta);

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
  .post("/upload", ({ body }) => uploadSetupAsset(body), {
    body: SetupUploadBody,
    response: {
      200: SetupUploadResponse,
    },
  })
  .post("/complete", () => completeSetup(), {
    response: {
      200: SetupStatusResponse,
    },
  });
