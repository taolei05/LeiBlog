import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";

import AdmZip from "adm-zip";

import { BackupError, readBackupZip } from "./archive";
import { EXPORTED_TABLES, excludeSensitiveColumns, readBackupPayload } from "./payload";

const createFixture = () => {
  const bytes = Buffer.from("fixture document");
  const entry = {
    accessUrl: "/uploads/media/asset.txt",
    entryName: "media/asset/document.txt",
    fileFormat: "txt",
    fileName: "document.txt",
    fileSizeBytes: bytes.length,
    id: "00000000-0000-4000-8000-000000000001",
    sha256: createHash("sha256").update(bytes).digest("hex"),
    storageKey: "media/asset.txt",
    storageProvider: "local" as const,
  };
  const tables: Record<string, Record<string, unknown>[]> = Object.fromEntries(
    EXPORTED_TABLES.map((table) => [table, []]),
  );
  tables.media_assets.push({
    id: entry.id,
    file_name: entry.fileName,
    file_format: entry.fileFormat,
    file_size_bytes: entry.fileSizeBytes,
    access_url: entry.accessUrl,
    storage_key: entry.storageKey,
    storage_provider: entry.storageProvider,
  });
  const manifest = {
    createdAt: "2026-10-12T00:00:00Z",
    format: "leiblog-backup",
    version: 1,
    media: { included: true, total: 1, totalBytes: bytes.length },
    tables: [...EXPORTED_TABLES],
    sensitiveFieldsExcluded: [],
  };
  const data = {
    exportedAt: manifest.createdAt,
    format: "leiblog-backup-data",
    version: 1,
    tables,
  };
  const media = { entries: [entry], total: 1, totalBytes: bytes.length };
  return { bytes, entry, manifest, data, media };
};

const makeZip = async (fixture: ReturnType<typeof createFixture>, includeFile = true) => {
  const zip = new AdmZip();
  zip.addFile("manifest.json", Buffer.from(JSON.stringify(fixture.manifest)));
  zip.addFile("data.json", Buffer.from(JSON.stringify(fixture.data)));
  zip.addFile("media-manifest.json", Buffer.from(JSON.stringify(fixture.media)));
  if (includeFile) zip.addFile(fixture.entry.entryName, fixture.bytes);
  return readBackupZip(new File([new Uint8Array(zip.toBuffer())], "backup.zip"));
};

describe("backup preflight before any restore", () => {
  test("accepts pre-subscription archives without dropping required legacy tables", async () => {
    const fixture = createFixture();
    delete fixture.data.tables.subscriptions;
    delete fixture.data.tables.subscription_attachments;
    fixture.manifest.tables = fixture.manifest.tables.filter(
      (table) => table !== "subscriptions" && table !== "subscription_attachments",
    );
    expect((await readBackupPayload(await makeZip(fixture))).data.tables.users).toEqual([]);
  });
  test("validates a complete backup and returns its checked media bytes", async () => {
    const fixture = createFixture();
    const payload = await readBackupPayload(await makeZip(fixture));
    expect(payload.mediaFiles[0].bytes).toEqual(fixture.bytes);
    expect(Object.keys(payload.data.tables)).toHaveLength(EXPORTED_TABLES.length);
  });

  test("rejects an incomplete table set instead of treating missing tables as empty", async () => {
    const fixture = createFixture();
    delete fixture.data.tables.users;
    await expect(readBackupPayload(await makeZip(fixture))).rejects.toBeInstanceOf(BackupError);
  });

  test("rejects arbitrary tables and malformed row collections", async () => {
    const fixture = createFixture();
    fixture.data.tables.encrypted_settings = [];
    await expect(readBackupPayload(await makeZip(fixture))).rejects.toBeInstanceOf(BackupError);
    const malformed = createFixture();
    Object.assign(malformed.data.tables, { users: "not an array" });
    await expect(readBackupPayload(await makeZip(malformed))).rejects.toBeInstanceOf(BackupError);
  });

  test("rejects missing files and checksum failures during preflight", async () => {
    const missing = createFixture();
    await expect(readBackupPayload(await makeZip(missing, false))).rejects.toBeInstanceOf(
      BackupError,
    );
    const corrupt = createFixture();
    corrupt.entry.sha256 = "0".repeat(64);
    await expect(readBackupPayload(await makeZip(corrupt))).rejects.toBeInstanceOf(BackupError);
  });

  test("rejects traversal, duplicate manifest entries, and unlisted media rows", async () => {
    const traversal = createFixture();
    traversal.entry.storageKey = "../outside.txt";
    await expect(readBackupPayload(await makeZip(traversal))).rejects.toBeInstanceOf(BackupError);
    const duplicate = createFixture();
    duplicate.media.entries.push({ ...duplicate.entry });
    duplicate.media.total = 2;
    duplicate.manifest.media.total = 2;
    await expect(readBackupPayload(await makeZip(duplicate))).rejects.toBeInstanceOf(BackupError);
    const unlisted = createFixture();
    unlisted.data.tables.media_assets.push({ id: "00000000-0000-4000-8000-000000000002" });
    await expect(readBackupPayload(await makeZip(unlisted))).rejects.toBeInstanceOf(BackupError);
  });

  test("rejects active SVGs even when their checksums match", async () => {
    const fixture = createFixture();
    fixture.entry.fileFormat = "svg";
    fixture.data.tables.media_assets[0].file_format = "svg";
    fixture.bytes = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    fixture.entry.fileSizeBytes = fixture.bytes.length;
    fixture.data.tables.media_assets[0].file_size_bytes = fixture.bytes.length;
    fixture.entry.sha256 = createHash("sha256").update(fixture.bytes).digest("hex");
    fixture.media.totalBytes = fixture.bytes.length;
    fixture.manifest.media.totalBytes = fixture.bytes.length;
    await expect(readBackupPayload(await makeZip(fixture))).rejects.toBeInstanceOf(BackupError);
  });

  test("rejects inconsistent sizes and summaries", async () => {
    const fixture = createFixture();
    fixture.manifest.media.totalBytes += 1;
    await expect(readBackupPayload(await makeZip(fixture))).rejects.toBeInstanceOf(BackupError);
    const mismatch = createFixture();
    mismatch.data.tables.media_assets[0].file_size_bytes = 1;
    await expect(readBackupPayload(await makeZip(mismatch))).rejects.toBeInstanceOf(BackupError);
  });

  test("excludes configured credentials from exported rows", () => {
    expect(
      excludeSensitiveColumns("auth_provider_settings", {
        provider: "fixture",
        client_secret_encrypted: "fixture-secret",
        enabled: true,
      }),
    ).toEqual({ provider: "fixture", enabled: true });
    expect(
      excludeSensitiveColumns("site_settings", {
        id: 1,
        r2_access_key_id: "fixture-key",
        title: "Site",
      }),
    ).toEqual({ id: 1, title: "Site" });
    expect(
      excludeSensitiveColumns("encrypted_settings", {
        key: "fixture",
        encrypted_value: "fixture-secret",
      }),
    ).toEqual({ key: "fixture" });
  });
});
