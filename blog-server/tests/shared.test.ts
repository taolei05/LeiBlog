import { describe, expect, test } from "bun:test";

import { hashPassword, requireAdmin, verifyPassword } from "../src/shared/auth";
import { loadConfig } from "../src/shared/config";
import { decryptSecret, encryptSecret } from "../src/shared/crypto";
import { AppError } from "../src/shared/errors";
import { createPinyinSlug, createUniqueSlug } from "../src/shared/slug";

describe("shared infrastructure", () => {
  test("loads config with defaults", () => {
    const config = loadConfig({ NODE_ENV: "test" });

    expect(config.env).toBe("test");
    expect(config.port).toBe(3000);
    expect(config.databaseUrl).toContain("lei_blog");
    expect(config.redisUrl).toBe("redis://localhost:6379");
    expect(config.openapiEnabled).toBe(true);
    expect(config.setupToken).toBeNull();
    expect(config.trustedProxyIps).toEqual([]);
  });

  test("requires setup token and explicit CORS origins in production", () => {
    const productionEnv = {
      APP_SECRET_KEY: "production-app-secret",
      JWT_SECRET: "production-jwt-secret",
      NODE_ENV: "production",
    };

    expect(() => loadConfig(productionEnv)).toThrow("SETUP_TOKEN");
    expect(() =>
      loadConfig({
        ...productionEnv,
        SETUP_TOKEN: "production-setup-token",
      })
    ).toThrow("CORS_ORIGINS");

    const config = loadConfig({
      ...productionEnv,
      CORS_ORIGINS: "https://blog.example.com",
      SETUP_TOKEN: "production-setup-token",
      TRUSTED_PROXY_IPS: "127.0.0.1,10.0.0.10",
    });

    expect(config.setupToken).toBe("production-setup-token");
    expect(config.trustedProxyIps).toEqual(["127.0.0.1", "10.0.0.10"]);
    expect(config.openapiEnabled).toBe(false);

    expect(loadConfig({
      ...productionEnv,
      CORS_ORIGINS: "https://blog.example.com",
      OPENAPI_ENABLED: "true",
      SETUP_TOKEN: "production-setup-token",
    }).openapiEnabled).toBe(true);
  });

  test("encrypts and decrypts secrets", () => {
    const encrypted = encryptSecret("resend-key", "test-secret");

    expect(encrypted?.data).not.toBe("resend-key");
    expect(decryptSecret(encrypted, "test-secret")).toBe("resend-key");
  });

  test("creates pinyin based slugs", async () => {
    expect(createPinyinSlug("你好 LeiBlog")).toBe("ni-hao-leiblog");

    const existing = new Set(["lei-blog", "lei-blog-2"]);
    const slug = await createUniqueSlug("Lei Blog", (value) => existing.has(value));

    expect(slug).toBe("lei-blog-3");
  });

  test("hashes and verifies passwords", async () => {
    const hash = await hashPassword("12345678");

    expect(hash).not.toBe("12345678");
    expect(await verifyPassword("12345678", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  test("blocks ordinary users from admin access", () => {
    expect(() =>
      requireAdmin({
        id: "user",
        role: "user",
        username: "user",
        email: null,
        name: null,
        avatarUrl: null,
      })
    ).toThrow(AppError);
  });
});
