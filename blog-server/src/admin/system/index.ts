import { Elysia } from "elysia";

import {
  AuthProviderParams,
  AuthProviderClientSecretResponse,
  AuthProviderSettingsBody,
  AuthProviderSettingsResponse,
  AuthProvidersResponse,
  ApiKeyEmailCodeResponse,
  ApiKeysResponse,
  DeepLTestBody,
  IntegrationTestResponse,
  RevealAuthProviderClientSecretBody,
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
  listAuthProviderSettings,
  revealAuthProviderClientSecret,
  updateAuthProviderSettings,
} from "./auth-providers";
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
import { adminContext } from "../../shared/auth/plugin";
import { requestContext } from "../../shared/http/plugin";
import { enforceApiKeyEmailCodeRateLimit } from "../../shared/http/rate-limit";

export const adminSystemModule = new Elysia({ prefix: "/system" })
  .use(requestContext)
  .use(adminContext)
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
  .get("/auth-providers", ({ currentUser }) => listAuthProviderSettings(currentUser), {
    response: { 200: AuthProvidersResponse },
  })
  .patch(
    "/auth-providers/:provider",
    ({ currentUser, params, body }) =>
      updateAuthProviderSettings(currentUser, params.provider, body),
    {
      body: AuthProviderSettingsBody,
      params: AuthProviderParams,
      response: { 200: AuthProviderSettingsResponse },
    }
  )
  .post(
    "/auth-providers/:provider/client-secret/reveal",
    ({ currentUser, params, body }) =>
      revealAuthProviderClientSecret(currentUser, params.provider, body),
    {
      body: RevealAuthProviderClientSecretBody,
      params: AuthProviderParams,
      response: { 200: AuthProviderClientSecretResponse },
    }
  )
  .post("/api-keys/email-code", async ({ currentUser, requestMeta }) => {
    await enforceApiKeyEmailCodeRateLimit(currentUser.id, requestMeta);
    return createApiKeyRevealCode(currentUser);
  }, {
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
