import type { Sql, TransactionSql } from "postgres";

import { getSql } from "../../shared/db/postgres";
import { getRedisClient } from "../../shared/db/redis";
import { env } from "../../shared/env";
import {
  DEFAULT_USER_PROFILE_LOCALE,
  normalizeProfileTagLocale,
  readLocalizedUserProfile,
} from "../../shared/profile-tags";
import type { AdminProfile, AdminSessionPayload, UserRecord } from "./types";
import { USER_ROLE } from "./types";

const ADMIN_SESSION_PREFIX = "admin:session:";

type LoginAdminParams = {
  identifier: string;
  locale?: string | null;
  password: string;
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

export const loginAdmin = async ({ identifier, locale, password }: LoginAdminParams) => {
  const user = await findAdminByIdentifier(identifier);
  if (user === undefined) {
    return undefined;
  }

  const isValidPassword = await Bun.password.verify(password, user.passwordHash);
  if (!isValidPassword) {
    return undefined;
  }

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

  const parsedSession: unknown = JSON.parse(rawSession);
  if (!isAdminSessionPayload(parsedSession)) {
    return undefined;
  }

  return parsedSession;
};

export const deleteAdminSession = async ({ sessionId }: DeleteAdminSessionParams) => {
  const redis = await getRedisClient();
  await redis.del(`${ADMIN_SESSION_PREFIX}${sessionId}`);
};

type GetAdminProfileByIdParameters = {
  locale?: string | null;
  userId: string;
};

export const getAdminProfileById = async ({
  locale,
  userId,
}: GetAdminProfileByIdParameters) => {
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
