import { jwt } from "@elysiajs/jwt";
import { Elysia, status, t } from "elysia";

import { adminJwtSchema, extractBearerToken, isAuthJwtPayload } from "../auth/session";
import { readAdminSession } from "../auth/service";
import {
  ADMIN_SETTINGS_FAILURE,
  AUTH_PROVIDER_SETTINGS_FAILURE,
  createAuthProviderClientSecretRevealCode,
  createSiteSettingsApiKeyRevealCode,
  getAdminSettings,
  listAuthProviderSettings,
  getSiteSettings,
  INTEGRATION_TEST_FAILURE,
  revealAuthProviderClientSecret,
  revealSiteSettingsApiKeys,
  SITE_SETTINGS_FAILURE,
  testDeepLApiKey,
  testIpGeolocationApiKey,
  testResendApiKey,
  updateAdminSettings,
  updateAuthProviderSettings,
  updateSiteSettings,
} from "./service";
import { env } from "../../shared/env";
import { USER_PROFILE_LOCALE_HEADER } from "../../shared/profile-tags";
import { readAltchaFailureMessage, verifyAltchaPayload } from "../../shared/altcha";
import { getExchangeRates } from "../subscriptions/exchange-rates";
import { SubscriptionError } from "../subscriptions/domain";

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
    timeZone: t.String({ minLength: 1 }),
  }),
  basics: t.Object({
    seoKeywords: t.Array(t.String()),
    copyright: t.String(),
    commentsEnabled: t.Boolean(),
    resendDomain: t.String(),
    resendApiKey: t.String(),
    deeplApiKey: t.String(),
    ipGeolocationApiKey: t.String(),
    exchangeRateApiKey: t.Optional(t.String({ maxLength: 1000 })),
  }),
  filings: t.Object({
    icpRecords: t.Array(filingRecordSchema),
    policeRecordNumber: t.String(),
    policeRecordUrl: t.String(),
  }),
  storage: t.Object({
    r2AccessKeyId: t.String(),
    r2AccountId: t.String(),
    r2Bucket: t.String(),
    r2Enabled: t.Boolean(),
    r2PublicBaseUrl: t.String(),
    r2SecretAccessKey: t.String(),
  }),
});

const testResendApiKeySchema = t.Object({
  resendApiKey: t.Optional(t.String({ maxLength: 1000 })),
  resendDomain: t.Optional(t.String({ maxLength: 255 })),
});

const testDeepLApiKeySchema = t.Object({
  apiKey: t.Optional(t.String({ maxLength: 1000 })),
  text: t.Optional(t.String({ maxLength: 1000 })),
});

const testIpGeolocationApiKeySchema = t.Object({
  apiKey: t.Optional(t.String({ maxLength: 1000 })),
});

const revealSiteSettingsApiKeysSchema = t.Object({
  emailCode: t.String({ minLength: 4, maxLength: 12 }),
});

const updateAuthProviderSettingsSchema = t.Object({
  clientId: t.Optional(t.Union([t.String({ maxLength: 1000 }), t.Null()])),
  clientSecret: t.Optional(t.Union([t.String({ maxLength: 1000 }), t.Null()])),
  displayName: t.Optional(t.Union([t.String({ maxLength: 80 }), t.Null()])),
  enabled: t.Boolean(),
  redirectUri: t.Optional(t.Union([t.String({ maxLength: 2048 }), t.Null()])),
  scopes: t.Optional(t.Array(t.String({ maxLength: 100 }))),
});

const authProviderClientSecretRevealSchema = t.Object({
  emailCode: t.String({ minLength: 4, maxLength: 12 }),
});

