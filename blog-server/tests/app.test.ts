import { describe, expect, test } from "bun:test";

import { createApp } from "../src/app";
import { loadConfig } from "../src/shared/config";

describe("app skeleton", () => {
  test("responds with base API metadata", async () => {
    const app = await createApp({ enableStatic: false });
    const response = await app.handle(new Request("http://localhost/"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      name: "LeiBlog API",
    });
  });

  test("responds with health metadata", async () => {
    const app = await createApp({ enableStatic: false });
    const response = await app.handle(
      new Request("http://localhost/api/health")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.name).toBe("LeiBlog API");
    expect(body.env).toBe("test");
  });

  test("separates process liveness from dependency readiness", async () => {
    const app = await createApp({ enableStatic: false });
    const liveResponse = await app.handle(
      new Request("http://localhost/api/health/live")
    );
    const liveBody = await liveResponse.json();

    expect(liveResponse.status).toBe(200);
    expect(liveBody.ok).toBe(true);
    expect(liveBody.checks).toBeUndefined();

    const readyResponse = await app.handle(
      new Request("http://localhost/api/health/ready")
    );
    const readyBody = await readyResponse.json();

    expect([200, 503]).toContain(readyResponse.status);
    expect(readyBody.checks).toEqual({
      database: expect.any(Boolean),
      redis: expect.any(Boolean),
    });
  });

  test("uses unified not found response", async () => {
    const app = await createApp({ enableStatic: false });
    const response = await app.handle(
      new Request("http://localhost/missing")
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "接口不存在",
    });
  });

  test("does not expose raw validation details in production", async () => {
    const config = loadConfig({
      APP_SECRET_KEY: "production-app-secret",
      CORS_ORIGINS: "https://blog.example.com",
      JWT_SECRET: "production-jwt-secret",
      NODE_ENV: "production",
      SETUP_TOKEN: "production-setup-token",
    });
    const app = await createApp({ config, enableStatic: false });
    const response = await app.handle(
      new Request("http://localhost/api/auth/login", {
        body: JSON.stringify({
          identifier: "reader",
          password: 12345,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "请求参数无效：请检查初始化表单字段",
    });
  });

  test("disables OpenAPI by default and exposes rate limit headers in production", async () => {
    const config = loadConfig({
      APP_SECRET_KEY: "production-app-secret",
      CORS_ORIGINS: "https://blog.example.com",
      JWT_SECRET: "production-jwt-secret",
      NODE_ENV: "production",
      SETUP_TOKEN: "production-setup-token",
    });
    const app = await createApp({ config, enableStatic: false });

    const openapiResponse = await app.handle(
      new Request("http://localhost/api/openapi")
    );
    expect(openapiResponse.status).toBe(404);

    const corsResponse = await app.handle(
      new Request("http://localhost/", {
        headers: {
          origin: "https://blog.example.com",
        },
      })
    );
    expect(corsResponse.headers.get("access-control-allow-origin")).toBe(
      "https://blog.example.com"
    );
    expect(corsResponse.headers.get("access-control-expose-headers")).toContain(
      "Retry-After"
    );
  });

  test("rejects invalid numeric and boolean queries", async () => {
    const app = await createApp({ enableStatic: false });

    for (const path of [
      "/api/public/articles?page=nope",
      "/api/public/articles?isPinned=maybe",
      "/api/public/guestbook/comments?pageSize=0",
    ]) {
      const response = await app.handle(new Request(`http://localhost${path}`));
      expect(response.status).toBe(422);
    }
  });
});
