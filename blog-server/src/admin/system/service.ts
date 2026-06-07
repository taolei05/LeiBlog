import type { AuthUser } from "../../shared/auth";

import {
  consumeEmailCode,
  createEmailCode,
  renderNoticeEmailHtml,
  renderVerificationCodeEmailHtml,
} from "../../auth/service";
import { requireAdmin } from "../../shared/auth";
import { clearSiteCache } from "../../shared/cache/content";
import type { StoredEncryptedSecret } from "../../shared/crypto";
import { decryptSecret, encryptSecret } from "../../shared/crypto";
import type { DbClient } from "../../shared/db";
import { db } from "../../shared/db";
import { validationError } from "../../shared/errors";
import type { IcpFilingRecordInput } from "../../shared/site-filing";
import { cleanIcpFilingRecords, readStoredIcpFilingRecords } from "../../shared/site-filing";

export interface SystemSiteInfoInput {
  siteName: string;
  description?: string;
  logoDarkUrl?: string | null;
  logoLightUrl?: string | null;
  faviconUrl?: string | null;
  homeCoverUrls?: string[];
  homeSlogan?: string;
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
  icpRecords?: IcpFilingRecordInput[] | null;
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
  resend_api_key_encrypted: StoredEncryptedSecret | null;
  deepl_api_key_encrypted: StoredEncryptedSecret | null;
  ipgeolocation_api_key_encrypted: StoredEncryptedSecret | null;
  comments_enabled: boolean;
}

interface SiteFilingRow {
  icp_records: unknown;
  police_number: string | null;
  police_url: string | null;
}

interface AdminLoginMetaRow {
  last_login_device: unknown;
  last_login_ip: string | null;
  last_login_location: unknown;
}

type ResendTestInput = {
  kind: "apiKey" | "domain";
  resendApiKey?: string | null;
  resendDomain?: string | null;
};

type DeepLTestInput = {
  apiKey?: string | null;
  text: string;
};

