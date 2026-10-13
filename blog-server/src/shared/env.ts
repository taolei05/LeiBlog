import { parseCorsOrigins } from "./cors-policy";
import { resolvePublicOrigin } from "./public-origin";

const DEFAULT_PORT = 3000;
const DEFAULT_HOSTNAME = "0.0.0.0";
const DEFAULT_DATABASE_URL = "postgres://leiblog:12345678@127.0.0.1:5432/leiblog";
const DEFAULT_REDIS_URL = "redis://127.0.0.1:6379";
const DEFAULT_CORS_ORIGINS = [
  "http://127.0.0.1:5174",
  "http://localhost:5174",
  "/^http:\\/\\/192\\.168\\.\\d{1,3}\\.\\d{1,3}:5174$/",
  "/^http:\\/\\/10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}:5174$/",
  "/^http:\\/\\/172\\.(1[6-9]|2\\d|3[0-1])\\.\\d{1,3}\\.\\d{1,3}:5174$/",
];
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const DEFAULT_TRUSTED_PROXY_IPS = ["127.0.0.1", "::1"];

type ServerEnv = {
  port: number;
  hostname: string;
  publicSiteUrl: string;
  databaseUrl: string;
  redisUrl: string;
  corsOrigins: string[];
  jwtSecret: string;
  configEncryptionSecret: string;
  altchaSecret: string;
  sessionTtlSeconds: number;
  trustedProxyIps: string[];
  uploadsDir: string;
  uploadsUrlPrefix: string;
  uploadMaxFileSizeBytes: number;
  adminBootstrapUsername: string;
  adminBootstrapPassword?: string;
  adminBootstrapEmail: string;
  adminBootstrapName?: string;
  adminBootstrapTags: string[];
};

const readText = ({ name, fallback }: { name: string; fallback?: string }) => {
  const value = Bun.env[name] ?? fallback;

  if (value === undefined) {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

const readRequiredText = ({ name, fallback }: { name: string; fallback: string }) => {
  const value = readText({ name, fallback });

  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const readInteger = ({ name, fallback }: { name: string; fallback: number }) => {
  const value = readText({ name });
  if (value === undefined) {
    return fallback;
  }

  const parsedValue = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer.`);
  }

  return parsedValue;
};

const readCsv = ({ name, fallback }: { name: string; fallback: string[] }) => {
  const value = readText({ name });
  if (value === undefined) {
    return fallback;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const isProduction = Bun.env.NODE_ENV === "production";

const readSecret = ({ name, fallback }: { name: string; fallback: string }) => {
  const value = readText({ name, fallback: isProduction ? undefined : fallback });
  if (
    value === undefined ||
    (isProduction && (value.length < 32 || /change[-_ ]|leiblog-dev-|example/i.test(value)))
  ) {
    throw new Error(`${name} must be configured with at least 32 random characters in production.`);
  }
  return value;
};

export const env: ServerEnv = Object.freeze({
  port: readInteger({ name: "PORT", fallback: DEFAULT_PORT }),
  hostname: readRequiredText({ name: "HOSTNAME", fallback: DEFAULT_HOSTNAME }),
  publicSiteUrl: resolvePublicOrigin({
    configuredOrigin: readText({ name: "PUBLIC_SITE_URL" }),
    corsOrigins: readCsv({ name: "CORS_ORIGINS", fallback: DEFAULT_CORS_ORIGINS }),
    hostname: readRequiredText({ name: "HOSTNAME", fallback: DEFAULT_HOSTNAME }),
    port: readInteger({ name: "PORT", fallback: DEFAULT_PORT }),
    isProduction,
  }),
  databaseUrl: readRequiredText({ name: "DATABASE_URL", fallback: DEFAULT_DATABASE_URL }),
  redisUrl: readRequiredText({ name: "REDIS_URL", fallback: DEFAULT_REDIS_URL }),
  corsOrigins: readCsv({ name: "CORS_ORIGINS", fallback: DEFAULT_CORS_ORIGINS }),
  jwtSecret: readSecret({
    name: "JWT_SECRET",
    fallback: "leiblog-dev-jwt-secret-change-me",
  }),
  configEncryptionSecret: readSecret({
    name: "CONFIG_ENCRYPTION_SECRET",
    fallback: "leiblog-dev-config-secret-change-me",
  }),
  altchaSecret: readSecret({
    name: "ALTCHA_SECRET",
    fallback: "leiblog-dev-altcha-secret-change-me",
  }),
  sessionTtlSeconds: readInteger({
    name: "SESSION_TTL_SECONDS",
    fallback: DEFAULT_SESSION_TTL_SECONDS,
  }),
  trustedProxyIps: readCsv({ name: "TRUSTED_PROXY_IPS", fallback: DEFAULT_TRUSTED_PROXY_IPS }),
  uploadsDir: readRequiredText({ name: "UPLOADS_DIR", fallback: "uploads" }),
  uploadsUrlPrefix: readRequiredText({ name: "UPLOADS_URL_PREFIX", fallback: "/uploads" }),
  uploadMaxFileSizeBytes: readInteger({
    name: "UPLOAD_MAX_FILE_SIZE_BYTES",
    fallback: 20 * 1024 * 1024,
  }),
  adminBootstrapUsername: readRequiredText({
    name: "ADMIN_BOOTSTRAP_USERNAME",
    fallback: "admin",
  }),
  adminBootstrapPassword: readText({ name: "ADMIN_BOOTSTRAP_PASSWORD" }),
  adminBootstrapEmail: readRequiredText({
    name: "ADMIN_BOOTSTRAP_EMAIL",
    fallback: "admin@example.com",
  }),
  adminBootstrapName: readText({ name: "ADMIN_BOOTSTRAP_NAME" }),
  adminBootstrapTags: readCsv({
    name: "ADMIN_BOOTSTRAP_TAGS",
    fallback: ["administrator"],
  }),
});

parseCorsOrigins(env.corsOrigins);
if (env.port > 65535) {
  throw new Error("PORT must not exceed 65535.");
}
if (!/^\/[A-Za-z0-9_/-]+$/.test(env.uploadsUrlPrefix) || env.uploadsUrlPrefix.includes("..")) {
  throw new Error("UPLOADS_URL_PREFIX must be a safe absolute URL path.");
}
if (isProduction) {
  if (
    readText({ name: "CORS_ORIGINS" }) === undefined ||
    env.corsOrigins.some((origin) => !origin.startsWith("https://"))
  ) {
    throw new Error("CORS_ORIGINS must list explicit HTTPS frontend origins in production.");
  }
  if (
    readText({ name: "DATABASE_URL" }) === undefined ||
    readText({ name: "REDIS_URL" }) === undefined
  ) {
    throw new Error("DATABASE_URL and REDIS_URL must be explicitly configured in production.");
  }
  if (
    env.adminBootstrapPassword !== undefined &&
    (env.adminBootstrapPassword.length < 12 ||
      /change[-_ ]|example/i.test(env.adminBootstrapPassword))
  ) {
    throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be a strong non-placeholder password.");
  }
}
