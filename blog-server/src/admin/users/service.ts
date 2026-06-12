import {
  hashPassword,
  normalizeEmail,
  requireAdmin,
  type AuthUser,
  type UserRole,
} from "../../shared/auth";
import { db, withTransaction, type DbClient } from "../../shared/db";
import { conflict, forbidden, notFound } from "../../shared/errors";
import { toUserProfile, type UserProfileRow } from "../../shared/types/user";

export interface UserListInput {
  search?: string;
  role?: UserRole;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "username" | "lastLoginAt";
  sortOrder?: "asc" | "desc";
}

export interface AdminCreateUserInput {
  username: string;
  password: string;
  email?: string;
  name?: string;
  description?: string;
  tags?: string[];
  role: UserRole;
  avatarUrl?: string;
  socialLinks?: Record<string, string>;
  blogUrl?: string;
}

export interface AdminUpdateUserInput {
  email?: string | null;
  name?: string | null;
  description?: string;
  tags?: string[];
  role?: UserRole;
  avatarUrl?: string | null;
  socialLinks?: Record<string, string>;
  blogUrl?: string | null;
  password?: string;
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
  if (!values) return {};

  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key.trim(), value.trim()])
      .filter(([key, value]) => key && value)
  );
}

function sortClause(sortBy?: UserListInput["sortBy"], sortOrder?: UserListInput["sortOrder"]) {
  const order = sortOrder === "asc" ? "ASC" : "DESC";
  const column =
    sortBy === "username"
      ? "lower(username)"
      : sortBy === "lastLoginAt"
        ? "last_login_at"
        : "created_at";

  return `${column} ${order} NULLS LAST, created_at DESC`;
}

async function getUserById(userId: string, client: DbClient = db) {
  const [row] = await client<UserProfileRow[]>`
    SELECT id, username, email, name, description, tags, role, avatar_url,
           social_links, blog_url, created_at, updated_at, last_login_at,
           host(last_login_ip) AS last_login_ip, last_login_location
    FROM users
    WHERE id = ${userId}
  `;

  if (!row) throw notFound("用户不存在");

  return toUserProfile(row);
}

async function ensureUniqueUserFields(
  input: { username?: string; email?: string | null },
  exceptUserId: string | null,
  client: DbClient
) {
  const username = input.username?.trim().toLowerCase() ?? null;
  const email = input.email ? normalizeEmail(input.email) : null;

  if (!username && !email) return;

  const [existing] = await client.unsafe<{ id: string }[]>(
    `
      SELECT id
      FROM users
      WHERE ($1::text IS NOT NULL AND lower(username) = $1)
         OR ($2::text IS NOT NULL AND lower(email) = $2)
      LIMIT 1
    `,
    [username, email]
  );

  if (existing && existing.id !== exceptUserId) {
    throw conflict("用户名或邮箱已存在");
  }
}

export async function listUsers(
  currentUser: AuthUser,
  input: UserListInput,
  client: DbClient = db
) {
  requireAdmin(currentUser);

  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  const offset = (page - 1) * pageSize;
  const search = input.search?.trim() ? `%${input.search.trim().toLowerCase()}%` : null;
  const role = input.role ?? null;
  const orderBy = sortClause(input.sortBy, input.sortOrder);

  const rows = await client.unsafe<UserProfileRow[]>(
    `
      SELECT id, username, email, name, description, tags, role, avatar_url,
             social_links, blog_url, created_at, updated_at, last_login_at,
             host(last_login_ip) AS last_login_ip, last_login_location
      FROM users
      WHERE ($1::text IS NULL OR lower(username) LIKE $1 OR lower(coalesce(email, '')) LIKE $1 OR lower(coalesce(name, '')) LIKE $1)
        AND ($2::user_role IS NULL OR role = $2)
      ORDER BY ${orderBy}
      LIMIT $3 OFFSET $4
    `,
    [search, role, pageSize, offset]
  );

  const [count] = await client.unsafe<{ total: string }[]>(
    `
      SELECT count(*) AS total
      FROM users
      WHERE ($1::text IS NULL OR lower(username) LIKE $1 OR lower(coalesce(email, '')) LIKE $1 OR lower(coalesce(name, '')) LIKE $1)
        AND ($2::user_role IS NULL OR role = $2)
    `,
    [search, role]
  );

  return {
    ok: true,
    items: rows.map(toUserProfile),
    page,
    pageSize,
    total: Number(count?.total ?? 0),
  };
}

