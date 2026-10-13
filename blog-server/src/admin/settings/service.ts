import { createHash, randomInt } from "node:crypto";

import type { Sql, TransactionSql } from "postgres";

import { getSql } from "../../shared/db/postgres";
import { env } from "../../shared/env";
import type { AuthProvider } from "../../shared/auth-providers";
import {
  getAuthProviderDefaults,
  normalizeAuthProviderScopes,
  readAuthProvider,
  SUPPORTED_AUTH_PROVIDERS,
} from "../../shared/auth-providers";
import type { UserLoginInfo } from "../../shared/login-metadata";
import { readUserLoginInfo } from "../../shared/login-metadata";
import type {
  UserProfileContent,
  UserProfileLocalizations,
  UserProfileLocale,
  UserProfileTranslationStatus,
  UserProfileTranslationSummary,
} from "../../shared/profile-tags";
import {
  normalizeProfileTagLocale,
  prepareUserProfileLocalizations,
  readUserProfileLocalizations,
  translateTexts,
  upsertUsersEnProfile,
  USER_PROFILE_LOCALES,
  USER_PROFILE_TRANSLATION_STATUS,
} from "../../shared/profile-tags";
import { isPrivateIp } from "../../shared/request-meta";
import { decryptSecret, encryptSecret } from "../../shared/security/encryption";
import {
  DEFAULT_SITE_TIME_ZONE,
  formatMinuteTimestampInTimeZone,
  normalizeTimeZone,
  parseMinuteTimestampInTimeZone,
} from "../../shared/time-zone";
import type { AdminProfile, UserRecord } from "../auth/types";
import { USER_ROLE } from "../auth/types";
import { toLocalizedAdminProfile } from "../auth/service";
import { consumeSecretRevealEmailCode } from "./email-code";

export const ENCRYPTED_SETTING_KEYS = [
  "resend_api_key",
  "deepl_api_key",
  "ip_geolocation_api_key",
  "r2_secret_access_key",
] as const;

export const ADMIN_SETTINGS_FAILURE = {
  NotFound: "not-found",
  InvalidIdentity: "invalid-identity",
  UsernameExists: "username-exists",
  EmailExists: "email-exists",
  InvalidCurrentPassword: "invalid-current-password",
  PasswordTooShort: "password-too-short",
  UpdateFailed: "update-failed",
} as const;

export const SITE_SETTINGS_FAILURE = {
  InvalidFoundedAt: "invalid-founded-at",
  R2Incomplete: "r2-incomplete",
  UpdateFailed: "update-failed",
} as const;

export const AUTH_PROVIDER_SETTINGS_FAILURE = {
  MissingRequiredFields: "missing-required-fields",
  NotFound: "not-found",
  UpdateFailed: "update-failed",
  UnsupportedProvider: "unsupported-provider",
} as const;

export const INTEGRATION_TEST_FAILURE = {
  AdminNotFound: "admin-not-found",
  AdminEmailMissing: "admin-email-missing",
  MissingResendDomain: "missing-resend-domain",
  MissingResendApiKey: "missing-resend-api-key",
  ResendFailed: "resend-failed",
  MissingDeepLApiKey: "missing-deepl-api-key",
  DeepLFailed: "deepl-failed",
  MissingIpGeolocationApiKey: "missing-ip-geolocation-api-key",
  IpGeolocationFailed: "ip-geolocation-failed",
} as const;

const API_KEY_REVEAL_EMAIL_CODE_MINUTES = 10;
const API_KEY_REVEAL_EMAIL_CODE_PURPOSE = "admin_api_key_reveal";
const AUTH_PROVIDER_SECRET_REVEAL_EMAIL_CODE_PURPOSE = "admin_auth_provider_secret_reveal";

export type EncryptedSettingKey = (typeof ENCRYPTED_SETTING_KEYS)[number];
type EmailTemplateLocale = "en" | "zh-CN";

export type AdminSocialLink = {
  label: string;
  url: string;
};

export type FilingRecord = {
  number: string;
  url: string;
};

export const SITE_SETTINGS_TRANSLATION_FIELDS = [
  "siteName",
  "siteDescription",
  "homepageCopy",
  "seoTitle",
  "seoDescription",
] as const;
export type SiteSettingsTranslationField = (typeof SITE_SETTINGS_TRANSLATION_FIELDS)[number];

export type SiteSettingsContentLocalization = {
  siteName: string;
  siteDescription: string;
  homepageCopy: string;
  seoTitle: string;
  seoDescription: string;
};

export type SiteSettingsLocalizations = {
  zhCN: SiteSettingsContentLocalization;
  en: SiteSettingsContentLocalization;
};

export type SiteSettingsTranslationSummary = {
  status: UserProfileTranslationStatus;
  sourceLocale: UserProfileLocale;
  targetLocale: UserProfileLocale;
  targetLocales: UserProfileLocale[];
  requestedFields: SiteSettingsTranslationField[];
  completedFields: SiteSettingsTranslationField[];
  missingFields: SiteSettingsTranslationField[];
};

export type AdminSettings = {
  user: AdminProfile;
  loginInfo: UserLoginInfo;
  socialLinks: AdminSocialLink[];
  profileLocalizations: UserProfileLocalizations;
  profileTranslation?: UserProfileTranslationSummary;
};

export type PublicSiteAuthor = {
  avatarUrl: string;
  blogUrl: string;
  profileLocalizations: UserProfileLocalizations;
  socialLinks: AdminSocialLink[];
  username: string;
};

export type SiteSettings = {
  siteLocalizations: SiteSettingsLocalizations;
  siteTranslation?: SiteSettingsTranslationSummary;
  site: {
    siteName: string;
    foundedAt: string;
    siteDescription: string;
    coverUrls: string[];
    homepageCopy: string;
    lightLogoUrl: string;
    darkLogoUrl: string;
    faviconUrl: string;
    timeZone: string;
  };
  basics: {
    seoTitle: string;
    seoDescription: string;
    seoKeywords: string[];
    copyright: string;
    commentsEnabled: boolean;
    resendDomain: string;
    resendApiKeyConfigured: boolean;
    deeplApiKeyConfigured: boolean;
    ipGeolocationApiKeyConfigured: boolean;
  };
  filings: {
    icpRecords: FilingRecord[];
    policeRecordNumber: string;
    policeRecordUrl: string;
  };
  storage: {
    r2AccessKeyId: string;
    r2AccountId: string;
    r2Bucket: string;
    r2Enabled: boolean;
    r2PublicBaseUrl: string;
    r2SecretAccessKeyConfigured: boolean;
  };
};

export type AuthProviderSettingsItem = {
  provider: AuthProvider;
  displayName: string;
  enabled: boolean;
  clientId: string;
  hasClientSecret: boolean;
  redirectUri: string;
  scopes: string[];
};

export type AuthProviderClientSecretItem = {
  provider: AuthProvider;
  clientSecret: string;
};

type EncryptedSettingRow = {
  encryptedValue: string;
};

type CountRow = {
  count: string;
};

type AdminSocialLinkRow = {
  label: string;
  url: string;
};

type SiteSettingsRow = {
  siteName: string | null;
  foundedAt: Date | null;
  siteDescription: string | null;
  coverUrls: string[];
  homepageCopy: string | null;
  lightLogoUrl: string | null;
  darkLogoUrl: string | null;
  faviconUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string[];
  copyright: string | null;
  commentsEnabled: boolean;
  resendDomain: string | null;
  timeZone: string | null;
  r2Enabled: boolean;
  r2AccountId: string | null;
  r2Bucket: string | null;
  r2AccessKeyId: string | null;
  r2PublicBaseUrl: string | null;
};

type SiteSettingsEnRow = {
  siteName: string | null;
  siteDescription: string | null;
  homepageCopy: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

type AuthProviderSettingsRow = {
  provider: string;
  displayName: string;
  enabled: boolean;
  clientId: string | null;
  clientSecretEncrypted: string | null;
  redirectUri: string | null;
  scopes: string[] | null;
};

type AuthProviderSecretRow = {
  clientSecretEncrypted: string | null;
};

type FilingRecordRow = {
  type: "icp" | "police";
  recordNumber: string;
  url: string;
};

type UpsertEncryptedSettingParams = {
  key: EncryptedSettingKey;
  value: string;
};

type SiteSettingsSql = Sql | TransactionSql;

type UpdateAdminSettingsInput = {
  profileLocalizations: UserProfileLocalizations;
  username: string;
  email: string;
  avatarUrl: string;
  tagLocale: UserProfileLocale;
  socialLinks: AdminSocialLink[];
  blogUrl: string;
  commentEmailNotifications: boolean;
  newPostEmailNotifications: boolean;
  currentPassword: string;
  newPassword: string;
};

type UpdateSiteSettingsInput = {
  siteLocalizations: SiteSettingsLocalizations;
  site: {
    foundedAt: string;
    coverUrls: string[];
    lightLogoUrl: string;
    darkLogoUrl: string;
    faviconUrl: string;
    timeZone: string;
  };
  basics: {
    seoKeywords: string[];
    copyright: string;
    commentsEnabled: boolean;
    resendDomain: string;
    resendApiKey: string;
    deeplApiKey: string;
    ipGeolocationApiKey: string;
  };
  filings: {
    icpRecords: FilingRecord[];
    policeRecordNumber: string;
    policeRecordUrl: string;
  };
  storage: {
    r2AccessKeyId: string;
    r2AccountId: string;
    r2Bucket: string;
    r2Enabled: boolean;
    r2PublicBaseUrl: string;
    r2SecretAccessKey: string;
  };
};

type UpdateAuthProviderSettingsInput = {
  clientId?: string | null;
  clientSecret?: string | null;
  displayName?: string | null;
  enabled: boolean;
  redirectUri?: string | null;
  scopes?: string[];
};

type UpdateAdminSettingsResult =
  | {
      ok: true;
      settings: AdminSettings;
    }
  | {
      ok: false;
      reason: (typeof ADMIN_SETTINGS_FAILURE)[keyof typeof ADMIN_SETTINGS_FAILURE];
    };

type UpdateSiteSettingsResult =
  | {
      ok: true;
      settings: SiteSettings;
    }
  | {
      ok: false;
      reason: (typeof SITE_SETTINGS_FAILURE)[keyof typeof SITE_SETTINGS_FAILURE];
    };

type UpdateSiteSettingsWriteResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: (typeof SITE_SETTINGS_FAILURE)[keyof typeof SITE_SETTINGS_FAILURE];
    };

