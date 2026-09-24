import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { ensureBootstrapAdmin } from "./admin/bootstrap";
import { adminRoutes } from "./admin/routes";
import { blogRoutes } from "./blog/routes";
import { closeSql } from "./shared/db/postgres";
import { closeRedis } from "./shared/db/redis";
import { runMigrations } from "./shared/db/migrate";
import { env } from "./shared/env";
import { healthRoutes } from "./shared/health-routes";
import { USER_PROFILE_LOCALE_HEADER } from "./shared/profile-tags";

const parseCorsOrigin = (origin: string) => {
  const lastSlashIndex = origin.lastIndexOf("/");
  if (!origin.startsWith("/") || lastSlashIndex === 0) {
    return origin;
  }

  const pattern = origin.slice(1, lastSlashIndex);
  const flags = origin.slice(lastSlashIndex + 1);

  return new RegExp(pattern, flags);
};

const resolveCorsOrigin = () => {
  if (env.corsOrigins.includes("*")) {
    return true;
  }

  return env.corsOrigins.map(parseCorsOrigin);
};

const startServer = async () => {
  await runMigrations();
  await ensureBootstrapAdmin();

  const app = new Elysia()
    .use(
      cors({
        origin: resolveCorsOrigin(),
        allowedHeaders: ["Content-Type", "Authorization", USER_PROFILE_LOCALE_HEADER],
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      }),
    )
    .get("/", () => ({ ok: true, service: "LeiBlog server" }))
    .use(healthRoutes)
    .use(adminRoutes)
    .use(blogRoutes)
    .listen({
      hostname: env.hostname,
      port: env.port,
    });

  console.log(`LeiBlog server is running at ${app.server?.hostname}:${app.server?.port}`);
};

const shutdown = async () => {
  await Promise.all([closeRedis(), closeSql()]);
};

process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

await startServer();
