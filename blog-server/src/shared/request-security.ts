import { createHash } from "node:crypto";

import { Elysia, status } from "elysia";

import { isAllowedWriteRequest, parseCorsOrigins } from "./cors-policy";
import { getRedisClient } from "./db/redis";
import { env } from "./env";
import { getRequestMeta } from "./request-meta";
import { getRequestBodyLimit, parseBoundedRequestBody, RequestBodyTooLarge } from "./request-body";

type RequestRateLimit = {
  bucket: string;
  limit: number;
  windowSeconds: number;
};

type ConsumeRateLimit = (input: RequestRateLimit & { ip: string }) => Promise<number>;

export const readRequestRateLimit = (request: Request): RequestRateLimit => {
  const path = new URL(request.url).pathname;
  if (path.startsWith("/api/admin/backup/")) {
    return { bucket: "backup", limit: 5, windowSeconds: 600 };
  }
  if (path.includes("email-code")) {
    return { bucket: "email-code", limit: 10, windowSeconds: 600 };
  }
  if (request.method === "POST" && path.endsWith("/comments")) {
    return { bucket: "comment", limit: 10, windowSeconds: 60 };
  }
  if (request.method === "POST" && path.endsWith("/reveal")) {
    return { bucket: "secret-reveal", limit: 10, windowSeconds: 600 };
  }
  if (request.method === "GET" || request.method === "HEAD") {
    return { bucket: "read", limit: 300, windowSeconds: 60 };
  }
  if (path.includes("/auth/") || path.startsWith("/api/admin/setup/")) {
    return { bucket: "auth", limit: 20, windowSeconds: 60 };
  }
  if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    return { bucket: "upload", limit: 20, windowSeconds: 600 };
  }
  return { bucket: "write", limit: 120, windowSeconds: 60 };
};

const RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
if count > tonumber(ARGV[1]) then return math.max(1, redis.call('TTL', KEYS[1])) end
return 0
`;

const consumeRequestRateLimit: ConsumeRateLimit = async ({ ip, bucket, limit, windowSeconds }) => {
  const redis = await getRedisClient();
  const identity = createHash("sha256").update(ip).digest("hex");
  const result = await redis.eval(RATE_LIMIT_SCRIPT, {
    keys: [`leiblog:request-limit:${bucket}:${identity}`],
    arguments: [String(limit), String(windowSeconds)],
  });
  if (typeof result !== "number") {
    throw new Error("Unexpected rate limiter response.");
  }
  return result;
};

export const createRequestSecurity = ({
  consumeRateLimit = consumeRequestRateLimit,
}: { consumeRateLimit?: ConsumeRateLimit } = {}) => {
  const allowedOrigins = parseCorsOrigins(env.corsOrigins);
  return new Elysia({ name: "leiblog-request-security" })
    .onRequest(async ({ request, server, set }) => {
      set.headers["X-Content-Type-Options"] = "nosniff";
      set.headers["X-Frame-Options"] = "DENY";
      set.headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
      set.headers["Content-Security-Policy"] =
        "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; sandbox";
      if (Bun.env.NODE_ENV === "production") {
        set.headers["Strict-Transport-Security"] = "max-age=31536000";
      }

      const path = new URL(request.url).pathname;
      if (!path.startsWith("/api/")) {
        return;
      }
      set.headers["Cache-Control"] = "no-store";

      if (!isAllowedWriteRequest({ request, allowedOrigins })) {
        return status(403, { message: "Request origin is not allowed." });
      }
      if (path.startsWith("/api/admin/setup/") && Bun.env.NODE_ENV === "production") {
        const setupStatusPath = path === "/api/admin/setup/status";
        if (!setupStatusPath) {
          return status(403, {
            message:
              "Run initial setup locally or configure a bootstrap administrator before production deployment.",
          });
        }
      }

      const rawLength = request.headers.get("content-length");
      if (
        rawLength !== null &&
        (!/^\d+$/.test(rawLength) || Number(rawLength) > getRequestBodyLimit(request))
      ) {
        return status(413, { message: "Request body is too large." });
      }

      if (request.method === "OPTIONS") {
        return;
      }
      const meta = getRequestMeta({
        headers: {
          "x-forwarded-for": request.headers.get("x-forwarded-for") ?? undefined,
          "x-real-ip": request.headers.get("x-real-ip") ?? undefined,
        },
        requestIp: server?.requestIP(request)?.address ?? null,
      });
      try {
        const retryAfter = await consumeRateLimit({
          ...readRequestRateLimit(request),
          ip: meta.ip ?? "unknown",
        });
        if (retryAfter > 0) {
          set.headers["Retry-After"] = String(retryAfter);
          return status(429, { message: "Too many requests. Please try again later." });
        }
      } catch {
        return status(503, { message: "Service is temporarily unavailable." });
      }
    })
    .onParse({ as: "global" }, ({ request }) => parseBoundedRequestBody(request))
    .onError({ as: "global" }, ({ code, error }) => {
      if (
        error instanceof RequestBodyTooLarge ||
        (error instanceof Error && error.cause instanceof RequestBodyTooLarge)
      ) {
        return status(413, { message: "Request body is too large." });
      }
      if (code === "VALIDATION" || code === "PARSE") {
        return status(400, { message: "Invalid request." });
      }
      if (code === "NOT_FOUND") {
        return status(404, { message: "Resource was not found." });
      }
      if (code === "INVALID_COOKIE_SIGNATURE") {
        return status(401, { message: "Invalid session." });
      }
      // Error messages and SQL details can contain credentials or personal data.
      console.error("Request failed", {
        code,
        errorType: error instanceof Error ? error.name : "unknown",
      });
      return status(500, { message: "Internal server error." });
    });
};
