import { Elysia, status } from "elysia";

import { getSql } from "./db/postgres";
import { getRedisClient } from "./db/redis";

export const healthRoutes = new Elysia().get("/api/health", async () => {
  try {
    const sql = getSql();
    await sql`SELECT 1`;

    const redis = await getRedisClient();
    await redis.ping();

    return {
      ok: true,
      services: {
        postgres: "ok",
        redis: "ok",
      },
    };
  } catch (error) {
    console.error("Health check failed", error);

    return status(503, {
      ok: false,
      services: {
        postgres: "unknown",
        redis: "unknown",
      },
    });
  }
});
