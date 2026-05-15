import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  createMigratedTestDatabase,
  type TestDatabase,
} from "./helpers/database";

let testDatabase: TestDatabase;

beforeAll(async () => {
  testDatabase = await createMigratedTestDatabase("lei_blog_http_routes_test");
});

afterAll(async () => {
  await testDatabase?.drop();
});

describe("http route integration", () => {
  test("serves public routes and enforces auth/role boundaries", async () => {
    const serverDir = join(import.meta.dir, "..");
    const proc = Bun.spawn({
      cmd: [process.execPath, "tests/fixtures/http-routes-fixture.ts"],
      cwd: serverDir,
      env: {
        ...Bun.env,
        APP_ENV: "test",
        NODE_ENV: "test",
        DATABASE_URL: testDatabase.databaseUrl,
        REDIS_URL: Bun.env.REDIS_URL ?? "redis://localhost:6379",
        APP_SECRET_KEY: "leiblog-test-secret",
        JWT_SECRET: "leiblog-test-jwt-secret",
        UPLOADS_DIR: join(serverDir, "uploads/test-routes"),
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    expect({
      exitCode,
      stdout,
      stderr,
    }).toEqual({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });
  });
});
