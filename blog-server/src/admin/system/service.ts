import {
  assertWritableAdmin,
  requireAdminOrDemo,
  type AuthUser,
} from "../../shared/auth";
import { clearSiteCache } from "../../shared/cache/content";
import { encryptSecret, type StoredEncryptedSecret } from "../../shared/crypto";
import { db, type DbClient } from "../../shared/db";
import { validationError } from "../../shared/errors";

export interface SystemSiteInfoInput {
  siteName: string;
  description?: string;
  logoDarkUrl?: string | null;
  logoLightUrl?: string | null;
  faviconUrl?: string | null;
  establishedAt: string;
}

export interface SystemSiteConfigInput {
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  copyright?: string;
  resendDomain?: string | null;
  resendApiKey?: string | null;
  deeplApiKey?: string | null;
  ipgeolocationApiKey?: string | null;
  commentsEnabled: boolean;
}

export interface SystemFilingInput {
  icpNumber?: string | null;
  icpUrl?: string | null;
  policeNumber?: string | null;
  policeUrl?: string | null;
}

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
  resend_api_key_encrypted: StoredEncryptedSecret | null;
  deepl_api_key_encrypted: StoredEncryptedSecret | null;
  ipgeolocation_api_key_encrypted: StoredEncryptedSecret | null;
  comments_enabled: boolean;
}

interface SiteFilingRow {
  icp_number: string | null;
  icp_url: string | null;
  police_number: string | null;
  police_url: string | null;
}

