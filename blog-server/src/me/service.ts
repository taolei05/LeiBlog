import { hashPassword, normalizeEmail, verifyPassword } from "../shared/auth";
import { db, withTransaction, type DbClient } from "../shared/db";
import { conflict, unauthorized } from "../shared/errors";
import { toUserProfile, type UserProfileRow } from "../shared/types/user";

export interface UpdateMeInput {
  email?: string | null;
  name?: string | null;
  description?: string;
  tags?: string[];
  avatarUrl?: string | null;
  socialLinks?: Record<string, string>;
  blogUrl?: string | null;
}

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
  const email =
    input.email === undefined || input.email === null
      ? input.email
      : normalizeEmail(input.email);

  if (email) {
    const [existing] = await client<{ id: string }[]>`
      SELECT id
      FROM users
      WHERE lower(email) = ${email}
        AND id <> ${userId}
      LIMIT 1
    `;

    if (existing) throw conflict("邮箱已被使用");
  }

  const tags = input.tags === undefined ? undefined : cleanTags(input.tags);
  const socialLinks = cleanSocialLinks(input.socialLinks);

  await client`
    UPDATE users
    SET email = COALESCE(${email}, email),
        name = COALESCE(${cleanOptional(input.name)}, name),
        description = COALESCE(${input.description?.trim()}, description),
        tags = COALESCE(${tags ? client.array(tags, "TEXT") : null}, tags),
        avatar_url = COALESCE(${cleanOptional(input.avatarUrl)}, avatar_url),
        social_links = COALESCE(${socialLinks ? JSON.stringify(socialLinks) : null}::jsonb, social_links),
        blog_url = COALESCE(${cleanOptional(input.blogUrl)}, blog_url)
    WHERE id = ${userId}
  `;

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
