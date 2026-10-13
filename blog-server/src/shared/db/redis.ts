import { createClient } from "redis";
import type { RedisClientType } from "redis";

import { env } from "../env";

let redisClient: RedisClientType | undefined;
let pendingConnection: Promise<RedisClientType> | undefined;

export const getRedisClient = async () => {
  if (redisClient !== undefined && redisClient.isReady) {
    return redisClient;
  }
  if (pendingConnection !== undefined) {
    return pendingConnection;
  }
  if (redisClient !== undefined && redisClient.isOpen) {
    throw new Error("Redis is reconnecting.");
  }

  const client = createClient({ url: env.redisUrl });
  client.on("error", (error: Error) => {
    console.error("Redis client error", { errorType: error.name });
  });

  pendingConnection = (async () => {
    try {
      await client.connect();
      redisClient = client;
      return client;
    } catch (error) {
      if (client.isOpen) {
        client.destroy();
      }
      throw error;
    } finally {
      pendingConnection = undefined;
    }
  })();

  return pendingConnection;
};

export const closeRedis = async () => {
  if (pendingConnection !== undefined) {
    try {
      await pendingConnection;
    } catch {
      return;
    }
  }
  const client = redisClient;
  if (client === undefined) {
    return;
  }

  redisClient = undefined;
  if (client.isOpen) {
    await client.quit();
  }
};
