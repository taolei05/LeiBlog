import { createHash, randomBytes, randomInt } from "node:crypto";

import { db } from "../db";
import { forbidden, unauthorized } from "../errors";

export type UserRole = "admin" | "user";

export interface AuthUser {
  id: string;
  role: UserRole;
  username: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export interface JwtVerifier {
  verify(token?: string): Promise<false | Record<string, unknown>>;
}

interface AuthUserRow {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  avatar_url: string | null;
}

export async function hashPassword(password: string) {
  return Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 12,
  });
}

export async function verifyPassword(password: string, hash: string) {
  return Bun.password.verify(password, hash);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createRandomToken(byteLength = 32) {
  return randomBytes(byteLength).toString("base64url");
}

export function createNumericCode(length = 6) {
  const max = 10 ** length;
  const value = randomInt(0, max);
  return value.toString().padStart(length, "0");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function toAuthUser(row: AuthUserRow): AuthUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    name: row.name,
    role: row.role,
    avatarUrl: row.avatar_url,
  };
}

export async function resolveAuthUser(token: string | undefined, jwt: JwtVerifier) {
  if (!token) throw unauthorized();

  const payload = await jwt.verify(token);
  if (!payload || payload.type !== "access" || typeof payload.sub !== "string") {
    throw unauthorized("登录状态无效");
  }

  const [row] = await db<AuthUserRow[]>`
    SELECT u.id, u.username, u.email, u.name, u.role, u.avatar_url
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashToken(token)}
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND u.id = ${payload.sub}
    LIMIT 1
  `;

  if (!row) throw unauthorized("登录状态已过期");

  return toAuthUser(row);
}

export function requireUser(user: AuthUser | null | undefined) {
  if (!user) throw unauthorized();
  return user;
}

export function requireAdmin(user: AuthUser | null | undefined) {
  const currentUser = requireUser(user);
  if (currentUser.role !== "admin") {
    throw forbidden("需要管理员权限");
  }

  return currentUser;
}
