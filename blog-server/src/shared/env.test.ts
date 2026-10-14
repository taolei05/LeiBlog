import { describe, expect, test } from "bun:test";

const envModule = new URL("./env.ts", import.meta.url).href;
const corsPolicyModule = new URL("./cors-policy.ts", import.meta.url).href;
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

  test("refuses weak initialization tokens", () => {
    expect(checkEnvironment({ SETUP_TOKEN: "change-me-now" }).exitCode).not.toBe(0);
    expect(checkEnvironment({ SETUP_TOKEN: "a".repeat(48) }).exitCode).toBe(0);
  });
});

test("development permits LAN HTTPS only on its dedicated port, without opening public origins", () => {
  const result = Bun.spawnSync({
    cmd: [
      process.execPath,
      "--no-env-file",
      "-e",
      `
      const {env}=await import(${JSON.stringify(envModule)});
      const {parseCorsOrigins,isAllowedOrigin}=await import(${JSON.stringify(corsPolicyModule)});
      const allowedOrigins=parseCorsOrigins(env.corsOrigins);
      const origins=["https://192.168.3.125:5175","https://10.0.0.2:5175","https://172.16.1.2:5175","https://localhost:5175","http://localhost:5174","https://example.com:5175","https://192.168.3.125:5176","https://192.168.3.125.evil.test:5175"];
      console.log(JSON.stringify(origins.map(origin=>isAllowedOrigin({origin,allowedOrigins}))));
    `,
    ],
    env: { ...productionEnv, NODE_ENV: "development", CORS_ORIGINS: undefined },
  });
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout.toString())).toEqual([
    true,
    true,
    true,
    true,
    true,
    false,
    false,
    false,
  ]);
});
