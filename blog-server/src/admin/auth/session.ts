import { t } from "elysia";

import { USER_ROLE } from "./types";

export type AuthJwtPayload = {
  sub: string;
  sid: string;
  username: string;
  role: typeof USER_ROLE.Admin;
};

export const adminJwtSchema = t.Object({
  sub: t.String(),
  sid: t.String(),
  username: t.String(),
  role: t.Literal(USER_ROLE.Admin),
});

export const extractBearerToken = (authorization?: string) => {
  if (authorization === undefined) {
    return undefined;
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || token === undefined || token.trim().length === 0) {
    return undefined;
  }

  return token;
};

export const isAuthJwtPayload = (value: unknown): value is AuthJwtPayload => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.sub === "string" &&
    typeof payload.sid === "string" &&
    typeof payload.username === "string" &&
    payload.role === USER_ROLE.Admin
  );
};
