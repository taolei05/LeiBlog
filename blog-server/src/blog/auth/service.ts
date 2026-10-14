import { createHash, randomInt } from "node:crypto";

import type { Sql, TransactionSql } from "postgres";

import { readEncryptedSetting, getSiteSettings } from "../../admin/settings/service";
import { getSql } from "../../shared/db/postgres";
import { env } from "../../shared/env";
import { escapeEmailHtml, renderEmailLogo, resolveEmailAssetUrl } from "../../shared/email-content";
import { reserveEmailVerificationAttempt } from "../../shared/email-verification";
import { deleteAdminSessionsForUser } from "../../admin/auth/service";
import {
  describeDevice,
  describeLocation,
  recordLoginAttempt,
  readUserLoginInfo,
  readLocationLabels,
} from "../../shared/login-metadata";
import type { LoginMethod, UserLoginInfo } from "../../shared/login-metadata";
import type { RequestMeta } from "../../shared/request-meta";
import { prepareUserProfileLocalizations, readUserProfileLocalizations, upsertUsersEnProfile } from "../../shared/profile-tags";
import type { UserProfileLocalizations, UserProfileTranslationSummary } from "../../shared/profile-tags";

export type EmailTemplateLocale = "en" | "zh-CN";

export type BlogUserRole = "admin" | "user";
export type PublicEmailCodePurpose = "password_reset" | "register";
export type AccountEmailCodePurpose =
  | "email_change_current"
  | "email_change_new"
  | "password_change";
export type EmailCodePurpose = AccountEmailCodePurpose | PublicEmailCodePurpose;

export type BlogUserProfile = {
  profileLocalizations?: UserProfileLocalizations;
  profileTranslation?: UserProfileTranslationSummary;
  avatarUrl?: string;
  bio?: string;
  blogUrl?: string;
  commentEmailNotifications: boolean;
  createdAt: string;
  id: string;
  lastLoginAt: string | null;
  lastLoginTimeZone: string | null;
  lastLoginTimeZoneOffsetMinutes: number | null;
  lastLoginDevice: string | null;
  lastLoginIp: string | null;
  lastLoginLocation: string | null;
  lastLoginLocationEn?: string | null;
  lastLoginMethod: LoginMethod | null;
  name?: string;
  newPostEmailNotifications: boolean;
  role: BlogUserRole;
  tags: string[];
  updatedAt: string;
  username: string;
  email: string;
};

export type BlogAuthSession = {
  sessionSecret: string;
  sessionId: string;
};

export type CreateEmailCodeInput = {
  email: string;
  locale?: string;
  purpose: PublicEmailCodePurpose;
};

export type CreateAccountEmailCodeInput = (
  | {
      purpose: "email_change_current" | "password_change";
      user: BlogUserProfile;
    }
  | {
      email: string;
      purpose: "email_change_new";
      user: BlogUserProfile;
    }
) & {
  locale?: string;
};

export type RegisterBlogUserInput = {
  username: string;
  password: string;
  email: string;
  emailCode: string;
  name?: string;
};

export type LoginBlogUserInput = {
  identifier: string;
  password: string;
};

export type PasswordResetInput = {
  email: string;
  emailCode: string;
  password: string;
};

export type ChangeBlogUserEmailInput = {
  currentEmailCode: string;
  newEmail: string;
  newEmailCode: string;
  user: BlogUserProfile;
};

export type ChangeBlogUserPasswordInput =
  | {
      currentPassword: string;
      method: "password";
      newPassword: string;
      user: BlogUserProfile;
    }
  | {
      emailCode: string;
      method: "email_code";
      newPassword: string;
      user: BlogUserProfile;
    };

export type UpdateBlogUserProfileInput = {
  profileLocalizations?: UserProfileLocalizations;
  notificationEmailLocale?: EmailTemplateLocale;
  avatarUrl?: string;
  bio?: string;
  blogUrl?: string;
  commentEmailNotifications?: boolean;
  name?: string;
  newPostEmailNotifications?: boolean;
  tags?: string[];
  username?: string;
};

export type BlogAuthFailureReason =
  | "email-unavailable"
  | "email-unchanged"
  | "email-exists"
  | "invalid-code"
  | "invalid-credentials"
  | "invalid-identity"
  | "oauth-provider-unavailable"
  | "oauth-state-invalid"
  | "password-too-short"
  | "username-exists";

export class BlogAuthError extends Error {
  readonly reason: BlogAuthFailureReason;
  readonly statusCode: number;

  constructor({
    message,
    reason,
    statusCode,
  }: {
    message: string;
    reason: BlogAuthFailureReason;
    statusCode: number;
  }) {
    super(message);
    this.name = "BlogAuthError";
    this.reason = reason;
    this.statusCode = statusCode;
  }
}

type BlogAuthSql = Sql | TransactionSql;

