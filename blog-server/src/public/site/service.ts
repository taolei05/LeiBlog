import { cacheRememberJson } from "../../shared/cache";
import type { DbClient } from "../../shared/db";
import type { UserProfileRow } from "../../shared/types/user";
import { db } from "../../shared/db";
import { notFound } from "../../shared/errors";
import { redisKeys } from "../../shared/redis";
import { readStoredIcpFilingRecords } from "../../shared/site-filing";
import { toUserProfile } from "../../shared/types/user";

interface SiteInfoRow {
  site_name: string;
  description: string;
  logo_dark_url: string | null;
  logo_light_url: string | null;
  favicon_url: string | null;
  home_cover_urls: string[] | string;
  home_slogan: string;
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
  icp_records: unknown;
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

function cleanList(values: string[] | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function getStoredCoverUrls(values: string[] | string) {
  return cleanList(parseTextArray(values));
}

export async function getPublicSiteInfo(client: DbClient = db) {
  return cacheRememberJson(redisKeys.siteInfo, async () => {
    const [row] = await client<SiteInfoRow[]>`
      SELECT site_name, description, logo_dark_url, logo_light_url, favicon_url,
             home_cover_urls, home_slogan, established_at
      FROM site_info
      WHERE id = 1
    `;

    if (!row) throw notFound("站点信息尚未配置");

    const homeCoverUrls = getStoredCoverUrls(row.home_cover_urls);

    return {
      siteName: row.site_name,
      description: row.description,
      logoDarkUrl: row.logo_dark_url,
      logoLightUrl: row.logo_light_url,
      faviconUrl: row.favicon_url,
      homeCoverUrls,
      homeSlogan: row.home_slogan,
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
      SELECT icp_number, icp_records, icp_url, police_number, police_url
      FROM site_filing
      WHERE id = 1
    `;

    if (!row) throw notFound("备案信息尚未配置");

    const icpRecords = readStoredIcpFilingRecords({
      legacyNumber: row.icp_number,
      legacyUrl: row.icp_url,
      storedRecords: row.icp_records,
    });
    const firstIcpRecord = icpRecords[0];

    return {
      icpNumber: row.icp_number ?? firstIcpRecord?.number ?? null,
      icpRecords,
      icpUrl: row.icp_url ?? firstIcpRecord?.url ?? null,
      policeNumber: row.police_number,
      policeUrl: row.police_url,
    };
  });
}

export async function getPublicSiteAuthor(client: DbClient = db) {
  const [row] = await client<UserProfileRow[]>`
    SELECT id, username, email, name, description, tags, role, avatar_url,
           social_links, blog_url, created_at, updated_at, last_login_at,
           last_login_ip, last_login_location, last_login_device
    FROM users
    WHERE role = 'admin'
    ORDER BY created_at ASC
    LIMIT 1
  `;

  if (!row) throw notFound("作者信息尚未配置");

  const profile = toUserProfile(row);

  return {
    avatarUrl: profile.avatarUrl,
    blogUrl: profile.blogUrl,
    description: profile.description,
    name: profile.name,
    socialLinks: profile.socialLinks,
    tags: profile.tags,
    username: profile.username,
  };
}
