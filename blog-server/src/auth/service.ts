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
  input: { to: string; subject: string; text: string }
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

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
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

async function resolveLoginLocation(meta: RequestMeta, client: DbClient) {
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
}: RequestMetaInput): RequestMeta {
  const forwarded = readForwardedIp(headers["x-forwarded-for"]);
  const realIp = normalizeIp(headers["x-real-ip"]);
  const directIp = normalizeIp(requestIp);

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

  await client`
    INSERT INTO email_verification_codes (email, code_hash, purpose, expires_at)
    VALUES (
      ${email},
      ${hashToken(code)},
      ${input.purpose},
      ${addMinutes(new Date(), EMAIL_CODE_MINUTES)}
    )
  `;

  const sent = await sendResendEmail(client, {
    to: email,
    subject:
      options.emailSubject ??
      (input.purpose === "register"
        ? "LeiBlog 注册验证码"
        : input.purpose === "email_change"
          ? "LeiBlog 邮箱变更验证码"
          : "LeiBlog 找回密码验证码"),
    text:
      options.emailText?.(code, EMAIL_CODE_MINUTES) ??
      `验证码：${code}，${EMAIL_CODE_MINUTES} 分钟内有效。`,
  });

  return {
    ok: true,
    sent,
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
  input: { token: string; password: string },
  options: AuthServiceOptions = {}
) {
  const client = options.client ?? db;
  const passwordHash = await hashPassword(input.password);

  await withTransaction(async (tx) => {
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
      UPDATE users
      SET password_hash = ${passwordHash}
      WHERE id = ${row.user_id}
    `;

    await tx`
      UPDATE password_reset_tokens
      SET consumed_at = now()
      WHERE id = ${row.id}
    `;

    await tx`
      UPDATE auth_sessions
      SET revoked_at = now()
      WHERE user_id = ${row.user_id}
        AND revoked_at IS NULL
    `;
  }, client);

  return { ok: true };
}
