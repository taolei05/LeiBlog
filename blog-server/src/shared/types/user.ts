import { t } from "elysia";

import type { UserRole } from "../auth";
import { describeLocation } from "../location";

export const UserRoleSchema = t.Union([
  t.Literal("admin"),
  t.Literal("user"),
]);

export const UserProfileSchema = t.Object({
  id: t.String(),
  username: t.String(),
  email: t.Nullable(t.String()),
  name: t.Nullable(t.String()),
  description: t.String(),
  tags: t.Array(t.String()),
  role: UserRoleSchema,
  avatarUrl: t.Nullable(t.String()),
  socialLinks: t.Record(t.String(), t.String()),
  blogUrl: t.Nullable(t.String()),
  createdAt: t.String(),
  updatedAt: t.String(),
  lastLoginAt: t.Nullable(t.String()),
  lastLoginIp: t.Nullable(t.String()),
  lastLoginLocation: t.Nullable(t.String()),
  lastLoginDevice: t.Nullable(t.String()),
});

export interface UserProfile {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  description: string;
  tags: string[];
  role: UserRole;
  avatarUrl: string | null;
  socialLinks: Record<string, string>;
  blogUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  lastLoginLocation: string | null;
  lastLoginDevice: string | null;
}

export interface UserProfileRow {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  description: string;
  tags: string[];
  role: UserRole;
  avatar_url: string | null;
  social_links: Record<string, string> | string | null;
  blog_url: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  last_login_at: Date | string | null;
  last_login_ip: string | null;
  last_login_location?: unknown;
  last_login_device?: unknown;
}

function toIsoString(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function parseSocialLinks(
  value: Record<string, string> | string | null
): Record<string, string> {
  if (!value) return {};
  if (typeof value === "string") return JSON.parse(value);
  return value;
}

function readJsonText(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" && field.trim() ? field.trim() : null;
}

export function toUserProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    name: row.name,
    description: row.description,
    tags: row.tags ?? [],
    role: row.role,
    avatarUrl: row.avatar_url,
    socialLinks: parseSocialLinks(row.social_links),
    blogUrl: row.blog_url,
    createdAt: toIsoString(row.created_at) ?? "",
    updatedAt: toIsoString(row.updated_at) ?? "",
    lastLoginAt: toIsoString(row.last_login_at),
    lastLoginIp: row.last_login_ip,
    lastLoginLocation: describeLocation(row.last_login_location),
    lastLoginDevice: readJsonText(row.last_login_device, "userAgent"),
  };
}