const altchaProtectedActionSchema = t.Object({
  altcha: t.String({ minLength: 1, maxLength: 20_000 }),
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

const getIntegrationTestFailureStatus = (
  reason: (typeof INTEGRATION_TEST_FAILURE)[keyof typeof INTEGRATION_TEST_FAILURE],
) => {
  switch (reason) {
    case INTEGRATION_TEST_FAILURE.AdminNotFound:
      return 404;
    case INTEGRATION_TEST_FAILURE.ResendFailed:
    case INTEGRATION_TEST_FAILURE.DeepLFailed:
    case INTEGRATION_TEST_FAILURE.IpGeolocationFailed:
      return 502;
    case INTEGRATION_TEST_FAILURE.AdminEmailMissing:
    case INTEGRATION_TEST_FAILURE.MissingResendDomain:
    case INTEGRATION_TEST_FAILURE.MissingResendApiKey:
    case INTEGRATION_TEST_FAILURE.MissingDeepLApiKey:
    case INTEGRATION_TEST_FAILURE.MissingIpGeolocationApiKey:
      return 400;
    default: {
      const exhaustiveReason: never = reason;
      throw new Error(`Unhandled integration test failure: ${exhaustiveReason}`);
    }
  }
};

const createLocalizedRouteMessage = ({
  en,
  locale,
  zhCN,
}: {
  en: string;
  locale?: string | null;
  zhCN: string;
}) => (locale?.toLowerCase().startsWith("en") === true ? en : zhCN);

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
        [USER_PROFILE_LOCALE_HEADER]: t.Optional(t.String()),
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
        [USER_PROFILE_LOCALE_HEADER]: t.Optional(t.String()),
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
        return status(400, {
          message: createLocalizedRouteMessage({
            en: "Founded time must use YYYY-MM-DD HH:mm.",
            locale: headers[USER_PROFILE_LOCALE_HEADER],
            zhCN: "建站时间必须使用 YYYY-MM-DD HH:mm。",
          }),
        });
      }

      if (result.reason === SITE_SETTINGS_FAILURE.R2Incomplete) {
        return status(400, {
          message: createLocalizedRouteMessage({
            en: "Complete the Cloudflare R2 account, bucket, access key, secret key, and public URL before enabling R2.",
            locale: headers[USER_PROFILE_LOCALE_HEADER],
            zhCN: "启用 Cloudflare R2 前，请完整填写账户、存储桶、Access Key、Secret Key 和公开访问地址。",
          }),
        });
      }

      return status(500, {
        message: createLocalizedRouteMessage({
          en: "Site settings update failed.",
          locale: headers[USER_PROFILE_LOCALE_HEADER],
          zhCN: "站点设置保存失败。",
        }),
      });
    },
    {
      headers: t.Object({
        authorization: t.Optional(t.String()),
        [USER_PROFILE_LOCALE_HEADER]: t.Optional(t.String()),
      }),
      body: updateSiteSettingsSchema,
    },
  )
  .get(
    "/login-methods",
    async ({ headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      const result = await listAuthProviderSettings();
      if (!result.ok) {
        return status(500, {
          message: createLocalizedRouteMessage({
            en: "Login method settings could not be loaded.",
            locale: headers[USER_PROFILE_LOCALE_HEADER],
            zhCN: "登录方式配置加载失败。",
          }),
        });
      }

      return result;
    },
    {
      headers: t.Object({
        authorization: t.Optional(t.String()),
        [USER_PROFILE_LOCALE_HEADER]: t.Optional(t.String()),
      }),
    },
  )
  .put(
    "/login-methods/:provider",
    async ({ body, headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      const result = await updateAuthProviderSettings({
        input: body,
        provider: params.provider,
      });
      if (result.ok) {
        return result;
      }

      if (result.reason === AUTH_PROVIDER_SETTINGS_FAILURE.UnsupportedProvider) {
        return status(400, {
          message: createLocalizedRouteMessage({
            en: "Unsupported login provider.",
            locale: headers[USER_PROFILE_LOCALE_HEADER],
            zhCN: "不支持的登录方式。",
          }),
        });
      }

      if (result.reason === AUTH_PROVIDER_SETTINGS_FAILURE.MissingRequiredFields) {
        return status(400, {
          message: createLocalizedRouteMessage({
            en: "Client ID, Client Secret, and Callback URL are required before enabling.",
            locale: headers[USER_PROFILE_LOCALE_HEADER],
            zhCN: "启用前请完整填写 Client ID、Client Secret 和 Callback URL。",
          }),
        });
      }

      return status(500, {
        message: createLocalizedRouteMessage({
          en: "Login method settings could not be saved.",
          locale: headers[USER_PROFILE_LOCALE_HEADER],
          zhCN: "登录方式配置保存失败。",
        }),
      });
    },
    {
      body: updateAuthProviderSettingsSchema,
      headers: t.Object({
        authorization: t.Optional(t.String()),
        [USER_PROFILE_LOCALE_HEADER]: t.Optional(t.String()),
      }),
      params: t.Object({
        provider: t.String(),
      }),
    },
  )
  .post(
    "/login-methods/:provider/client-secret/email-code",
    async ({ body, headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      const altchaResponse = await createAltchaVerificationResponse({
        locale: headers[USER_PROFILE_LOCALE_HEADER],
        payload: body.altcha,
      });
      if (altchaResponse !== undefined) {
        return altchaResponse;
      }

      const result = await createAuthProviderClientSecretRevealCode({
        locale: headers[USER_PROFILE_LOCALE_HEADER],
        provider: params.provider,
        userId: auth.userId,
      });
      if (result.ok) {
        return result;
      }

      return status(result.status, { message: result.message });
    },
    {
      body: altchaProtectedActionSchema,
      headers: t.Object({
        authorization: t.Optional(t.String()),
        [USER_PROFILE_LOCALE_HEADER]: t.Optional(t.String()),
      }),
      params: t.Object({
        provider: t.String(),
      }),
    },
  )
  .post(
    "/login-methods/:provider/client-secret/reveal",
    async ({ body, headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      const result = await revealAuthProviderClientSecret({
        emailCode: body.emailCode,
        locale: headers[USER_PROFILE_LOCALE_HEADER],
        provider: params.provider,
        userId: auth.userId,
      });
      if (result.ok) {
        return result;
      }

      return status(result.status, { message: result.message });
    },
    {
      body: authProviderClientSecretRevealSchema,
      headers: t.Object({
        authorization: t.Optional(t.String()),
        [USER_PROFILE_LOCALE_HEADER]: t.Optional(t.String()),
      }),
      params: t.Object({
        provider: t.String(),
      }),
    },
  )
  .post(
    "/site/api-keys/email-code",
    async ({ body, headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      const altchaResponse = await createAltchaVerificationResponse({
        locale: headers[USER_PROFILE_LOCALE_HEADER],
        payload: body.altcha,
      });
      if (altchaResponse !== undefined) {
        return altchaResponse;
      }

      const result = await createSiteSettingsApiKeyRevealCode({
        locale: headers[USER_PROFILE_LOCALE_HEADER],
        userId: auth.userId,
      });
      if (result.ok) {
        return result;
      }

      return status(result.status, { message: result.message });
    },
    {
      body: altchaProtectedActionSchema,
      headers: t.Object({
        authorization: t.Optional(t.String()),
        [USER_PROFILE_LOCALE_HEADER]: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/site/api-keys/reveal",
    async ({ body, headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      const result = await revealSiteSettingsApiKeys({
        emailCode: body.emailCode,
        locale: headers[USER_PROFILE_LOCALE_HEADER],
        userId: auth.userId,
      });
      if (result.ok) {
        return result;
      }

      return status(result.status, { message: result.message });
    },
    {
      headers: t.Object({
        authorization: t.Optional(t.String()),
        [USER_PROFILE_LOCALE_HEADER]: t.Optional(t.String()),
      }),
      body: revealSiteSettingsApiKeysSchema,
    },
  )
  .post(
    "/site/api-keys/test-resend",
    async ({ body, headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      const result = await testResendApiKey({
        locale: headers[USER_PROFILE_LOCALE_HEADER],
        resendApiKey: body.resendApiKey,
        resendDomain: body.resendDomain,
        userId: auth.userId,
      });
      if (result.ok) {
        return result;
      }

      return status(getIntegrationTestFailureStatus(result.reason), {
        ...(result.details === undefined ? {} : { details: result.details }),
        message: result.message,
      });
    },
    {
      headers: t.Object({
        authorization: t.Optional(t.String()),
        [USER_PROFILE_LOCALE_HEADER]: t.Optional(t.String()),
      }),
      body: testResendApiKeySchema,
    },
  )
  .post(
    "/site/api-keys/test-deepl",
    async ({ body, headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      const result = await testDeepLApiKey({
        apiKey: body.apiKey,
        locale: headers[USER_PROFILE_LOCALE_HEADER],
        text: body.text,
      });
      if (result.ok) {
        return result;
      }

      return status(getIntegrationTestFailureStatus(result.reason), {
        ...(result.details === undefined ? {} : { details: result.details }),
        message: result.message,
      });
    },
    {
      headers: t.Object({
        authorization: t.Optional(t.String()),
        [USER_PROFILE_LOCALE_HEADER]: t.Optional(t.String()),
      }),
      body: testDeepLApiKeySchema,
    },
  )
  .post(
    "/site/api-keys/test-ip-geolocation",
    async ({ body, headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      const result = await testIpGeolocationApiKey({
        apiKey: body.apiKey,
        locale: headers[USER_PROFILE_LOCALE_HEADER],
        userId: auth.userId,
      });
      if (result.ok) {
        return result;
      }

      return status(getIntegrationTestFailureStatus(result.reason), {
        ...(result.details === undefined ? {} : { details: result.details }),
        message: result.message,
      });
    },
    {
      headers: t.Object({
        authorization: t.Optional(t.String()),
        [USER_PROFILE_LOCALE_HEADER]: t.Optional(t.String()),
      }),
      body: testIpGeolocationApiKeySchema,
    },
  )
  .post("/site/api-keys/test-exchange-rate", async ({ body, headers, jwt }) => {
    const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
    if (!auth.ok) return auth.response;
    try {
      const rates = await getExchangeRates({ apiKey: body.apiKey, forceRefresh: true });
      return { ok: true, message: createLocalizedRouteMessage({
        locale: headers[USER_PROFILE_LOCALE_HEADER], en: "ExchangeRate API connected.", zhCN: "ExchangeRate API 连接成功。",
      }), details: `USD → CNY: ${rates.rates.CNY}; ${rates.updatedAt}` };
    } catch (error) {
      if (error instanceof SubscriptionError) return status(400, { message: error.message });
      return status(502, { message: "ExchangeRate service unavailable. / 汇率服务暂不可用。" });
    }
  }, { body: testIpGeolocationApiKeySchema, headers: t.Object({
    authorization: t.Optional(t.String()), [USER_PROFILE_LOCALE_HEADER]: t.Optional(t.String()),
  }) });
