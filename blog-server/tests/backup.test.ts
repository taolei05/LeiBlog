import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import AdmZip from "adm-zip";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  createBackupArchive,
  importBackupArchive,
  previewBackupArchive,
} from "../src/admin/backup/service";
import { uploadMedia } from "../src/admin/media/service";
import { hashPassword, type AuthUser } from "../src/shared/auth";
import { loadConfig } from "../src/shared/config";
import { decryptSecret, encryptSecret, type StoredEncryptedSecret } from "../src/shared/crypto";
import { createMigratedTestDatabase, type TestDatabase } from "./helpers/database";

let testDatabase: TestDatabase;
let testDb: Bun.SQL;
let uploadRoot = "";

const currentAdmin: AuthUser = {
  avatarUrl: null,
  email: "admin@example.com",
  id: "00000000-0000-0000-0000-000000000001",
  name: null,
  role: "admin",
  username: "admin",
};

function pngFile(name = "backup-cover.png") {
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

function readJsonEntry<T>(zip: AdmZip, name: string): T {
  const entry = zip.getEntry(name);
  if (!entry) throw new Error(`Missing zip entry: ${name}`);
  return JSON.parse(entry.getData().toString("utf8")) as T;
}

function toFilePart(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

beforeAll(async () => {
  testDatabase = await createMigratedTestDatabase("lei_blog_backup_test");
  testDb = new Bun.SQL(testDatabase.databaseUrl, { max: 1 });
  uploadRoot = join(tmpdir(), `leiblog-backup-${Date.now()}`);
  await mkdir(uploadRoot, { recursive: true });

  const [admin] = await testDb<{ id: string }[]>`
    INSERT INTO users (username, password_hash, email, role)
    VALUES ('admin', ${await hashPassword("admin-password")}, 'admin@example.com', 'admin')
    RETURNING id
  `;

  currentAdmin.id = admin.id;

  await testDb`
    INSERT INTO site_config (id, comments_enabled)
    VALUES (1, true)
    ON CONFLICT (id) DO NOTHING
  `;
  await testDb`
    UPDATE site_config
    SET resend_api_key_encrypted = ${encryptSecret("resend-secret")},
        deepl_api_key_encrypted = ${encryptSecret("deepl-secret")},
        ipgeolocation_api_key_encrypted = ${encryptSecret("ip-secret")},
        r2_secret_access_key_encrypted = ${encryptSecret("r2-secret")}
    WHERE id = 1
  `;

  await testDb`
    UPDATE auth_provider_settings
    SET client_secret_encrypted = ${encryptSecret("github-secret")}
    WHERE provider = 'github'
  `;
});

afterAll(async () => {
  await testDb?.close({ timeout: 1 });
  await testDatabase?.drop();
  await rm(uploadRoot, { recursive: true, force: true });
});

describe("admin backup service", () => {
  test("exports a zip backup with sanitized data and media files", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      UPLOADS_DIR: uploadRoot,
      UPLOADS_URL_PREFIX: "/uploads",
    });

    const uploaded = await uploadMedia(
      currentAdmin,
      { file: pngFile(), fileName: "备份封面.png", folderSlug: "article-covers" },
      { client: testDb, config }
    );

    const backup = await createBackupArchive(currentAdmin, { client: testDb, config });
    const zip = new AdmZip(Buffer.from(backup.data));
    const entryNames = zip.getEntries().map((entry) => entry.entryName);

    expect(backup.fileName).toMatch(/^leiblog-backup-.*\.zip$/);
    expect(entryNames).toContain("manifest.json");
    expect(entryNames).toContain("data.json");
    expect(entryNames).toContain("media-manifest.json");
    expect(entryNames.some((name) => name.startsWith("media/"))).toBe(true);

    const data = readJsonEntry<{
      tables: {
        auth_provider_settings: Array<Record<string, unknown>>;
        media_assets: Array<Record<string, unknown>>;
        site_config: Array<Record<string, unknown>>;
      };
    }>(zip, "data.json");
    const serializedData = JSON.stringify(data);

    expect(serializedData).not.toContain("resend-secret");
    expect(serializedData).not.toContain("deepl-secret");
    expect(serializedData).not.toContain("ip-secret");
    expect(serializedData).not.toContain("r2-secret");
    expect(serializedData).not.toContain("github-secret");
    expect(data.tables.site_config[0]).not.toHaveProperty("resend_api_key_encrypted");
    expect(data.tables.site_config[0]).not.toHaveProperty("deepl_api_key_encrypted");
    expect(data.tables.site_config[0]).not.toHaveProperty("ipgeolocation_api_key_encrypted");
    expect(data.tables.site_config[0]).not.toHaveProperty("r2_secret_access_key_encrypted");
    expect(data.tables.auth_provider_settings[0]).not.toHaveProperty("client_secret_encrypted");
    expect(data.tables.media_assets.some((item) => item.id === uploaded.id)).toBe(true);
  });

  test("previews a zip backup before import", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      UPLOADS_DIR: uploadRoot,
      UPLOADS_URL_PREFIX: "/uploads",
    });
    const backup = await createBackupArchive(currentAdmin, { client: testDb, config });
    const preview = await previewBackupArchive(currentAdmin, {
      file: new File([toFilePart(backup.data)], backup.fileName, { type: "application/zip" }),
    });

    expect(preview.ok).toBe(true);
    expect(preview.manifest.format).toBe("leiblog-backup");
    expect(preview.tables.users).toBeGreaterThanOrEqual(1);
    expect(preview.media.total).toBeGreaterThanOrEqual(1);
    expect(preview.sensitiveConfigExported).toBe(false);
  });

  test("imports a backup without overwriting sensitive configuration", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      UPLOADS_DIR: uploadRoot,
      UPLOADS_URL_PREFIX: "/uploads",
    });
    await testDb`
      INSERT INTO article_categories (name, slug)
      VALUES ('备份恢复', 'backup-restore')
      ON CONFLICT DO NOTHING
    `;
    const backup = await createBackupArchive(currentAdmin, { client: testDb, config });

    await testDb`DELETE FROM article_categories WHERE slug = 'backup-restore'`;
    await testDb`
      INSERT INTO site_config (id, resend_api_key_encrypted)
      VALUES (1, ${encryptSecret("current-resend-secret")})
      ON CONFLICT (id) DO UPDATE
      SET resend_api_key_encrypted = EXCLUDED.resend_api_key_encrypted
    `;

    const result = await importBackupArchive(currentAdmin, {
      client: testDb,
      config,
      file: new File([toFilePart(backup.data)], backup.fileName, { type: "application/zip" }),
      mode: "replace",
    });
    const [category] = await testDb<{ id: string }[]>`
      SELECT id FROM article_categories WHERE slug = 'backup-restore'
    `;
    const [siteConfig] = await testDb<{
      resend_api_key_encrypted: StoredEncryptedSecret | null;
    }[]>`
      SELECT resend_api_key_encrypted FROM site_config WHERE id = 1
    `;

    expect(result.ok).toBe(true);
    expect(category?.id).toBeTruthy();
    expect(decryptSecret(siteConfig?.resend_api_key_encrypted ?? null)).toBe(
      "current-resend-secret"
    );
  });
});
