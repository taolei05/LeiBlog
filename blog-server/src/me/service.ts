import type { AuthUser } from "../shared/auth";
import type { DbClient } from "../shared/db";
import type { UserProfileRow } from "../shared/types/user";

import { uploadUserAvatar } from "../admin/media/service";
import { renderVerificationCodeEmailHtml, sendResendEmail } from "../auth/service";
import {
  createNumericCode,
  hashPassword,
  hashToken,
  normalizeEmail,
  verifyPassword,
} from "../shared/auth";
import { appConfig } from "../shared/config";
import { db, withTransaction } from "../shared/db";
import { conflict, forbidden, unauthorized, validationError } from "../shared/errors";
import { addMinutes } from "../shared/time";
import { toUserProfile } from "../shared/types/user";

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
           host(last_login_ip) AS last_login_ip, last_login_location, last_login_device
    FROM users
    WHERE id = ${userId}
  `;

  if (!row) throw unauthorized("用户不存在");

  return toUserProfile(row);
}

export async function updateMe(
  currentUser: AuthUser | string,
  input: UpdateMeInput,
  client: DbClient = db
) {
  const userId = typeof currentUser === "string" ? currentUser : currentUser.id;
  const currentRole =
    typeof currentUser === "string" && input.socialLinks !== undefined
      ? (await getUserProfile(userId, client)).role
      : typeof currentUser === "string"
        ? null
        : currentUser.role;

  if (input.socialLinks !== undefined && currentRole !== "admin") {
    throw forbidden("只有管理员可以设置社交链接");
  }

  const tags = input.tags === undefined ? undefined : cleanTags(input.tags);
  const socialLinks = cleanSocialLinks(input.socialLinks);
  const name = cleanOptional(input.name);
  const description = input.description?.trim() ?? "";
  const avatarUrl = cleanOptional(input.avatarUrl);
  const blogUrl = cleanOptional(input.blogUrl);

  await client`
    UPDATE users
    SET name = CASE WHEN ${input.name !== undefined} THEN ${name} ELSE name END,
        description = CASE WHEN ${input.description !== undefined} THEN ${description} ELSE description END,
        tags = CASE WHEN ${tags !== undefined} THEN ${client.array(tags ?? [], "TEXT")} ELSE tags END,
        avatar_url = CASE WHEN ${input.avatarUrl !== undefined} THEN ${avatarUrl} ELSE avatar_url END,
        social_links = CASE
          WHEN ${input.socialLinks !== undefined} THEN ${JSON.stringify(socialLinks ?? {})}::jsonb
          ELSE social_links
        END,
        blog_url = CASE WHEN ${input.blogUrl !== undefined} THEN ${blogUrl} ELSE blog_url END,
        updated_at = now()
    WHERE id = ${userId}
  `;

  return getUserProfile(userId, client);
}

export async function uploadMyAvatar(
  userId: string,
  input: { file: File },
  client: DbClient = db
) {
  const item = await uploadUserAvatar(userId, { file: input.file }, { client });

  return {
    accessUrl: item.accessUrl,
    ok: true,
  };
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
  const expiresAt = addMinutes(new Date(), EMAIL_CHANGE_CODE_MINUTES);

  await client`
    INSERT INTO email_change_requests (user_id, new_email, code_hash, expires_at)
    VALUES (
      ${userId},
      ${email},
      ${hashToken(code)},
      ${expiresAt}
    )
  `;

  const sent = await sendResendEmail(client, {
    to: email,
    html: renderVerificationCodeEmailHtml({
      code,
      description: "请使用下面的验证码确认新的邮箱地址。",
      title: "LeiBlog 邮箱变更验证码",
      validMinutes: EMAIL_CHANGE_CODE_MINUTES,
    }),
    subject: "LeiBlog 邮箱变更验证码",
    text: `验证码：${code}，${EMAIL_CHANGE_CODE_MINUTES} 分钟内有效。`,
  });

  return {
    expiresAt: expiresAt.toISOString(),
    ok: true,
    sent,
    validMinutes: EMAIL_CHANGE_CODE_MINUTES,
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