type AuthProviderSettingsResult =
  | {
      ok: true;
      items: AuthProviderSettingsItem[];
    }
  | {
      ok: false;
      reason: (typeof AUTH_PROVIDER_SETTINGS_FAILURE)[keyof typeof AUTH_PROVIDER_SETTINGS_FAILURE];
    };

type UpdateAuthProviderSettingsResult =
  | {
      ok: true;
      item: AuthProviderSettingsItem;
    }
  | {
      ok: false;
      reason: (typeof AUTH_PROVIDER_SETTINGS_FAILURE)[keyof typeof AUTH_PROVIDER_SETTINGS_FAILURE];
    };

type IntegrationTestResult =
  | {
      ok: true;
      message: string;
      details?: string;
    }
  | {
      ok: false;
      reason: (typeof INTEGRATION_TEST_FAILURE)[keyof typeof INTEGRATION_TEST_FAILURE];
      message: string;
      details?: string;
    };

type SiteSettingsApiKeys = {
  deeplApiKey: string;
  ipGeolocationApiKey: string;
  r2SecretAccessKey: string;
  resendApiKey: string;
};

type SiteSettingsApiKeyRevealCodeResult =
  | {
      ok: true;
      expiresAt: string;
      message: string;
      sent: boolean;
      validMinutes: number;
    }
  | {
      ok: false;
      message: string;
      status: 400 | 404 | 502;
    };

type SiteSettingsApiKeyRevealResult =
  | {
      ok: true;
      item: SiteSettingsApiKeys;
    }
  | {
      ok: false;
      message: string;
      status: 400 | 404;
    };

type AuthProviderClientSecretRevealCodeResult = SiteSettingsApiKeyRevealCodeResult;

type AuthProviderClientSecretRevealResult =
  | {
      ok: true;
      item: AuthProviderClientSecretItem;
    }
  | {
      ok: false;
      message: string;
      status: 400 | 404;
    };

type CreateSiteSettingsApiKeyRevealCodeParameters = {
  locale?: string | null;
  userId: string;
};

type RevealSiteSettingsApiKeysParameters = {
  emailCode: string;
  locale?: string | null;
  userId: string;
};

type CreateAuthProviderClientSecretRevealCodeParameters = {
  locale?: string | null;
  provider: string;
  userId: string;
};

type RevealAuthProviderClientSecretParameters = {
  emailCode: string;
  locale?: string | null;
  provider: string;
  userId: string;
};

type TestResendApiKeyParameters = {
  locale?: string | null;
  resendApiKey?: string;
  resendDomain?: string;
  userId: string;
};

type TestDeepLApiKeyParameters = {
  apiKey?: string;
  locale?: string | null;
  text?: string;
};

type TestIpGeolocationApiKeyParameters = {
  apiKey?: string;
  locale?: string | null;
  userId: string;
};

type ResolvedEmailBranding = {
  locale: EmailTemplateLocale;
  logoUrl?: string;
  siteInitial: string;
  siteName: string;
};

type ResendTestCopy = {
  badge: string;
  description: string;
  message: string;
  subject: string;
};

const trimText = (value: string) => value.trim();

const optionalText = (value: string) => {
  const trimmedValue = trimText(value);
  return trimmedValue.length > 0 ? trimmedValue : null;
};

const optionalInputText = (value?: string) => {
  const trimmedValue = value?.trim();
  return trimmedValue === undefined || trimmedValue.length === 0 ? undefined : trimmedValue;
};

const createNumericCode = (length = 6) => {
  const max = 10 ** length;
  return randomInt(0, max).toString().padStart(length, "0");
};

const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60 * 1000);

const textValue = (value: string | null) => value ?? "";

const normalizeTextArray = (values: string[]) =>
  values.map((value) => value.trim()).filter((value) => value.length > 0);

const normalizeAuthProviderOptionalText = (value?: string | null) => {
  const trimmedValue = value?.trim();
  return trimmedValue === undefined || trimmedValue.length === 0 ? null : trimmedValue;
};

const toAuthProviderSettingsItem = (
  provider: AuthProvider,
  row?: AuthProviderSettingsRow,
): AuthProviderSettingsItem => {
  const defaults = getAuthProviderDefaults(provider);

  return {
    provider,
    displayName: row?.displayName ?? defaults.displayName,
    enabled: row?.enabled ?? false,
    clientId: row?.clientId ?? "",
    hasClientSecret:
      row?.clientSecretEncrypted !== null && row?.clientSecretEncrypted !== undefined,
    redirectUri:
      row?.redirectUri ?? `${getServerOrigin()}/api/blog/auth/oauth/${provider}/callback`,
    scopes: normalizeAuthProviderScopes(provider, row?.scopes ?? undefined),
  };
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const getServerOrigin = () => {
  return env.publicSiteUrl;
};

const toAbsoluteAssetUrl = (value: string) => {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return undefined;
  }

  try {
    return new URL(trimmedValue).toString();
  } catch {
    return new URL(trimmedValue, `${getServerOrigin()}/`).toString();
  }
};

const normalizeEmailTemplateLocale = (locale?: string | null): EmailTemplateLocale => {
  if (locale?.toLowerCase().startsWith("en") === true) {
    return "en";
  }

  return "zh-CN";
};

const getEmailBrandInitial = (siteName: string) => siteName.trim().slice(0, 1).toUpperCase() || "L";

const normalizeSiteSettingsContent = (
  content: SiteSettingsContentLocalization,
): SiteSettingsContentLocalization => ({
  siteName: trimText(content.siteName),
  siteDescription: trimText(content.siteDescription),
  homepageCopy: trimText(content.homepageCopy),
  seoTitle: trimText(content.seoTitle),
  seoDescription: trimText(content.seoDescription),
});

const createEmptySiteSettingsContent = (): SiteSettingsContentLocalization => ({
  siteName: "",
  siteDescription: "",
  homepageCopy: "",
  seoTitle: "",
  seoDescription: "",
});

const normalizeSocialLinks = (links: AdminSocialLink[]) =>
  links
    .map((link) => ({
      label: trimText(link.label),
      url: trimText(link.url),
    }))
    .filter((link) => link.label.length > 0 || link.url.length > 0);

const toUserProfileContent = (row: UserRecord): UserProfileContent => ({
  name: row.name ?? "",
  bio: row.bio ?? "",
  tags: row.tags,
});

const normalizeFilingRecords = (records: FilingRecord[]) =>
  records
    .map((record) => ({
      number: trimText(record.number),
      url: trimText(record.url),
    }))
    .filter((record) => record.number.length > 0 || record.url.length > 0);

type SiteSettingsTranslationDirectionResult = {
  completedFields: SiteSettingsTranslationField[];
  requestedFields: SiteSettingsTranslationField[];
  sourceLocale: UserProfileLocale;
  target: SiteSettingsContentLocalization;
  targetLocale: UserProfileLocale;
};

type TranslateMissingSiteSettingsFieldsParameters = {
  apiKey?: string;
  source: SiteSettingsContentLocalization;
  sourceLocale: UserProfileLocale;
  target: SiteSettingsContentLocalization;
  targetLocale: UserProfileLocale;
};

const translateMissingSiteSettingsFields = async ({
  apiKey,
  source,
  sourceLocale,
  target,
  targetLocale,
}: TranslateMissingSiteSettingsFieldsParameters): Promise<SiteSettingsTranslationDirectionResult> => {
  const requestedFields = SITE_SETTINGS_TRANSLATION_FIELDS.filter(
    (field) => source[field].length > 0 && target[field].length === 0,
  );
  const translations =
    apiKey === undefined || apiKey.length === 0
      ? []
      : await translateTexts({
          apiKey,
          sourceLocale,
          targetLocale,
          texts: requestedFields.map((field) => source[field]),
        });
  const nextTarget: SiteSettingsContentLocalization = { ...target };

  for (const [index, field] of requestedFields.entries()) {
    const translatedText = translations[index]?.trim();
    if (translatedText === undefined || translatedText.length === 0) {
      continue;
    }

    nextTarget[field] = translatedText;
  }

  const completedFields = requestedFields.filter((field) => nextTarget[field].length > 0);

  return {
    completedFields,
    requestedFields,
    sourceLocale,
    target: nextTarget,
    targetLocale,
  };
};

const uniqueSiteSettingsTranslationFields = (fields: SiteSettingsTranslationField[]) =>
  SITE_SETTINGS_TRANSLATION_FIELDS.filter((field) => fields.includes(field));

const uniqueSiteSettingsLocales = (locales: UserProfileLocale[]) =>
  USER_PROFILE_LOCALES.filter((locale) => locales.includes(locale));

type CreateSiteSettingsTranslationSummaryParameters = {
  apiKeyConfigured: boolean;
  directions: SiteSettingsTranslationDirectionResult[];
};

const createSiteSettingsTranslationSummary = ({
  apiKeyConfigured,
  directions,
}: CreateSiteSettingsTranslationSummaryParameters): SiteSettingsTranslationSummary => {
  const requestedFields = uniqueSiteSettingsTranslationFields(
    directions.flatMap((direction) => direction.requestedFields),
  );
  const completedFields = uniqueSiteSettingsTranslationFields(
    directions.flatMap((direction) => direction.completedFields),
  );
  const missingFields = requestedFields.filter((field) => !completedFields.includes(field));
  const requestedDirections = directions.filter(
    (direction) => direction.requestedFields.length > 0,
  );
  const firstRequestedDirection = requestedDirections[0];
  const sourceLocale = firstRequestedDirection?.sourceLocale ?? "zh-CN";
  const targetLocale =
    firstRequestedDirection?.targetLocale ?? (sourceLocale === "zh-CN" ? "en" : "zh-CN");
  const targetLocales = uniqueSiteSettingsLocales(
    requestedDirections.map((direction) => direction.targetLocale),
  );
  const status =
    requestedFields.length === 0
      ? USER_PROFILE_TRANSLATION_STATUS.NotNeeded
      : missingFields.length === 0
        ? USER_PROFILE_TRANSLATION_STATUS.Completed
        : apiKeyConfigured
          ? USER_PROFILE_TRANSLATION_STATUS.Incomplete
          : USER_PROFILE_TRANSLATION_STATUS.MissingApiKey;

  return {
    status,
    sourceLocale,
    targetLocale,
    targetLocales,
    requestedFields,
    completedFields,
    missingFields,
  };
};

