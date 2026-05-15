import { Elysia } from "elysia";

import {
  SetupAdminBody,
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
  getSetupStatus,
} from "./service";

export const setupModule = new Elysia({ prefix: "/setup" })
  .get("/status", () => getSetupStatus(), {
    response: {
      200: SetupStatusResponse,
    },
  })
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
