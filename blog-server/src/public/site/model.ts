import { t } from "elysia";

export const SiteInfoItem = t.Object({
  siteName: t.String(),
  description: t.String(),
  logoDarkUrl: t.Nullable(t.String()),
  logoLightUrl: t.Nullable(t.String()),
  faviconUrl: t.Nullable(t.String()),
  establishedAt: t.String(),
});

export const SiteConfigItem = t.Object({
  seoTitle: t.String(),
  seoDescription: t.String(),
  seoKeywords: t.Array(t.String()),
  copyright: t.String(),
  resendDomain: t.Nullable(t.String()),
  commentsEnabled: t.Boolean(),
});

export const SiteFilingItem = t.Object({
  icpNumber: t.Nullable(t.String()),
  icpUrl: t.Nullable(t.String()),
  policeNumber: t.Nullable(t.String()),
  policeUrl: t.Nullable(t.String()),
});

export const SiteInfoResponse = t.Object({
  ok: t.Boolean(),
  item: SiteInfoItem,
});

export const SiteConfigResponse = t.Object({
  ok: t.Boolean(),
  item: SiteConfigItem,
});

export const SiteFilingResponse = t.Object({
  ok: t.Boolean(),
  item: SiteFilingItem,
});
