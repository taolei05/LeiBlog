import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  enforceRateLimits,
  type RateLimitRedisClient,
} from "../src/shared/rate-limit";
import { AppError } from "../src/shared/errors";
import { closeRedis, getRedis, redisKeys } from "../src/shared/redis";

const scope = `test-rate-limit-${Date.now()}`;
let redisAvailable = false;

beforeAll(async () => {
  try {
    const redis = await getRedis();
    redisAvailable = (await redis.ping()) === "PONG";
  } catch {
    redisAvailable = false;
  }
});

afterAll(async () => {
  if (redisAvailable) {
    const redis = await getRedis();
    const keys = await redis.keys(redisKeys.rateLimit(scope, "*"));
    if (keys.length > 0) await redis.del(keys);
  }

  await closeRedis();
});

describe("rate limiter", () => {
  test("blocks requests over the limit without exposing the identity", async () => {
    if (!redisAvailable) return;

    const rule = {
      identity: "reader@example.com",
      limit: 2,
      scope,
      windowSeconds: 60,
    };

    await enforceRateLimits([rule]);
    await enforceRateLimits([rule]);

    let error: unknown;
    try {
      await enforceRateLimits([rule]);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: "RATE_LIMITED",
      statusCode: 429,
    });
    expect((error as AppError).details).toMatchObject({
      retryAfterSeconds: expect.any(Number),
    });

    const redis = await getRedis();
    const keys = await redis.keys(redisKeys.rateLimit(scope, "*"));
    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toContain("reader@example.com");
  });

  test("fails open when Redis is unavailable", async () => {
    const errors: unknown[] = [];
    const client: RateLimitRedisClient = {
      eval: async () => {
        throw new Error("redis unavailable");
      },
    };

    await expect(
      enforceRateLimits(
        [
          {
            identity: "127.0.0.1",
            limit: 1,
            scope,
            windowSeconds: 60,
          },
        ],
        {
          client,
          onError: (error) => errors.push(error),
        }
      )
    ).resolves.toBeUndefined();
    expect(errors).toHaveLength(1);
  });
});
