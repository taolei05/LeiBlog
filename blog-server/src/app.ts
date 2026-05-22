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
import type { AppConfig } from "./shared/config";
import { appConfig } from "./shared/config";
import { AppError, createErrorBody } from "./shared/errors";

export interface CreateAppOptions {
  config?: AppConfig;
  enableStatic?: boolean;
}

function createCorsOrigin(config: AppConfig) {
  return config.corsOrigins.length > 0 ? config.corsOrigins : true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "number" ? value : null;
}

function readString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" ? value : null;
}

function readValidationDetails(error: Error) {
  try {
    const parsed: unknown = JSON.parse(error.message);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getValidationFieldName(path: string | null) {
  const parts = path?.replace(/^\//, "").split("/") ?? [];
  const key = parts[parts.length - 1] ?? "";
  const names: Record<string, string> = {
    admin: "管理员配置",
    avatarUrl: "头像链接",
    commentsEnabled: "是否开启评论系统",
    copyright: "版权信息",
    deeplApiKey: "DeepL API Key",
    description: "描述",
    email: "邮箱",
    establishedAt: "建站时间",
    faviconUrl: "favicon",
    file: "上传文件",
    fileName: "文件名",
    folderSlug: "目标文件夹",
    icpNumber: "ICP备案号",
    icpUrl: "ICP备案网址",
    ipgeolocationApiKey: "IPGeolocation API Key",
    logoDarkUrl: "深色 Logo",
    logoLightUrl: "浅色 Logo",
    name: "显示名称",
    password: "密码",
    policeNumber: "公安备案号",
    policeUrl: "公安备案网址",
    resendApiKey: "Resend API Key",
    resendDomain: "Resend 域名",
    seoDescription: "SEO 描述",
    seoKeywords: "SEO 关键词",
    seoTitle: "SEO 标题",
    siteConfig: "站点配置",
    siteInfo: "站点信息",
    siteName: "站点名称",
    tags: "个人标签",
    username: "用户名",
  };

  return names[key] ?? (key || "请求字段");
}

function describeValidationIssue(issue: unknown) {
  if (!isRecord(issue)) return null;

  const path = readString(issue, "path");
  const message = readString(issue, "message");
  const summary = readString(issue, "summary");
  const schema = isRecord(issue.schema) ? issue.schema : {};
  const fieldName = getValidationFieldName(path);
  const minLength = readNumber(schema, "minLength");
  const maxLength = readNumber(schema, "maxLength");
  const maxItems = readNumber(schema, "maxItems");
  const format = readString(schema, "format");
  const type = readString(schema, "type");
  const text = `${message ?? ""} ${summary ?? ""}`;

  if (format === "email") return `${fieldName}格式不正确`;
  if (minLength !== null && text.includes("greater or equal")) {
    return `${fieldName}至少需要 ${minLength} 个字符`;
  }
  if (maxLength !== null && text.includes("smaller or equal")) {
    return `${fieldName}不能超过 ${maxLength} 个字符`;
  }
  if (maxItems !== null && text.includes("Expected array length")) {
    return `${fieldName}最多填写 ${maxItems} 项`;
  }
  if (summary?.includes("undefined")) return `${fieldName}不能为空`;
  if (type === "boolean") return `${fieldName}必须是开启或关闭状态`;
  if (type === "array") return `${fieldName}必须是列表格式`;
  if (type === "string") return `${fieldName}必须是文本格式`;

  return `${fieldName}${summary ?? message ?? "格式不正确"}`;
}

function createValidationErrorMessage(error: Error) {
  const details = readValidationDetails(error);
  if (!details) return `请求参数无效：${error.message}`;

  const errors = Array.isArray(details.errors) ? details.errors : [];
  const messages = errors
    .map(describeValidationIssue)
    .filter((message): message is string => Boolean(message));

  if (messages.length > 0) {
    return `请求参数无效：${messages.join("；")}`;
  }

  const property = readString(details, "property");
  const summary = readString(details, "summary") ?? readString(details, "message");
  if (summary) return `请求参数无效：${getValidationFieldName(property)}${summary}`;

  return "请求参数无效：请检查初始化表单字段";
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
        const message = createValidationErrorMessage(error);

        return status(422, {
          ok: false,
          code: "VALIDATION_ERROR",
          message,
          details: error.message,
        });
      }

      if (code === "PARSE") {
        return status(400, {
          ok: false,
          code: "PARSE_ERROR",
          message: "请求内容格式无效",
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
