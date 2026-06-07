process.env.TZ ??= "Asia/Shanghai";

export type AppEnv = "development" | "test" | "production";

export interface AppConfig {
  env: AppEnv;
  host: string;
  port: number;
  databaseUrl: string;
  databaseMaxConnections: number;
  redisUrl: string;
  jwtSecret: string;
  appSecretKey: string;
  corsOrigins: string[];
  openapiEnabled: boolean;
  setupToken: string | null;
  trustedProxyIps: string[];
  uploadsDir: string;
  uploadsUrlPrefix: string;
  uploadMaxFileSizeBytes: number;
  isProduction: boolean;
}

const DEFAULT_DATABASE_URL =
  "postgres://taolei:12345678@localhost:5432/lei_blog";
const DEFAULT_REDIS_URL = "redis://localhost:6379";
const DEV_SECRET = "leiblog-development-secret-change-before-production";

type EnvSource = Record<string, string | undefined>;

function readString(env: EnvSource, key: string, fallback: string) {
  const value = env[key]?.trim();
  return value ? value : fallback;
}

function readStringAliases(env: EnvSource, keys: string[], fallback: string) {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }

  return fallback;
}

function readNumber(env: EnvSource, key: string, fallback: number) {
  const raw = env[key]?.trim();
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid numeric environment variable: ${key}`);
  }

  return value;
}

function readNumberAliases(env: EnvSource, keys: string[], fallback: number) {
  for (const key of keys) {
    const raw = env[key]?.trim();
    if (!raw) continue;

    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`Invalid numeric environment variable: ${key}`);
    }

    return value;
  }

  return fallback;
}

function readBoolean(env: EnvSource, key: string, fallback: boolean) {
  const raw = env[key]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`Invalid boolean environment variable: ${key}`);
}

function readList(env: EnvSource, key: string) {
  return (env[key] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readEnv(env: EnvSource): AppEnv {
  const value = readStringAliases(env, ["NODE_ENV", "APP_ENV"], "development");
  if (value === "development" || value === "test" || value === "production") {
    return value;
  }

  throw new Error("NODE_ENV must be development, test, or production");
}

function ensureProductionSecret(key: string, value: string) {
  if (value === DEV_SECRET) {
    throw new Error(`${key} must be configured in production`);
  }
}

export function loadConfig(env: EnvSource = Bun.env): AppConfig {
  const appEnv = readEnv(env);
  const appSecretKey = readString(env, "APP_SECRET_KEY", DEV_SECRET);
  const jwtSecret = readString(env, "JWT_SECRET", appSecretKey);
  const corsOrigins = readList(env, "CORS_ORIGINS");
  const openapiEnabled = readBoolean(env, "OPENAPI_ENABLED", appEnv !== "production");
  const setupToken = env.SETUP_TOKEN?.trim() || null;
  const trustedProxyIps = readList(env, "TRUSTED_PROXY_IPS");

  if (appEnv === "production") {
    ensureProductionSecret("APP_SECRET_KEY", appSecretKey);
    ensureProductionSecret("JWT_SECRET", jwtSecret);
    if (!setupToken) throw new Error("SETUP_TOKEN must be configured in production");
    if (corsOrigins.length === 0) {
      throw new Error("CORS_ORIGINS must be configured in production");
    }
  }

  return {
    env: appEnv,
    host: readStringAliases(env, ["HOST", "APP_HOST"], "0.0.0.0"),
    port: readNumberAliases(env, ["PORT", "APP_PORT"], 3000),
    databaseUrl: readString(env, "DATABASE_URL", DEFAULT_DATABASE_URL),
    databaseMaxConnections: readNumber(env, "DATABASE_MAX_CONNECTIONS", 10),
    redisUrl: readString(env, "REDIS_URL", DEFAULT_REDIS_URL),
    jwtSecret,
    appSecretKey,
    corsOrigins,
    openapiEnabled,
    setupToken,
    trustedProxyIps,
    uploadsDir: readString(env, "UPLOADS_DIR", "uploads"),
    uploadsUrlPrefix: readString(env, "UPLOADS_URL_PREFIX", "/uploads"),
    uploadMaxFileSizeBytes: readNumber(env, "UPLOAD_MAX_FILE_SIZE_BYTES", 50 * 1024 * 1024),
    isProduction: appEnv === "production",
  };
}

export const appConfig = loadConfig();