type PrepareSiteSettingsLocalizationsParameters = {
  deeplApiKey?: string;
  localizations: SiteSettingsLocalizations;
};

const prepareSiteSettingsLocalizations = async ({
  deeplApiKey,
  localizations,
}: PrepareSiteSettingsLocalizationsParameters) => {
  const apiKey = deeplApiKey?.trim();
  const apiKeyConfigured = apiKey !== undefined && apiKey.length > 0;
  const zhCN = normalizeSiteSettingsContent(localizations.zhCN);
  const en = normalizeSiteSettingsContent(localizations.en);
  const enDirection = await translateMissingSiteSettingsFields({
    apiKey,
    source: zhCN,
    sourceLocale: "zh-CN",
    target: en,
    targetLocale: "en",
  });
  const zhDirection = await translateMissingSiteSettingsFields({
    apiKey,
    source: enDirection.target,
    sourceLocale: "en",
    target: zhCN,
    targetLocale: "zh-CN",
  });
  const nextLocalizations: SiteSettingsLocalizations = {
    zhCN: zhDirection.target,
    en: enDirection.target,
  };

  return {
    localizations: nextLocalizations,
    translation: createSiteSettingsTranslationSummary({
      apiKeyConfigured,
      directions: [enDirection, zhDirection],
    }),
  };
};

type ReadAdminUserParameters = {
  sql: Sql;
  userId: string;
};

type ReadPrimaryAdminUserParameters = {
  sql: Sql;
};

const readAdminUser = async ({ sql, userId }: ReadAdminUserParameters) => {
  const users = await sql<UserRecord[]>`
    SELECT
      id,
      role,
      name,
      username,
      password_hash,
      email,
      avatar_url,
      bio,
      tags,
      blog_url,
      comment_email_notifications,
      new_post_email_notifications
    FROM users
    WHERE id = ${userId}
      AND role = ${USER_ROLE.Admin}
    LIMIT 1
  `;

  return users[0];
};

const readPrimaryAdminUser = async ({ sql }: ReadPrimaryAdminUserParameters) => {
  const users = await sql<UserRecord[]>`
    SELECT
      id,
      role,
      name,
      username,
      password_hash,
      email,
      avatar_url,
      bio,
      tags,
      blog_url,
      comment_email_notifications,
      new_post_email_notifications
    FROM users
    WHERE role = ${USER_ROLE.Admin}
    ORDER BY created_at ASC
    LIMIT 1
  `;

  return users[0];
};

const readAdminSocialLinks = async (userId: string) => {
  const sql = getSql();
  const links = await sql<AdminSocialLinkRow[]>`
    SELECT label, url
    FROM user_social_links
    WHERE user_id = ${userId}
    ORDER BY sort_order ASC, created_at ASC
  `;

  return links;
};

const readSiteSettingsRow = async () => {
  const sql = getSql();
  const rows = await sql<SiteSettingsRow[]>`
    SELECT
      site_name,
      founded_at,
      site_description,
      cover_urls,
      homepage_copy,
      light_logo_url,
      dark_logo_url,
      favicon_url,
      seo_title,
      seo_description,
      seo_keywords,
      copyright,
      comments_enabled,
      resend_domain,
      time_zone,
      r2_enabled,
      r2_account_id,
      r2_bucket,
      r2_access_key_id,
      r2_public_base_url
    FROM site_settings
    WHERE id = 1
    LIMIT 1
  `;

  return rows[0];
};

type ReadSiteSettingsEnContentParameters = {
  sql: SiteSettingsSql;
};

const readSiteSettingsEnContent = async ({
  sql,
}: ReadSiteSettingsEnContentParameters): Promise<SiteSettingsContentLocalization> => {
  const rows = await sql<SiteSettingsEnRow[]>`
    SELECT
      site_name,
      site_description,
      homepage_copy,
      seo_title,
      seo_description
    FROM site_settings_en
    WHERE id = 1
    LIMIT 1
  `;
  const row = rows[0];
  if (row === undefined) {
    return createEmptySiteSettingsContent();
  }

  return {
    siteName: textValue(row.siteName),
    siteDescription: textValue(row.siteDescription),
    homepageCopy: textValue(row.homepageCopy),
    seoTitle: textValue(row.seoTitle),
    seoDescription: textValue(row.seoDescription),
  };
};

type UpsertSiteSettingsEnContentParameters = {
  content: SiteSettingsContentLocalization;
  sql: SiteSettingsSql;
};

const upsertSiteSettingsEnContent = async ({
  content,
  sql,
}: UpsertSiteSettingsEnContentParameters) => {
  await sql`
    INSERT INTO site_settings_en (
      id,
      site_name,
      site_description,
      homepage_copy,
      seo_title,
      seo_description
    )
    VALUES (
      1,
      ${optionalText(content.siteName)},
      ${optionalText(content.siteDescription)},
      ${optionalText(content.homepageCopy)},
      ${optionalText(content.seoTitle)},
      ${optionalText(content.seoDescription)}
    )
    ON CONFLICT (id)
    DO UPDATE SET
      site_name = EXCLUDED.site_name,
      site_description = EXCLUDED.site_description,
      homepage_copy = EXCLUDED.homepage_copy,
      seo_title = EXCLUDED.seo_title,
      seo_description = EXCLUDED.seo_description
  `;
};

const readFilingRecords = async () => {
  const sql = getSql();
  const rows = await sql<FilingRecordRow[]>`
    SELECT type, record_number, url
    FROM filing_records
    ORDER BY type ASC, sort_order ASC, created_at ASC
  `;

  return rows;
};

const isEncryptedSettingConfigured = async (key: EncryptedSettingKey) => {
  const sql = getSql();
  const rows = await sql<CountRow[]>`
    SELECT count(*)::text AS count
    FROM encrypted_settings
    WHERE key = ${key}
  `;

  return Number(rows[0]?.count ?? 0) > 0;
};

const readEncryptedSettingStatuses = async () => {
  const [
    resendApiKeyConfigured,
    deeplApiKeyConfigured,
    ipGeolocationApiKeyConfigured,
    r2SecretAccessKeyConfigured,
  ] = await Promise.all([
    isEncryptedSettingConfigured("resend_api_key"),
    isEncryptedSettingConfigured("deepl_api_key"),
    isEncryptedSettingConfigured("ip_geolocation_api_key"),
    isEncryptedSettingConfigured("r2_secret_access_key"),
  ]);

  return {
    resendApiKeyConfigured,
    deeplApiKeyConfigured,
    ipGeolocationApiKeyConfigured,
    r2SecretAccessKeyConfigured,
  };
};

const createDefaultSiteSettings = (): SiteSettings => ({
  siteLocalizations: {
    zhCN: createEmptySiteSettingsContent(),
    en: createEmptySiteSettingsContent(),
  },
  site: {
    siteName: "",
    foundedAt: "",
    siteDescription: "",
    coverUrls: [],
    homepageCopy: "",
    lightLogoUrl: "",
    darkLogoUrl: "",
    faviconUrl: "",
    timeZone: DEFAULT_SITE_TIME_ZONE,
  },
  basics: {
    seoTitle: "",
    seoDescription: "",
    seoKeywords: [],
    copyright: "",
    commentsEnabled: true,
    resendDomain: "",
    resendApiKeyConfigured: false,
    deeplApiKeyConfigured: false,
    ipGeolocationApiKeyConfigured: false,
  },
  filings: {
    icpRecords: [],
    policeRecordNumber: "",
    policeRecordUrl: "",
  },
  storage: {
    r2AccessKeyId: "",
    r2AccountId: "",
    r2Bucket: "",
    r2Enabled: false,
    r2PublicBaseUrl: "",
    r2SecretAccessKeyConfigured: false,
  },
});

type ResolveEmailBrandingParameters = {
  locale?: string | null;
  settings: SiteSettings;
};

const resolveEmailBranding = ({
  locale,
  settings,
}: ResolveEmailBrandingParameters): ResolvedEmailBranding => {
  const templateLocale = normalizeEmailTemplateLocale(locale);
  const primarySiteName =
    templateLocale === "en"
      ? settings.siteLocalizations.en.siteName.trim()
      : settings.siteLocalizations.zhCN.siteName.trim();
  const fallbackSiteName =
    templateLocale === "en"
      ? settings.siteLocalizations.zhCN.siteName.trim()
      : settings.siteLocalizations.en.siteName.trim();
  const siteName =
    primarySiteName || fallbackSiteName || settings.site.siteName.trim() || "LeiBlog";
  const logoUrl = toAbsoluteAssetUrl(
    settings.site.lightLogoUrl.trim() || settings.site.darkLogoUrl.trim(),
  );

  return {
    ...(logoUrl === undefined ? {} : { logoUrl }),
    locale: templateLocale,
    siteInitial: getEmailBrandInitial(siteName),
    siteName,
  };
};

const EMAIL_FRAME_COPY = {
  "zh-CN": {
    eyebrow: "Security Mail",
    footer: (siteName: string) =>
      `这封邮件由 ${siteName} 自动发送。如果不是你本人操作，可以忽略此邮件。`,
    htmlLang: "zh-CN",
  },
  en: {
    eyebrow: "Security Mail",
    footer: (siteName: string) =>
      `This email was sent automatically by ${siteName}. If you did not request this action, you can ignore it.`,
    htmlLang: "en",
  },
} as const;

