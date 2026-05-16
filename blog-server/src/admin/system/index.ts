import { Elysia } from "elysia";

import {
  SystemFilingBody,
  SystemFilingResponse,
  SystemSiteConfigBody,
  SystemSiteConfigResponse,
  SystemSiteInfoBody,
  SystemSiteInfoResponse,
} from "./model";
import {
  getSystemFiling,
  getSystemSiteConfig,
  getSystemSiteInfo,
  updateSystemFiling,
  updateSystemSiteConfig,
  updateSystemSiteInfo,
} from "./service";
import { authContext } from "../../shared/auth/plugin";

export const adminSystemModule = new Elysia({ prefix: "/system" })
  .use(authContext)
  .get("/site-info", ({ currentUser }) => getSystemSiteInfo(currentUser), {
    response: { 200: SystemSiteInfoResponse },
  })
  .patch("/site-info", ({ currentUser, body }) => updateSystemSiteInfo(currentUser, body), {
    body: SystemSiteInfoBody,
    response: { 200: SystemSiteInfoResponse },
  })
  .get("/site-config", ({ currentUser }) => getSystemSiteConfig(currentUser), {
    response: { 200: SystemSiteConfigResponse },
  })
  .patch(
    "/site-config",
    ({ currentUser, body }) => updateSystemSiteConfig(currentUser, body),
    {
      body: SystemSiteConfigBody,
      response: { 200: SystemSiteConfigResponse },
    }
  )
  .get("/filing", ({ currentUser }) => getSystemFiling(currentUser), {
    response: { 200: SystemFilingResponse },
  })
  .patch("/filing", ({ currentUser, body }) => updateSystemFiling(currentUser, body), {
    body: SystemFilingBody,
    response: { 200: SystemFilingResponse },
  });