type BlogUserRow = {
  avatarUrl: string | null;
  bio: string | null;
  blogUrl: string | null;
  commentEmailNotifications: boolean;
  createdAt: Date | string;
  id: string;
  lastLoginAt?: Date | string | null;
  lastLoginTimeZone?: string | null;
  lastLoginTimeZoneOffsetMinutes?: number | null;
  lastLoginDevice?: unknown;
  lastLoginIp?: string | null;
  lastLoginLocation?: unknown;
  lastLoginMethod?: LoginMethod | null;
  name: string | null;
  newPostEmailNotifications: boolean;
  role: BlogUserRole;
  tags: string[];
  updatedAt: Date | string;
  username: string;
  email: string;
};

type BlogLoginUserRow = BlogUserRow & {
  passwordHash: string;
};

type LoginBlogUserParameters = LoginBlogUserInput & {
  requestMeta: RequestMeta;
};

type RecordBlogUserLoginParameters = {
  requestMeta: RequestMeta;
  user: BlogUserProfile;
};

type RecordBlogUserOAuthLoginParameters = {
  loginMethod: Extract<LoginMethod, "github" | "google">;
  requestMeta: RequestMeta;
  user: BlogUserProfile;
};

type CreateBlogSessionParameters = {
  loginMethod?: LoginMethod;
  requestMeta: RequestMeta;
  sessionSecret: string;
  sessionId: string;
  user: BlogUserProfile;
};

type CountRow = {
  count: string;
};

type EmailCodeRow = {
  id: string;
  codeHash: string;
};

export type ResolvedEmailBranding = {
  locale: EmailTemplateLocale;
  logoUrl: string | null;
  siteInitial: string;
  siteName: string;
};

type ResolveEmailBrandingParameters = {
  locale?: string;
};

const EMAIL_CODE_MINUTES = 10;
const MIN_PASSWORD_LENGTH = 8;

const EMAIL_FRAME_COPY = {
  "zh-CN": {
    codeLabel: "验证码",
    eyebrow: "Security Mail",
    footer: (siteName: string) =>
      `这封邮件由 ${siteName} 自动发送。如果不是你本人操作，可以忽略此邮件。`,
    htmlLang: "zh-CN",
    plainCodeLine: ({ code, validMinutes }: { code: string; validMinutes: number }) =>
      `验证码：${code}，${validMinutes} 分钟内有效。`,
    preheaderSuffix: (validMinutes: number) => `验证码 ${validMinutes} 分钟内有效。`,
    validityText: (validMinutes: number) =>
      `验证码 ${validMinutes} 分钟内有效，请不要转发或泄露给他人。`,
  },
  en: {
    codeLabel: "Verification code",
    eyebrow: "Security Mail",
    footer: (siteName: string) =>
      `This email was sent automatically by ${siteName}. If you did not request this action, you can ignore it.`,
    htmlLang: "en",
    plainCodeLine: ({ code, validMinutes }: { code: string; validMinutes: number }) =>
      `Verification code: ${code}. This code is valid for ${validMinutes} minutes.`,
    preheaderSuffix: (validMinutes: number) => `This code is valid for ${validMinutes} minutes.`,
    validityText: (validMinutes: number) =>
      `This code is valid for ${validMinutes} minutes. Do not forward or share it with anyone.`,
  },
} as const;

const createAuthError = (statusCode: number, reason: BlogAuthFailureReason, message: string) =>
  new BlogAuthError({ message, reason, statusCode });

const trimText = (value: string) => value.trim();

const normalizeEmail = (email: string) => trimText(email).toLowerCase();

const cleanOptionalText = (value?: string) => {
  const trimmedValue = value?.trim();
  return trimmedValue && trimmedValue.length > 0 ? trimmedValue : null;
};

const cleanTags = (tags?: readonly string[]) =>
  Array.from(new Set((tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0))).slice(
    0,
    12,
  );

const createNumericCode = (length = 6) => {
  const max = 10 ** length;
  return randomInt(0, max).toString().padStart(length, "0");
};

const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60 * 1000);

const addSeconds = (date: Date, seconds: number) => new Date(date.getTime() + seconds * 1000);

export const escapeHtml = escapeEmailHtml;

const toAbsoluteAssetUrl = (value: string | null | undefined) => {
  return resolveEmailAssetUrl(value, env.publicSiteUrl);
};

const getEmailBrandInitial = (siteName: string) => siteName.trim().slice(0, 1).toUpperCase() || "L";

const normalizeEmailTemplateLocale = (locale?: string): EmailTemplateLocale => {
  if (locale?.toLowerCase().startsWith("en") === true) {
    return "en";
  }

  return "zh-CN";
};

export const resolveEmailBranding = async ({
  locale,
}: ResolveEmailBrandingParameters): Promise<ResolvedEmailBranding> => {
  const settings = await getSiteSettings();
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
    locale: templateLocale,
    logoUrl,
    siteInitial: getEmailBrandInitial(siteName),
    siteName,
  };
};