const renderLeiBlogEmailHtml = ({
  bodyHtml,
  branding,
  preheader,
  title,
}: {
  bodyHtml: string;
  branding: ResolvedEmailBranding;
  preheader: string;
  title: string;
}) => {
  const copy = EMAIL_FRAME_COPY[branding.locale];
  const brandMark =
    branding.logoUrl !== undefined
      ? `<img alt="${escapeHtml(branding.siteName)} logo" src="${escapeHtml(branding.logoUrl)}" style="display:block;width:100%;height:100%;object-fit:contain;" />`
      : escapeHtml(branding.siteInitial);

  return `<!doctype html>
<html lang="${copy.htmlLang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f6f7fb;color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#f6f7fb;padding:18px 10px;border-collapse:separate;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:520px;background:#ffffff;border:1px solid #e4e4e7;border-radius:20px;overflow:hidden;box-shadow:0 18px 46px rgba(15,23,42,0.10);border-collapse:separate;">
            <tr>
              <td style="padding:22px 22px 16px;background:linear-gradient(135deg,#fff 0%,#fdf2f8 46%,#eff6ff 100%);border-bottom:1px solid #ececf0;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border-collapse:separate;">
                  <tr>
                    <td style="width:34px;height:34px;padding:0;">
                      <div style="width:34px;height:34px;overflow:hidden;border:1px solid #111827;border-radius:10px;background:#fff;color:#111827;font-size:16px;font-weight:800;line-height:34px;text-align:center;">${brandMark}</div>
                    </td>
                    <td style="padding-left:9px;color:#111827;font-size:16px;font-weight:800;line-height:1.2;">${escapeHtml(branding.siteName)}</td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;color:#ec4899;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;line-height:1.4;">${escapeHtml(copy.eyebrow)}</p>
                <h1 style="margin:0;color:#09090b;font-size:24px;line-height:1.22;font-weight:900;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 22px 24px;">
                ${bodyHtml}
                <div style="margin-top:22px;padding-top:16px;border-top:1px solid #ececf0;">
                  <p style="margin:0;color:#71717a;font-size:12px;line-height:1.7;">${escapeHtml(copy.footer(branding.siteName))}</p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

type RenderNoticeEmailHtmlParameters = {
  badge: string;
  branding: ResolvedEmailBranding;
  description: string;
  title: string;
};

const renderNoticeEmailHtml = ({
  badge,
  branding,
  description,
  title,
}: RenderNoticeEmailHtmlParameters) =>
  renderLeiBlogEmailHtml({
    bodyHtml: `
      <p style="margin:0 0 18px;color:#52525b;font-size:15px;line-height:1.7;">${escapeHtml(description)}</p>
      <div style="margin:20px 0 0;padding:16px 18px;border:1px solid #bbf7d0;border-radius:18px;background:#f0fdf4;color:#166534;font-size:14px;font-weight:800;">${escapeHtml(badge)}</div>
    `,
    branding,
    preheader: description,
    title,
  });

type ApiKeyRevealCodeCopy = {
  description: string;
  message: string;
  operationNote: string;
  subject: string;
};

const getApiKeyRevealCodeCopy = (branding: ResolvedEmailBranding): ApiKeyRevealCodeCopy => {
  if (branding.locale === "en") {
    return {
      description: `You are viewing saved API keys in ${branding.siteName}. Use the code below to verify the administrator email before the keys are shown.`,
      message: "Verification code sent to the administrator email.",
      operationNote:
        "This code is only for viewing saved API keys on the site settings page. Do not share it.",
      subject: `${branding.siteName} API key viewing code`,
    };
  }

  return {
    description: `你正在查看 ${branding.siteName} 站点设置里已保存的 API key。请使用下面的验证码完成管理员邮箱校验后再显示密钥。`,
    message: "验证码已发送到管理员邮箱。",
    operationNote: "这是查看站点设置 API key 的验证码，请不要转发或泄露给他人。",
    subject: `${branding.siteName} API key 查看验证码`,
  };
};

const getAuthProviderSecretRevealCodeCopy = (
  branding: ResolvedEmailBranding,
  provider: AuthProvider,
): ApiKeyRevealCodeCopy => {
  const providerName = getAuthProviderDefaults(provider).displayName;

  if (branding.locale === "en") {
    return {
      description: `You are viewing the saved ${providerName} login Client Secret in ${branding.siteName}. Use the code below to verify the administrator email before the secret is shown.`,
      message: "Verification code sent to the administrator email.",
      operationNote: `This code is only for viewing the ${providerName} login Client Secret. Do not share it.`,
      subject: `${branding.siteName} ${providerName} login Client Secret viewing code`,
    };
  }

  return {
    description: `你正在查看 ${branding.siteName} 的 ${providerName} 登录 Client Secret。请使用下面的验证码完成管理员邮箱校验后再显示密钥。`,
    message: "验证码已发送到管理员邮箱。",
    operationNote: `这是查看 ${providerName} 登录 Client Secret 的验证码，请不要转发或泄露给他人。`,
    subject: `${branding.siteName} ${providerName} 登录 Client Secret 查看验证码`,
  };
};

const getApiKeyRevealValidityText = (branding: ResolvedEmailBranding, validMinutes: number) =>
  branding.locale === "en"
    ? `This code is valid for ${validMinutes} minutes.`
    : `验证码 ${validMinutes} 分钟内有效。`;

type RenderApiKeyRevealCodeEmailHtmlParameters = {
  branding: ResolvedEmailBranding;
  code: string;
  copy: ApiKeyRevealCodeCopy;
  validMinutes: number;
};

const renderApiKeyRevealCodeEmailHtml = ({
  branding,
  code,
  copy,
  validMinutes,
}: RenderApiKeyRevealCodeEmailHtmlParameters) => {
  const codeDigits = code
    .split("")
    .map(
      (digit) =>
        `<td style="padding:0 3px 0 0;"><div style="display:block;padding:9px 0;border:1px solid #d4d4d8;border-radius:10px;background:#f4f4f5;color:#09090b;font-size:21px;font-weight:900;text-align:center;line-height:1.1;">${escapeHtml(digit)}</div></td>`,
    )
    .join("");

  return renderLeiBlogEmailHtml({
    bodyHtml: `
      <p style="margin:0 0 16px;color:#52525b;font-size:14px;line-height:1.65;">${escapeHtml(copy.description)}</p>
      <div style="margin:18px 0 16px;padding:14px;border:1px solid #f0abfc;border-radius:16px;background:#fdf4ff;">
        <p style="margin:0 0 10px;color:#86198f;font-size:13px;font-weight:800;line-height:1.4;">${escapeHtml(branding.locale === "en" ? "Verification code" : "验证码")}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:330px;table-layout:fixed;border-collapse:separate;">
          <tr>${codeDigits}</tr>
        </table>
      </div>
      <p style="margin:0 0 12px;padding:10px 12px;border-radius:12px;background:#fff7ed;color:#9a3412;font-size:13px;font-weight:700;line-height:1.65;">${escapeHtml(copy.operationNote)}</p>
      <p style="margin:0;color:#71717a;font-size:13px;line-height:1.65;">${escapeHtml(getApiKeyRevealValidityText(branding, validMinutes))}</p>
    `,
    branding,
    preheader: `${copy.description} ${getApiKeyRevealValidityText(branding, validMinutes)}`,
    title: copy.subject,
  });
};

type SendResendEmailParameters = {
  apiKey: string;
  branding: ResolvedEmailBranding;
  domain: string;
  html: string;
  subject: string;
  text: string;
  to: string;
};

const sendResendEmail = async ({
  apiKey,
  branding,
  domain,
  html,
  subject,
  text,
  to,
}: SendResendEmailParameters) => {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      signal: AbortSignal.timeout(10_000),
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${branding.siteName} <no-reply@${domain}>`,
        html,
        subject,
        text,
        to: [to],
      }),
    });

    if (!response.ok) {
      return {
        ok: false as const,
        details: await getResponseErrorDetails(response),
      };
    }

    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      details: error instanceof Error ? error.message : undefined,
    };
  }
};

const getResendTestCopy = (branding: ResolvedEmailBranding): ResendTestCopy => {
  if (branding.locale === "en") {
    return {
      badge: "Configuration test complete",
      description:
        "The Resend API key test has completed successfully. LeiBlog used the current backend configuration to send this test email to the administrator account.",
      message: "Resend API key works. A test email has been sent to the administrator email.",
      subject: `${branding.siteName} Resend API key configured`,
    };
  }

  return {
    badge: "配置检测已完成",
    description:
      "Resend API key 配置检测已完成。系统已经使用当前后台配置向管理员邮箱发送了这封测试邮件。",
    message: "Resend API key 配置成功，已向管理员邮箱发送测试邮件。",
    subject: `${branding.siteName} Resend API key 配置成功`,
  };
};

const toSiteSettings = ({
  row,
  siteLocalizations,
  filingRows,
  secretStatuses,
}: {
  row: SiteSettingsRow;
  siteLocalizations: SiteSettingsLocalizations;
  filingRows: FilingRecordRow[];
  secretStatuses: Awaited<ReturnType<typeof readEncryptedSettingStatuses>>;
}): SiteSettings => {
  const icpRecords = filingRows
    .filter((record) => record.type === "icp")
    .map((record) => ({
      number: record.recordNumber,
      url: record.url,
    }));
  const policeRecord = filingRows.find((record) => record.type === "police");
  const timeZone = normalizeTimeZone(row.timeZone);

  return {
    siteLocalizations,
    site: {
      siteName: textValue(row.siteName),
      foundedAt: formatMinuteTimestampInTimeZone({
        timeZone,
        value: row.foundedAt,
      }),
      siteDescription: textValue(row.siteDescription),
      coverUrls: row.coverUrls,
      homepageCopy: textValue(row.homepageCopy),
      lightLogoUrl: textValue(row.lightLogoUrl),
      darkLogoUrl: textValue(row.darkLogoUrl),
      faviconUrl: textValue(row.faviconUrl),
      timeZone,
    },
    basics: {
      seoTitle: textValue(row.seoTitle),
      seoDescription: textValue(row.seoDescription),
      seoKeywords: row.seoKeywords,
      copyright: textValue(row.copyright),
      commentsEnabled: row.commentsEnabled,
      resendDomain: textValue(row.resendDomain),
      resendApiKeyConfigured: secretStatuses.resendApiKeyConfigured,
      deeplApiKeyConfigured: secretStatuses.deeplApiKeyConfigured,
      ipGeolocationApiKeyConfigured: secretStatuses.ipGeolocationApiKeyConfigured,
    },
    filings: {
      icpRecords,
      policeRecordNumber: policeRecord?.recordNumber ?? "",
      policeRecordUrl: policeRecord?.url ?? "",
    },
    storage: {
      r2AccessKeyId: textValue(row.r2AccessKeyId),
      r2AccountId: textValue(row.r2AccountId),
      r2Bucket: textValue(row.r2Bucket),
      r2Enabled: row.r2Enabled,
      r2PublicBaseUrl: textValue(row.r2PublicBaseUrl),
      r2SecretAccessKeyConfigured: secretStatuses.r2SecretAccessKeyConfigured,
    },
  };
};

export const upsertEncryptedSetting = async ({ key, value }: UpsertEncryptedSettingParams) => {
  const sql = getSql();
  const encryptedValue = encryptSecret({
    value,
    secret: env.configEncryptionSecret,
  });

  await sql`
    INSERT INTO encrypted_settings (key, encrypted_value)
    VALUES (${key}, ${encryptedValue})
    ON CONFLICT (key)
    DO UPDATE SET encrypted_value = EXCLUDED.encrypted_value
  `;
};

