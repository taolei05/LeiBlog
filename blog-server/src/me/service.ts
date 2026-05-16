import { sendResendEmail } from "../auth/service";
import {
  createNumericCode,
  hashPassword,
  hashToken,
  normalizeEmail,
  verifyPassword,
} from "../shared/auth";
import { appConfig } from "../shared/config";
import { db, withTransaction, type DbClient } from "../shared/db";
import { conflict, unauthorized, validationError } from "../shared/errors";
import { addMinutes } from "../shared/time";
import { toUserProfile, type UserProfileRow } from "../shared/types/user";

export interface UpdateMeInput {
  name?: string | null;
  description?: string;
  tags?: string[];
  avatarUrl?: string | null;
  socialLinks?: Record<string, string>;
  blogUrl?: string | null;
}

export interface EmailChangeInput {
  email: string;
}

export interface ConfirmEmailChangeInput extends EmailChangeInput {
  emailCode: string;
}

const EMAIL_CHANGE_CODE_MINUTES = 10;

function cleanOptional(value: string | null | undefined) {
  if (value === null) return null;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanTags(values: string[] | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function cleanSocialLinks(values: Record<string, string> | undefined) {
  if (!values) return undefined;

  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key.trim(), value.trim()])
      .filter(([key, value]) => key && value)
  );
}

export async function getUserProfile(userId: string, client: DbClient = db) {
  const [row] = await client<UserProfileRow[]>`
    SELECT id, username, email, name, description, tags, role, avatar_url,
           social_links, blog_url, created_at, updated_at, last_login_at,
           host(last_login_ip) AS last_login_ip
    FROM users
    WHERE id = ${userId}
  `;

  if (!row) throw unauthorized("用户不存在");

  return toUserProfile(row);
}

export async function updateMe(
  userId: string,
  input: UpdateMeInput,
  client: DbClient = db
) {
  const tags = input.tags === undefined ? undefined : cleanTags(input.tags);
  const socialLinks = cleanSocialLinks(input.socialLinks);

  await client`
    UPDATE users
    SET name = COALESCE(${cleanOptional(input.name)}, name),
        description = COALESCE(${input.description?.trim()}, description),
        tags = COALESCE(${tags ? client.array(tags, "TEXT") : null}, tags),
        avatar_url = COALESCE(${cleanOptional(input.avatarUrl)}, avatar_url),
        social_links = COALESCE(${socialLinks ? JSON.stringify(socialLinks) : null}::jsonb, social_links),
        blog_url = COALESCE(${cleanOptional(input.blogUrl)}, blog_url)
    WHERE id = ${userId}
  `;

  return getUserProfile(userId, client);
}

async function ensureEmailAvailable(email: string, userId: string, client: DbClient) {
  const [existing] = await client<{ id: string }[]>`
    SELECT id
    FROM users
    WHERE lower(email) = ${email}
      AND id <> ${userId}
    LIMIT 1
  `;

  if (existing) throw conflict("邮箱已被使用");
}

export async function requestEmailChangeCode(
  userId: string,
  input: EmailChangeInput,
  client: DbClient = db
) {
  const email = normalizeEmail(input.email);
  await ensureEmailAvailable(email, userId, client);

  const code = createNumericCode();

  await client`
    INSERT INTO email_change_requests (user_id, new_email, code_hash, expires_at)
    VALUES (
      ${userId},
      ${email},
      ${hashToken(code)},
      ${addMinutes(new Date(), EMAIL_CHANGE_CODE_MINUTES)}
    )
  `;

  const sent = await sendResendEmail(client, {
    to: email,
    subject: "LeiBlog 邮箱变更验证码",
    text: `验证码：${code}，${EMAIL_CHANGE_CODE_MINUTES} 分钟内有效。`,
  });

  return {
    ok: true,
    sent,
    ...(appConfig.isProduction || sent ? {} : { devCode: code }),
  };
}

export async function confirmEmailChange(
  userId: string,
  input: ConfirmEmailChangeInput,
  client: DbClient = db
) {
  const email = normalizeEmail(input.email);

  await withTransaction(async (tx) => {
    await ensureEmailAvailable(email, userId, tx);

    const [request] = await tx<{ id: string; code_hash: string }[]>`
      SELECT id, code_hash
      FROM email_change_requests
      WHERE user_id = ${userId}
        AND lower(new_email) = ${email}
        AND consumed_at IS NULL
        AND expires_at > now()
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!request || hashToken(input.emailCode) !== request.code_hash) {
      throw validationError("邮箱验证码无效或已过期");
    }

    await tx`
      UPDATE users
      SET email = ${email}
      WHERE id = ${userId}
    `;

    await tx`
      UPDATE email_change_requests
      SET consumed_at = now()
      WHERE id = ${request.id}
    `;
  }, client);

  return getUserProfile(userId, client);
}

export async function changeMyPassword(
  userId: string,
  input: { currentPassword: string; newPassword: string },
  client: DbClient = db
) {
  await withTransaction(async (tx) => {
    const [row] = await tx<{ password_hash: string }[]>`
      SELECT password_hash
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (!row || !(await verifyPassword(input.currentPassword, row.password_hash))) {
      throw unauthorized("当前密码错误");
    }

    await tx`
      UPDATE users
      SET password_hash = ${await hashPassword(input.newPassword)}
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
