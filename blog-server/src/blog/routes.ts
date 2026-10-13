import { Elysia, t } from "elysia";

import { getPublicSiteAuthor, getSiteSettings } from "../admin/settings/service";
import { blogArticleRoutes } from "./articles/routes";
import { blogAuthRoutes } from "./auth/routes";
import { blogCommentRoutes } from "./comments/routes";
import { listPublicNavigation } from "./navigation/service";

const siteContentLocalizationSchema = t.Object({
  siteName: t.String(),
  siteDescription: t.String(),
  homepageCopy: t.String(),
  seoTitle: t.String(),
  seoDescription: t.String(),
});

const publicAuthorProfileLocalizationSchema = t.Object({
  name: t.String(),
  bio: t.String(),
  tags: t.Array(t.String()),
});

const publicAuthorSocialLinkSchema = t.Object({
  label: t.String(),
  url: t.String(),
});

const publicSiteFilingRecordSchema = t.Object({
  number: t.String(),
  url: t.String(),
});

const publicSiteAuthorSchema = t.Nullable(
  t.Object({
    avatarUrl: t.String(),
    blogUrl: t.String(),
    profileLocalizations: t.Object({
      zhCN: publicAuthorProfileLocalizationSchema,
      en: publicAuthorProfileLocalizationSchema,
    }),
    socialLinks: t.Array(publicAuthorSocialLinkSchema),
    username: t.String(),
  }),
);

const publicSiteSettingsSchema = t.Object({
  author: publicSiteAuthorSchema,
  basics: t.Object({
    commentsEnabled: t.Boolean(),
    copyright: t.String(),
  }),
  filings: t.Object({
    icpRecords: t.Array(publicSiteFilingRecordSchema),
    policeRecordNumber: t.String(),
    policeRecordUrl: t.String(),
  }),
  siteLocalizations: t.Object({
    zhCN: siteContentLocalizationSchema,
    en: siteContentLocalizationSchema,
  }),
  site: t.Object({
    siteName: t.String(),
    foundedAt: t.String(),
    siteDescription: t.String(),
    coverUrls: t.Array(t.String()),
    lightLogoUrl: t.String(),
    darkLogoUrl: t.String(),
    faviconUrl: t.String(),
    timeZone: t.String(),
  }),
});

const publicNavigationItemSchema = t.Object({
  iconUrl: t.Nullable(t.String()),
  id: t.String(),
  name: t.String(),
  note: t.Nullable(t.String()),
  url: t.String(),
});

const publicNavigationGroupSchema = t.Object({
  id: t.String(),
  items: t.Array(publicNavigationItemSchema),
  name: t.String(),
  nameEn: t.Nullable(t.String()),
});

const publicNavigationResponseSchema = t.Object({
  groups: t.Array(publicNavigationGroupSchema),
  ok: t.Boolean(),
});

const readPublicSiteSettings = async () => {
  const [settings, author] = await Promise.all([getSiteSettings(), getPublicSiteAuthor()]);

  return {
    author: author ?? null,
    basics: {
      commentsEnabled: settings.basics.commentsEnabled,
      copyright: settings.basics.copyright,
    },
    filings: {
      icpRecords: settings.filings.icpRecords,
      policeRecordNumber: settings.filings.policeRecordNumber,
      policeRecordUrl: settings.filings.policeRecordUrl,
    },
    siteLocalizations: settings.siteLocalizations,
    site: {
      siteName: settings.site.siteName,
      foundedAt: settings.site.foundedAt,
      siteDescription: settings.site.siteDescription,
      coverUrls: settings.site.coverUrls,
      lightLogoUrl: settings.site.lightLogoUrl,
      darkLogoUrl: settings.site.darkLogoUrl,
      faviconUrl: settings.site.faviconUrl,
      timeZone: settings.site.timeZone,
    },
  };
};

export const blogRoutes = new Elysia({ prefix: "/api/blog" })
  .use(blogAuthRoutes)
  .use(blogArticleRoutes)
  .use(blogCommentRoutes)
  .get("/health", () => ({
    ok: true,
    scope: "blog",
  }))
  .get("/settings", readPublicSiteSettings, {
    response: publicSiteSettingsSchema,
  })
  .get("/navigation", () => listPublicNavigation(), {
    response: publicNavigationResponseSchema,
  });
