import { Elysia } from "elysia";

import {
  ApiKeyEmailCodeResponse,
  ApiKeysResponse,
  DeepLTestBody,
  IntegrationTestResponse,
  RevealApiKeysBody,
  ResendTestBody,
  SystemFilingBody,
  SystemFilingResponse,
  SystemSiteConfigBody,
  SystemSiteConfigResponse,
  SystemSiteInfoBody,
  SystemSiteInfoResponse,
} from "./model";
import {
  createApiKeyRevealCode,
  getSystemFiling,
  getSystemSiteConfig,
  getSystemSiteInfo,
  revealSystemApiKeys,
  testDeepLIntegration,
  testIpGeolocationIntegration,
  testResendIntegration,
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
  })
  .post("/api-keys/email-code", ({ currentUser }) => createApiKeyRevealCode(currentUser), {
    response: { 200: ApiKeyEmailCodeResponse },
  })
  .post("/api-keys/reveal", ({ currentUser, body }) => revealSystemApiKeys(currentUser, body), {
    body: RevealApiKeysBody,
    response: { 200: ApiKeysResponse },
  })
  .post("/api-keys/test-resend", ({ currentUser, body }) => testResendIntegration(currentUser, body), {
    body: ResendTestBody,
    response: { 200: IntegrationTestResponse },
  })
  .post("/api-keys/test-deepl", ({ currentUser, body }) => testDeepLIntegration(currentUser, body), {
    body: DeepLTestBody,
    response: { 200: IntegrationTestResponse },
  })
  .post("/api-keys/test-ipgeolocation", ({ currentUser }) => testIpGeolocationIntegration(currentUser), {
    response: { 200: IntegrationTestResponse },
  });
