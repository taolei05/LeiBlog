import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  isMediaStorageKeyValid,
  resolveMediaStoragePath,
  resolveSafeMediaStoragePath,
} from "./storage-path";
import { buildR2ObjectUrl, deleteR2Object, getR2Object, putR2Object } from "./r2-storage";
import { createMediaFileRoutes } from "./public-routes";

let fixtureRoot = "";
beforeEach(async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), "leiblog-media-test-"));
});
afterEach(async () => {
  await rm(fixtureRoot, { recursive: true, force: true });
});

test.each([
  "",
  ".",
  "..",
  "../outside",
  "/absolute",
  "a/../b",
  "a//b",
  "a\\b",
  "C:/file",
  "a/%2e%2e/b",
  "a\0b",
])("rejects noncanonical storage key %j", (storageKey) => {
  expect(isMediaStorageKeyValid(storageKey)).toBe(false);
  expect(() => resolveMediaStoragePath({ root: fixtureRoot, storageKey })).toThrow();
});

test("resolves a new nested media path inside the uploads root", async () => {
  const storageKey = "media/2026/10/asset.png";
  expect(await resolveSafeMediaStoragePath({ root: fixtureRoot, storageKey })).toBe(
    join(fixtureRoot, storageKey),
  );
});

test("rejects symlinked directories, files, and the uploads root", async () => {
  const uploads = join(fixtureRoot, "uploads");
  const outside = join(fixtureRoot, "outside");
  await mkdir(uploads);
  await mkdir(outside);
  await writeFile(join(outside, "file.txt"), "fixture");
  await symlink(outside, join(uploads, "linked"));
  await symlink(join(outside, "file.txt"), join(uploads, "file.txt"));
  await symlink(uploads, join(fixtureRoot, "root-link"));
  await expect(
    resolveSafeMediaStoragePath({ root: uploads, storageKey: "linked/file.txt" }),
  ).rejects.toThrow();
  await expect(
    resolveSafeMediaStoragePath({ root: uploads, storageKey: "file.txt" }),
  ).rejects.toThrow();
  await expect(
    resolveSafeMediaStoragePath({ root: join(fixtureRoot, "root-link"), storageKey: "new.txt" }),
  ).rejects.toThrow();
});

test("serves uploads created after startup and stops serving them after deletion", async () => {
  const app = createMediaFileRoutes({ root: fixtureRoot, prefix: "/uploads" }).compile();
  const request = () => new Request("http://localhost/uploads/media/2026/10/new.txt");
  const missing = await app.handle(request());
  expect(missing.status).toBe(404);
  expect(missing.headers.get("cache-control")).toBe("no-store");
  const directory = join(fixtureRoot, "media", "2026", "10");
  await mkdir(directory, { recursive: true });
  const filePath = join(directory, "new.txt");
  await writeFile(filePath, "uploaded after startup");
  const response = await app.handle(request());
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("uploaded after startup");
  const head = await app.handle(new Request(request(), { method: "HEAD" }));
  expect(head.status).toBe(200);
  expect(head.headers.get("content-length")).toBe(String("uploaded after startup".length));
  await rm(filePath);
  expect((await app.handle(request())).status).toBe(404);
});

test("serves matching GET and HEAD metadata over HTTP without a HEAD body", async () => {
  const contents = "uploaded over HTTP";
  await writeFile(join(fixtureRoot, "file.txt"), contents);
  const app = createMediaFileRoutes({ root: fixtureRoot, prefix: "/uploads" }).listen({
    hostname: "127.0.0.1",
    port: 0,
  });
  try {
    if (!app.server) throw new Error("Media test server did not start");
    const url = new URL("/uploads/file.txt", app.server.url);
    const get = await fetch(url);
    expect(get.status).toBe(200);
    expect(get.headers.get("content-length")).toBe(String(contents.length));
    expect(await get.text()).toBe(contents);
    const head = await fetch(url, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe(get.headers.get("content-length"));
    expect(head.headers.get("content-type")).toBe(get.headers.get("content-type"));
    expect(await head.text()).toBe("");
  } finally {
    await app.stop(true);
  }
});

test("public upload routes reject hidden files, directories, traversal and symbolic links", async () => {
  const uploads = join(fixtureRoot, "uploads");
  const outside = join(fixtureRoot, "private.txt");
  await mkdir(uploads);
  await writeFile(outside, "private fixture");
  await mkdir(join(uploads, "directory"));
  await writeFile(join(uploads, ".env"), "private fixture");
  await symlink(outside, join(uploads, "linked.txt"));
  const app = createMediaFileRoutes({ root: uploads, prefix: "/uploads" });
  for (const path of [".env", "linked.txt", "%252e%252e/private.txt", "%2e%2e/private.txt", "missing", "directory"]) {
    const response = await app.handle(new Request(`http://localhost/uploads/${path}`));
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("private fixture");
  }
});

const settings = {
  accessKeyId: "fixture-access-key",
  accountId: "a".repeat(32),
  bucket: "fixture-bucket",
  publicBaseUrl: "https://media.example.test/",
  secretAccessKey: "fixture-secret",
};

test("rejects R2 traversal before constructing or sending requests", async () => {
  expect(() => buildR2ObjectUrl(settings, "../other-bucket/file.txt")).toThrow();
  await expect(getR2Object(settings, "../other-bucket/file.txt")).rejects.toThrow();
  await expect(deleteR2Object(settings, "a/../file.txt")).rejects.toThrow();
  await expect(
    putR2Object({
      settings,
      key: "/file.txt",
      body: Buffer.from("fixture"),
      contentType: "text/plain",
    }),
  ).rejects.toThrow();
  expect(buildR2ObjectUrl(settings, "media/asset.png")).toBe(
    "https://media.example.test/media/asset.png",
  );
});

test("rejects R2 authority and bucket injection before network access", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = Object.assign(
    async () => {
      calls += 1;
      return new Response("fixture");
    },
    { preconnect: originalFetch.preconnect },
  );
  try {
    for (const injected of [
      { ...settings, accountId: "127.0.0.1:443/#" },
      { ...settings, accountId: "attacker.test/#" },
      { ...settings, accountId: "x@attacker.test/#" },
      { ...settings, bucket: "../other-bucket" },
    ]) {
      await expect(getR2Object(injected, "media/image.png")).rejects.toThrow();
      await expect(deleteR2Object(injected, "media/image.png")).rejects.toThrow();
      await expect(
        putR2Object({
          settings: injected,
          key: "media/image.png",
          body: Buffer.from("fixture"),
          contentType: "image/png",
        }),
      ).rejects.toThrow();
    }
    expect(calls).toBe(0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("bounds R2 streaming downloads even without Content-Length", async () => {
  const originalFetch = globalThis.fetch;
  let cancelled = false;
  const chunk = new Uint8Array(1024 * 1024);
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(chunk);
    },
    cancel() {
      cancelled = true;
    },
  });
  globalThis.fetch = Object.assign(async () => new Response(stream), {
    preconnect: originalFetch.preconnect,
  });
  try {
    await expect(getR2Object(settings, "media/image.png")).rejects.toThrow("download size");
    expect(cancelled).toBe(true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
