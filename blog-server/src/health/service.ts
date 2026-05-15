import { appConfig } from "../shared/config";
import { pingDb } from "../shared/db";
import { pingRedis } from "../shared/redis";
import { toShanghaiISOString } from "../shared/time";

export function getHealth() {
  return {
    ok: true,
    name: "LeiBlog API",
    env: appConfig.env,
    time: toShanghaiISOString(),
    uptime: process.uptime(),
  };
}

export async function getLiveHealth() {
  const [database, redis] = await Promise.allSettled([pingDb(), pingRedis()]);
  const checks = {
    database: database.status === "fulfilled" && database.value,
    redis: redis.status === "fulfilled" && redis.value,
  };

  return {
    ok: checks.database && checks.redis,
    checks,
    time: toShanghaiISOString(),
  };
}
