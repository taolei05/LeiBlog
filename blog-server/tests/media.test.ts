import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  deleteMedia,
  getMediaById,
  getMediaDownload,
  getMediaLink,
  getMediaPreview,
  listMedia,
  renameMedia,
  uploadMedia,
} from "../src/admin/media/service";
import { hashPassword, type AuthUser } from "../src/shared/auth";
import { loadConfig } from "../src/shared/config";

const POSTGRES_ADMIN_URL =
  process.env.TEST_POSTGRES_ADMIN_URL ??
  "postgres://taolei:12345678@localhost:5432/postgres";

const dbName = `lei_blog_media_test_${Date.now()}`;
const adminDb = new Bun.SQL(POSTGRES_ADMIN_URL, { max: 1 });
let testDb: Bun.SQL;
let uploadRoot = "";
let currentAdmin: AuthUser;

function pngFile(name = "cover.png") {
  return new File(
    [
      new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
      ]),
    ],
    name,
    { type: "image/png" }
  );
}

beforeAll(async () => {
  uploadRoot = await mkdtemp(join(tmpdir(), "leiblog-media-"));
  await adminDb.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await adminDb.unsafe(`CREATE DATABASE ${dbName}`);

  testDb = new Bun.SQL(
    `postgres://taolei:12345678@localhost:5432/${dbName}`,
    { max: 1 }
  );

  const migration = readFileSync(
    join(import.meta.dir, "../src/db/migrations/001_initial_schema.sql"),
    "utf8"
  );
  await testDb.unsafe(migration);

  const [admin] = await testDb<{ id: string }[]>`
    INSERT INTO users (username, password_hash, email, role)
    VALUES ('admin', ${await hashPassword("admin-password")}, 'admin@example.com', 'admin')
    RETURNING id
  `;

  currentAdmin = {
    id: admin.id,
    username: "admin",
    email: "admin@example.com",
    name: null,
    role: "admin",
    avatarUrl: null,
  };
});

afterAll(async () => {
  await testDb?.close({ timeout: 1 });
  await adminDb.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await adminDb.close({ timeout: 1 });
  await rm(uploadRoot, { recursive: true, force: true });
});

describe("admin media service", () => {
  test("uploads, lists, renames, links, previews, downloads, and deletes media", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      UPLOADS_DIR: uploadRoot,
      UPLOADS_URL_PREFIX: "/uploads",
      UPLOAD_MAX_FILE_SIZE_BYTES: "1024",
    });

    const uploaded = await uploadMedia(
      currentAdmin,
      { file: pngFile(), fileName: "封面图.png" },
      { client: testDb, config }
    );

    expect(uploaded.fileName).toBe("封面图.png");
    expect(uploaded.fileFormat).toBe("png");
    expect(uploaded.fileType).toBe("image");
    expect(uploaded.accessUrl.startsWith("/uploads/")).toBe(true);

    const list = await listMedia(
      currentAdmin,
      { fileType: "image", fileFormat: "png", search: "封面", page: "1" },
      { client: testDb, config }
    );
    expect(list.total).toBe(1);
    expect(list.items[0]?.id).toBe(uploaded.id);

    const detail = await getMediaById(currentAdmin, uploaded.id, {
      client: testDb,
      config,
    });
    expect(detail.accessUrl).toBe(uploaded.accessUrl);

    const link = await getMediaLink(currentAdmin, uploaded.id, {
      client: testDb,
      config,
    });
    expect(link.accessUrl).toBe(uploaded.accessUrl);

    const preview = await getMediaPreview(currentAdmin, uploaded.id, {
      client: testDb,
      config,
    });
    expect(preview.implemented).toBe(false);
    expect(preview.fileType).toBe("image");

    const download = await getMediaDownload(currentAdmin, uploaded.id, {
      client: testDb,
      config,
    });
    expect(download.contentType).toBe("image/png");
    expect((await stat(download.filePath)).isFile()).toBe(true);

    const renamed = await renameMedia(
      currentAdmin,
      uploaded.id,
      "renamed.png",
      { client: testDb, config }
    );
    expect(renamed.fileName).toBe("renamed.png");

    await deleteMedia(currentAdmin, uploaded.id, { client: testDb, config });

    const afterDelete = await listMedia(currentAdmin, {}, { client: testDb, config });
    expect(afterDelete.total).toBe(0);
    await expect(stat(download.filePath)).rejects.toThrow();
  });

  test("rejects invalid files and blocks demo writes", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      UPLOADS_DIR: uploadRoot,
      UPLOADS_URL_PREFIX: "/uploads",
      UPLOAD_MAX_FILE_SIZE_BYTES: "1024",
    });

    await expect(
      uploadMedia(
        currentAdmin,
        {
          file: new File(["not a png"], "fake.png", { type: "image/png" }),
        },
        { client: testDb, config }
      )
    ).rejects.toThrow("文件内容与扩展名不匹配");

    await expect(
      uploadMedia(
        { ...currentAdmin, role: "demo" },
        { file: pngFile("demo.png") },
        { client: testDb, config }
      )
    ).rejects.toThrow("演示账户仅允许读取");
  });
});
