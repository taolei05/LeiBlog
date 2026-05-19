import { t } from "elysia";

const SystemSiteInfoItem = t.Object({
  siteName: t.String(),
  description: t.String(),
  logoDarkUrl: t.Nullable(t.String()),
  logoLightUrl: t.Nullable(t.String()),
  faviconUrl: t.Nullable(t.String()),
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
  icpUrl: t.Nullable(t.String()),
  policeNumber: t.Nullable(t.String()),
  policeUrl: t.Nullable(t.String()),
});

export const SystemSiteInfoBody = t.Object({
  siteName: t.String({ minLength: 1, maxLength: 120 }),
  description: t.Optional(t.String({ maxLength: 2000 })),
  logoDarkUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
  logoLightUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
  faviconUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
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
  icpUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
  policeNumber: t.Optional(t.Nullable(t.String({ maxLength: 120 }))),
  policeUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
});

export const RevealApiKeysBody = t.Object({
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

export const ApiKeyEmailCodeResponse = t.Object({
  ok: t.Boolean(),
  sent: t.Boolean(),
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
