import { describe, expect, test } from "bun:test";

import { createApp } from "../src/app";

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
});
