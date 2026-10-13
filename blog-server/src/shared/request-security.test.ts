import { describe, expect, test } from "bun:test";
import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";

import { isAllowedOrigin, isAllowedWriteRequest, parseCorsOrigins } from "./cors-policy";
import { createRequestSecurity } from "./request-security";

const allowedOrigins = parseCorsOrigins(["https://blog.example.com"]);

describe("cross-site request protection", () => {
  test("refuses credentialed wildcard and unanchored patterns", () => {
    expect(() => parseCorsOrigins(["*"])).toThrow();
    expect(() => parseCorsOrigins(["/example.com/"])).toThrow();
    expect(() => parseCorsOrigins(["https://blog.example.com/path"])).toThrow();
  });

  test("matches complete configured origins", () => {
    expect(isAllowedOrigin({ origin: "https://blog.example.com", allowedOrigins })).toBe(true);
    expect(isAllowedOrigin({ origin: "https://blog.example.com.evil.test", allowedOrigins })).toBe(
      false,
    );
  });

  test("blocks same-site attacker origins and opaque origins", () => {
    for (const origin of ["https://evil.example.com", "null"]) {
      expect(
        isAllowedWriteRequest({
          allowedOrigins,
          request: new Request("https://api.example.com/api/blog/auth/me", {
            method: "PATCH",
            headers: { origin, cookie: "session=value" },
          }),
        }),
      ).toBe(false);
    }
  });

  test("accepts a configured origin and same-origin deployment", () => {
    for (const origin of ["https://blog.example.com", "https://api.example.com"]) {
      expect(
        isAllowedWriteRequest({
          allowedOrigins,
          request: new Request("https://api.example.com/api/blog/auth/me", {
            method: "PATCH",
            headers: { origin, cookie: "session=value" },
          }),
        }),
      ).toBe(true);
    }
  });

  test("cookie writes require Origin or a trusted Referer", () => {
    expect(
      isAllowedWriteRequest({
        allowedOrigins,
        request: new Request("https://api.example.com/api/blog/auth/logout", {
          method: "POST",
          headers: { cookie: "session=value" },
        }),
      }),
    ).toBe(false);
    expect(
      isAllowedWriteRequest({
        allowedOrigins,
        request: new Request("https://api.example.com/api/blog/auth/logout", {
          method: "POST",
          headers: { cookie: "session=value", referer: "https://blog.example.com/account" },
        }),
      }),
    ).toBe(true);
  });
});

describe("HTTP safety controls", () => {
  const app = new Elysia()
    .use(createRequestSecurity({ consumeRateLimit: async () => 0 }))
    .post("/api/echo", ({ body }) => body, {
      body: t.Object({ password: t.String({ minLength: 8 }) }),
    })
    .get("/api/failure", () => {
      throw new Error("secret database connection");
    });

  test("rejects cross-origin writes before invoking handlers", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/echo", {
        method: "POST",
        headers: { origin: "https://evil.test", "content-type": "application/json" },
        body: JSON.stringify({ password: "test-password" }),
      }),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test("does not echo password input in validation errors", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/echo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "secret" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("secret");
  });

  test("limits actual streamed bytes when Content-Length is missing", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/echo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "a".repeat(2 * 1024 * 1024) }),
      }),
    );
    expect(response.status).toBe(413);
  });

  test("rejects malformed JSON without leaking its contents", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/echo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"password":"secret"',
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("secret");
  });

  test("preserves multipart file uploads through the bounded parser", async () => {
    const upload = new Elysia()
      .use(createRequestSecurity({ consumeRateLimit: async () => 0 }))
      .post("/api/file", ({ body }) => ({ name: body.file.name, note: body.note }), {
        body: t.Object({ file: t.File(), note: t.String() }),
      });
    const form = new FormData();
    form.set("file", new File(["sample"], "sample.txt"));
    form.set("note", "caption");
    const response = await upload.handle(
      new Request("http://localhost/api/file", { method: "POST", body: form }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: "sample.txt", note: "caption" });
  });

  test("hides internal failures and prevents caching API responses", async () => {
    const response = await app.handle(new Request("http://localhost/api/failure"));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("database");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  test("returns retry information when rate limited", async () => {
    const limited = new Elysia()
      .use(createRequestSecurity({ consumeRateLimit: async () => 45 }))
      .get("/api/resource", () => "ok");
    const response = await limited.handle(new Request("http://localhost/api/resource"));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("45");
  });

  test("rate-limit responses keep CORS headers for the allowed frontend", async () => {
    const limited = new Elysia()
      .use(cors({ origin: "http://localhost:5174", credentials: true }))
      .use(createRequestSecurity({ consumeRateLimit: async () => 45 }))
      .get("/api/resource", () => "ok");
    const response = await limited.handle(
      new Request("http://localhost/api/resource", {
        headers: { origin: "http://localhost:5174" },
      }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5174");
  });

  test("does not run protected endpoints if the limiter is unavailable", async () => {
    const unavailable = new Elysia()
      .use(
        createRequestSecurity({
          consumeRateLimit: async () => {
            throw new Error("offline");
          },
        }),
      )
      .get("/api/resource", () => "ok");
    const response = await unavailable.handle(new Request("http://localhost/api/resource"));
    expect(response.status).toBe(503);
  });
});
