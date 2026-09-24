import type { Sql, TransactionSql } from "postgres";

import { getSql } from "../../shared/db/postgres";
import { env } from "../../shared/env";
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
import { decryptSecret, encryptSecret } from "../../shared/security/encryption";
import type { AdminProfile, UserRecord } from "../auth/types";
import { USER_ROLE } from "../auth/types";
import { toLocalizedAdminProfile } from "../auth/service";

const DATE_TIME_MINUTE_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

export const ENCRYPTED_SETTING_KEYS = [
  "resend_api_key",
  "deepl_api_key",
  "ip_geolocation_api_key",
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
  UpdateFailed: "update-failed",
} as const;

export type EncryptedSettingKey = (typeof ENCRYPTED_SETTING_KEYS)[number];

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
export type SiteSettingsTranslationField =
  (typeof SITE_SETTINGS_TRANSLATION_FIELDS)[number];

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
  socialLinks: AdminSocialLink[];
  profileLocalizations: UserProfileLocalizations;
  profileTranslation?: UserProfileTranslationSummary;
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
};

type SiteSettingsEnRow = {
  siteName: string | null;
  siteDescription: string | null;
  homepageCopy: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
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

const trimText = (value: string) => value.trim();

const optionalText = (value: string) => {
  const trimmedValue = trimText(value);
  return trimmedValue.length > 0 ? trimmedValue : null;
};

const textValue = (value: string | null) => value ?? "";

const normalizeTextArray = (values: string[]) =>
  values.map((value) => value.trim()).filter((value) => value.length > 0);

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

  const completedFields = requestedFields.filter(
    (field) => nextTarget[field].length > 0,
  );

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
  const missingFields = requestedFields.filter(
    (field) => !completedFields.includes(field),
  );
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

const parseMinuteTimestamp = (value: string) => {
  const trimmedValue = optionalText(value);
  if (trimmedValue === null) {
    return null;
  }

  const match = DATE_TIME_MINUTE_PATTERN.exec(trimmedValue);
  if (match === null) {
    return undefined;
  }

  const [, yearText = "", monthText = "", dayText = "", hourText = "", minuteText = ""] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const date = new Date(year, month - 1, day, hour, minute);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return undefined;
  }

  return date;
};

const padDateUnit = (value: number) => value.toString().padStart(2, "0");

const formatMinuteTimestamp = (value: Date | null) => {
  if (value === null) {
    return "";
  }

  return [
    `${value.getFullYear()}-${padDateUnit(value.getMonth() + 1)}-${padDateUnit(value.getDate())}`,
    `${padDateUnit(value.getHours())}:${padDateUnit(value.getMinutes())}`,
  ].join(" ");
};

type ReadAdminUserParameters = {
  sql: Sql;
  userId: string;
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
  await sql`
    INSERT INTO site_settings (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING
  `;

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
      resend_domain
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
  const [resendApiKeyConfigured, deeplApiKeyConfigured, ipGeolocationApiKeyConfigured] =
    await Promise.all([
      isEncryptedSettingConfigured("resend_api_key"),
      isEncryptedSettingConfigured("deepl_api_key"),
      isEncryptedSettingConfigured("ip_geolocation_api_key"),
    ]);

  return {
    resendApiKeyConfigured,
    deeplApiKeyConfigured,
    ipGeolocationApiKeyConfigured,
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
});

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

  return {
    siteLocalizations,
    site: {
      siteName: textValue(row.siteName),
      foundedAt: formatMinuteTimestamp(row.foundedAt),
      siteDescription: textValue(row.siteDescription),
      coverUrls: row.coverUrls,
      homepageCopy: textValue(row.homepageCopy),
      lightLogoUrl: textValue(row.lightLogoUrl),
      darkLogoUrl: textValue(row.darkLogoUrl),
      faviconUrl: textValue(row.faviconUrl),
    },
    basics: {
      seoTitle: textValue(row.seoTitle),
      seoDescription: textValue(row.seoDescription),
      seoKeywords: row.seoKeywords,
      copyright: textValue(row.copyright),
      commentsEnabled: row.commentsEnabled,
      resendDomain: textValue(row.resendDomain),
      ...secretStatuses,
    },
    filings: {
      icpRecords,
      policeRecordNumber: policeRecord?.recordNumber ?? "",
      policeRecordUrl: policeRecord?.url ?? "",
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

  const socialLinks = await readAdminSocialLinks(userId);
  const profileLocalizations = await readUserProfileLocalizations({
    base: toUserProfileContent(userRow),
    sql,
    userId,
  });

  return {
    profileLocalizations,
    user,
    socialLinks,
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
        new_post_email_notifications = ${input.newPostEmailNotifications}
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
  const foundedAt = parseMinuteTimestamp(input.site.foundedAt);
  if (foundedAt === undefined) {
    return { ok: false, reason: SITE_SETTINGS_FAILURE.InvalidFoundedAt };
  }

  const deeplApiKey =
    optionalText(input.basics.deeplApiKey) ?? (await readEncryptedSetting("deepl_api_key"));
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
        resend_domain
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
        ${optionalText(input.basics.resendDomain)}
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
        resend_domain = EXCLUDED.resend_domain
    `;

    await upsertSiteSettingsEnContent({
      content: preparedContent.localizations.en,
      sql: transaction,
    });

    const encryptedSettings = [
      { key: "resend_api_key", value: input.basics.resendApiKey },
      { key: "deepl_api_key", value: input.basics.deeplApiKey },
      { key: "ip_geolocation_api_key", value: input.basics.ipGeolocationApiKey },
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
