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
