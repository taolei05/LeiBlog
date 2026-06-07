import { t } from "elysia";

import { UserProfileSchema, UserRoleSchema } from "../../shared/types/user";

export const UserListQuery = t.Object({
  search: t.Optional(t.String({ maxLength: 120 })),
  role: t.Optional(UserRoleSchema),
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 10_000 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
  sortBy: t.Optional(
    t.Union([
      t.Literal("createdAt"),
      t.Literal("username"),
      t.Literal("lastLoginAt"),
    ])
  ),
  sortOrder: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
});

export const UserListResponse = t.Object({
  ok: t.Boolean(),
  items: t.Array(UserProfileSchema),
  page: t.Number(),
  pageSize: t.Number(),
  total: t.Number(),
});

export const AdminCreateUserBody = t.Object({
  username: t.String({ minLength: 2, maxLength: 60 }),
  password: t.String({ minLength: 8, maxLength: 128 }),
  email: t.Optional(t.String({ format: "email", maxLength: 254 })),
  name: t.Optional(t.String({ maxLength: 80 })),
  description: t.Optional(t.String({ maxLength: 1000 })),
  tags: t.Optional(t.Array(t.String({ maxLength: 40 }), { maxItems: 12 })),
  role: UserRoleSchema,
  avatarUrl: t.Optional(t.String({ maxLength: 2048 })),
  socialLinks: t.Optional(t.Record(t.String(), t.String({ maxLength: 2048 }))),
  blogUrl: t.Optional(t.String({ maxLength: 2048 })),
});

export const AdminUpdateUserBody = t.Object({
  email: t.Optional(t.Nullable(t.String({ format: "email", maxLength: 254 }))),
  name: t.Optional(t.Nullable(t.String({ maxLength: 80 }))),
  description: t.Optional(t.String({ maxLength: 1000 })),
  tags: t.Optional(t.Array(t.String({ maxLength: 40 }), { maxItems: 12 })),
  role: t.Optional(UserRoleSchema),
  avatarUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
  socialLinks: t.Optional(t.Record(t.String(), t.String({ maxLength: 2048 }))),
  blogUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
  password: t.Optional(t.String({ minLength: 8, maxLength: 128 })),
});

export const UserParams = t.Object({
  id: t.String(),
});

export const UserResponse = t.Object({
  ok: t.Boolean(),
  user: UserProfileSchema,
});

export const OkResponse = t.Object({
  ok: t.Boolean(),
});
