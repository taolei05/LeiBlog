import type { Cookie } from "elysia";

import { env } from "../../shared/env";
import type { AdminProfile } from "./types";

export const ADMIN_SESSION_COOKIE_NAME =
  Bun.env.NODE_ENV === "production" ? "__Host-leiblog_admin_session" : "leiblog_admin_session";

type AdminCookieJar = Record<string, Cookie<unknown>>;

export const setAdminSessionCookie = (cookie: AdminCookieJar, token: string) => {
  cookie[ADMIN_SESSION_COOKIE_NAME].set({
    value: token,
    httpOnly: true,
    secure: Bun.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: env.sessionTtlSeconds,
  });
};

export const clearAdminSessionCookie = (cookie: AdminCookieJar) => {
  cookie[ADMIN_SESSION_COOKIE_NAME].remove();
};

export const createAdminAuthResponse = ({
  request,
  token,
  user,
}: {
  request: Request;
  token: string;
  user: AdminProfile;
}) =>
  request.headers.has("origin")
    ? { token: "", transport: "cookie" as const, user }
    : { token, transport: "bearer" as const, user };

export const readAdminCookieToken = (header: string | null) => {
  const entry = header
    ?.split(";")
    .find((part) => part.trim().startsWith(`${ADMIN_SESSION_COOKIE_NAME}=`));
  if (entry === undefined) {
    return undefined;
  }
  const value = entry.trim().slice(ADMIN_SESSION_COOKIE_NAME.length + 1);
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value) && value.length <= 8192
    ? value
    : undefined;
};

export const applyAdminCookieAuthentication = ({
  request,
  headers,
}: {
  request: Request;
  headers: Record<string, string | undefined>;
}) => {
  if (
    !new URL(request.url).pathname.startsWith("/api/admin/") ||
    headers.authorization !== undefined
  ) {
    return;
  }
  const token = readAdminCookieToken(request.headers.get("cookie"));
  if (token !== undefined) {
    headers.authorization = `Bearer ${token}`;
  }
};