function cleanOptional(value: string | null | undefined) {
  if (value === null) return null;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanList(values: string[] | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function parseDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw validationError("建站时间格式无效");
  }

  return date;
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

function toSiteInfo(row: SiteInfoRow) {
  return {
    siteName: row.site_name,
    description: row.description,
    logoDarkUrl: row.logo_dark_url,
    logoLightUrl: row.logo_light_url,
    faviconUrl: row.favicon_url,
    establishedAt: toIso(row.established_at),
  };
}

function toSiteConfig(row: SiteConfigRow) {
  return {
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    seoKeywords: parseTextArray(row.seo_keywords),
    copyright: row.copyright,
    resendDomain: row.resend_domain,
    hasResendApiKey: Boolean(row.resend_api_key_encrypted),
    hasDeepLApiKey: Boolean(row.deepl_api_key_encrypted),
    hasIpgeolocationApiKey: Boolean(row.ipgeolocation_api_key_encrypted),
    commentsEnabled: row.comments_enabled,
  };
}

function toFiling(row: SiteFilingRow) {
  return {
    icpNumber: row.icp_number,
    icpUrl: row.icp_url,
    policeNumber: row.police_number,
    policeUrl: row.police_url,
  };
}

export async function getSystemSiteInfo(currentUser: AuthUser, client: DbClient = db) {
  requireAdminOrDemo(currentUser);

  const [row] = await client<SiteInfoRow[]>`
    SELECT site_name, description, logo_dark_url, logo_light_url, favicon_url, established_at
    FROM site_info
    WHERE id = 1
  `;

  return { ok: true, item: row ? toSiteInfo(row) : null };
}

export async function updateSystemSiteInfo(
  currentUser: AuthUser,
  input: SystemSiteInfoInput,
  client: DbClient = db
) {
  assertWritableAdmin(currentUser);

  await client`
    INSERT INTO site_info (
      id, site_name, description, logo_dark_url, logo_light_url, favicon_url, established_at
    )
    VALUES (
      1,
      ${input.siteName.trim()},
      ${input.description?.trim() ?? ""},
      ${cleanOptional(input.logoDarkUrl)},
      ${cleanOptional(input.logoLightUrl)},
      ${cleanOptional(input.faviconUrl)},
      ${parseDate(input.establishedAt)}
    )
    ON CONFLICT (id) DO UPDATE
    SET site_name = EXCLUDED.site_name,
        description = EXCLUDED.description,
        logo_dark_url = EXCLUDED.logo_dark_url,
        logo_light_url = EXCLUDED.logo_light_url,
        favicon_url = EXCLUDED.favicon_url,
        established_at = EXCLUDED.established_at
  `;

  await clearSiteCache();
  return getSystemSiteInfo(currentUser, client);
}

export async function getSystemSiteConfig(currentUser: AuthUser, client: DbClient = db) {
  requireAdminOrDemo(currentUser);

  const [row] = await client<SiteConfigRow[]>`
    SELECT seo_title, seo_description, seo_keywords, copyright, resend_domain,
           resend_api_key_encrypted, deepl_api_key_encrypted,
           ipgeolocation_api_key_encrypted, comments_enabled
    FROM site_config
    WHERE id = 1
  `;

  return { ok: true, item: row ? toSiteConfig(row) : null };
}

export async function updateSystemSiteConfig(
  currentUser: AuthUser,
  input: SystemSiteConfigInput,
  client: DbClient = db
) {
  assertWritableAdmin(currentUser);

  const shouldUpdateResendApiKey = input.resendApiKey !== undefined;
  const shouldUpdateDeepLApiKey = input.deeplApiKey !== undefined;
  const shouldUpdateIpgeolocationApiKey = input.ipgeolocationApiKey !== undefined;
  const resendApiKey = shouldUpdateResendApiKey
    ? encryptSecret(cleanOptional(input.resendApiKey))
    : null;
  const deeplApiKey = shouldUpdateDeepLApiKey
    ? encryptSecret(cleanOptional(input.deeplApiKey))
    : null;
  const ipgeolocationApiKey = shouldUpdateIpgeolocationApiKey
    ? encryptSecret(cleanOptional(input.ipgeolocationApiKey))
    : null;

  await client`
    INSERT INTO site_config (
      id, seo_title, seo_description, seo_keywords, copyright, resend_domain,
      resend_api_key_encrypted, deepl_api_key_encrypted,
      ipgeolocation_api_key_encrypted, comments_enabled
    )
    VALUES (
      1,
      ${input.seoTitle?.trim() ?? ""},
      ${input.seoDescription?.trim() ?? ""},
      ${client.array(cleanList(input.seoKeywords), "TEXT")},
      ${input.copyright?.trim() ?? ""},
      ${cleanOptional(input.resendDomain)},
      ${resendApiKey ? JSON.stringify(resendApiKey) : null}::jsonb,
      ${deeplApiKey ? JSON.stringify(deeplApiKey) : null}::jsonb,
      ${ipgeolocationApiKey ? JSON.stringify(ipgeolocationApiKey) : null}::jsonb,
      ${input.commentsEnabled}
    )
    ON CONFLICT (id) DO UPDATE
    SET seo_title = EXCLUDED.seo_title,
        seo_description = EXCLUDED.seo_description,
        seo_keywords = EXCLUDED.seo_keywords,
        copyright = EXCLUDED.copyright,
        resend_domain = EXCLUDED.resend_domain,
        resend_api_key_encrypted = CASE
          WHEN ${shouldUpdateResendApiKey} THEN EXCLUDED.resend_api_key_encrypted
          ELSE site_config.resend_api_key_encrypted
        END,
        deepl_api_key_encrypted = CASE
          WHEN ${shouldUpdateDeepLApiKey} THEN EXCLUDED.deepl_api_key_encrypted
          ELSE site_config.deepl_api_key_encrypted
        END,
        ipgeolocation_api_key_encrypted = CASE
          WHEN ${shouldUpdateIpgeolocationApiKey} THEN EXCLUDED.ipgeolocation_api_key_encrypted
          ELSE site_config.ipgeolocation_api_key_encrypted
        END,
        comments_enabled = EXCLUDED.comments_enabled
  `;

  await clearSiteCache();
  return getSystemSiteConfig(currentUser, client);
}

export async function getSystemFiling(currentUser: AuthUser, client: DbClient = db) {
  requireAdminOrDemo(currentUser);

  const [row] = await client<SiteFilingRow[]>`
    SELECT icp_number, icp_url, police_number, police_url
    FROM site_filing
    WHERE id = 1
  `;

  return { ok: true, item: row ? toFiling(row) : null };
}

export async function updateSystemFiling(
  currentUser: AuthUser,
  input: SystemFilingInput,
  client: DbClient = db
) {
  assertWritableAdmin(currentUser);

  await client`
    INSERT INTO site_filing (id, icp_number, icp_url, police_number, police_url)
    VALUES (
      1,
      ${cleanOptional(input.icpNumber)},
      ${cleanOptional(input.icpUrl)},
      ${cleanOptional(input.policeNumber)},
      ${cleanOptional(input.policeUrl)}
    )
    ON CONFLICT (id) DO UPDATE
    SET icp_number = EXCLUDED.icp_number,
        icp_url = EXCLUDED.icp_url,
        police_number = EXCLUDED.police_number,
        police_url = EXCLUDED.police_url
  `;

  await clearSiteCache();
  return getSystemFiling(currentUser, client);
}
