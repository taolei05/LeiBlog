import { getSql } from "../../shared/db/postgres";
import { env } from "../../shared/env";
import type { UserProfileLocale } from "../../shared/profile-tags";
import {
  normalizeProfileTagLocale,
  prepareUserProfileInput,
  resolveUserProfileWrite,
  upsertUsersEnProfile,
} from "../../shared/profile-tags";
import { encryptSecret } from "../../shared/security/encryption";
import { normalizeTimeZone, parseMinuteTimestampInTimeZone } from "../../shared/time-zone";
import type { AdminProfile, UserRecord } from "../auth/types";
import { USER_ROLE } from "../auth/types";
import { toLocalizedAdminProfile } from "../auth/service";
import type { EncryptedSettingKey } from "../settings/service";

export const INITIAL_SETUP_FAILURE = {
  AdminExists: "admin-exists",
  InvalidFoundedAt: "invalid-founded-at",
  UserInsertFailed: "user-insert-failed",
} as const;

type CountRow = {
  count: string;
};

type SocialLinkInput = {
  label: string;
  url: string;
};

type FilingRecordInput = {
  number: string;
  url: string;
};

type InitialSetupAdminInput = {
  name: string;
  username: string;
  password: string;
  email: string;
  avatarUrl: string;
  bio: string;
  tags: string[];
  tagLocale: UserProfileLocale;
  socialLinks: SocialLinkInput[];
  blogUrl: string;
  commentEmailNotifications: boolean;
  newPostEmailNotifications: boolean;
};