export const renderLeiBlogEmailHtml = ({
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
  const brandMark = renderEmailLogo(branding, env.publicSiteUrl);

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

type RenderVerificationCodeEmailHtmlParameters = {
  branding: ResolvedEmailBranding;
  code: string;
  description: string;
  operationNote?: string;
  title: string;
  validMinutes: number;
};

const renderVerificationCodeEmailHtml = ({
  branding,
  code,
  description,
  operationNote,
  title,
  validMinutes,
}: RenderVerificationCodeEmailHtmlParameters) => {
  const copy = EMAIL_FRAME_COPY[branding.locale];
  const codeDigits = code
    .split("")
    .map(
      (digit) =>
        `<td style="padding:0 3px 0 0;"><div style="display:block;padding:9px 0;border:1px solid #d4d4d8;border-radius:10px;background:#f4f4f5;color:#09090b;font-size:21px;font-weight:900;text-align:center;line-height:1.1;">${escapeHtml(digit)}</div></td>`,
    )
    .join("");

  return renderLeiBlogEmailHtml({
    bodyHtml: `
      <p style="margin:0 0 16px;color:#52525b;font-size:14px;line-height:1.65;">${escapeHtml(description)}</p>
      <div style="margin:18px 0 16px;padding:14px;border:1px solid #f0abfc;border-radius:16px;background:#fdf4ff;">
        <p style="margin:0 0 10px;color:#86198f;font-size:13px;font-weight:800;line-height:1.4;">${escapeHtml(copy.codeLabel)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:330px;table-layout:fixed;border-collapse:separate;">
          <tr>${codeDigits}</tr>
        </table>
      </div>
      ${
        operationNote === undefined
          ? ""
          : `<p style="margin:0 0 12px;padding:10px 12px;border-radius:12px;background:#fff7ed;color:#9a3412;font-size:13px;font-weight:700;line-height:1.65;">${escapeHtml(operationNote)}</p>`
      }
      <p style="margin:0;color:#71717a;font-size:13px;line-height:1.65;">${escapeHtml(copy.validityText(validMinutes))}</p>
    `,
    branding,
    preheader: `${description} ${copy.preheaderSuffix(validMinutes)}`,
    title,
  });
};

export type SendResendEmailParameters = {
  branding: ResolvedEmailBranding;
  html: string;
  subject: string;
  text: string;
  to: string;
  idempotencyKey?: string;
  senderDomain?: string;
};

export const sendResendEmail = async ({
  branding,
  html,
  subject,
  text,
  to,
  idempotencyKey,
  senderDomain,
}: SendResendEmailParameters) => {
  const [settings, apiKey] = await Promise.all([
    getSiteSettings(),
    readEncryptedSetting("resend_api_key"),
  ]);
  const configuredDomain = settings.basics.resendDomain.trim();
  const domain = senderDomain ?? configuredDomain;

  if (configuredDomain.length === 0 || domain.length === 0 || apiKey === undefined) {
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(idempotencyKey === undefined ? {} : { "Idempotency-Key": idempotencyKey }),
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
    throw new Error("邮件发送失败");
  }

  return true;
};

const toNullableIsoString = (value: Date | string | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

const mergeBlogUserLoginInfo = ({
  loginInfo,
  user,
}: {
  loginInfo: UserLoginInfo;
  user: BlogUserProfile;
}): BlogUserProfile => ({
  ...user,
  lastLoginAt: loginInfo.lastLoginAt,
  lastLoginTimeZone: loginInfo.lastLoginTimeZone,
  lastLoginTimeZoneOffsetMinutes: loginInfo.lastLoginTimeZoneOffsetMinutes,
  lastLoginDevice: loginInfo.lastLoginDevice,
  lastLoginIp: loginInfo.lastLoginIp,
  lastLoginLocation: loginInfo.lastLoginLocation,
  lastLoginLocationEn: loginInfo.lastLoginLocationEn ?? null,
  lastLoginMethod: loginInfo.lastLoginMethod,
});

const toBlogUserProfile = async (
  row: BlogUserRow,
  sql: BlogAuthSql = getSql(),
): Promise<BlogUserProfile> => {
  const [labels] = await readLocationLabels({ values: [row.lastLoginLocation], sql });
  return {
    profileLocalizations: await readUserProfileLocalizations({
      base: { name: row.name, bio: row.bio, tags: row.tags },
      sql,
      userId: row.id,
    }),
    ...(row.avatarUrl === null ? {} : { avatarUrl: row.avatarUrl }),
    ...(row.bio === null ? {} : { bio: row.bio }),
    ...(row.blogUrl === null ? {} : { blogUrl: row.blogUrl }),
    commentEmailNotifications: row.commentEmailNotifications,
    createdAt: new Date(row.createdAt).toISOString(),
    id: row.id,
    lastLoginAt: toNullableIsoString(row.lastLoginAt),
    lastLoginTimeZone: row.lastLoginTimeZone ?? null,
    lastLoginTimeZoneOffsetMinutes: row.lastLoginTimeZoneOffsetMinutes ?? null,
    lastLoginDevice: describeDevice(row.lastLoginDevice),
    lastLoginIp: row.lastLoginIp ?? null,
    lastLoginLocation: describeLocation(row.lastLoginLocation),
    lastLoginLocationEn: labels?.en ?? null,
    lastLoginMethod: row.lastLoginMethod ?? null,
    ...(row.name === null ? {} : { name: row.name }),
    newPostEmailNotifications: row.newPostEmailNotifications,
    role: row.role,
    tags: row.tags,
    updatedAt: new Date(row.updatedAt).toISOString(),
    username: row.username,
    email: row.email,
  };
};

const countRows = async (sql: BlogAuthSql, query: Promise<CountRow[]>) => {
  const rows = await query;
  return Number(rows[0]?.count ?? 0);
};

const assertPasswordLength = (password: string) => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw createAuthError(400, "password-too-short", "密码至少需要 8 位。");
  }
};

const findUserByEmail = async (sql: BlogAuthSql, email: string) => {
  const users = await sql<{ id: string }[]>`
    SELECT id
    FROM users
    WHERE lower(email) = ${email}
    LIMIT 1
  `;

  return users[0];
};

type EmailCodeCopy = {
  description: string;
  operationNote?: string;
  subject: string;
};

type GetEmailCodeCopyParameters = {
  branding: ResolvedEmailBranding;
  purpose: EmailCodePurpose;
};

const getEmailCodeCopy = ({ branding, purpose }: GetEmailCodeCopyParameters): EmailCodeCopy => {
  const siteName = branding.siteName;
  const isEnglish = branding.locale === "en";

  switch (purpose) {
    case "register":
      return isEnglish
        ? {
            description: `Use the code below to finish registering your ${siteName} account.`,
            subject: `${siteName} registration code`,
          }
        : {
            description: `请使用下面的验证码完成 ${siteName} 账号注册。`,
            subject: `${siteName} 注册验证码`,
          };
    case "password_reset":
      return isEnglish
        ? {
            description: `Use the code below to continue resetting your ${siteName} password.`,
            subject: `${siteName} password reset code`,
          }
        : {
            description: `请使用下面的验证码继续找回 ${siteName} 密码。`,
            subject: `${siteName} 找回密码验证码`,
          };
    case "email_change_current":
      return isEnglish
        ? {
            description: `You are changing your ${siteName} account email. Use the code below to verify your current email address.`,
            operationNote:
              "This is the current-email verification code for changing your email address.",
            subject: `${siteName} email change: verify current email`,
          }
        : {
            description: `你正在修改 ${siteName} 账号邮箱，请使用下面的验证码确认当前邮箱归属。`,
            operationNote: "这是修改邮箱操作的旧邮箱验证码，用于确认当前邮箱属于你。",
            subject: `${siteName} 修改邮箱：当前邮箱验证`,
          };
    case "email_change_new":
      return isEnglish
        ? {
            description: `You are changing your ${siteName} account email. Use the code below to verify your new email address.`,
            operationNote:
              "This is the new-email verification code for changing your email address.",
            subject: `${siteName} email change: verify new email`,
          }
        : {
            description: `你正在修改 ${siteName} 账号邮箱，请使用下面的验证码确认新邮箱归属。`,
            operationNote: "这是修改邮箱操作的新邮箱验证码，用于确认新邮箱可以接收安全邮件。",
            subject: `${siteName} 修改邮箱：新邮箱验证`,
          };
    case "password_change":
      return isEnglish
        ? {
            description: `Use the code below to continue changing your ${siteName} account password.`,
            subject: `${siteName} password change code`,
          }
        : {
            description: `请使用下面的验证码继续修改 ${siteName} 账号密码。`,
            subject: `${siteName} 修改密码验证码`,
          };
    default: {
      const exhaustivePurpose: never = purpose;
      throw new Error(`Unhandled email code purpose: ${exhaustivePurpose}`);
    }
  }
};

const issueEmailCode = async ({
  email,
  locale,
  purpose,
  sql,
}: {
  email: string;
  locale?: string;
  purpose: EmailCodePurpose;
  sql: BlogAuthSql;
}) => {
  const code = createNumericCode();
  const expiresAt = addMinutes(new Date(), EMAIL_CODE_MINUTES);
  const branding = await resolveEmailBranding({ locale });
  const copy = getEmailCodeCopy({ branding, purpose });
  const frameCopy = EMAIL_FRAME_COPY[branding.locale];

  await sql`
    INSERT INTO email_verification_codes (email, code_hash, purpose, expires_at)
    VALUES (${email}, ${hashSecret(code)}, ${purpose}, ${expiresAt})
  `;

  const sent = await sendResendEmail({
    branding,
    to: email,
    html: renderVerificationCodeEmailHtml({
      branding,
      code,
      description: copy.description,
      operationNote: copy.operationNote,
      title: copy.subject,
      validMinutes: EMAIL_CODE_MINUTES,
    }),
    subject: copy.subject,
    text: [
      copy.description,
      copy.operationNote,
      frameCopy.plainCodeLine({ code, validMinutes: EMAIL_CODE_MINUTES }),
    ]
      .filter((line) => line !== undefined)
      .join("\n"),
  });

  if (!sent) {
    await sql`
      UPDATE email_verification_codes
      SET consumed_at = now()
      WHERE lower(email) = ${email}
        AND purpose = ${purpose}
        AND code_hash = ${hashSecret(code)}
        AND consumed_at IS NULL
    `;
    throw createAuthError(503, "email-unavailable", "邮件服务暂不可用，请稍后重试。");
  }

  return {
    expiresAt: expiresAt.toISOString(),
    ok: true,
    sent,
    validMinutes: EMAIL_CODE_MINUTES,
  };
};

export const createEmailCode = async ({
  email: rawEmail,
  locale,
  purpose,
}: CreateEmailCodeInput) => {
  const sql = getSql();
  const email = normalizeEmail(rawEmail);
  const existingUser = await findUserByEmail(sql, email);

  if (purpose === "register" && existingUser !== undefined) {
    throw createAuthError(409, "email-exists", "邮箱已被使用。");
  }

  if (purpose === "password_reset" && existingUser === undefined) {
    return {
      expiresAt: addMinutes(new Date(), EMAIL_CODE_MINUTES).toISOString(),
      ok: true,
      sent: false,
      validMinutes: EMAIL_CODE_MINUTES,
    };
  }

  return issueEmailCode({ email, locale, purpose, sql });
};

export const createBlogAccountEmailCode = async (input: CreateAccountEmailCodeInput) => {
  const sql = getSql();
  const email =
    input.purpose === "email_change_new"
      ? normalizeEmail(input.email)
      : normalizeEmail(input.user.email);

  if (input.purpose === "email_change_new") {
    if (email.length === 0) {
      throw createAuthError(400, "invalid-identity", "请输入新邮箱。");
    }

    if (email === normalizeEmail(input.user.email)) {
      throw createAuthError(400, "email-unchanged", "新邮箱不能与当前邮箱一致。");
    }

    const existingUser = await findUserByEmail(sql, email);
    if (existingUser !== undefined && existingUser.id !== input.user.id) {
      throw createAuthError(409, "email-exists", "邮箱已被使用。");
    }
  }

  return issueEmailCode({ email, locale: input.locale, purpose: input.purpose, sql });
};

const consumeEmailCode = async (
  sql: BlogAuthSql,
  email: string,
  code: string,
  purpose: EmailCodePurpose,
) => {
  if (!(await reserveEmailVerificationAttempt({ email, purpose }))) {
    throw createAuthError(400, "invalid-code", "邮箱验证码无效或已过期。");
  }

  const rows = await sql<EmailCodeRow[]>`
    SELECT id, code_hash
    FROM email_verification_codes
    WHERE lower(email) = ${email}
      AND purpose = ${purpose}
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `;
  const row = rows[0];

  if (row === undefined || hashSecret(code.trim()) !== row.codeHash) {
    throw createAuthError(400, "invalid-code", "邮箱验证码无效或已过期。");
  }

  const consumedRows = await sql<{ id: string }[]>`
    UPDATE email_verification_codes
    SET consumed_at = now()
    WHERE id = ${row.id}
      AND consumed_at IS NULL
      AND expires_at > now()
    RETURNING id
  `;
  if (consumedRows[0] === undefined) {
    throw createAuthError(400, "invalid-code", "邮箱验证码无效或已过期。");
  }
};

export const registerBlogUser = async ({
  email: rawEmail,
  emailCode,
  name,
  password,
  username: rawUsername,
}: RegisterBlogUserInput) => {
  assertPasswordLength(password);

  const sql = getSql();
  const username = trimText(rawUsername);
  const email = normalizeEmail(rawEmail);
  if (username.length < 2 || email.length === 0) {
    throw createAuthError(400, "invalid-identity", "请输入用户名和邮箱。");
  }

  const passwordHash = await Bun.password.hash(password);

  return sql.begin<BlogUserProfile>(async (transaction) => {
    await transaction`LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE`;
    await consumeEmailCode(transaction, email, emailCode, "register");

    const usernameCount = await countRows(
      transaction,
      transaction<CountRow[]>`
        SELECT count(*)::text AS count
        FROM users
        WHERE lower(username) = lower(${username})
      `,
    );
    if (usernameCount > 0) {
      throw createAuthError(409, "username-exists", "用户名已被使用。");
    }

    const emailCount = await countRows(
      transaction,
      transaction<CountRow[]>`
        SELECT count(*)::text AS count
        FROM users
        WHERE lower(email) = ${email}
      `,
    );
    if (emailCount > 0) {
      throw createAuthError(409, "email-exists", "邮箱已被使用。");
    }

    const rows = await transaction<BlogUserRow[]>`
	      INSERT INTO users (username, password_hash, email, name, role)
	      VALUES (${username}, ${passwordHash}, ${email}, ${cleanOptionalText(name)}, 'user')
	      RETURNING
	        id,
	        role,
	        username,
	        email,
	        name,
	        avatar_url,
	        bio,
	        tags,
	        blog_url,
		        comment_email_notifications,
		        new_post_email_notifications,
		        created_at,
			        updated_at,
			        last_login_at,
			        last_login_time_zone,
			        last_login_time_zone_offset_minutes,
			        host(last_login_ip) AS last_login_ip,
			        last_login_location,
			        last_login_device,
		        last_login_method
		    `;

    return toBlogUserProfile(rows[0], transaction);
  });
};

export const recordBlogUserLogin = async ({ requestMeta, user }: RecordBlogUserLoginParameters) => {
  const sql = getSql();

  await recordLoginAttempt({
    loginMethod: "password",
    meta: requestMeta,
    sql,
    success: true,
    userId: user.id,
  });

  return mergeBlogUserLoginInfo({
    loginInfo: await readUserLoginInfo({ sql, userId: user.id }),
    user,
  });
};

export const recordBlogUserOAuthLogin = async ({
  loginMethod,
  requestMeta,
  user,
}: RecordBlogUserOAuthLoginParameters) => {
  const sql = getSql();

  await recordLoginAttempt({
    loginMethod,
    meta: requestMeta,
    sql,
    success: true,
    userId: user.id,
  });

  return mergeBlogUserLoginInfo({
    loginInfo: await readUserLoginInfo({ sql, userId: user.id }),
    user,
  });
};

export const loginBlogUser = async ({
  identifier: rawIdentifier,
  password,
  requestMeta,
}: LoginBlogUserParameters) => {
  const sql = getSql();
  const identifier = trimText(rawIdentifier).toLowerCase();
  const users = await sql<BlogLoginUserRow[]>`
	    SELECT
	      id,
	      role,
	      username,
	      email,
	      name,
	      avatar_url,
	      bio,
	      tags,
	      blog_url,
		      comment_email_notifications,
		      new_post_email_notifications,
		      created_at,
			      updated_at,
			      last_login_at,
			      last_login_time_zone,
			      last_login_time_zone_offset_minutes,
			      host(last_login_ip) AS last_login_ip,
			      last_login_location,
			      last_login_device,
		      last_login_method,
		      password_hash
		    FROM users
	    WHERE lower(username) = ${identifier}
       OR lower(email) = ${identifier}
    LIMIT 1
  `;
  const user = users[0];
  const isValidPassword =
    user !== undefined ? await Bun.password.verify(password, user.passwordHash) : false;

  if (user === undefined || !isValidPassword) {
    await recordLoginAttempt({
      failureReason: "INVALID_CREDENTIALS",
      loginMethod: "password",
      meta: requestMeta,
      success: false,
      userId: user?.id,
    });
    throw createAuthError(401, "invalid-credentials", "用户名、邮箱或密码错误。");
  }

  await recordLoginAttempt({
    loginMethod: "password",
    meta: requestMeta,
    success: true,
    userId: user.id,
  });

  return mergeBlogUserLoginInfo({
    loginInfo: await readUserLoginInfo({ sql, userId: user.id }),
    user: await toBlogUserProfile(user, sql),
  });
};

export const createBlogSession = async ({
  loginMethod = "password",
  requestMeta,
  sessionSecret,
  sessionId,
  user,
}: CreateBlogSessionParameters): Promise<BlogAuthSession> => {
  const sql = getSql();

  await sql`
    INSERT INTO auth_sessions (user_id, session_id, token_hash, user_agent, ip, login_method, expires_at)
    VALUES (
      ${user.id},
      ${sessionId},
      ${hashSecret(sessionSecret)},
      ${requestMeta.userAgent},
      ${requestMeta.ip},
      ${loginMethod},
      ${addSeconds(new Date(), env.sessionTtlSeconds)}
    )
  `;

  return { sessionId, sessionSecret };
};

export const getBlogUserBySession = async ({
  sessionSecret,
  sessionId,
}: {
  sessionSecret: string;
  sessionId: string;
}) => {
  const sql = getSql();
  const rows = await sql<BlogUserRow[]>`
	    SELECT
	      users.id,
	      users.role,
	      users.username,
	      users.email,
	      users.name,
	      users.avatar_url,
	      users.bio,
	      users.tags,
	      users.blog_url,
		      users.comment_email_notifications,
		      users.new_post_email_notifications,
		      users.created_at,
			      users.updated_at,
			      users.last_login_at,
			      users.last_login_time_zone,
			      users.last_login_time_zone_offset_minutes,
			      host(users.last_login_ip) AS last_login_ip,
			      users.last_login_location,
			      users.last_login_device,
		      users.last_login_method
		    FROM auth_sessions
    JOIN users
      ON users.id = auth_sessions.user_id
    WHERE auth_sessions.session_id = ${sessionId}
      AND auth_sessions.token_hash = ${hashSecret(sessionSecret)}
      AND auth_sessions.revoked_at IS NULL
      AND auth_sessions.expires_at > now()
    LIMIT 1
  `;

  return rows[0] === undefined ? undefined : toBlogUserProfile(rows[0], sql);
};

const findLoginUserById = async (sql: BlogAuthSql, userId: string) => {
  const rows = await sql<BlogLoginUserRow[]>`
    SELECT
      id,
      role,
      username,
      email,
      name,
      avatar_url,
      bio,
      tags,
      blog_url,
	      comment_email_notifications,
	      new_post_email_notifications,
	      created_at,
		      updated_at,
		      last_login_at,
		      last_login_time_zone,
		      last_login_time_zone_offset_minutes,
		      host(last_login_ip) AS last_login_ip,
		      last_login_location,
		      last_login_device,
	      last_login_method,
	      password_hash
	    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  return rows[0];
};

export const readBlogUserProfileById = async ({
  sql = getSql(),
  userId,
}: {
  sql?: BlogAuthSql;
  userId: string;
}) => {
  const user = await findLoginUserById(sql, userId);
  if (user === undefined) {
    throw createAuthError(404, "invalid-identity", "用户不存在。");
  }

  return toBlogUserProfile(user, sql);
};

export const updateBlogUserProfile = async ({
  profileLocalizations,
  avatarUrl,
  bio,
  blogUrl,
  commentEmailNotifications,
  name,
  newPostEmailNotifications,
  notificationEmailLocale,
  tags,
  userId,
  username: rawUsername,
}: UpdateBlogUserProfileInput & { userId: string }) => {
  const sql = getSql();
  const username = rawUsername?.trim();
  const preparedProfile = profileLocalizations === undefined
    ? undefined
    : await prepareUserProfileLocalizations({
        profile: profileLocalizations,
        deeplApiKey: await readEncryptedSetting("deepl_api_key"),
      });
  const normalizedTags = preparedProfile?.base.tags ?? cleanTags(tags);

  if (username !== undefined && username.length < 2) {
    throw createAuthError(400, "invalid-identity", "请输入至少 2 位用户名。");
  }

  return sql.begin<BlogUserProfile>(async (transaction) => {
    const usernameCount = await countRows(
      transaction,
      transaction<CountRow[]>`
        SELECT count(*)::text AS count
        FROM users
        WHERE lower(username) = lower(${username ?? null})
          AND id <> ${userId}
      `,
    );
    if (username !== undefined && usernameCount > 0) {
      throw createAuthError(409, "username-exists", "用户名已被使用。");
    }

    const rows = await transaction<BlogUserRow[]>`
	      UPDATE users
	      SET
	        username = COALESCE(${username ?? null}, username),
	        name = CASE WHEN ${name === undefined && preparedProfile === undefined} THEN name ELSE ${preparedProfile === undefined ? cleanOptionalText(name) : preparedProfile.base.name} END,
	        avatar_url = CASE WHEN ${avatarUrl === undefined} THEN avatar_url ELSE ${cleanOptionalText(avatarUrl)} END,
	        bio = CASE WHEN ${bio === undefined && preparedProfile === undefined} THEN bio ELSE ${preparedProfile === undefined ? cleanOptionalText(bio) : preparedProfile.base.bio} END,
	        blog_url = CASE WHEN ${blogUrl === undefined} THEN blog_url ELSE ${cleanOptionalText(blogUrl)} END,
	        tags = CASE WHEN ${tags === undefined && preparedProfile === undefined} THEN tags ELSE ${normalizedTags} END,
	        comment_email_notifications = COALESCE(${commentEmailNotifications ?? null}, comment_email_notifications),
	        new_post_email_notifications = COALESCE(${newPostEmailNotifications ?? null}, new_post_email_notifications),
          notification_email_locale = COALESCE(${notificationEmailLocale ?? null}, notification_email_locale),
	        updated_at = now()
	      WHERE id = ${userId}
	      RETURNING
	        id,
	        role,
	        username,
	        email,
	        name,
	        avatar_url,
	        bio,
	        tags,
	        blog_url,
		        comment_email_notifications,
		        new_post_email_notifications,
		        created_at,
			        updated_at,
			        last_login_at,
			        last_login_time_zone,
			        last_login_time_zone_offset_minutes,
			        host(last_login_ip) AS last_login_ip,
			        last_login_location,
			        last_login_device,
		        last_login_method
		    `;
    const row = rows[0];

    if (row === undefined) {
      throw createAuthError(404, "invalid-identity", "用户不存在。");
    }

    if (preparedProfile !== undefined) {
      await upsertUsersEnProfile({ sql: transaction, userId, profile: preparedProfile.english });
    }
    return {
      ...await toBlogUserProfile(row, transaction),
      ...(preparedProfile === undefined ? {} : { profileTranslation: preparedProfile.translation }),
    };
  });
};

export const logoutBlogSession = async ({
  sessionId,
  sessionSecret,
}: {
  sessionId: string;
  sessionSecret: string;
}) => {
  const sql = getSql();

  await sql`
    UPDATE auth_sessions
    SET revoked_at = now()
    WHERE session_id = ${sessionId}
      AND token_hash = ${hashSecret(sessionSecret)}
      AND revoked_at IS NULL
  `;

  return { ok: true };
};

export const changeBlogUserEmail = async ({
  currentEmailCode,
  newEmail: rawNewEmail,
  newEmailCode,
  user,
}: ChangeBlogUserEmailInput) => {
  const sql = getSql();
  const newEmail = normalizeEmail(rawNewEmail);

  if (newEmail.length === 0) {
    throw createAuthError(400, "invalid-identity", "请输入新邮箱。");
  }

  return sql.begin<BlogUserProfile>(async (transaction) => {
    await transaction`LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE`;

    const currentUser = await findLoginUserById(transaction, user.id);
    if (currentUser === undefined) {
      throw createAuthError(404, "invalid-identity", "用户不存在。");
    }

    const currentEmail = normalizeEmail(currentUser.email);
    if (newEmail === currentEmail) {
      throw createAuthError(400, "email-unchanged", "新邮箱不能与当前邮箱一致。");
    }

    const existingUser = await findUserByEmail(transaction, newEmail);
    if (existingUser !== undefined && existingUser.id !== user.id) {
      throw createAuthError(409, "email-exists", "邮箱已被使用。");
    }

    await consumeEmailCode(transaction, currentEmail, currentEmailCode, "email_change_current");
    await consumeEmailCode(transaction, newEmail, newEmailCode, "email_change_new");

    const rows = await transaction<BlogUserRow[]>`
      UPDATE users
      SET email = ${newEmail}
      WHERE id = ${user.id}
      RETURNING
        id,
        role,
        username,
        email,
        name,
        avatar_url,
        bio,
        tags,
        blog_url,
	        comment_email_notifications,
	        new_post_email_notifications,
	        created_at,
		        updated_at,
		        last_login_at,
		        last_login_time_zone,
		        last_login_time_zone_offset_minutes,
		        host(last_login_ip) AS last_login_ip,
		        last_login_location,
		        last_login_device,
	        last_login_method
	    `;
    const row = rows[0];

    if (row === undefined) {
      throw createAuthError(404, "invalid-identity", "用户不存在。");
    }

    return toBlogUserProfile(row, transaction);
  });
};

export const changeBlogUserPassword = async (input: ChangeBlogUserPasswordInput) => {
  assertPasswordLength(input.newPassword);

  const sql = getSql();
  const passwordHash = await Bun.password.hash(input.newPassword);

  await sql.begin(async (transaction) => {
    const currentUser = await findLoginUserById(transaction, input.user.id);
    if (currentUser === undefined) {
      throw createAuthError(404, "invalid-identity", "用户不存在。");
    }

    if (input.method === "password") {
      const isValidPassword = await Bun.password.verify(
        input.currentPassword,
        currentUser.passwordHash,
      );

      if (!isValidPassword) {
        throw createAuthError(401, "invalid-credentials", "当前密码错误。");
      }
    } else {
      await consumeEmailCode(
        transaction,
        normalizeEmail(currentUser.email),
        input.emailCode,
        "password_change",
      );
    }

    await transaction`
      UPDATE users
      SET password_hash = ${passwordHash}
      WHERE id = ${currentUser.id}
    `;

    await transaction`
      UPDATE auth_sessions
      SET revoked_at = now()
      WHERE user_id = ${currentUser.id}
        AND revoked_at IS NULL
    `;
  });

  await deleteAdminSessionsForUser({ userId: input.user.id });

  return { ok: true };
};

export const resetBlogUserPassword = async (input: PasswordResetInput) => {
  assertPasswordLength(input.password);

  const sql = getSql();
  const passwordHash = await Bun.password.hash(input.password);

  const userId = await sql.begin(async (transaction) => {
    const email = normalizeEmail(input.email);
    const user = await findUserByEmail(transaction, email);
    if (user === undefined) {
      throw createAuthError(400, "invalid-code", "邮箱验证码无效或已过期。");
    }

    await consumeEmailCode(transaction, email, input.emailCode, "password_reset");

    await transaction`
      UPDATE users
      SET password_hash = ${passwordHash}
      WHERE id = ${user.id}
    `;

    await transaction`
      UPDATE auth_sessions
      SET revoked_at = now()
      WHERE user_id = ${user.id}
        AND revoked_at IS NULL
    `;
    return user.id;
  });

  await deleteAdminSessionsForUser({ userId });

  return { ok: true };
};
