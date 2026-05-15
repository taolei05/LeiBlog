import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { serverTiming } from "@elysiajs/server-timing";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";

import { adminModule } from "./admin";
import { authModule } from "./auth";
import { healthModule } from "./health";
import { meModule } from "./me";
import { publicModule } from "./public";
import { type AppConfig, appConfig } from "./shared/config";
import { AppError, createErrorBody } from "./shared/errors";

export interface CreateAppOptions {
  config?: AppConfig;
  enableStatic?: boolean;
}

function createCorsOrigin(config: AppConfig) {
  return config.corsOrigins.length > 0 ? config.corsOrigins : true;
}

export async function createApp(options: CreateAppOptions = {}) {
  const config = options.config ?? appConfig;
  const enableStatic = options.enableStatic ?? true;

  const app = new Elysia({ name: "leiblog-api" })
    .use(
      serverTiming({
        enabled: !config.isProduction,
      })
    )
    .use(
      cors({
        origin: createCorsOrigin(config),
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      })
    )
    .use(
      openapi({
        path: "/api/openapi",
        documentation: {
          info: {
            title: "LeiBlog API",
            version: "0.1.0",
          },
        },
      })
    )
    .onError(({ code, error, status }) => {
      if (error instanceof AppError) {
        return status(error.statusCode, createErrorBody(error));
      }

      if (code === "NOT_FOUND") {
        return status(404, {
          ok: false,
          code: "NOT_FOUND",
          message: "接口不存在",
        });
      }

      if (code === "VALIDATION") {
        return status(422, {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "请求参数无效",
          details: error.message,
        });
      }

      console.error(error);

      return status(500, {
        ok: false,
        code: "INTERNAL_SERVER_ERROR",
        message: "服务器内部错误",
      });
    })
    .get("/", () => ({
      ok: true,
      name: "LeiBlog API",
    }));

  if (enableStatic) {
    app.use(
      await staticPlugin({
        assets: config.uploadsDir,
        prefix: config.uploadsUrlPrefix,
        silent: true,
      })
    );
  }

  return app
    .use(healthModule)
    .use(publicModule)
    .use(authModule)
    .use(meModule)
    .use(adminModule);
}

export type LeiBlogApp = Awaited<ReturnType<typeof createApp>>;
