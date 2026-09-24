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

type ServerEnv = {
  port: number;
  hostname: string;
  databaseUrl: string;
  redisUrl: string;
  corsOrigins: string[];
  jwtSecret: string;
  configEncryptionSecret: string;
  sessionTtlSeconds: number;
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

  const parsedValue = Number.parseInt(value, 10);
  if (Number.isNaN(parsedValue) || parsedValue <= 0) {
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

export const env: ServerEnv = Object.freeze({
  port: readInteger({ name: "PORT", fallback: DEFAULT_PORT }),
  hostname: readRequiredText({ name: "HOSTNAME", fallback: DEFAULT_HOSTNAME }),
  databaseUrl: readRequiredText({ name: "DATABASE_URL", fallback: DEFAULT_DATABASE_URL }),
  redisUrl: readRequiredText({ name: "REDIS_URL", fallback: DEFAULT_REDIS_URL }),
  corsOrigins: readCsv({ name: "CORS_ORIGINS", fallback: DEFAULT_CORS_ORIGINS }),
  jwtSecret: readRequiredText({
    name: "JWT_SECRET",
    fallback: "leiblog-dev-jwt-secret-change-me",
  }),
  configEncryptionSecret: readRequiredText({
    name: "CONFIG_ENCRYPTION_SECRET",
    fallback: "leiblog-dev-config-secret-change-me",
  }),
  sessionTtlSeconds: readInteger({
    name: "SESSION_TTL_SECONDS",
    fallback: DEFAULT_SESSION_TTL_SECONDS,
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
