import { normalizeEmail } from "../auth";
import { enforceRateLimits } from "../rate-limit";
import type { RequestMeta } from "../../auth/service";

function requestIp(meta: RequestMeta) {
  return meta.ip ?? "unknown";
}

function enforceActorAndIpRateLimit({
  actorId,
  ipLimit,
  limit,
  meta,
  scope,
  windowSeconds,
}: {
  actorId: string;
  ipLimit: number;
  limit: number;
  meta: RequestMeta;
  scope: string;
  windowSeconds: number;
}) {
  return enforceRateLimits([
    {
      identity: actorId,
      limit,
      scope: `${scope}-actor`,
      windowSeconds,
    },
    {
      identity: requestIp(meta),
      limit: ipLimit,
      scope: `${scope}-ip`,
      windowSeconds,
    },
  ]);
}

export function enforceEmailChangeCodeRateLimit(
  userId: string,
  email: string,
  meta: RequestMeta
) {
  const actorId = `${userId}:${normalizeEmail(email)}`;

  return enforceRateLimits([
    {
      identity: actorId,
      limit: 1,
      scope: "me-email-change-code-minute",
      windowSeconds: 60,
    },
    {
      identity: userId,
      limit: 5,
      scope: "me-email-change-code-hour",
      windowSeconds: 60 * 60,
    },
    {
      identity: requestIp(meta),
      limit: 20,
      scope: "me-email-change-code-ip-hour",
      windowSeconds: 60 * 60,
    },
  ]);
}

export function enforceApiKeyEmailCodeRateLimit(userId: string, meta: RequestMeta) {
  return enforceActorAndIpRateLimit({
    actorId: userId,
    ipLimit: 10,
    limit: 1,
    meta,
    scope: "admin-api-key-email-code",
    windowSeconds: 60,
  });
}

export function enforceCommentWriteRateLimit(userId: string, meta: RequestMeta) {
  return enforceActorAndIpRateLimit({
    actorId: userId,
    ipLimit: 30,
    limit: 10,
    meta,
    scope: "comment-write",
    windowSeconds: 10 * 60,
  });
}

export function enforceUploadRateLimit(
  kind: "admin-media" | "avatar" | "comment-image" | "setup",
  actorId: string,
  meta: RequestMeta
) {
  return enforceActorAndIpRateLimit({
    actorId,
    ipLimit: 30,
    limit: 10,
    meta,
    scope: `upload-${kind}`,
    windowSeconds: 10 * 60,
  });
}

export function enforceSetupWriteRateLimit(actorId: string, meta: RequestMeta) {
  return enforceActorAndIpRateLimit({
    actorId,
    ipLimit: 50,
    limit: 20,
    meta,
    scope: "setup-write",
    windowSeconds: 10 * 60,
  });
}
