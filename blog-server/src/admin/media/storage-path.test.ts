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
