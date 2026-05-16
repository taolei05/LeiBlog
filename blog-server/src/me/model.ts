import { t } from "elysia";

import { UserProfileSchema } from "../shared/types/user";

export const MeResponse = t.Object({
  ok: t.Boolean(),
  user: UserProfileSchema,
});

export const UpdateMeBody = t.Object({
  name: t.Optional(t.Nullable(t.String({ maxLength: 80 }))),
  description: t.Optional(t.String({ maxLength: 1000 })),
  tags: t.Optional(t.Array(t.String({ maxLength: 40 }), { maxItems: 12 })),
  avatarUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
  socialLinks: t.Optional(t.Record(t.String(), t.String({ maxLength: 2048 }))),
  blogUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
});

export const ChangePasswordBody = t.Object({
  currentPassword: t.String({ minLength: 1, maxLength: 128 }),
  newPassword: t.String({ minLength: 8, maxLength: 128 }),
});

export const EmailChangeCodeBody = t.Object({
  email: t.String({ format: "email", maxLength: 254 }),
});

export const ConfirmEmailChangeBody = t.Object({
  email: t.String({ format: "email", maxLength: 254 }),
  emailCode: t.String({ minLength: 4, maxLength: 12 }),
});

export const EmailChangeCodeResponse = t.Object({
  ok: t.Boolean(),
  sent: t.Boolean(),
  devCode: t.Optional(t.String()),
});

export const OkResponse = t.Object({
  ok: t.Boolean(),
});
