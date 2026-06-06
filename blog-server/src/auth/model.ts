import { t } from "elysia";

import { UserProfileSchema } from "../shared/types/user";

export const EmailCodeBody = t.Object({
  email: t.String({ format: "email", maxLength: 254 }),
  purpose: t.Union([
    t.Literal("register"),
    t.Literal("password_reset"),
    t.Literal("email_change"),
  ]),
});

export const RegisterBody = t.Object({
  username: t.String({ minLength: 2, maxLength: 60 }),
  password: t.String({ minLength: 8, maxLength: 128 }),
  email: t.String({ format: "email", maxLength: 254 }),
  emailCode: t.String({ minLength: 4, maxLength: 12 }),
  name: t.Optional(t.String({ maxLength: 80 })),
});

export const LoginBody = t.Object({
  identifier: t.String({ minLength: 1, maxLength: 254 }),
  password: t.String({ minLength: 1, maxLength: 128 }),
});

export const ForgotPasswordBody = t.Object({
  email: t.String({ format: "email", maxLength: 254 }),
});

export const ResetPasswordBody = t.Union([
  t.Object({
    token: t.String({ minLength: 16, maxLength: 512 }),
    password: t.String({ minLength: 8, maxLength: 128 }),
  }),
  t.Object({
    email: t.String({ format: "email", maxLength: 254 }),
    emailCode: t.String({ minLength: 4, maxLength: 12 }),
    password: t.String({ minLength: 8, maxLength: 128 }),
  }),
]);

export const AuthResponse = t.Object({
  ok: t.Boolean(),
  token: t.String(),
  user: UserProfileSchema,
});

export const EmailCodeResponse = t.Object({
  expiresAt: t.String(),
  ok: t.Boolean(),
  sent: t.Boolean(),
  validMinutes: t.Number(),
  devCode: t.Optional(t.String()),
});

export const PasswordResetResponse = t.Object({
  ok: t.Boolean(),
  sent: t.Boolean(),
  devToken: t.Optional(t.String()),
});

export const OkResponse = t.Object({
  ok: t.Boolean(),
});
