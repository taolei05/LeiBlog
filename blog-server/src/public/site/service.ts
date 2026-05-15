import { cacheRememberJson } from "../../shared/cache";
import { db, type DbClient } from "../../shared/db";
import { notFound } from "../../shared/errors";
import { redisKeys } from "../../shared/redis";

interface SiteInfoRow {
  site_name: string;
  description: string;
  logo_dark_url: string | null;
  logo_light_url: string | null;
  favicon_url: string | null;
  established_at: Date | string;
}

interface SiteConfigRow {
  seo_title: string;
  seo_description: string;
  seo_keywords: string[] | string;
  copyright: string;
  resend_domain: string | null;
  comments_enabled: boolean;
}

interface SiteFilingRow {
  icp_number: string | null;
  icp_url: string | null;
  police_number: string | null;
  police_url: string | null;
}

function toIso(value: Date | string) {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function parseTextArray(value: string[] | string) {
  if (Array.isArray(value)) return value;
  return value
    .replace(/^\{|\}$/g, "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function getPublicSiteInfo(client: DbClient = db) {
  return cacheRememberJson(redisKeys.siteInfo, async () => {
    const [row] = await client<SiteInfoRow[]>`
      SELECT site_name, description, logo_dark_url, logo_light_url, favicon_url, established_at
      FROM site_info
      WHERE id = 1
    `;

    if (!row) throw notFound("站点信息尚未配置");

    return {
      siteName: row.site_name,
      description: row.description,
      logoDarkUrl: row.logo_dark_url,
      logoLightUrl: row.logo_light_url,
      faviconUrl: row.favicon_url,
      establishedAt: toIso(row.established_at),
    };
  });
}

export async function getPublicSiteConfig(client: DbClient = db) {
  return cacheRememberJson(redisKeys.siteConfig, async () => {
    const [row] = await client<SiteConfigRow[]>`
      SELECT seo_title, seo_description, seo_keywords, copyright, resend_domain, comments_enabled
      FROM site_config
      WHERE id = 1
    `;

    if (!row) throw notFound("站点配置尚未配置");

    return {
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
      seoKeywords: parseTextArray(row.seo_keywords),
      copyright: row.copyright,
      resendDomain: row.resend_domain,
      commentsEnabled: row.comments_enabled,
    };
  });
}

export async function getPublicSiteFiling(client: DbClient = db) {
  return cacheRememberJson(redisKeys.siteFiling, async () => {
    const [row] = await client<SiteFilingRow[]>`
      SELECT icp_number, icp_url, police_number, police_url
      FROM site_filing
      WHERE id = 1
    `;

    if (!row) throw notFound("备案信息尚未配置");

    return {
      icpNumber: row.icp_number,
      icpUrl: row.icp_url,
      policeNumber: row.police_number,
      policeUrl: row.police_url,
    };
  });
}
