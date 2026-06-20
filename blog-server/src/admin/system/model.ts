import { t } from "elysia";

const SystemSiteInfoItem = t.Object({
  siteName: t.String(),
  description: t.String(),
  logoDarkUrl: t.Nullable(t.String()),
  logoLightUrl: t.Nullable(t.String()),
  faviconUrl: t.Nullable(t.String()),
  homeCoverUrls: t.Array(t.String()),
  homeSlogan: t.String(),
  establishedAt: t.String(),
});

const SystemSiteConfigItem = t.Object({
  seoTitle: t.String(),
  seoDescription: t.String(),
  seoKeywords: t.Array(t.String()),
  copyright: t.String(),
  resendDomain: t.Nullable(t.String()),
  hasResendApiKey: t.Boolean(),
  hasDeepLApiKey: t.Boolean(),
  hasIpgeolocationApiKey: t.Boolean(),
  commentsEnabled: t.Boolean(),
});

const SystemFilingItem = t.Object({
  icpNumber: t.Nullable(t.String()),
  icpRecords: t.Array(
    t.Object({
      number: t.String(),
      url: t.Nullable(t.String()),
    })
  ),
  icpUrl: t.Nullable(t.String()),
  policeNumber: t.Nullable(t.String()),
  policeUrl: t.Nullable(t.String()),
});

const AuthProviderSettingsItem = t.Object({
  clientId: t.Nullable(t.String()),
  displayName: t.String(),
  enabled: t.Boolean(),
  hasClientSecret: t.Boolean(),
  provider: t.String(),
  redirectUri: t.Nullable(t.String()),
  scopes: t.Array(t.String()),
});

export const SystemSiteInfoBody = t.Object({
  siteName: t.String({ minLength: 1, maxLength: 120 }),
  description: t.Optional(t.String({ maxLength: 2000 })),
  logoDarkUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
  logoLightUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
  faviconUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
  homeCoverUrls: t.Optional(t.Array(t.String({ maxLength: 2048 }), { maxItems: 12 })),
  homeSlogan: t.Optional(t.String({ maxLength: 500 })),
  establishedAt: t.String(),
});

export const SystemSiteConfigBody = t.Object({
  seoTitle: t.Optional(t.String({ maxLength: 160 })),
  seoDescription: t.Optional(t.String({ maxLength: 300 })),
  seoKeywords: t.Optional(t.Array(t.String({ maxLength: 60 }), { maxItems: 30 })),
  copyright: t.Optional(t.String({ maxLength: 500 })),
  resendDomain: t.Optional(t.Nullable(t.String({ maxLength: 255 }))),
  resendApiKey: t.Optional(t.Nullable(t.String({ maxLength: 1000 }))),
  deeplApiKey: t.Optional(t.Nullable(t.String({ maxLength: 1000 }))),
  ipgeolocationApiKey: t.Optional(t.Nullable(t.String({ maxLength: 1000 }))),
  commentsEnabled: t.Boolean(),
});

export const SystemFilingBody = t.Object({
  icpNumber: t.Optional(t.Nullable(t.String({ maxLength: 120 }))),
  icpRecords: t.Optional(
    t.Array(
      t.Object({
        number: t.String({ maxLength: 120 }),
        url: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
      }),
      { maxItems: 20 }
    )
  ),
  icpUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
  policeNumber: t.Optional(t.Nullable(t.String({ maxLength: 120 }))),
  policeUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
});

export const AuthProviderParams = t.Object({
  provider: t.String({ minLength: 1, maxLength: 40 }),
});

export const AuthProviderSettingsBody = t.Object({
  clientId: t.Optional(t.Nullable(t.String({ maxLength: 1000 }))),
  clientSecret: t.Optional(t.Nullable(t.String({ maxLength: 1000 }))),
  displayName: t.Optional(t.String({ maxLength: 80 })),
  enabled: t.Boolean(),
  redirectUri: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
  scopes: t.Optional(t.Array(t.String({ maxLength: 100 }), { maxItems: 20 })),
});

export const RevealApiKeysBody = t.Object({
  emailCode: t.String({ minLength: 4, maxLength: 12 }),
});

export const RevealAuthProviderClientSecretBody = t.Object({
  emailCode: t.String({ minLength: 4, maxLength: 12 }),
});

export const ResendTestBody = t.Object({
  kind: t.Union([t.Literal("domain"), t.Literal("apiKey")]),
  resendApiKey: t.Optional(t.Nullable(t.String({ maxLength: 1000 }))),
  resendDomain: t.Optional(t.Nullable(t.String({ maxLength: 255 }))),
});

export const DeepLTestBody = t.Object({
  apiKey: t.Optional(t.Nullable(t.String({ maxLength: 1000 }))),
  text: t.String({ minLength: 1, maxLength: 1000 }),
});

export const SystemSiteInfoResponse = t.Object({
  ok: t.Boolean(),
  item: t.Nullable(SystemSiteInfoItem),
});

export const SystemSiteConfigResponse = t.Object({
  ok: t.Boolean(),
  item: t.Nullable(SystemSiteConfigItem),
});

export const SystemFilingResponse = t.Object({
  ok: t.Boolean(),
  item: t.Nullable(SystemFilingItem),
});

export const AuthProvidersResponse = t.Object({
  ok: t.Boolean(),
  items: t.Array(AuthProviderSettingsItem),
});

export const AuthProviderSettingsResponse = t.Object({
  ok: t.Boolean(),
  item: AuthProviderSettingsItem,
});

export const ApiKeyEmailCodeResponse = t.Object({
  expiresAt: t.String(),
  ok: t.Boolean(),
  sent: t.Boolean(),
  validMinutes: t.Number(),
  devCode: t.Optional(t.String()),
});

export const ApiKeysResponse = t.Object({
  ok: t.Boolean(),
  item: t.Object({
    resendApiKey: t.Nullable(t.String()),
    deeplApiKey: t.Nullable(t.String()),
    ipgeolocationApiKey: t.Nullable(t.String()),
  }),
});

export const AuthProviderClientSecretResponse = t.Object({
  ok: t.Boolean(),
  item: t.Object({
    clientSecret: t.Nullable(t.String()),
    provider: t.String(),
  }),
});

export const IntegrationTestResponse = t.Object({
  ok: t.Boolean(),
  message: t.String(),
  translatedText: t.Optional(t.String()),
  login: t.Optional(
    t.Object({
      device: t.String(),
      ip: t.String(),
      location: t.String(),
    })
  ),
});
