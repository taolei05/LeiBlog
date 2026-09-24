import { createClient } from "redis";
import type { RedisClientType } from "redis";

import { env } from "../env";

let redisClient: RedisClientType | undefined;

export const getRedisClient = async () => {
  if (redisClient !== undefined && redisClient.isOpen) {
    return redisClient;
  }

  const client = createClient({ url: env.redisUrl });
  client.on("error", (error: Error) => {
    console.error("Redis client error", error);
  });

  await client.connect();
  redisClient = client;

  return client;
};

export const closeRedis = async () => {
  const client = redisClient;
  if (client === undefined) {
    return;
  }

  redisClient = undefined;
  if (client.isOpen) {
    await client.quit();
  }
};
