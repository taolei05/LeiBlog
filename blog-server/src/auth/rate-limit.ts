import { normalizeEmail } from "../shared/auth";
import { enforceRateLimits } from "../shared/rate-limit";
import type { PasswordResetInput, RequestMeta } from "./service";

function requestIp(meta: RequestMeta) {
  return meta.ip ?? "unknown";
}

export function enforceLoginRateLimit(meta: RequestMeta, identifier: string) {
  const ip = requestIp(meta);
  const normalizedIdentifier = identifier.trim().toLowerCase();

  return enforceRateLimits([
    {
      identity: `${ip}:${normalizedIdentifier}`,
      limit: 5,
      scope: "auth-login-ip-identifier",
      windowSeconds: 10 * 60,
    },
    {
      identity: ip,
      limit: 20,
      scope: "auth-login-ip",
      windowSeconds: 10 * 60,
    },
  ]);
}

export function enforceEmailCodeRateLimit(
  meta: RequestMeta,
  email: string,
  purpose: string
) {
  const identity = `${requestIp(meta)}:${normalizeEmail(email)}:${purpose}`;

  return enforceRateLimits([
    {
      identity,
      limit: 1,
      scope: "auth-email-code-minute",
      windowSeconds: 60,
    },
    {
      identity,
      limit: 5,
      scope: "auth-email-code-hour",
      windowSeconds: 60 * 60,
    },
  ]);
}

export function enforceForgotPasswordRateLimit(meta: RequestMeta, email: string) {
  return enforceRateLimits([
    {
      identity: `${requestIp(meta)}:${normalizeEmail(email)}`,
      limit: 3,
      scope: "auth-password-forgot",
      windowSeconds: 60 * 60,
    },
  ]);
}

export function enforcePasswordResetRateLimit(
  meta: RequestMeta,
  input: PasswordResetInput
) {
  const resetIdentity =
    "token" in input ? `token:${input.token}` : `email:${normalizeEmail(input.email)}`;

  return enforceRateLimits([
    {
      identity: `${requestIp(meta)}:${resetIdentity}`,
      limit: 5,
      scope: "auth-password-reset",
      windowSeconds: 15 * 60,
    },
  ]);
}