function cleanOptional(value: string | null | undefined) {
  if (value === null) return null;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanList(values: string[] | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function cleanCoverUrls(values: string[] | undefined) {
  return cleanList(values);
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
  const homeCoverUrls = cleanCoverUrls(parseTextArray(row.home_cover_urls));

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
  const icpRecords = readStoredIcpFilingRecords({
    storedRecords: row.icp_records,
  });
  const firstIcpRecord = icpRecords[0];

  return {
    icpNumber: firstIcpRecord?.number ?? null,
    icpRecords,
    icpUrl: firstIcpRecord?.url ?? null,
    policeNumber: row.police_number,
    policeUrl: row.police_url,
  };
}

function readStoredApiKeys(row: SiteConfigRow | undefined) {
  return {
    deeplApiKey: decryptSecret(row?.deepl_api_key_encrypted),
    ipgeolocationApiKey: decryptSecret(row?.ipgeolocation_api_key_encrypted),
    resendApiKey: decryptSecret(row?.resend_api_key_encrypted),
    resendDomain: row?.resend_domain ?? null,
  };
}

function readJsonText(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" && field.trim() ? field.trim() : null;
}

function describeDevice(value: unknown) {
  return readJsonText(value, "userAgent") ?? "未知设备";
}

function describeLocation(value: unknown) {
  const location = readJsonText(value, "location");
  if (location) return location;

  const city = readJsonText(value, "city");
  const country = readJsonText(value, "country_name") ?? readJsonText(value, "country");
  const parts = [country, city].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "未知地点";
}

async function getSiteConfigRow(client: DbClient) {
  const [row] = await client<SiteConfigRow[]>`
    SELECT seo_title, seo_description, seo_keywords, copyright, resend_domain,
           resend_api_key_encrypted, deepl_api_key_encrypted,
           ipgeolocation_api_key_encrypted, comments_enabled
    FROM site_config
    WHERE id = 1
  `;

  return row;
}

async function sendResendTestEmail({
  apiKey,
  domain,
  to,
  subject,
  text,
  html,
}: {
  apiKey: string;
  domain: string;
  html: string;
  subject: string;
  text: string;
  to: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from: `LeiBlog <no-reply@${domain}>`,
      html,
      subject,
      text,
      to: [to],
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw validationError("Resend 测试失败，请检查域名或 API Key");
  }
}

async function translateWithDeepL(apiKey: string, text: string) {
  const endpoint = apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
  const response = await fetch(endpoint, {
    body: JSON.stringify({
      target_lang: "EN",
      text: [text],
    }),
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw validationError("DeepL API Key 测试失败");
  }

  const payload = (await response.json()) as {
    translations?: Array<{ text?: string }>;
  };
  const translatedText = payload.translations?.[0]?.text;
  if (!translatedText) throw validationError("DeepL 没有返回翻译结果");

  return translatedText;
}

export async function getSystemSiteInfo(currentUser: AuthUser, client: DbClient = db) {
  requireAdmin(currentUser);

  const [row] = await client<SiteInfoRow[]>`
    SELECT site_name, description, logo_dark_url, logo_light_url, favicon_url,
           home_cover_urls, home_slogan, established_at
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
  requireAdmin(currentUser);

  const homeCoverUrls = cleanCoverUrls(input.homeCoverUrls);

  await client`
    INSERT INTO site_info (
      id, site_name, description, logo_dark_url, logo_light_url, favicon_url,
      home_cover_urls, home_slogan, established_at
    )
    VALUES (
      1,
      ${input.siteName.trim()},
      ${input.description?.trim() ?? ""},
      ${cleanOptional(input.logoDarkUrl)},
      ${cleanOptional(input.logoLightUrl)},
      ${cleanOptional(input.faviconUrl)},
      ${client.array(homeCoverUrls, "TEXT")},
      ${input.homeSlogan?.trim() ?? ""},
      ${parseDate(input.establishedAt)}
    )
    ON CONFLICT (id) DO UPDATE
    SET site_name = EXCLUDED.site_name,
        description = EXCLUDED.description,
        logo_dark_url = EXCLUDED.logo_dark_url,
        logo_light_url = EXCLUDED.logo_light_url,
        favicon_url = EXCLUDED.favicon_url,
        home_cover_urls = EXCLUDED.home_cover_urls,
        home_slogan = EXCLUDED.home_slogan,
        established_at = EXCLUDED.established_at
  `;

  await clearSiteCache();
  return getSystemSiteInfo(currentUser, client);
}

export async function getSystemSiteConfig(currentUser: AuthUser, client: DbClient = db) {
  requireAdmin(currentUser);

  const row = await getSiteConfigRow(client);

  return { ok: true, item: row ? toSiteConfig(row) : null };
}

export async function updateSystemSiteConfig(
  currentUser: AuthUser,
  input: SystemSiteConfigInput,
  client: DbClient = db
) {
  requireAdmin(currentUser);

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
  requireAdmin(currentUser);

  const [row] = await client<SiteFilingRow[]>`
    SELECT icp_records, police_number, police_url
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
  requireAdmin(currentUser);

  const icpRecords = cleanIcpFilingRecords({
    legacyNumber: input.icpNumber,
    legacyUrl: input.icpUrl,
    records: input.icpRecords,
  });

  await client`
    INSERT INTO site_filing (id, icp_records, police_number, police_url)
    VALUES (
      1,
      ${JSON.stringify(icpRecords)}::jsonb,
      ${cleanOptional(input.policeNumber)},
      ${cleanOptional(input.policeUrl)}
    )
    ON CONFLICT (id) DO UPDATE
    SET icp_records = EXCLUDED.icp_records,
        police_number = EXCLUDED.police_number,
        police_url = EXCLUDED.police_url
  `;

  await clearSiteCache();
  return getSystemFiling(currentUser, client);
}

export async function createApiKeyRevealCode(
  currentUser: AuthUser,
  client: DbClient = db
) {
  requireAdmin(currentUser);

  if (!currentUser.email) {
    throw validationError("管理员账号未配置邮箱，无法发送验证码");
  }

  const stored = readStoredApiKeys(await getSiteConfigRow(client));

  if (!stored.resendApiKey) {
    throw validationError("Resend API Key 未配置，无法发送管理员邮箱验证码");
  }

  if (!stored.resendDomain) {
    throw validationError(
      "Resend 域名未配置，无法发送管理员邮箱验证码。Resend 未配置已验证域名时，只能向注册 Resend 的邮箱发送邮件，请先配置并验证 Resend 域名。"
    );
  }

  const result = await createEmailCode(
    {
      email: currentUser.email,
      purpose: "email_change",
    },
    {
      client,
      emailHtml: (code, validMinutes) =>
        renderVerificationCodeEmailHtml({
          code,
          description: "你正在查看 LeiBlog 后台 API Key。请使用下面的验证码完成管理员邮箱校验。",
          title: "LeiBlog API Key 查看验证码",
          validMinutes,
        }),
      emailSubject: "LeiBlog API Key 查看验证码",
      emailText: (code, validMinutes) =>
        `你正在查看 LeiBlog 后台 API Key，验证码：${code}，${validMinutes} 分钟内有效。`,
    }
  );

  if (!result.sent) {
    throw validationError("验证码邮件未发送，请检查 Resend 域名和 API Key 配置");
  }

  return {
    expiresAt: result.expiresAt,
    ok: true,
    sent: true,
    validMinutes: result.validMinutes,
  };
}

export async function revealSystemApiKeys(
  currentUser: AuthUser,
  input: { emailCode: string },
  client: DbClient = db
) {
  requireAdmin(currentUser);

  if (!currentUser.email) {
    throw validationError("管理员账号未配置邮箱，无法校验验证码");
  }

  await consumeEmailCode(currentUser.email, input.emailCode, "email_change", client);

  const row = await getSiteConfigRow(client);
  const apiKeys = readStoredApiKeys(row);

  return {
    ok: true,
    item: {
      resendApiKey: apiKeys.resendApiKey,
      deeplApiKey: apiKeys.deeplApiKey,
      ipgeolocationApiKey: apiKeys.ipgeolocationApiKey,
    },
  };
}

export async function testResendIntegration(
  currentUser: AuthUser,
  input: ResendTestInput,
  client: DbClient = db
) {
  requireAdmin(currentUser);

  if (!currentUser.email) {
    throw validationError("管理员账号未配置邮箱，无法接收测试邮件");
  }

  const stored = readStoredApiKeys(await getSiteConfigRow(client));
  const domain = cleanOptional(input.resendDomain) ?? stored.resendDomain;
  const apiKey = cleanOptional(input.resendApiKey) ?? stored.resendApiKey;

  if (!domain) throw validationError("Resend 域名未配置");
  if (!apiKey) throw validationError("Resend API Key 未配置");

  const label = input.kind === "domain" ? "Resend 域名" : "Resend API Key";
  await sendResendTestEmail({
    apiKey,
    domain,
    html: renderNoticeEmailHtml({
      description: `${label}配置成功。系统已经使用当前配置向管理员邮箱发送了这封测试邮件。`,
      title: `LeiBlog ${label}配置成功`,
    }),
    subject: `LeiBlog ${label}配置成功`,
    text: `${label}配置成功。`,
    to: currentUser.email,
  });

  return {
    ok: true,
    message: `${label}配置成功，已向管理员邮箱发送提醒邮件`,
  };
}

export async function testDeepLIntegration(
  currentUser: AuthUser,
  input: DeepLTestInput,
  client: DbClient = db
) {
  requireAdmin(currentUser);
  const stored = readStoredApiKeys(await getSiteConfigRow(client));
  const apiKey = cleanOptional(input.apiKey) ?? stored.deeplApiKey;
  if (!apiKey) throw validationError("DeepL API Key 未配置");

  const translatedText = await translateWithDeepL(apiKey, input.text.trim());
  return {
    ok: true,
    message: "DeepL API Key 配置成功",
    translatedText,
  };
}

export async function testIpGeolocationIntegration(
  currentUser: AuthUser,
  client: DbClient = db
) {
  requireAdmin(currentUser);
  const stored = readStoredApiKeys(await getSiteConfigRow(client));
  if (!stored.ipgeolocationApiKey) throw validationError("IPGeolocation API Key 未配置");

  const [row] = await client<AdminLoginMetaRow[]>`
    SELECT host(last_login_ip) AS last_login_ip, last_login_location, last_login_device
    FROM users
    WHERE id = ${currentUser.id}
  `;
  const apiUrl = new URL("https://api.ipgeolocation.io/ipgeo");
  apiUrl.searchParams.set("apiKey", stored.ipgeolocationApiKey);
  apiUrl.searchParams.set("lang", "cn");
  if (row?.last_login_ip && row.last_login_ip !== "127.0.0.1" && row.last_login_ip !== "::1") {
    apiUrl.searchParams.set("ip", row.last_login_ip);
  }
  const response = await fetch(apiUrl);
  if (!response.ok) throw validationError("IPGeolocation API Key 测试失败");

  const apiLocation = (await response.json()) as Record<string, unknown>;

  return {
    ok: true,
    message: "IPGeolocation API Key 配置成功",
    login: {
      device: describeDevice(row?.last_login_device),
      ip: row?.last_login_ip ?? "本地或未知 IP",
      location: describeLocation(row?.last_login_location ?? apiLocation),
    },
  };
}