export async function createUserByAdmin(
  currentUser: AuthUser,
  input: AdminCreateUserInput,
  client: DbClient = db
) {
  requireAdmin(currentUser);

  const username = input.username.trim();
  const email = cleanOptional(input.email);
  const tags = cleanTags(input.tags);
  const socialLinks = cleanSocialLinks(input.socialLinks);
  const passwordHash = await hashPassword(input.password);

  let userId = "";

  await withTransaction(async (tx) => {
    await ensureUniqueUserFields({ username, email }, null, tx);

    const [created] = await tx<{ id: string }[]>`
      INSERT INTO users (
        username, password_hash, email, name, description, tags, role,
        avatar_url, social_links, blog_url
      )
      VALUES (
        ${username},
        ${passwordHash},
        ${email},
        ${cleanOptional(input.name)},
        ${input.description?.trim() ?? ""},
        ${tx.array(tags, "TEXT")},
        ${input.role},
        ${cleanOptional(input.avatarUrl)},
        ${JSON.stringify(socialLinks)}::jsonb,
        ${cleanOptional(input.blogUrl)}
      )
      RETURNING id
    `;

    userId = created.id;
  }, client);

  return getUserById(userId, client);
}

export async function updateUserByAdmin(
  currentUser: AuthUser,
  userId: string,
  input: AdminUpdateUserInput,
  client: DbClient = db
) {
  requireAdmin(currentUser);

  if (currentUser.id === userId && input.role && input.role !== "admin") {
    throw forbidden("不能移除自己的管理员权限");
  }

  const email =
    input.email === undefined || input.email === null
      ? input.email
      : normalizeEmail(input.email);
  const tags = input.tags === undefined ? null : cleanTags(input.tags);
  const socialLinks =
    input.socialLinks === undefined ? null : cleanSocialLinks(input.socialLinks);
  const passwordHash = input.password ? await hashPassword(input.password) : null;

  await withTransaction(async (tx) => {
    await getUserById(userId, tx);
    await ensureUniqueUserFields({ email }, userId, tx);

    await tx`
      UPDATE users
      SET email = COALESCE(${email}, email),
          name = COALESCE(${cleanOptional(input.name)}, name),
          description = COALESCE(${input.description?.trim() ?? null}, description),
          tags = COALESCE(${tags ? tx.array(tags, "TEXT") : null}, tags),
          role = COALESCE(${input.role ?? null}, role),
          avatar_url = COALESCE(${cleanOptional(input.avatarUrl)}, avatar_url),
          social_links = COALESCE(${socialLinks ? JSON.stringify(socialLinks) : null}::jsonb, social_links),
          blog_url = COALESCE(${cleanOptional(input.blogUrl)}, blog_url),
          password_hash = COALESCE(${passwordHash}, password_hash)
      WHERE id = ${userId}
    `;

    if (passwordHash) {
      await tx`
        UPDATE auth_sessions
        SET revoked_at = now()
        WHERE user_id = ${userId}
          AND revoked_at IS NULL
      `;
    }
  }, client);

  return getUserById(userId, client);
}

export async function deleteUserByAdmin(
  currentUser: AuthUser,
  userId: string,
  client: DbClient = db
) {
  requireAdmin(currentUser);

  if (currentUser.id === userId) {
    throw forbidden("不能删除自己的账户");
  }

  await withTransaction(async (tx) => {
    await getUserById(userId, tx);
    await tx`
      UPDATE auth_sessions
      SET revoked_at = now()
      WHERE user_id = ${userId}
        AND revoked_at IS NULL
    `;
    await tx`DELETE FROM users WHERE id = ${userId}`;
  }, client);

  return { ok: true };
}

export { getUserById };
