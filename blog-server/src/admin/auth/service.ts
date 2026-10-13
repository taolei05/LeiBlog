import { createHash } from "node:crypto";

import type { Sql, TransactionSql } from "postgres";

import { getSql } from "../../shared/db/postgres";
import { getRedisClient } from "../../shared/db/redis";
import { env } from "../../shared/env";
import { recordLoginAttempt } from "../../shared/login-metadata";
import {
  DEFAULT_USER_PROFILE_LOCALE,
  normalizeProfileTagLocale,
  readLocalizedUserProfile,
} from "../../shared/profile-tags";
import type { RequestMeta } from "../../shared/request-meta";
import type { AdminProfile, AdminSessionPayload, UserRecord } from "./types";
import { USER_ROLE } from "./types";

const ADMIN_SESSION_PREFIX = "admin:session:";

type LoginAdminParams = {
  identifier: string;
  locale?: string | null;
  password: string;
  requestMeta: RequestMeta;
};

type CreateAdminSessionParams = {
  user: AdminProfile;
};

type ReadAdminSessionParams = {
  sessionId: string;
};

type DeleteAdminSessionParams = {
  sessionId: string;
};

type DeleteAdminSessionsForUserParams = {
  userId: string;
};

export const toAdminProfile = (row: UserRecord) => {
  if (row.role !== USER_ROLE.Admin) {
    return undefined;
  }

  const profile: AdminProfile = {
    id: row.id,
    role: row.role,
    username: row.username,
    email: row.email,
    tags: row.tags,
    commentEmailNotifications: row.commentEmailNotifications,
    newPostEmailNotifications: row.newPostEmailNotifications,
  };

  if (row.name !== null) {
    profile.name = row.name;
  }

  if (row.avatarUrl !== null) {
    profile.avatarUrl = row.avatarUrl;
  }

  if (row.bio !== null) {
    profile.bio = row.bio;
  }

  if (row.blogUrl !== null) {
    profile.blogUrl = row.blogUrl;
  }

  return profile;
};

type ToLocalizedAdminProfileParameters = {
  locale?: string | null;
  row: UserRecord;
  sql: Sql | TransactionSql;
};

export const toLocalizedAdminProfile = async ({
  locale,
  row,
  sql,
}: ToLocalizedAdminProfileParameters) => {
  const profile = toAdminProfile(row);
  if (profile === undefined) {
    return undefined;
  }

  const localizedProfile = await readLocalizedUserProfile({
    base: {
      name: row.name,
      bio: row.bio,
      tags: row.tags,
    },
    locale: normalizeProfileTagLocale(locale ?? DEFAULT_USER_PROFILE_LOCALE),
    sql,
    userId: row.id,
  });
  profile.tags = localizedProfile.tags;

  if (localizedProfile.name.length > 0) {
    profile.name = localizedProfile.name;
  } else {
    delete profile.name;
  }

  if (localizedProfile.bio.length > 0) {
    profile.bio = localizedProfile.bio;
  } else {
    delete profile.bio;
  }

  return profile;
};