export const readEncryptedSetting = async (key: EncryptedSettingKey) => {
  const sql = getSql();
  const rows = await sql<EncryptedSettingRow[]>`
    SELECT encrypted_value
    FROM encrypted_settings
    WHERE key = ${key}
    LIMIT 1
  `;

  const row = rows[0];
  if (row === undefined) {
    return undefined;
  }

  return decryptSecret({
    value: row.encryptedValue,
    secret: env.configEncryptionSecret,
  });
};

type GetAdminSettingsParameters = {
  locale?: string | null;
  userId: string;
};

export const getAdminSettings = async ({ locale, userId }: GetAdminSettingsParameters) => {
  const sql = getSql();
  const userRow = await readAdminUser({ sql, userId });
  if (userRow === undefined) {
    return undefined;
  }

  const user = await toLocalizedAdminProfile({
    locale,
    row: userRow,
    sql,
  });
  if (user === undefined) {
    return undefined;
  }

  const [socialLinks, profileLocalizations, loginInfo] = await Promise.all([
    readAdminSocialLinks(userId),
    readUserProfileLocalizations({
      base: toUserProfileContent(userRow),
      sql,
      userId,
    }),
    readUserLoginInfo({ sql, userId }),
  ]);

  return {
    loginInfo,
    profileLocalizations,
    user,
    socialLinks,
  };
};

export const getPublicSiteAuthor = async (): Promise<PublicSiteAuthor | undefined> => {
  const sql = getSql();
  const userRow = await readPrimaryAdminUser({ sql });

  if (userRow === undefined) {
    return undefined;
  }

  const [profileLocalizations, socialLinks] = await Promise.all([
    readUserProfileLocalizations({
      base: toUserProfileContent(userRow),
      sql,
      userId: userRow.id,
    }),
    readAdminSocialLinks(userRow.id),
  ]);

  return {
    avatarUrl: userRow.avatarUrl ?? "",
    blogUrl: userRow.blogUrl ?? "",
    profileLocalizations,
    socialLinks,
    username: userRow.username,
  };
};

export const getSiteSettings = async () => {
  const row = await readSiteSettingsRow();

  if (row === undefined) {
    return createDefaultSiteSettings();
  }

  const sql = getSql();
  const [englishContent, filingRows, secretStatuses] = await Promise.all([
    readSiteSettingsEnContent({ sql }),
    readFilingRecords(),
    readEncryptedSettingStatuses(),
  ]);
  const zhCN = normalizeSiteSettingsContent({
    siteName: textValue(row.siteName),
    siteDescription: textValue(row.siteDescription),
    homepageCopy: textValue(row.homepageCopy),
    seoTitle: textValue(row.seoTitle),
    seoDescription: textValue(row.seoDescription),
  });

  return toSiteSettings({
    row,
    siteLocalizations: {
      zhCN,
      en: englishContent,
    },
    filingRows,
    secretStatuses,
  });
};

export const listAuthProviderSettings = async (): Promise<AuthProviderSettingsResult> => {
  const sql = getSql();
  const rows = await sql<AuthProviderSettingsRow[]>`
    SELECT
      provider,
      display_name,
      enabled,
      client_id,
      client_secret_encrypted,
      redirect_uri,
      scopes
    FROM auth_provider_settings
  `;
  const rowMap = new Map(
    rows
      .map((row) => {
        const provider = readAuthProvider(row.provider);
        return provider === undefined ? undefined : ([provider, row] as const);
      })
      .filter(
        (entry): entry is readonly [AuthProvider, AuthProviderSettingsRow] => entry !== undefined,
      ),
  );

  return {
    ok: true,
    items: SUPPORTED_AUTH_PROVIDERS.map((provider) =>
      toAuthProviderSettingsItem(provider, rowMap.get(provider)),
    ),
  };
};

export const updateAuthProviderSettings = async ({
  input,
  provider: providerValue,
}: {
  input: UpdateAuthProviderSettingsInput;
  provider: string;
}): Promise<UpdateAuthProviderSettingsResult> => {
  const provider = readAuthProvider(providerValue);
  if (provider === undefined) {
    return {
      ok: false,
      reason: AUTH_PROVIDER_SETTINGS_FAILURE.UnsupportedProvider,
    };
  }

  const sql = getSql();
  const [existing] = await sql<AuthProviderSettingsRow[]>`
    SELECT
      provider,
      display_name,
      enabled,
      client_id,
      client_secret_encrypted,
      redirect_uri,
      scopes
    FROM auth_provider_settings
    WHERE provider = ${provider}
    LIMIT 1
  `;
  const shouldUpdateClientId = input.clientId !== undefined;
  const shouldUpdateClientSecret = input.clientSecret !== undefined;
  const shouldUpdateRedirectUri = input.redirectUri !== undefined;
  const nextClientId = shouldUpdateClientId
    ? normalizeAuthProviderOptionalText(input.clientId)
    : (existing?.clientId ?? null);
  const nextRedirectUri = shouldUpdateRedirectUri
    ? normalizeAuthProviderOptionalText(input.redirectUri)
    : (existing?.redirectUri ?? null);
  const nextClientSecret = shouldUpdateClientSecret
    ? normalizeAuthProviderOptionalText(input.clientSecret)
    : null;
  const nextEncryptedClientSecret =
    nextClientSecret === null
      ? null
      : encryptSecret({
          value: nextClientSecret,
          secret: env.configEncryptionSecret,
        });
  const hasClientSecret = shouldUpdateClientSecret
    ? nextEncryptedClientSecret !== null
    : existing?.clientSecretEncrypted !== null && existing?.clientSecretEncrypted !== undefined;
  const nextDisplayName =
    normalizeAuthProviderOptionalText(input.displayName) ??
    existing?.displayName ??
    getAuthProviderDefaults(provider).displayName;
  const nextScopes = normalizeAuthProviderScopes(provider, input.scopes);

  if (input.enabled && (nextClientId === null || nextRedirectUri === null || !hasClientSecret)) {
    return {
      ok: false,
      reason: AUTH_PROVIDER_SETTINGS_FAILURE.MissingRequiredFields,
    };
  }

  await sql`
    INSERT INTO auth_provider_settings (
      provider,
      display_name,
      enabled,
      client_id,
      client_secret_encrypted,
      redirect_uri,
      scopes
    )
    VALUES (
      ${provider},
      ${nextDisplayName},
      ${input.enabled},
      ${nextClientId},
      ${shouldUpdateClientSecret ? nextEncryptedClientSecret : (existing?.clientSecretEncrypted ?? null)},
      ${nextRedirectUri},
      ${sql.array(nextScopes, 25)}::text[]
    )
    ON CONFLICT (provider)
    DO UPDATE SET
      display_name = EXCLUDED.display_name,
      enabled = EXCLUDED.enabled,
      client_id = EXCLUDED.client_id,
      client_secret_encrypted = CASE
        WHEN ${shouldUpdateClientSecret} THEN EXCLUDED.client_secret_encrypted
        ELSE auth_provider_settings.client_secret_encrypted
      END,
      redirect_uri = EXCLUDED.redirect_uri,
      scopes = EXCLUDED.scopes
  `;

  const [row] = await sql<AuthProviderSettingsRow[]>`
    SELECT
      provider,
      display_name,
      enabled,
      client_id,
      client_secret_encrypted,
      redirect_uri,
      scopes
    FROM auth_provider_settings
    WHERE provider = ${provider}
    LIMIT 1
  `;

  return {
    ok: true,
    item: toAuthProviderSettingsItem(provider, row),
  };
};

type ReadResponseJsonParameters = {
  response: Response;
};

const readResponseJson = async ({ response }: ReadResponseJsonParameters): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

const getResponseErrorDetails = async (response: Response) => {
  const payload = await readResponseJson({ response });
  if (isObjectRecord(payload) && typeof payload.message === "string") {
    return payload.message;
  }

  return `${response.status} ${response.statusText}`.trim();
};

type SendResendTestEmailParameters = {
  apiKey: string;
  branding: ResolvedEmailBranding;
  copy: ResendTestCopy;
  domain: string;
  to: string;
};

