import { describe, expect, test } from "bun:test";

import { assertWritableAdmin, hashPassword, verifyPassword } from "../src/shared/auth";
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

  test("blocks demo writes", () => {
    expect(() =>
      assertWritableAdmin({
        id: "demo",
        role: "demo",
        username: "demo",
        email: null,
        name: null,
        avatarUrl: null,
      })
    ).toThrow(AppError);
  });
});
