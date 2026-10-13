import { describe, expect, test } from "bun:test";

const envModule = new URL("./env.ts", import.meta.url).href;
const productionEnv = {
  NODE_ENV: "production",
  JWT_SECRET: "a".repeat(40),
  CONFIG_ENCRYPTION_SECRET: "b".repeat(40),
  ALTCHA_SECRET: "c".repeat(40),
  DATABASE_URL: "postgres://local-test@localhost/leiblog_test",
  REDIS_URL: "redis://localhost:6379",
  CORS_ORIGINS: "https://blog.example.com",
};

const checkEnvironment = (changes: Record<string, string | undefined> = {}) =>
  Bun.spawnSync({
    cmd: [process.execPath, "--no-env-file", "-e", `await import(${JSON.stringify(envModule)});`],
    env: { ...productionEnv, ...changes },
  });

describe("production configuration", () => {
  test("accepts explicit production configuration", () => {
    expect(checkEnvironment().exitCode).toBe(0);
  });

  test("refuses missing or placeholder secrets", () => {
    for (const changes of [
      { JWT_SECRET: "" },
      { ALTCHA_SECRET: "change-this-altcha-secret" },
      { CONFIG_ENCRYPTION_SECRET: "short" },
    ]) {
      expect(checkEnvironment(changes).exitCode).not.toBe(0);
    }
  });

  test("refuses wildcard credentials and insecure frontend origins", () => {
    for (const origin of ["*", "http://blog.example.com", "/^https:\\/\\/.*$/"]) {
      expect(checkEnvironment({ CORS_ORIGINS: origin }).exitCode).not.toBe(0);
    }
  });

  test("does not silently truncate malformed integers", () => {
    for (const value of ["3000junk", "2.5", "9007199254740993", "65536"]) {
      expect(checkEnvironment({ PORT: value }).exitCode).not.toBe(0);
    }
  });

  test("refuses default bootstrap passwords", () => {
    expect(checkEnvironment({ ADMIN_BOOTSTRAP_PASSWORD: "change-me-now" }).exitCode).not.toBe(0);
  });
});