const sendResendTestEmail = async ({
  apiKey,
  branding,
  copy,
  domain,
  to,
}: SendResendTestEmailParameters) => {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      signal: AbortSignal.timeout(10_000),
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${branding.siteName} <no-reply@${domain}>`,
        html: renderNoticeEmailHtml({
          badge: copy.badge,
          branding,
          description: copy.description,
          title: copy.subject,
        }),
        subject: copy.subject,
        text: copy.description,
        to: [to],
      }),
    });

    if (!response.ok) {
      return {
        ok: false as const,
        details: await getResponseErrorDetails(response),
      };
    }

    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      details: error instanceof Error ? error.message : undefined,
    };
  }
};

const createIntegrationMessage = ({
  en,
  locale,
  zhCN,
}: {
  en: string;
  locale?: string | null;
  zhCN: string;
}) => (normalizeEmailTemplateLocale(locale) === "en" ? en : zhCN);

const consumeApiKeyRevealEmailCode = async ({
  email,
  emailCode,
  sql,
}: {
  email: string;
  emailCode: string;
  sql: Sql;
}) =>
  consumeSecretRevealEmailCode({
    email,
    emailCode,
    purpose: API_KEY_REVEAL_EMAIL_CODE_PURPOSE,
    sql,
  });

const consumeAuthProviderSecretRevealEmailCode = async ({
  email,
  emailCode,
  sql,
}: {
  email: string;
  emailCode: string;
  sql: Sql;
}) =>
  consumeSecretRevealEmailCode({
    email,
    emailCode,
    purpose: AUTH_PROVIDER_SECRET_REVEAL_EMAIL_CODE_PURPOSE,
    sql,
  });

export const createSiteSettingsApiKeyRevealCode = async ({
  locale,
  userId,
}: CreateSiteSettingsApiKeyRevealCodeParameters): Promise<SiteSettingsApiKeyRevealCodeResult> => {
  const sql = getSql();
  const [admin, settings, resendApiKey] = await Promise.all([
    readAdminUser({ sql, userId }),
    getSiteSettings(),
    readEncryptedSetting("resend_api_key"),
  ]);
  if (admin === undefined) {
    return {
      ok: false,
      status: 404,
      message: createIntegrationMessage({
        en: "Administrator no longer exists.",
        locale,
        zhCN: "管理员账号不存在。",
      }),
    };
  }

  const adminEmail = optionalInputText(admin.email)?.toLowerCase();
  if (adminEmail === undefined) {
    return {
      ok: false,
      status: 400,
      message: createIntegrationMessage({
        en: "The administrator account has no email address for receiving the verification code.",
        locale,
        zhCN: "管理员账号未配置邮箱，无法接收验证码。",
      }),
    };
  }

  const resendDomain = optionalInputText(settings.basics.resendDomain);
  if (resendDomain === undefined) {
    return {
      ok: false,
      status: 400,
      message: createIntegrationMessage({
        en: "Resend domain is not configured.",
        locale,
        zhCN: "Resend 域名未配置。",
      }),
    };
  }

  if (resendApiKey === undefined) {
    return {
      ok: false,
      status: 400,
      message: createIntegrationMessage({
        en: "Resend API key is not configured.",
        locale,
        zhCN: "Resend API key 未配置。",
      }),
    };
  }

  const code = createNumericCode();
  const expiresAt = addMinutes(new Date(), API_KEY_REVEAL_EMAIL_CODE_MINUTES);
  const branding = resolveEmailBranding({ locale, settings });
  const copy = getApiKeyRevealCodeCopy(branding);

  await sql`
    INSERT INTO email_verification_codes (email, code_hash, purpose, expires_at)
    VALUES (
      ${adminEmail},
      ${hashSecret(code)},
      ${API_KEY_REVEAL_EMAIL_CODE_PURPOSE},
      ${expiresAt}
    )
  `;

  const sent = await sendResendEmail({
    apiKey: resendApiKey,
    branding,
    domain: resendDomain,
    html: renderApiKeyRevealCodeEmailHtml({
      branding,
      code,
      copy,
      validMinutes: API_KEY_REVEAL_EMAIL_CODE_MINUTES,
    }),
    subject: copy.subject,
    text: [
      copy.description,
      copy.operationNote,
      getApiKeyRevealValidityText(branding, API_KEY_REVEAL_EMAIL_CODE_MINUTES),
      code,
    ].join("\n"),
    to: adminEmail,
  });

  if (!sent.ok) {
    return {
      ok: false,
      status: 502,
      message: createIntegrationMessage({
        en: "Verification code email could not be sent. Check the Resend configuration.",
        locale,
        zhCN: "验证码邮件发送失败，请检查 Resend 配置。",
      }),
    };
  }

  return {
    ok: true,
    expiresAt: expiresAt.toISOString(),
    message: copy.message,
    sent: true,
    validMinutes: API_KEY_REVEAL_EMAIL_CODE_MINUTES,
  };
};

export const createAuthProviderClientSecretRevealCode = async ({
  locale,
  provider: providerValue,
  userId,
}: CreateAuthProviderClientSecretRevealCodeParameters): Promise<AuthProviderClientSecretRevealCodeResult> => {
  const provider = readAuthProvider(providerValue);
  if (provider === undefined) {
    return {
      ok: false,
      status: 400,
      message: createIntegrationMessage({
        en: "Unsupported login provider.",
        locale,
        zhCN: "不支持的登录方式。",
      }),
    };
  }

  const sql = getSql();
  const [admin, settings, resendApiKey] = await Promise.all([
    readAdminUser({ sql, userId }),
    getSiteSettings(),
    readEncryptedSetting("resend_api_key"),
  ]);
  if (admin === undefined) {
    return {
      ok: false,
      status: 404,
      message: createIntegrationMessage({
        en: "Administrator no longer exists.",
        locale,
        zhCN: "管理员账号不存在。",
      }),
    };
  }

  const adminEmail = optionalInputText(admin.email)?.toLowerCase();
  if (adminEmail === undefined) {
    return {
      ok: false,
      status: 400,
      message: createIntegrationMessage({
        en: "The administrator account has no email address for receiving the verification code.",
        locale,
        zhCN: "管理员账号未配置邮箱，无法接收验证码。",
      }),
    };
  }

  const resendDomain = optionalInputText(settings.basics.resendDomain);
  if (resendDomain === undefined) {
    return {
      ok: false,
      status: 400,
      message: createIntegrationMessage({
        en: "Resend domain is not configured.",
        locale,
        zhCN: "Resend 域名未配置。",
      }),
    };
  }

  if (resendApiKey === undefined) {
    return {
      ok: false,
      status: 400,
      message: createIntegrationMessage({
        en: "Resend API key is not configured.",
        locale,
        zhCN: "Resend API key 未配置。",
      }),
    };
  }

  const code = createNumericCode();
  const expiresAt = addMinutes(new Date(), API_KEY_REVEAL_EMAIL_CODE_MINUTES);
  const branding = resolveEmailBranding({ locale, settings });
  const copy = getAuthProviderSecretRevealCodeCopy(branding, provider);

  await sql`
    INSERT INTO email_verification_codes (email, code_hash, purpose, expires_at)
    VALUES (
      ${adminEmail},
      ${hashSecret(code)},
      ${AUTH_PROVIDER_SECRET_REVEAL_EMAIL_CODE_PURPOSE},
      ${expiresAt}
    )
  `;

  const sent = await sendResendEmail({
    apiKey: resendApiKey,
    branding,
    domain: resendDomain,
    html: renderApiKeyRevealCodeEmailHtml({
      branding,
      code,
      copy,
      validMinutes: API_KEY_REVEAL_EMAIL_CODE_MINUTES,
    }),
    subject: copy.subject,
    text: [
      copy.description,
      copy.operationNote,
      getApiKeyRevealValidityText(branding, API_KEY_REVEAL_EMAIL_CODE_MINUTES),
      code,
    ].join("\n"),
    to: adminEmail,
  });

  if (!sent.ok) {
    return {
      ok: false,
      status: 502,
      message: createIntegrationMessage({
        en: "Verification code email could not be sent. Check the Resend configuration.",
        locale,
        zhCN: "验证码邮件发送失败，请检查 Resend 配置。",
      }),
    };
  }

  return {
    ok: true,
    expiresAt: expiresAt.toISOString(),
    message: copy.message,
    sent: true,
    validMinutes: API_KEY_REVEAL_EMAIL_CODE_MINUTES,
  };
};

export const revealSiteSettingsApiKeys = async ({
  emailCode,
  locale,
  userId,
}: RevealSiteSettingsApiKeysParameters): Promise<SiteSettingsApiKeyRevealResult> => {
  const sql = getSql();
  const admin = await readAdminUser({ sql, userId });
  if (admin === undefined) {
    return {
      ok: false,
      status: 404,
      message: createIntegrationMessage({
        en: "Administrator no longer exists.",
        locale,
        zhCN: "管理员账号不存在。",
      }),
    };
  }

  const adminEmail = optionalInputText(admin.email)?.toLowerCase();
  const trimmedEmailCode = optionalInputText(emailCode);
  if (adminEmail === undefined || trimmedEmailCode === undefined) {
    return {
      ok: false,
      status: 400,
      message: createIntegrationMessage({
        en: "Email verification code is required.",
        locale,
        zhCN: "请输入邮箱验证码。",
      }),
    };
  }

  const isCodeValid = await consumeApiKeyRevealEmailCode({
    email: adminEmail,
    emailCode: trimmedEmailCode,
    sql,
  });
  if (!isCodeValid) {
    return {
      ok: false,
      status: 400,
      message: createIntegrationMessage({
        en: "Email verification code is invalid or expired.",
        locale,
        zhCN: "邮箱验证码无效或已过期。",
      }),
    };
  }

  const [resendApiKey, deeplApiKey, ipGeolocationApiKey, r2SecretAccessKey] = await Promise.all([
    readEncryptedSetting("resend_api_key"),
    readEncryptedSetting("deepl_api_key"),
    readEncryptedSetting("ip_geolocation_api_key"),
    readEncryptedSetting("r2_secret_access_key"),
  ]);

  return {
    ok: true,
    item: {
      deeplApiKey: deeplApiKey ?? "",
      ipGeolocationApiKey: ipGeolocationApiKey ?? "",
      r2SecretAccessKey: r2SecretAccessKey ?? "",
      resendApiKey: resendApiKey ?? "",
    },
  };
};

export const revealAuthProviderClientSecret = async ({
  emailCode,
  locale,
  provider: providerValue,
  userId,
}: RevealAuthProviderClientSecretParameters): Promise<AuthProviderClientSecretRevealResult> => {
  const provider = readAuthProvider(providerValue);
  if (provider === undefined) {
    return {
      ok: false,
      status: 400,
      message: createIntegrationMessage({
        en: "Unsupported login provider.",
        locale,
        zhCN: "不支持的登录方式。",
      }),
    };
  }

  const sql = getSql();
  const admin = await readAdminUser({ sql, userId });
  if (admin === undefined) {
    return {
      ok: false,
      status: 404,
      message: createIntegrationMessage({
        en: "Administrator no longer exists.",
        locale,
        zhCN: "管理员账号不存在。",
      }),
    };
  }

  const adminEmail = optionalInputText(admin.email)?.toLowerCase();
  const trimmedEmailCode = optionalInputText(emailCode);
  if (adminEmail === undefined || trimmedEmailCode === undefined) {
    return {
      ok: false,
      status: 400,
      message: createIntegrationMessage({
        en: "Email verification code is required.",
        locale,
        zhCN: "请输入邮箱验证码。",
      }),
    };
  }

  const isCodeValid = await consumeAuthProviderSecretRevealEmailCode({
    email: adminEmail,
    emailCode: trimmedEmailCode,
    sql,
  });
  if (!isCodeValid) {
    return {
      ok: false,
      status: 400,
      message: createIntegrationMessage({
        en: "Email verification code is invalid or expired.",
        locale,
        zhCN: "邮箱验证码无效或已过期。",
      }),
    };
  }

  const [row] = await sql<AuthProviderSecretRow[]>`
    SELECT client_secret_encrypted
    FROM auth_provider_settings
    WHERE provider = ${provider}
    LIMIT 1
  `;

  return {
    ok: true,
    item: {
      provider,
      clientSecret:
        row?.clientSecretEncrypted === null || row?.clientSecretEncrypted === undefined
          ? ""
          : decryptSecret({
              value: row.clientSecretEncrypted,
              secret: env.configEncryptionSecret,
            }),
    },
  };
};

export const testResendApiKey = async ({
  locale,
  resendApiKey,
  resendDomain,
  userId,
}: TestResendApiKeyParameters): Promise<IntegrationTestResult> => {
  const sql = getSql();
  const admin = await readAdminUser({ sql, userId });
  if (admin === undefined) {
    return {
      ok: false,
      reason: INTEGRATION_TEST_FAILURE.AdminNotFound,
      message: createIntegrationMessage({
        en: "Administrator no longer exists.",
        locale,
        zhCN: "管理员账号不存在。",
      }),
    };
  }

  const adminEmail = optionalInputText(admin.email);
  if (adminEmail === undefined) {
    return {
      ok: false,
      reason: INTEGRATION_TEST_FAILURE.AdminEmailMissing,
      message: createIntegrationMessage({
        en: "The administrator account has no email address for receiving the test email.",
        locale,
        zhCN: "管理员账号未配置邮箱，无法接收测试邮件。",
      }),
    };
  }

  const [settings, storedApiKey] = await Promise.all([
    getSiteSettings(),
    readEncryptedSetting("resend_api_key"),
  ]);
  const domain = optionalInputText(resendDomain) ?? optionalInputText(settings.basics.resendDomain);
  if (domain === undefined) {
    return {
      ok: false,
      reason: INTEGRATION_TEST_FAILURE.MissingResendDomain,
      message: createIntegrationMessage({
        en: "Resend domain is not configured.",
        locale,
        zhCN: "Resend 域名未配置。",
      }),
    };
  }

  const apiKey = optionalInputText(resendApiKey) ?? storedApiKey;
  if (apiKey === undefined) {
    return {
      ok: false,
      reason: INTEGRATION_TEST_FAILURE.MissingResendApiKey,
      message: createIntegrationMessage({
        en: "Resend API key is not configured.",
        locale,
        zhCN: "Resend API key 未配置。",
      }),
    };
  }

  const branding = resolveEmailBranding({ locale, settings });
  const copy = getResendTestCopy(branding);
  const sent = await sendResendTestEmail({
    apiKey,
    branding,
    copy,
    domain,
    to: adminEmail,
  });
  if (!sent.ok) {
    return {
      ok: false,
      reason: INTEGRATION_TEST_FAILURE.ResendFailed,
      message: createIntegrationMessage({
        en: "Resend API key test failed. Check the API key and domain.",
        locale,
        zhCN: "Resend API key 测试失败，请检查 API key 和域名。",
      }),
      details: sent.details,
    };
  }

  return {
    ok: true,
    message: copy.message,
    details: createIntegrationMessage({
      en: `Test email recipient: ${adminEmail}`,
      locale,
      zhCN: `测试邮件接收邮箱：${adminEmail}`,
    }),
  };
};

export const testDeepLApiKey = async ({
  apiKey: inputApiKey,
  locale,
  text,
}: TestDeepLApiKeyParameters): Promise<IntegrationTestResult> => {
  const apiKey = optionalInputText(inputApiKey) ?? (await readEncryptedSetting("deepl_api_key"));
  if (apiKey === undefined) {
    return {
      ok: false,
      reason: INTEGRATION_TEST_FAILURE.MissingDeepLApiKey,
      message: createIntegrationMessage({
        en: "DeepL API key is not configured.",
        locale,
        zhCN: "DeepL API key 未配置。",
      }),
    };
  }

  const sourceText =
    optionalInputText(text) ??
    createIntegrationMessage({
      en: "LeiBlog translation test",
      locale,
      zhCN: "LeiBlog 翻译测试",
    });
  const sourceLocale = normalizeEmailTemplateLocale(locale);
  const translatedTexts = await translateTexts({
    apiKey,
    sourceLocale,
    targetLocale: sourceLocale === "en" ? "zh-CN" : "en",
    texts: [sourceText],
  });
  const translatedText = translatedTexts[0]?.trim();
  if (translatedText === undefined || translatedText.length === 0) {
    return {
      ok: false,
      reason: INTEGRATION_TEST_FAILURE.DeepLFailed,
      message: createIntegrationMessage({
        en: "DeepL API key test failed.",
        locale,
        zhCN: "DeepL API key 测试失败。",
      }),
    };
  }

  return {
    ok: true,
    message: createIntegrationMessage({
      en: "DeepL API key works.",
      locale,
      zhCN: "DeepL API key 配置成功。",
    }),
    details: createIntegrationMessage({
      en: `Translation result: ${translatedText}`,
      locale,
      zhCN: `翻译结果：${translatedText}`,
    }),
  };
};

const getRecordString = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

const summarizeIpGeolocationPayload = ({
  locale,
  payload,
}: {
  locale?: string | null;
  payload: unknown;
}) => {
  if (!isObjectRecord(payload)) {
    return undefined;
  }

  const values = [
    getRecordString(payload, "ip"),
    getRecordString(payload, "city"),
    getRecordString(payload, "state_prov"),
    getRecordString(payload, "country_name"),
    getRecordString(payload, "isp"),
  ].filter((value) => value !== undefined);

  if (values.length === 0) {
    return undefined;
  }

  return createIntegrationMessage({
    en: `Lookup result: ${values.join(" / ")}`,
    locale,
    zhCN: `定位结果：${values.join(" / ")}`,
  });
};

const summarizeLoginInfoForIpGeolocationTest = ({
  loginInfo,
  locale,
}: {
  loginInfo: UserLoginInfo;
  locale?: string | null;
}) => {
  const unknown = createIntegrationMessage({
    en: "Unknown",
    locale,
    zhCN: "未知",
  });
  const localNetwork = createIntegrationMessage({
    en: "Local network",
    locale,
    zhCN: "本地网络",
  });
  const unrecordedDevice = createIntegrationMessage({
    en: "Device not recorded",
    locale,
    zhCN: "未记录设备",
  });
  const ip = loginInfo.lastLoginIp ?? unknown;
  const location =
    loginInfo.lastLoginLocation ??
    (loginInfo.lastLoginIp === null || !isPrivateIp(loginInfo.lastLoginIp)
      ? unknown
      : localNetwork);
  const device = loginInfo.lastLoginDevice ?? unrecordedDevice;

  return createIntegrationMessage({
    en: `Latest login: IP ${ip}; location ${location}; device ${device}.`,
    locale,
    zhCN: `最近登录：IP ${ip}；地点 ${location}；设备 ${device}。`,
  });
};

export const testIpGeolocationApiKey = async ({
  apiKey: inputApiKey,
  locale,
  userId,
}: TestIpGeolocationApiKeyParameters): Promise<IntegrationTestResult> => {
  const apiKey =
    optionalInputText(inputApiKey) ?? (await readEncryptedSetting("ip_geolocation_api_key"));
  if (apiKey === undefined) {
    return {
      ok: false,
      reason: INTEGRATION_TEST_FAILURE.MissingIpGeolocationApiKey,
      message: createIntegrationMessage({
        en: "IPGeolocation API key is not configured.",
        locale,
        zhCN: "IPGeolocation API key 未配置。",
      }),
    };
  }

  const loginInfo = await readUserLoginInfo({ limit: 1, userId });
  const latestLoginIp = loginInfo.lastLoginIp?.trim();
  const publicLoginIp =
    latestLoginIp === undefined || isPrivateIp(latestLoginIp) ? undefined : latestLoginIp;
  const apiUrl = new URL("https://api.ipgeolocation.io/ipgeo");
  apiUrl.searchParams.set("apiKey", apiKey);
  apiUrl.searchParams.set("lang", normalizeEmailTemplateLocale(locale) === "en" ? "en" : "cn");
  if (publicLoginIp !== undefined) {
    apiUrl.searchParams.set("ip", publicLoginIp);
  }

  try {
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      return {
        ok: false,
        reason: INTEGRATION_TEST_FAILURE.IpGeolocationFailed,
        message: createIntegrationMessage({
          en: "IPGeolocation API key test failed.",
          locale,
          zhCN: "IPGeolocation API key 测试失败。",
        }),
        details: await getResponseErrorDetails(response),
      };
    }

    const payload = await readResponseJson({ response });
    const payloadDetails = summarizeIpGeolocationPayload({ locale, payload });
    const privateIpDetails =
      latestLoginIp !== undefined && publicLoginIp === undefined
        ? createIntegrationMessage({
            en: "The latest login IP is private or local, so the API key test used the service-side request IP.",
            locale,
            zhCN: "最近登录 IP 是内网或本机地址，本次 API key 测试使用服务端请求 IP。",
          })
        : undefined;
    return {
      ok: true,
      message: createIntegrationMessage({
        en: "IPGeolocation API key works.",
        locale,
        zhCN: "IPGeolocation API key 配置成功。",
      }),
      details: [
        summarizeLoginInfoForIpGeolocationTest({ loginInfo, locale }),
        privateIpDetails,
        payloadDetails,
      ]
        .filter((detail) => detail !== undefined)
        .join("\n"),
    };
  } catch (error) {
    return {
      ok: false,
      reason: INTEGRATION_TEST_FAILURE.IpGeolocationFailed,
      message: createIntegrationMessage({
        en: "IPGeolocation API key test failed.",
        locale,
        zhCN: "IPGeolocation API key 测试失败。",
      }),
      details: error instanceof Error ? error.message : undefined,
    };
  }
};

export const updateAdminSettings = async ({
  userId,
  input,
}: {
  userId: string;
  input: UpdateAdminSettingsInput;
}): Promise<UpdateAdminSettingsResult> => {
  const username = trimText(input.username);
  const email = trimText(input.email);
  const newPassword = input.newPassword;

  if (username.length === 0 || email.length === 0) {
    return { ok: false, reason: ADMIN_SETTINGS_FAILURE.InvalidIdentity };
  }

  if (newPassword.length > 0 && newPassword.length < 8) {
    return { ok: false, reason: ADMIN_SETTINGS_FAILURE.PasswordTooShort };
  }

  const profileLocale = normalizeProfileTagLocale(input.tagLocale);
  const deeplApiKey = await readEncryptedSetting("deepl_api_key");
  const preparedProfile = await prepareUserProfileLocalizations({
    deeplApiKey,
    profile: input.profileLocalizations,
  });

  const sql = getSql();
  const result = await sql.begin<UpdateAdminSettingsResult>(async (transaction) => {
    const users = await transaction<UserRecord[]>`
      SELECT
        id,
        role,
        name,
        username,
        password_hash,
        email,
        avatar_url,
        bio,
        tags,
        blog_url,
        comment_email_notifications,
        new_post_email_notifications
      FROM users
      WHERE id = ${userId}
        AND role = ${USER_ROLE.Admin}
      LIMIT 1
    `;

    const currentUser = users[0];
    if (currentUser === undefined) {
      return { ok: false, reason: ADMIN_SETTINGS_FAILURE.NotFound };
    }

    const usernameRows = await transaction<CountRow[]>`
      SELECT count(*)::text AS count
      FROM users
      WHERE id <> ${userId}
        AND lower(username) = lower(${username})
    `;
    if (Number(usernameRows[0]?.count ?? 0) > 0) {
      return { ok: false, reason: ADMIN_SETTINGS_FAILURE.UsernameExists };
    }

    const emailRows = await transaction<CountRow[]>`
      SELECT count(*)::text AS count
      FROM users
      WHERE id <> ${userId}
        AND lower(email) = lower(${email})
    `;
    if (Number(emailRows[0]?.count ?? 0) > 0) {
      return { ok: false, reason: ADMIN_SETTINGS_FAILURE.EmailExists };
    }

    let passwordHash = currentUser.passwordHash;
    if (newPassword.length > 0) {
      const isCurrentPasswordValid = await Bun.password.verify(
        input.currentPassword,
        currentUser.passwordHash,
      );
      if (!isCurrentPasswordValid) {
        return { ok: false, reason: ADMIN_SETTINGS_FAILURE.InvalidCurrentPassword };
      }

      passwordHash = await Bun.password.hash(newPassword);
    }

    const updatedUsers = await transaction<UserRecord[]>`
      UPDATE users
      SET
        name = ${preparedProfile.base.name},
        username = ${username},
        password_hash = ${passwordHash},
        email = ${email},
        avatar_url = ${optionalText(input.avatarUrl)},
        bio = ${preparedProfile.base.bio},
        tags = ${transaction.array(preparedProfile.base.tags, 25)}::text[],
        blog_url = ${optionalText(input.blogUrl)},
        comment_email_notifications = ${input.commentEmailNotifications},
        new_post_email_notifications = ${input.newPostEmailNotifications},
        notification_email_locale = ${profileLocale}
      WHERE id = ${userId}
        AND role = ${USER_ROLE.Admin}
      RETURNING
        id,
        role,
        name,
        username,
        password_hash,
        email,
        avatar_url,
        bio,
        tags,
        blog_url,
        comment_email_notifications,
        new_post_email_notifications
    `;

    const updatedUser = updatedUsers[0];
    if (updatedUser === undefined) {
      return { ok: false, reason: ADMIN_SETTINGS_FAILURE.UpdateFailed };
    }

    await upsertUsersEnProfile({
      profile: preparedProfile.english,
      sql: transaction,
      userId,
    });

    const user = await toLocalizedAdminProfile({
      locale: profileLocale,
      row: updatedUser,
      sql: transaction,
    });
    if (user === undefined) {
      return { ok: false, reason: ADMIN_SETTINGS_FAILURE.UpdateFailed };
    }

    await transaction`
      DELETE FROM user_social_links
      WHERE user_id = ${userId}
    `;

    const socialLinks = normalizeSocialLinks(input.socialLinks);
    for (const [index, link] of socialLinks.entries()) {
      await transaction`
        INSERT INTO user_social_links (user_id, label, url, sort_order)
        VALUES (${userId}, ${link.label}, ${link.url}, ${index})
      `;
    }

    return {
      ok: true,
      settings: {
        loginInfo: await readUserLoginInfo({ sql: transaction, userId }),
        profileLocalizations: preparedProfile.localizations,
        profileTranslation: preparedProfile.translation,
        user,
        socialLinks,
      },
    };
  });

  return result;
};

export const updateSiteSettings = async (
  input: UpdateSiteSettingsInput,
): Promise<UpdateSiteSettingsResult> => {
  const timeZone = normalizeTimeZone(input.site.timeZone);
  const foundedAt = parseMinuteTimestampInTimeZone({
    timeZone,
    value: input.site.foundedAt,
  });
  if (foundedAt === undefined) {
    return { ok: false, reason: SITE_SETTINGS_FAILURE.InvalidFoundedAt };
  }

  const [storedDeepLApiKey, storedR2SecretAccessKey] = await Promise.all([
    readEncryptedSetting("deepl_api_key"),
    readEncryptedSetting("r2_secret_access_key"),
  ]);
  const deeplApiKey = optionalText(input.basics.deeplApiKey) ?? storedDeepLApiKey;
  const r2AccountId = optionalText(input.storage.r2AccountId);
  const r2Bucket = optionalText(input.storage.r2Bucket);
  const r2AccessKeyId = optionalText(input.storage.r2AccessKeyId);
  const r2PublicBaseUrl = optionalText(input.storage.r2PublicBaseUrl);
  const r2SecretAccessKey =
    optionalText(input.storage.r2SecretAccessKey) ?? storedR2SecretAccessKey;
  if (
    input.storage.r2Enabled &&
    (r2AccountId === null ||
      r2Bucket === null ||
      r2AccessKeyId === null ||
      r2PublicBaseUrl === null ||
      r2SecretAccessKey === undefined)
  ) {
    return { ok: false, reason: SITE_SETTINGS_FAILURE.R2Incomplete };
  }

  const preparedContent = await prepareSiteSettingsLocalizations({
    deeplApiKey,
    localizations: input.siteLocalizations,
  });
  const sql = getSql();
  const result = await sql.begin<UpdateSiteSettingsWriteResult>(async (transaction) => {
    await transaction`
      INSERT INTO site_settings (
        id,
        site_name,
        founded_at,
        site_description,
        cover_urls,
        homepage_copy,
        light_logo_url,
        dark_logo_url,
        favicon_url,
        seo_title,
        seo_description,
        seo_keywords,
        copyright,
        comments_enabled,
        resend_domain,
        time_zone,
        r2_enabled,
        r2_account_id,
        r2_bucket,
        r2_access_key_id,
        r2_public_base_url
      )
      VALUES (
        1,
        ${optionalText(preparedContent.localizations.zhCN.siteName)},
        ${foundedAt},
        ${optionalText(preparedContent.localizations.zhCN.siteDescription)},
        ${transaction.array(normalizeTextArray(input.site.coverUrls), 25)}::text[],
        ${optionalText(preparedContent.localizations.zhCN.homepageCopy)},
        ${optionalText(input.site.lightLogoUrl)},
        ${optionalText(input.site.darkLogoUrl)},
        ${optionalText(input.site.faviconUrl)},
        ${optionalText(preparedContent.localizations.zhCN.seoTitle)},
        ${optionalText(preparedContent.localizations.zhCN.seoDescription)},
        ${transaction.array(normalizeTextArray(input.basics.seoKeywords), 25)}::text[],
        ${optionalText(input.basics.copyright)},
        ${input.basics.commentsEnabled},
        ${optionalText(input.basics.resendDomain)},
        ${timeZone},
        ${input.storage.r2Enabled},
        ${r2AccountId},
        ${r2Bucket},
        ${r2AccessKeyId},
        ${r2PublicBaseUrl}
      )
      ON CONFLICT (id)
      DO UPDATE SET
        site_name = EXCLUDED.site_name,
        founded_at = EXCLUDED.founded_at,
        site_description = EXCLUDED.site_description,
        cover_urls = EXCLUDED.cover_urls,
        homepage_copy = EXCLUDED.homepage_copy,
        light_logo_url = EXCLUDED.light_logo_url,
        dark_logo_url = EXCLUDED.dark_logo_url,
        favicon_url = EXCLUDED.favicon_url,
        seo_title = EXCLUDED.seo_title,
        seo_description = EXCLUDED.seo_description,
        seo_keywords = EXCLUDED.seo_keywords,
        copyright = EXCLUDED.copyright,
        comments_enabled = EXCLUDED.comments_enabled,
        resend_domain = EXCLUDED.resend_domain,
        time_zone = EXCLUDED.time_zone,
        r2_enabled = EXCLUDED.r2_enabled,
        r2_account_id = EXCLUDED.r2_account_id,
        r2_bucket = EXCLUDED.r2_bucket,
        r2_access_key_id = EXCLUDED.r2_access_key_id,
        r2_public_base_url = EXCLUDED.r2_public_base_url
    `;

    await upsertSiteSettingsEnContent({
      content: preparedContent.localizations.en,
      sql: transaction,
    });

    const encryptedSettings = [
      { key: "resend_api_key", value: input.basics.resendApiKey },
      { key: "deepl_api_key", value: input.basics.deeplApiKey },
      { key: "ip_geolocation_api_key", value: input.basics.ipGeolocationApiKey },
      { key: "r2_secret_access_key", value: input.storage.r2SecretAccessKey },
    ] satisfies Array<{ key: EncryptedSettingKey; value: string }>;

    for (const setting of encryptedSettings) {
      const value = optionalText(setting.value);
      if (value === null) {
        continue;
      }

      const encryptedValue = encryptSecret({
        value,
        secret: env.configEncryptionSecret,
      });

      await transaction`
        INSERT INTO encrypted_settings (key, encrypted_value)
        VALUES (${setting.key}, ${encryptedValue})
        ON CONFLICT (key)
        DO UPDATE SET encrypted_value = EXCLUDED.encrypted_value
      `;
    }

    await transaction`
      DELETE FROM filing_records
      WHERE type IN ('icp', 'police')
    `;

    const icpRecords = normalizeFilingRecords(input.filings.icpRecords);
    for (const [index, record] of icpRecords.entries()) {
      await transaction`
        INSERT INTO filing_records (type, record_number, url, sort_order)
        VALUES ('icp', ${record.number}, ${record.url}, ${index})
      `;
    }

    const policeRecordNumber = optionalText(input.filings.policeRecordNumber);
    const policeRecordUrl = optionalText(input.filings.policeRecordUrl);
    if (policeRecordNumber !== null || policeRecordUrl !== null) {
      await transaction`
        INSERT INTO filing_records (type, record_number, url, sort_order)
        VALUES ('police', ${policeRecordNumber ?? ""}, ${policeRecordUrl ?? ""}, 0)
      `;
    }

    return { ok: true };
  });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    settings: {
      ...(await getSiteSettings()),
      siteTranslation: preparedContent.translation,
    },
  };
};
