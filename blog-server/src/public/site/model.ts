import { t } from "elysia";

export const SiteInfoItem = t.Object({
  siteName: t.String(),
  description: t.String(),
  logoDarkUrl: t.Nullable(t.String()),
  logoLightUrl: t.Nullable(t.String()),
  faviconUrl: t.Nullable(t.String()),
  homeCoverUrl: t.Nullable(t.String()),
  homeCoverUrls: t.Array(t.String()),
  homeSlogan: t.String(),
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

export const SiteAuthorItem = t.Object({
  avatarUrl: t.Nullable(t.String()),
  blogUrl: t.Nullable(t.String()),
  description: t.String(),
  name: t.Nullable(t.String()),
  socialLinks: t.Record(t.String(), t.String()),
  tags: t.Array(t.String()),
  username: t.String(),
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

export const SiteAuthorResponse = t.Object({
  ok: t.Boolean(),
  item: SiteAuthorItem,
});
