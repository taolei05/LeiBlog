import { createHash } from "node:crypto";

import { tooManyRequests } from "../errors";
import { getRedis, redisKeys } from "../redis";

const CONSUME_RATE_LIMIT_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
return { count, ttl }
`;

export interface RateLimitRule {
  identity: string;
  limit: number;
  scope: string;
  windowSeconds: number;
}

export interface RateLimitRedisClient {
  eval(
    script: string,
    options: {
      arguments: string[];
      keys: string[];
    }
  ): Promise<unknown>;
}

interface RateLimitOptions {
  client?: RateLimitRedisClient;
  onError?: (error: unknown) => void;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

function isBlocked(result: RateLimitResult | null): result is RateLimitResult {
  return result !== null && !result.allowed;
}

function hashIdentity(identity: string) {
  return createHash("sha256").update(identity).digest("hex");
}

function parseRateLimitResult(result: unknown): [number, number] {
  if (!Array.isArray(result) || result.length !== 2) {
    throw new Error("Redis returned an invalid rate limit result");
  }

  const count = Number(result[0]);
  const ttl = Number(result[1]);
  if (!Number.isFinite(count) || !Number.isFinite(ttl)) {
    throw new Error("Redis returned an invalid rate limit count or TTL");
  }

  return [count, ttl];
}

async function consumeRateLimit(
  rule: RateLimitRule,
  client: RateLimitRedisClient
): Promise<RateLimitResult> {
  const key = redisKeys.rateLimit(rule.scope, hashIdentity(rule.identity));
  const result = await client.eval(CONSUME_RATE_LIMIT_SCRIPT, {
    arguments: [String(rule.windowSeconds)],
    keys: [key],
  });
  const [count, ttl] = parseRateLimitResult(result);

  return {
    allowed: count <= rule.limit,
    retryAfterSeconds: Math.max(ttl, 1),
  };
}

export async function enforceRateLimits(
  rules: RateLimitRule[],
  options: RateLimitOptions = {}
) {
  const onError =
    options.onError ??
    ((error: unknown) => {
      console.error("Rate limit Redis error", error);
    });

  let client: RateLimitRedisClient;
  try {
    client = options.client ?? (await getRedis());
  } catch (error) {
    onError(error);
    return;
  }

  const results = await Promise.all(
    rules.map(async (rule) => {
      try {
        return await consumeRateLimit(rule, client);
      } catch (error) {
        onError(error);
        return null;
      }
    })
  );
  const retryAfterSeconds = Math.max(
    0,
    ...results
      .filter(isBlocked)
      .map((result) => result.retryAfterSeconds)
  );

  if (retryAfterSeconds > 0) {
    throw tooManyRequests(retryAfterSeconds);
  }
}
