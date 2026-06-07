import { Elysia } from "elysia";

import {
  SetupAdminBody,
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
  getSetupStatus,
  requireSetupToken,
  uploadSetupAsset,
} from "./service";
import { adminContext } from "../../shared/auth/plugin";
import { requestContext } from "../../shared/http/plugin";
import {
  enforceSetupWriteRateLimit,
  enforceUploadRateLimit,
} from "../../shared/http/rate-limit";

export const setupModule = new Elysia({ prefix: "/setup" })
  .use(requestContext)
  .get("/status", () => getSetupStatus(), {
    response: {
      200: SetupStatusResponse,
    },
  })
  .post("/admin", async ({ body, headers, requestMeta }) => {
    requireSetupToken(headers["x-setup-token"]);
    await enforceSetupWriteRateLimit(
      `token:${headers["x-setup-token"] ?? "missing"}`,
      requestMeta
    );
    return configureAdmin(body);
  }, {
    body: SetupAdminBody,
    response: {
      200: SetupStatusResponse,
    },
  })
  .post("/upload", async ({ body, headers, requestMeta }) => {
    requireSetupToken(headers["x-setup-token"]);
    const actorId = `token:${headers["x-setup-token"] ?? "missing"}`;
    await enforceSetupWriteRateLimit(actorId, requestMeta);
    await enforceUploadRateLimit("setup", actorId, requestMeta);
    return uploadSetupAsset(body);
  }, {
    body: SetupUploadBody,
    response: {
      200: SetupUploadResponse,
    },
  })
  .use(adminContext)
  .post("/site-info", async ({ body, currentUser, requestMeta }) => {
    await enforceSetupWriteRateLimit(currentUser.id, requestMeta);
    return configureSiteInfo(body);
  }, {
    body: SetupSiteInfoBody,
    response: {
      200: SetupStatusResponse,
    },
  })
  .post("/site-config", async ({ body, currentUser, requestMeta }) => {
    await enforceSetupWriteRateLimit(currentUser.id, requestMeta);
    return configureSiteConfig(body);
  }, {
    body: SetupSiteConfigBody,
    response: {
      200: SetupStatusResponse,
    },
  })
  .post("/filing", async ({ body, currentUser, requestMeta }) => {
    await enforceSetupWriteRateLimit(currentUser.id, requestMeta);
    return configureFiling(body);
  }, {
    body: SetupFilingBody,
    response: {
      200: SetupStatusResponse,
    },
  })
  .post("/complete", async ({ currentUser, requestMeta }) => {
    await enforceSetupWriteRateLimit(currentUser.id, requestMeta);
    return completeSetup();
  }, {
    response: {
      200: SetupStatusResponse,
    },
  });
