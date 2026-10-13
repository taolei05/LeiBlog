import { mkdir } from "node:fs/promises";

import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";

import { ensureBootstrapAdmin } from "./admin/bootstrap";
import { adminRoutes } from "./admin/routes";
import { applyAdminCookieAuthentication } from "./admin/auth/cookie";
import { blogRoutes } from "./blog/routes";
import { altchaRoutes } from "./shared/altcha-routes";
import { closeSql } from "./shared/db/postgres";
import { closeRedis } from "./shared/db/redis";
import { runMigrations } from "./shared/db/migrate";
import { env } from "./shared/env";
import { healthRoutes } from "./shared/health-routes";
import { USER_PROFILE_LOCALE_HEADER } from "./shared/profile-tags";
import { isAllowedOrigin, parseCorsOrigins } from "./shared/cors-policy";
import { createRequestSecurity } from "./shared/request-security";

export const prepareAppRuntime = async () => {
  await runMigrations();
  await ensureBootstrapAdmin();
  await mkdir(env.uploadsDir, { recursive: true });
};

export const createApp = () => {
  const allowedOrigins = parseCorsOrigins(env.corsOrigins);
  return new Elysia()
    .use(
      cors({
        origin: (request) =>
          isAllowedOrigin({
            origin: request.headers.get("origin") ?? "",
            allowedOrigins,
          }),
        allowedHeaders: ["Content-Type", "Authorization", USER_PROFILE_LOCALE_HEADER],
        exposeHeaders: ["Retry-After"],
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      }),
    )
    .use(createRequestSecurity())
    .onTransform({ as: "global" }, applyAdminCookieAuthentication)
    .get("/", () => ({ ok: true, service: "LeiBlog server" }))
    .use(
      staticPlugin({
        assets: env.uploadsDir,
        prefix: env.uploadsUrlPrefix,
        silent: true,
      }),
    )
    .use(healthRoutes)
    .use(altchaRoutes)
    .use(adminRoutes)
    .use(blogRoutes);
};

export const closeAppRuntime = async () => {
  await Promise.all([closeRedis(), closeSql()]);
};
