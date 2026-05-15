import { createClient } from "redis";

import { appConfig } from "../config";

type LeiBlogRedisClient = ReturnType<typeof createClient>;

let redisClient: LeiBlogRedisClient | null = null;

export const redisKeys = {
  siteInfo: "site:info",
  siteConfig: "site:config",
  siteFiling: "site:filing",
  post: (slug: string) => `post:${slug}`,
  postPattern: "post:*",
  postList: (hash: string) => `post:list:${hash}`,
  postListPattern: "post:list:*",
  authSession: (token: string) => `auth:session:${token}`,
  emailVerify: (email: string) => `email:verify:${email}`,
  passwordReset: (token: string) => `password:reset:${token}`,
  rateLimit: (scope: string, key: string) => `rate:${scope}:${key}`,
};

export function createRedisConnection(url = appConfig.redisUrl) {
  return createClient({ url });
}

export async function getRedis() {
  if (!redisClient) {
    const client = createRedisConnection();
    client.on("error", (error) => {
      console.error("Redis connection error", error);
    });
    redisClient = client;
  }

  const client = redisClient;

  if (!client.isOpen) {
    await client.connect();
  }

  return client;
}

export async function pingRedis() {
  const client = await getRedis();
  return (await client.ping()) === "PONG";
}

export async function closeRedis() {
  if (!redisClient || !redisClient.isOpen) return;

  await redisClient.quit();
  redisClient = null;
}
