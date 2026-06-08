import { isIP } from "node:net";

import type { UserRole } from "../shared/auth";
import {
  createNumericCode,
  createRandomToken,
  hashPassword,
  hashToken,
  normalizeEmail,
  verifyPassword,
} from "../shared/auth";
import { appConfig } from "../shared/config";
import type { StoredEncryptedSecret } from "../shared/crypto";
import { decryptSecret } from "../shared/crypto";
import type { DbClient } from "../shared/db";
import { db, withTransaction } from "../shared/db";
import { conflict, unauthorized, validationError } from "../shared/errors";
import { addDays, addMinutes } from "../shared/time";
import type { UserProfileRow } from "../shared/types/user";
import { toUserProfile } from "../shared/types/user";

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export interface RequestMetaInput {
  headers: Record<string, string | undefined>;
  requestIp?: string | null;
  trustedProxyIps?: string[];
}

export interface AuthUserInput {
  username: string;
  password: string;
  email: string;
  emailCode: string;
  name?: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export type PasswordResetInput =
  | {
      password: string;
      token: string;
    }
  | {
      email: string;
      emailCode: string;
      password: string;
    };

export interface SignableUser {
  id: string;
  username: string;
  role: UserRole;
}

interface LoginUserRow extends UserProfileRow {
  password_hash: string;
}

interface EmailCodePurpose {
  purpose: "register" | "password_reset" | "email_change";
}

interface ResendConfigRow {
  resend_domain: string | null;
  resend_api_key_encrypted: StoredEncryptedSecret | null;
}

interface IpGeolocationConfigRow {
  ipgeolocation_api_key_encrypted: StoredEncryptedSecret | null;
}

interface AuthServiceOptions {
  client?: DbClient;
  emailHtml?: (code: string, validMinutes: number) => string;
  emailSubject?: string;
  emailText?: (code: string, validMinutes: number) => string;
}

const SESSION_DAYS = 7;
const EMAIL_CODE_MINUTES = 10;
const RESET_TOKEN_MINUTES = 30;

function cleanOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderTextLines(text: string) {
  return text
    .split("\n")
    .map((line) => `<p style="margin:0 0 10px;color:#52525b;font-size:15px;line-height:1.7;">${escapeHtml(line)}</p>`)
    .join("");
}

export function renderLeiBlogEmailHtml({
  bodyHtml,
  preheader,
  title,
}: {
  bodyHtml: string;
  preheader: string;
  title: string;
}) {
  return `<!doctype html>
<html lang="zh-CN">
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
                    <td style="width:34px;height:34px;border:1px solid #111827;border-radius:10px;background:#fff;color:#111827;font-size:16px;font-weight:800;line-height:34px;text-align:center;">L</td>
                    <td style="padding-left:9px;color:#111827;font-size:16px;font-weight:800;line-height:1.2;">LeiBlog</td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;color:#ec4899;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;line-height:1.4;">Security Mail</p>
                <h1 style="margin:0;color:#09090b;font-size:24px;line-height:1.22;font-weight:900;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 22px 24px;">
                ${bodyHtml}
                <div style="margin-top:22px;padding-top:16px;border-top:1px solid #ececf0;">
                  <p style="margin:0;color:#71717a;font-size:12px;line-height:1.7;">这封邮件由 LeiBlog 自动发送。如果不是你本人操作，可以忽略此邮件。</p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderPlainEmailHtml({
  subject,
  text,
}: {
  subject: string;
  text: string;
}) {
  return renderLeiBlogEmailHtml({
    bodyHtml: renderTextLines(text),
    preheader: text,
    title: subject,
  });
}

export function renderVerificationCodeEmailHtml({
  code,
  description,
  title,
  validMinutes,
}: {
  code: string;
  description: string;
  title: string;
  validMinutes: number;
}) {
  const codeDigits = code
    .split("")
    .map(
      (digit) =>
        `<td style="padding:0 3px 0 0;"><div style="display:block;padding:9px 0;border:1px solid #d4d4d8;border-radius:10px;background:#f4f4f5;color:#09090b;font-size:21px;font-weight:900;text-align:center;line-height:1.1;">${escapeHtml(digit)}</div></td>`
    )
    .join("");

  return renderLeiBlogEmailHtml({
    bodyHtml: `
      <p style="margin:0 0 16px;color:#52525b;font-size:14px;line-height:1.65;">${escapeHtml(description)}</p>
      <div style="margin:18px 0 16px;padding:14px;border:1px solid #f0abfc;border-radius:16px;background:#fdf4ff;">
        <p style="margin:0 0 10px;color:#86198f;font-size:13px;font-weight:800;line-height:1.4;">验证码</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:330px;table-layout:fixed;border-collapse:separate;">
          <tr>${codeDigits}</tr>
        </table>
      </div>
      <p style="margin:0;color:#71717a;font-size:13px;line-height:1.65;">验证码 ${validMinutes} 分钟内有效，请不要转发或泄露给他人。</p>
    `,
    preheader: `${description} 验证码 ${validMinutes} 分钟内有效。`,
    title,
  });
}

function renderTokenEmailHtml({
  description,
  title,
  token,
  validMinutes,
}: {
  description: string;
  title: string;
  token: string;
  validMinutes: number;
}) {
  return renderLeiBlogEmailHtml({
    bodyHtml: `
      <p style="margin:0 0 18px;color:#52525b;font-size:15px;line-height:1.7;">${escapeHtml(description)}</p>
      <div style="margin:20px 0 18px;padding:18px;border:1px solid #d4d4d8;border-radius:18px;background:#f4f4f5;">
        <p style="margin:0 0 10px;color:#3f3f46;font-size:13px;font-weight:800;">重置 Token</p>
        <p style="margin:0;color:#09090b;font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:14px;line-height:1.7;word-break:break-all;">${escapeHtml(token)}</p>
      </div>
      <p style="margin:0;color:#71717a;font-size:14px;line-height:1.7;">Token ${validMinutes} 分钟内有效，请在有效期内完成密码重置。</p>
    `,
    preheader: `${description} Token ${validMinutes} 分钟内有效。`,
    title,
  });
}

export function renderNoticeEmailHtml({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return renderLeiBlogEmailHtml({
    bodyHtml: `
      <p style="margin:0 0 18px;color:#52525b;font-size:15px;line-height:1.7;">${escapeHtml(description)}</p>
      <div style="margin:20px 0 0;padding:16px 18px;border:1px solid #bbf7d0;border-radius:18px;background:#f0fdf4;color:#166534;font-size:14px;font-weight:800;">配置检测已完成</div>
    `,
    preheader: description,
    title,
  });
}

async function getResendConfig(client: DbClient) {
  const [config] = await client<ResendConfigRow[]>`
    SELECT resend_domain, resend_api_key_encrypted
    FROM site_config
    WHERE id = 1
  `;

  if (!config?.resend_domain || !config.resend_api_key_encrypted) return null;

  const apiKey = decryptSecret(config.resend_api_key_encrypted);
  if (!apiKey) return null;

  return {
    domain: config.resend_domain,
    apiKey,
  };
}

export async function sendResendEmail(
  client: DbClient,
  input: { html?: string; subject: string; text: string; to: string }
) {
  const config = await getResendConfig(client);
  if (!config) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `LeiBlog <no-reply@${config.domain}>`,
      html: input.html ?? renderPlainEmailHtml({ subject: input.subject, text: input.text }),
      to: [input.to],
      subject: input.subject,
      text: input.text,
    }),
  });

  if (!response.ok) {
    throw validationError("邮件发送失败");
  }

  return true;
}

function normalizeIp(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const unwrapped = trimmed.match(/^\[([^\]]+)\]$/)?.[1] ?? trimmed;
  return isIP(unwrapped) ? unwrapped : null;
}

function readForwardedIp(value: string | undefined) {
  return value
    ?.split(",")
    .map((candidate) => normalizeIp(candidate))
    .find((candidate) => candidate !== null) ?? null;
}

function ipv4ToNumber(ip: string) {
  if (isIP(ip) !== 4) return null;

  return ip
    .split(".")
    .map(Number)
    .reduce((value, octet) => ((value << 8) + octet) >>> 0, 0);
}

function isIpv4CidrMatch(ip: string, cidr: string) {
  const [range, prefixRaw, extra] = cidr.split("/");
  if (extra !== undefined || !range || !prefixRaw) return false;

  const prefix = Number(prefixRaw);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;

  const ipNumber = ipv4ToNumber(ip);
  const rangeNumber = ipv4ToNumber(range);
  if (ipNumber === null || rangeNumber === null) return false;

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return ((ipNumber & mask) >>> 0) === ((rangeNumber & mask) >>> 0);
}

function isTrustedProxyIp(ip: string, trustedProxyIps: string[]) {
  return trustedProxyIps.some((trustedIp) => trustedIp === ip || isIpv4CidrMatch(ip, trustedIp));
}

export function isPrivateIp(ip: string): boolean {
  const ipVersion = isIP(ip);
  if (ipVersion === 4) {
    const [first, second] = ip.split(".").map(Number);
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }
  if (ipVersion !== 6) return false;

  const normalized = ip.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    const mappedIpv4 = normalized.slice("::ffff:".length);
    return isIP(mappedIpv4) === 4 ? isPrivateIp(mappedIpv4) : false;
  }

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized)
  );
}

async function getIpGeolocationApiKey(client: DbClient) {
  const [config] = await client<IpGeolocationConfigRow[]>`
    SELECT ipgeolocation_api_key_encrypted
    FROM site_config
    WHERE id = 1
  `;

  return decryptSecret(config?.ipgeolocation_api_key_encrypted);
}

export async function resolveLoginLocation(meta: RequestMeta, client: DbClient) {
  if (!meta.ip || isPrivateIp(meta.ip)) return null;

  const apiKey = await getIpGeolocationApiKey(client);
  if (!apiKey) return null;

  const apiUrl = new URL("https://api.ipgeolocation.io/ipgeo");
  apiUrl.searchParams.set("apiKey", apiKey);
  apiUrl.searchParams.set("ip", meta.ip);
  apiUrl.searchParams.set("lang", "cn");

  try {
    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;

    const location: unknown = await response.json();
    return location && typeof location === "object" && !Array.isArray(location)
      ? location
      : null;
  } catch {
    return null;
  }
}

export function getRequestMeta({
  headers,
  requestIp,
  trustedProxyIps = appConfig.trustedProxyIps,
}: RequestMetaInput): RequestMeta {
  const directIp = normalizeIp(requestIp);
  const trustsProxy = directIp !== null && isTrustedProxyIp(directIp, trustedProxyIps);
  const forwarded = trustsProxy ? readForwardedIp(headers["x-forwarded-for"]) : null;
  const realIp = trustsProxy ? normalizeIp(headers["x-real-ip"]) : null;

  return {
    ip: forwarded ?? realIp ?? directIp,
    userAgent: headers["user-agent"] ?? null,
  };
}

async function getUserProfileById(userId: string, client: DbClient = db) {
  const [row] = await client<UserProfileRow[]>`
    SELECT id, username, email, name, description, tags, role, avatar_url,
           social_links, blog_url, created_at, updated_at, last_login_at,
           host(last_login_ip) AS last_login_ip, last_login_location,
           last_login_device
    FROM users
    WHERE id = ${userId}
  `;

  if (!row) throw unauthorized("用户不存在");

  return toUserProfile(row);
}

export async function consumeEmailCode(
  email: string,
  code: string,
  purpose: EmailCodePurpose["purpose"],
  client: DbClient
) {
  const [row] = await client<{ id: string; code_hash: string }[]>`
    SELECT id, code_hash
    FROM email_verification_codes
    WHERE lower(email) = ${normalizeEmail(email)}
      AND purpose = ${purpose}
      AND consumed_at IS NULL
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (!row || hashToken(code) !== row.code_hash) {
    throw validationError("邮箱验证码无效或已过期");
  }

  await client`
    UPDATE email_verification_codes
    SET consumed_at = now()
    WHERE id = ${row.id}
  `;
}

export async function createEmailCode(
  input: { email: string } & EmailCodePurpose,
  options: AuthServiceOptions = {}
) {
  const client = options.client ?? db;
  const email = normalizeEmail(input.email);
  const code = createNumericCode();
  const expiresAt = addMinutes(new Date(), EMAIL_CODE_MINUTES);

  await client`
    INSERT INTO email_verification_codes (email, code_hash, purpose, expires_at)
    VALUES (
      ${email},
      ${hashToken(code)},
      ${input.purpose},
      ${expiresAt}
    )
  `;

  const fallbackSubject =
    input.purpose === "register"
      ? "LeiBlog 注册验证码"
      : input.purpose === "email_change"
        ? "LeiBlog 邮箱变更验证码"
        : "LeiBlog 找回密码验证码";
  const fallbackDescription =
    input.purpose === "register"
      ? "请使用下面的验证码完成 LeiBlog 账号注册。"
      : input.purpose === "email_change"
        ? "请使用下面的验证码完成邮箱验证。"
        : "请使用下面的验证码继续找回密码流程。";
  const subject = options.emailSubject ?? fallbackSubject;
  const text =
    options.emailText?.(code, EMAIL_CODE_MINUTES) ??
    `验证码：${code}，${EMAIL_CODE_MINUTES} 分钟内有效。`;
  const html =
    options.emailHtml?.(code, EMAIL_CODE_MINUTES) ??
    renderVerificationCodeEmailHtml({
      code,
      description: fallbackDescription,
      title: subject,
      validMinutes: EMAIL_CODE_MINUTES,
    });

  const sent = await sendResendEmail(client, {
    to: email,
    html,
    subject,
    text,
  });

  return {
    expiresAt: expiresAt.toISOString(),
    ok: true,
    sent,
    validMinutes: EMAIL_CODE_MINUTES,
    ...(appConfig.isProduction || sent ? {} : { devCode: code }),
  };
}

export async function registerUser(
  input: AuthUserInput,
  options: AuthServiceOptions = {}
) {
  const client = options.client ?? db;
  const email = normalizeEmail(input.email);
  const username = input.username.trim();
  const passwordHash = await hashPassword(input.password);

  let userId = "";

  await withTransaction(async (tx) => {
    await consumeEmailCode(email, input.emailCode, "register", tx);

    const [existing] = await tx<{ id: string }[]>`
      SELECT id
      FROM users
      WHERE lower(username) = ${username.toLowerCase()}
         OR lower(email) = ${email}
      LIMIT 1
    `;

    if (existing) {
      throw conflict("用户名或邮箱已存在");
    }

    const [created] = await tx<{ id: string }[]>`
      INSERT INTO users (username, password_hash, email, name, role)
      VALUES (
        ${username},
        ${passwordHash},
        ${email},
        ${cleanOptional(input.name)},
        'user'
      )
      RETURNING id
    `;

    userId = created.id;
  }, client);

  return getUserProfileById(userId, client);
}

export async function verifyLogin(
  input: LoginInput,
  meta: RequestMeta,
  options: AuthServiceOptions = {}
) {
  const client = options.client ?? db;
  const identifier = input.identifier.trim().toLowerCase();

  const [user] = await client<LoginUserRow[]>`
    SELECT id, username, password_hash, email, name, description, tags, role,
           avatar_url, social_links, blog_url, created_at, updated_at,
           last_login_at, host(last_login_ip) AS last_login_ip
    FROM users
    WHERE lower(username) = ${identifier}
       OR lower(email) = ${identifier}
    LIMIT 1
  `;

  const isValid = user
    ? await verifyPassword(input.password, user.password_hash)
    : false;
  const location = isValid ? await resolveLoginLocation(meta, client) : null;
  const device = { userAgent: meta.userAgent };

  await client`
    INSERT INTO login_audit_logs (
      user_id, ip, location, device, user_agent, success, failure_reason
    )
    VALUES (
      ${user?.id ?? null},
      ${meta.ip},
      ${location}::jsonb,
      ${device}::jsonb,
      ${meta.userAgent},
      ${isValid},
      ${isValid ? null : "INVALID_CREDENTIALS"}
    )
  `;

  if (!user || !isValid) {
    throw unauthorized("用户名、邮箱或密码错误");
  }

  await client`
    UPDATE users
    SET last_login_at = now(),
        last_login_ip = ${meta.ip},
        last_login_location = ${location}::jsonb,
        last_login_device = ${device}::jsonb
    WHERE id = ${user.id}
  `;

  return toUserProfile({
    ...user,
    last_login_at: new Date(),
    last_login_ip: meta.ip,
    last_login_location: location,
    last_login_device: device,
  });
}

export async function createAuthSession(
  user: SignableUser,
  token: string,
  meta: RequestMeta,
  options: AuthServiceOptions = {}
) {
  const client = options.client ?? db;

  await client`
    INSERT INTO auth_sessions (user_id, token_hash, user_agent, ip, expires_at)
    VALUES (
      ${user.id},
      ${hashToken(token)},
      ${meta.userAgent},
      ${meta.ip},
      ${addDays(new Date(), SESSION_DAYS)}
    )
  `;
}

export async function revokeAuthSession(
  token: string,
  options: AuthServiceOptions = {}
) {
  const client = options.client ?? db;

  await client`
    UPDATE auth_sessions
    SET revoked_at = now()
    WHERE token_hash = ${hashToken(token)}
      AND revoked_at IS NULL
  `;

  return { ok: true };
}

export async function createPasswordResetToken(
  email: string,
  options: AuthServiceOptions = {}
) {
  const client = options.client ?? db;
  const normalizedEmail = normalizeEmail(email);
  const token = createRandomToken(40);

  const [user] = await client<{ id: string }[]>`
    SELECT id
    FROM users
    WHERE lower(email) = ${normalizedEmail}
    LIMIT 1
  `;

  if (user) {
    await client`
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES (
        ${user.id},
        ${hashToken(token)},
        ${addMinutes(new Date(), RESET_TOKEN_MINUTES)}
      )
    `;

    const sent = await sendResendEmail(client, {
      to: normalizedEmail,
      html: renderTokenEmailHtml({
        description: "你正在请求重置 LeiBlog 账号密码。复制下面的重置 Token 继续完成操作。",
        title: "LeiBlog 密码重置",
        token,
        validMinutes: RESET_TOKEN_MINUTES,
      }),
      subject: "LeiBlog 密码重置",
      text: `密码重置 token：${token}，${RESET_TOKEN_MINUTES} 分钟内有效。`,
    });

    return {
      ok: true,
      sent,
      ...(appConfig.isProduction || sent ? {} : { devToken: token }),
    };
  }

  return {
    ok: true,
    sent: false,
    ...(appConfig.isProduction || !user ? {} : { devToken: token }),
  };
}

export async function resetPassword(
  input: PasswordResetInput,
  options: AuthServiceOptions = {}
) {
  const client = options.client ?? db;
  const passwordHash = await hashPassword(input.password);

  await withTransaction(async (tx) => {
    let userId = "";

    if ("token" in input) {
      const [row] = await tx<{ id: string; user_id: string }[]>`
        SELECT id, user_id
        FROM password_reset_tokens
        WHERE token_hash = ${hashToken(input.token)}
          AND consumed_at IS NULL
          AND expires_at > now()
        LIMIT 1
      `;

      if (!row) throw validationError("重置链接无效或已过期");

      await tx`
        UPDATE password_reset_tokens
        SET consumed_at = now()
        WHERE id = ${row.id}
      `;
      userId = row.user_id;
    } else {
      const email = normalizeEmail(input.email);
      const [user] = await tx<{ id: string }[]>`
        SELECT id
        FROM users
        WHERE lower(email) = ${email}
        LIMIT 1
      `;

      if (!user) throw validationError("邮箱验证码无效或已过期");

      await consumeEmailCode(email, input.emailCode, "password_reset", tx);
      userId = user.id;
    }

    await tx`
      UPDATE users
      SET password_hash = ${passwordHash}
      WHERE id = ${userId}
    `;

    await tx`
      UPDATE auth_sessions
      SET revoked_at = now()
      WHERE user_id = ${userId}
        AND revoked_at IS NULL
    `;
  }, client);

  return { ok: true };
}