type InitialSetupSiteInput = {
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

type InitialSetupBasicsInput = {
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  copyright: string;
  commentsEnabled: boolean;
  resendDomain: string;
  resendApiKey: string;
  deeplApiKey: string;
  ipGeolocationApiKey: string;
};

type InitialSetupFilingsInput = {
  icpRecords: FilingRecordInput[];
  policeRecordNumber: string;
  policeRecordUrl: string;
};

export type CompleteInitialSetupInput = {
  admin: InitialSetupAdminInput;
  site: InitialSetupSiteInput;
  basics: InitialSetupBasicsInput;
  filings: InitialSetupFilingsInput;
};

type CompleteInitialSetupResult =
  | {
      ok: true;
      user: AdminProfile;
    }
  | {
      ok: false;
      reason: (typeof INITIAL_SETUP_FAILURE)[keyof typeof INITIAL_SETUP_FAILURE];
    };

const trimText = (value: string) => value.trim();

const optionalText = (value: string) => {
  const trimmedValue = trimText(value);
  return trimmedValue.length > 0 ? trimmedValue : null;
};

const normalizeTextArray = (values: string[]) =>
  values.map((value) => value.trim()).filter((value) => value.length > 0);

const countAdmins = async () => {
  const sql = getSql();
  const rows = await sql<CountRow[]>`
    SELECT count(*)::text AS count
    FROM users
    WHERE role = ${USER_ROLE.Admin}
  `;

  return Number(rows[0]?.count ?? 0);
};

export const getAdminSetupStatus = async () => {
  const adminCount = await countAdmins();
  const hasAdmin = adminCount > 0;

  return {
    hasAdmin,
    requiresSetup: !hasAdmin,
    requiresSetupToken: Bun.env.NODE_ENV === "production" || env.setupToken !== undefined,
  };
};

export const completeInitialSetup = async (
  input: CompleteInitialSetupInput,
): Promise<CompleteInitialSetupResult> => {
  if ((await countAdmins()) > 0) {
    return { ok: false, reason: INITIAL_SETUP_FAILURE.AdminExists };
  }

  const timeZone = normalizeTimeZone(input.site.timeZone);
  const foundedAt = parseMinuteTimestampInTimeZone({
    timeZone,
    value: input.site.foundedAt,
  });
  if (foundedAt === undefined) {
    return { ok: false, reason: INITIAL_SETUP_FAILURE.InvalidFoundedAt };
  }

  const profileLocale = normalizeProfileTagLocale(input.admin.tagLocale);
  const deeplApiKey = optionalText(input.basics.deeplApiKey) ?? undefined;
  const preparedProfile = await prepareUserProfileInput({
    deeplApiKey,
    profile: {
      name: input.admin.name,
      bio: input.admin.bio,
      tags: input.admin.tags,
    },
    sourceLocale: profileLocale,
  });
  const profileWrite = resolveUserProfileWrite({
    prepared: preparedProfile,
  });

  const sql = getSql();
  const result = await sql.begin<CompleteInitialSetupResult>(async (transaction) => {
    await transaction`LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE`;

    const rows = await transaction<CountRow[]>`
      SELECT count(*)::text AS count
      FROM users
      WHERE role = ${USER_ROLE.Admin}
    `;

    if (Number(rows[0]?.count ?? 0) > 0) {
      return { ok: false, reason: INITIAL_SETUP_FAILURE.AdminExists };
    }

    const passwordHash = await Bun.password.hash(input.admin.password);
    const insertedUsers = await transaction<UserRecord[]>`
      INSERT INTO users (
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
      )
      VALUES (
        ${USER_ROLE.Admin},
        ${profileWrite.base.name},
        ${trimText(input.admin.username)},
        ${passwordHash},
        ${trimText(input.admin.email)},
        ${optionalText(input.admin.avatarUrl)},
        ${profileWrite.base.bio},
        ${transaction.array(profileWrite.base.tags, 25)}::text[],
        ${optionalText(input.admin.blogUrl)},
        ${input.admin.commentEmailNotifications},
        ${input.admin.newPostEmailNotifications}
      )
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

    const insertedUser = insertedUsers[0];
    if (insertedUser === undefined) {
      return { ok: false, reason: INITIAL_SETUP_FAILURE.UserInsertFailed };
    }

    await upsertUsersEnProfile({
      profile: profileWrite.english,
      sql: transaction,
      userId: insertedUser.id,
    });

    const adminUser = await toLocalizedAdminProfile({
      locale: profileLocale,
      row: insertedUser,
      sql: transaction,
    });
    if (adminUser === undefined) {
      return { ok: false, reason: INITIAL_SETUP_FAILURE.UserInsertFailed };
    }

    const socialLinks = input.admin.socialLinks
      .map((link) => ({
        label: trimText(link.label),
        url: trimText(link.url),
      }))
      .filter((link) => link.label.length > 0 || link.url.length > 0);

    for (const [index, link] of socialLinks.entries()) {
      await transaction`
        INSERT INTO user_social_links (user_id, label, url, sort_order)
        VALUES (${adminUser.id}, ${link.label}, ${link.url}, ${index})
      `;
    }

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
        time_zone
      )
      VALUES (
        1,
        ${optionalText(input.site.siteName)},
        ${foundedAt},
        ${optionalText(input.site.siteDescription)},
        ${transaction.array(normalizeTextArray(input.site.coverUrls), 25)}::text[],
        ${optionalText(input.site.homepageCopy)},
        ${optionalText(input.site.lightLogoUrl)},
        ${optionalText(input.site.darkLogoUrl)},
        ${optionalText(input.site.faviconUrl)},
        ${optionalText(input.basics.seoTitle)},
        ${optionalText(input.basics.seoDescription)},
        ${transaction.array(normalizeTextArray(input.basics.seoKeywords), 25)}::text[],
        ${optionalText(input.basics.copyright)},
        ${input.basics.commentsEnabled},
        ${optionalText(input.basics.resendDomain)},
        ${timeZone}
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
        time_zone = EXCLUDED.time_zone
    `;

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

    const icpRecords = input.filings.icpRecords
      .map((record) => ({
        number: trimText(record.number),
        url: trimText(record.url),
      }))
      .filter((record) => record.number.length > 0 || record.url.length > 0);

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
        ON CONFLICT (type)
        WHERE type = 'police'
        DO UPDATE SET
          record_number = EXCLUDED.record_number,
          url = EXCLUDED.url,
          sort_order = EXCLUDED.sort_order
      `;
    }

    return { ok: true, user: adminUser };
  });

  return result;
};