const findAdminByIdentifier = async (identifier: string) => {
  const sql = getSql();
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
      AND (
        lower(username) = lower(${identifier})
        OR lower(email) = lower(${identifier})
      )
    LIMIT 1
  `;

  return users[0];
};

const isAdminSessionPayload = (value: unknown): value is AdminSessionPayload => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.userId === "string" &&
    typeof payload.sessionId === "string" &&
    typeof payload.username === "string" &&
    payload.role === USER_ROLE.Admin
  );
};

const parseAdminSession = (value: string) => {
  try {
    const payload: unknown = JSON.parse(value);
    return isAdminSessionPayload(payload) ? payload : undefined;
  } catch {
    return undefined;
  }
};

export const loginAdmin = async ({
  identifier,
  locale,
  password,
  requestMeta,
}: LoginAdminParams) => {
  const user = await findAdminByIdentifier(identifier);
  if (user === undefined) {
    await recordLoginAttempt({
      failureReason: "INVALID_CREDENTIALS",
      loginMethod: "password",
      meta: requestMeta,
      success: false,
    });
    return undefined;
  }

  const isValidPassword = await Bun.password.verify(password, user.passwordHash);
  if (!isValidPassword) {
    await recordLoginAttempt({
      failureReason: "INVALID_CREDENTIALS",
      loginMethod: "password",
      meta: requestMeta,
      success: false,
      userId: user.id,
    });
    return undefined;
  }

  await recordLoginAttempt({
    loginMethod: "password",
    meta: requestMeta,
    success: true,
    userId: user.id,
  });

  return toLocalizedAdminProfile({
    locale,
    row: user,
    sql: getSql(),
  });
};

export const createAdminSession = async ({ user }: CreateAdminSessionParams) => {
  const redis = await getRedisClient();
  const sessionId = crypto.randomUUID();
  const payload: AdminSessionPayload = {
    userId: user.id,
    sessionId,
    username: user.username,
    role: user.role,
  };

  const sql = getSql();
  const sessions = await sql<{ id: string }[]>`
    INSERT INTO auth_sessions (user_id, session_id, token_hash, expires_at)
    SELECT
      id,
      ${sessionId},
      ${createHash("sha256").update(crypto.randomUUID()).digest("hex")},
      ${new Date(Date.now() + env.sessionTtlSeconds * 1000)}
    FROM users
    WHERE id = ${user.id}
      AND role = ${USER_ROLE.Admin}
    RETURNING id
  `;
  if (sessions[0] === undefined) {
    throw new Error("Administrator no longer exists.");
  }

  await redis.sendCommand([
    "SET",
    `${ADMIN_SESSION_PREFIX}${sessionId}`,
    JSON.stringify(payload),
    "EX",
    String(env.sessionTtlSeconds),
  ]);

  return payload;
};

export const readAdminSession = async ({ sessionId }: ReadAdminSessionParams) => {
  const redis = await getRedisClient();
  const rawSession = await redis.get(`${ADMIN_SESSION_PREFIX}${sessionId}`);
  if (rawSession === null) {
    return undefined;
  }

  const parsedSession = parseAdminSession(rawSession);
  if (parsedSession === undefined || parsedSession.sessionId !== sessionId) {
    return undefined;
  }

  const sql = getSql();
  const sessions = await sql<{ userId: string }[]>`
    SELECT auth_sessions.user_id
    FROM auth_sessions
    JOIN users ON users.id = auth_sessions.user_id
    WHERE auth_sessions.session_id = ${sessionId}
      AND auth_sessions.revoked_at IS NULL
      AND auth_sessions.expires_at > now()
      AND users.role = ${USER_ROLE.Admin}
    LIMIT 1
  `;
  if (sessions[0]?.userId !== parsedSession.userId) {
    return undefined;
  }

  return parsedSession;
};

export const deleteAdminSession = async ({ sessionId }: DeleteAdminSessionParams) => {
  const sql = getSql();
  await sql`
    UPDATE auth_sessions
    SET revoked_at = now()
    WHERE session_id = ${sessionId}
      AND revoked_at IS NULL
  `;
  try {
    const redis = await getRedisClient();
    await redis.del(`${ADMIN_SESSION_PREFIX}${sessionId}`);
  } catch {
    // The database revocation remains authoritative when cache cleanup fails.
  }
};

const isRedisScanResponse = (value: unknown): value is [string, string[]] =>
  Array.isArray(value) &&
  typeof value[0] === "string" &&
  Array.isArray(value[1]) &&
  value[1].every((item) => typeof item === "string");

export const deleteAdminSessionsForUser = async ({ userId }: DeleteAdminSessionsForUserParams) => {
  const sql = getSql();
  await sql`
    UPDATE auth_sessions
    SET revoked_at = now()
    WHERE user_id = ${userId}
      AND revoked_at IS NULL
  `;
  try {
    await clearCachedAdminSessionsForUser(userId);
  } catch {
    // A stale cache entry cannot bypass readAdminSession's database check.
  }
};

const clearCachedAdminSessionsForUser = async (userId: string) => {
  const redis = await getRedisClient();
  let cursor = "0";

  do {
    const response: unknown = await redis.sendCommand([
      "SCAN",
      cursor,
      "MATCH",
      `${ADMIN_SESSION_PREFIX}*`,
      "COUNT",
      "100",
    ]);
    if (!isRedisScanResponse(response)) {
      return;
    }

    const [nextCursor, keys] = response;
    cursor = nextCursor;

    for (const key of keys) {
      const rawSession = await redis.get(key);
      if (rawSession === null) {
        continue;
      }

      const parsedSession = parseAdminSession(rawSession);
      if (parsedSession !== undefined && parsedSession.userId === userId) {
        await redis.del(key);
      }
    }
  } while (cursor !== "0");
};

type GetAdminProfileByIdParameters = {
  locale?: string | null;
  userId: string;
};

export const getAdminProfileById = async ({ locale, userId }: GetAdminProfileByIdParameters) => {
  const sql = getSql();
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

  const user = users[0];
  if (user === undefined) {
    return undefined;
  }

  return toLocalizedAdminProfile({
    locale,
    row: user,
    sql,
  });
};
