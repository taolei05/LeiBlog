import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PassThrough } from "node:stream";

import type { Archiver } from "archiver";
import type { Sql, TransactionSql } from "postgres";
import { ZipArchive } from "archiver";

import { getSql } from "../../shared/db/postgres";
import { env } from "../../shared/env";
import { decryptSecret } from "../../shared/security/encryption";
import { getR2Object } from "../media/r2-storage";
import type { R2StorageSettings } from "../media/r2-storage";
import { resolveSafeMediaStoragePath } from "../media/storage-path";
import { BACKUP_FAILURE, BACKUP_LIMITS, BackupError } from "./archive";
import { readBackupZip } from "./archive";
import { packSubscriptionAttachments } from "../subscriptions/attachment-backup";
import {
  EXPORTED_TABLES,
  SENSITIVE_COLUMNS,
  excludeSensitiveColumns,
  readBackupPayload,
} from "./payload";
import type { BackupData, BackupManifest, MediaManifest, MediaManifestEntry } from "./payload";

export { BACKUP_FAILURE, BackupError } from "./archive";
export type { BackupFailure } from "./archive";

type BackupImportMode = "replace";
type BackupRow = Record<string, unknown>;
type BackupSql = Sql | TransactionSql;
type SqlValue = string | number | boolean | null;

type BackupPreviewInput = {
  file: File;
};

type BackupImportInput = BackupPreviewInput & {
  mode?: BackupImportMode;
};

type JsonRowsResult = {
  rows: unknown;
};

type AuthProviderSecretRow = {
  clientSecretEncrypted: string | null;
  provider: string;
};

type SiteSettingsSensitiveRow = {
  r2AccessKeyId: string | null;
};

type R2StorageSettingsRow = {
  r2AccessKeyId: string | null;
  r2AccountId: string | null;
  r2Bucket: string | null;
  r2PublicBaseUrl: string | null;
  r2SecretAccessKeyEncrypted: string | null;
};

const BACKUP_VERSION = 1;

const SENSITIVE_FIELD_NAMES = Object.entries(SENSITIVE_COLUMNS).flatMap(([table, columns]) =>
  [...columns].map((column) => `${table}.${column}`),
);

const MEDIA_REFERENCE_COLUMNS: Record<string, string[]> = {
  article_contributors: ["avatar_url"],
  articles: ["content_mdx", "cover_image_url"],
  articles_en: ["content_mdx"],
  comments: ["content"],
  navigation_items: ["icon_url"],
  site_settings: ["cover_urls", "dark_logo_url", "favicon_url", "light_logo_url"],
  users: ["avatar_url"],
};

const JSONB_COLUMNS: Record<string, Set<string>> = {
  comments: new Set(["comment_device", "comment_location"]),
  login_audit_logs: new Set(["device", "location"]),
  users: new Set(["last_login_device", "last_login_location"]),
};

const TEXT_ARRAY_COLUMNS: Record<string, Set<string>> = {
  auth_provider_settings: new Set(["scopes"]),
  site_settings: new Set(["cover_urls", "seo_keywords"]),
  users: new Set(["tags"]),
  users_en: new Set(["tags"]),
};

const quoteIdent = (value: string) => `"${value.replace(/"/g, '""')}"`;

const jsonReplacer = (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value;

const toJsonBytes = (value: unknown) => Buffer.from(`${JSON.stringify(value, jsonReplacer, 2)}\n`);

const timestampForFileName = (date = new Date()) =>
  date
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[:]/g, "-");

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

const isRecord = (value: unknown): value is BackupRow =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const optionalString = (value: string | null) => {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

const resolveUploadsDir = () => resolve(process.cwd(), env.uploadsDir);

const localPathForStorageKey = async (storageKey: string) => {
  try {
    return await resolveSafeMediaStoragePath({ root: resolveUploadsDir(), storageKey });
  } catch {
    throw new BackupError(BACKUP_FAILURE.InvalidMediaPath, "Backup media path is invalid.");
  }
};

const storageKeyFromAccessUrl = (accessUrl: string) => {
  const prefix = env.uploadsUrlPrefix.replace(/\/$/, "");
  if (!accessUrl.startsWith(`${prefix}/`)) {
    return undefined;
  }

  return accessUrl.slice(prefix.length + 1);
};

const normalizeStorageKey = async (row: BackupRow) => {
  const storedKey = typeof row.storage_key === "string" ? row.storage_key.trim() : "";
  const accessUrl = typeof row.access_url === "string" ? row.access_url : "";
  const accessKey = storageKeyFromAccessUrl(accessUrl) ?? "";
  const fallback = `backup/${String(row.id ?? randomUUID())}.${String(row.file_format ?? "bin")}`;
  const candidate = storedKey || accessKey || fallback;

  await localPathForStorageKey(candidate);
  return candidate;
};

const accessUrlFromStorageKey = (storageKey: string) =>
  `${env.uploadsUrlPrefix.replace(/\/$/, "")}/${storageKey}`;

const readR2StorageSettings = async (sql: BackupSql): Promise<R2StorageSettings> => {
  const [row] = await sql<R2StorageSettingsRow[]>`
    SELECT
      ss.r2_account_id,
      ss.r2_bucket,
      ss.r2_access_key_id,
      ss.r2_public_base_url,
      es.encrypted_value AS r2_secret_access_key_encrypted
    FROM site_settings ss
    LEFT JOIN encrypted_settings es
      ON es.key = 'r2_secret_access_key'
    WHERE ss.id = 1
    LIMIT 1
  `;
  const accessKeyId = optionalString(row?.r2AccessKeyId ?? null);
  const accountId = optionalString(row?.r2AccountId ?? null);
  const bucket = optionalString(row?.r2Bucket ?? null);
  const publicBaseUrl = optionalString(row?.r2PublicBaseUrl ?? null);
  const secretAccessKey =
    row?.r2SecretAccessKeyEncrypted === undefined || row.r2SecretAccessKeyEncrypted === null
      ? undefined
      : decryptSecret({
          secret: env.configEncryptionSecret,
          value: row.r2SecretAccessKeyEncrypted,
        });

  if (
    accessKeyId === undefined ||
    accountId === undefined ||
    bucket === undefined ||
    publicBaseUrl === undefined ||
    secretAccessKey === undefined
  ) {
    throw new BackupError(
      BACKUP_FAILURE.RemoteMediaUnsupported,
      "Cloudflare R2 storage configuration is incomplete.",
    );
  }

  return {
    accessKeyId,
    accountId,
    bucket,
    publicBaseUrl,
    secretAccessKey,
  };
};

const createMediaEntryName = (row: BackupRow, storageKey: string) => {
  const id = String(row.id ?? randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "");
  const storageKeyParts = storageKey.split("/");
  const fileName = String(
    row.file_name ?? storageKeyParts[storageKeyParts.length - 1] ?? "media",
  ).replace(/[\\/:*?"<>|]+/g, "-");

  return `media/${id}/${fileName}`;
};

const collectArchive = async (archive: Archiver) => {
  const output = new PassThrough();
  const chunks: Buffer[] = [];

  const done = new Promise<Uint8Array>((resolveArchive, rejectArchive) => {
    output.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    output.on("close", () => resolveArchive(new Uint8Array(Buffer.concat(chunks))));
    output.on("error", rejectArchive);
    archive.on("warning", rejectArchive);
    archive.on("error", rejectArchive);
  });

  archive.pipe(output);
  await archive.finalize();
  return done;
};

const createZipArchive = (entries: Array<{ data: Uint8Array | Buffer; name: string }>) => {
  const archive = new ZipArchive({
    zlib: { level: 9 },
  });

  for (const entry of entries) {
    archive.append(Buffer.from(entry.data), { name: entry.name });
  }

  return collectArchive(archive);
};

const readTableRows = async (sql: BackupSql, table: string) => {
  const [result] = await sql.unsafe<JsonRowsResult[]>(
    `SELECT COALESCE(jsonb_agg(to_jsonb(source_row)), '[]'::jsonb)::text AS rows
     FROM (SELECT * FROM ${quoteIdent(table)}) AS source_row`,
  );
  // JSON text preserves SQL column names instead of applying the connection's camel transform.
  const value: unknown = typeof result?.rows === "string" ? JSON.parse(result.rows) : result?.rows;
  const rows = Array.isArray(value) ? value.filter(isRecord) : [];
  return rows.map((row) => excludeSensitiveColumns(table, row));
};

const exportData = async (sql: BackupSql): Promise<BackupData> => {
  const tables: Record<string, BackupRow[]> = {};

  for (const table of EXPORTED_TABLES) {
    tables[table] = await readTableRows(sql, table);
  }

  return {
    exportedAt: new Date().toISOString(),
    format: "leiblog-backup-data",
    tables,
    version: BACKUP_VERSION,
  };
};

const readMediaBytes = async (sql: BackupSql, row: BackupRow) => {
  const storageKey = await normalizeStorageKey(row);
  if (row.storage_provider === "r2") {
    return {
      bytes: new Uint8Array(await getR2Object(await readR2StorageSettings(sql), storageKey)),
      storageKey,
    };
  }

  const filePath = await localPathForStorageKey(storageKey);
  if ((await stat(filePath)).size > BACKUP_LIMITS.entryBytes) {
    throw new BackupError(BACKUP_FAILURE.InvalidMedia, "Media file exceeds the backup size limit.");
  }
  return {
    bytes: new Uint8Array(await readFile(filePath)),
    storageKey,
  };
};

const exportMediaEntries = async (sql: BackupSql, rows: BackupRow[]) => {
  const entries: Array<{ data: Uint8Array; name: string }> = [];
  const manifestEntries: MediaManifestEntry[] = [];
  let totalBytes = 0;

  for (const row of rows) {
    const { bytes, storageKey } = await readMediaBytes(sql, row);
    const entryName = createMediaEntryName(row, storageKey);
    const fileSizeBytes = bytes.byteLength;
    const storageProvider = row.storage_provider === "r2" ? "r2" : "local";

    totalBytes += fileSizeBytes;
    if (
      fileSizeBytes > BACKUP_LIMITS.entryBytes ||
      totalBytes > BACKUP_LIMITS.expandedBytes ||
      entries.length + 4 > BACKUP_LIMITS.entries
    ) {
      throw new BackupError(BACKUP_FAILURE.InvalidMedia, "Media exceeds the backup size limits.");
    }
    entries.push({ data: bytes, name: entryName });
    manifestEntries.push({
      accessUrl: String(row.access_url ?? ""),
      entryName,
      fileFormat: String(row.file_format ?? ""),
      fileName: String(row.file_name ?? ""),
      fileSizeBytes,
      id: String(row.id ?? ""),
      sha256: sha256(bytes),
      storageKey,
      storageProvider,
    });
  }

  return {
    entries,
    manifest: {
      entries: manifestEntries,
      total: manifestEntries.length,
      totalBytes,
    } satisfies MediaManifest,
  };
};

const createManifest = (data: BackupData, media: MediaManifest): BackupManifest => ({
  createdAt: data.exportedAt,
  format: "leiblog-backup",
  media: {
    included: true,
    total: media.total,
    totalBytes: media.totalBytes,
  },
  sensitiveFieldsExcluded: SENSITIVE_FIELD_NAMES,
  tables: Object.keys(data.tables),
  version: BACKUP_VERSION,
});

export const createBackupArchive = async () => {
  const sql = getSql();
  const data = await exportData(sql);
  const media = await exportMediaEntries(sql, data.tables.media_assets ?? []);
  const privateAttachments = packSubscriptionAttachments(data.tables.subscription_attachments ?? []);
  const manifest = createManifest(data, media.manifest);
  const archiveEntries = [
    { data: toJsonBytes(manifest), name: "manifest.json" },
    { data: toJsonBytes(data), name: "data.json" },
    { data: toJsonBytes(media.manifest), name: "media-manifest.json" },
    ...media.entries,
    ...privateAttachments,
  ];
  if (
    archiveEntries.length > BACKUP_LIMITS.entries ||
    archiveEntries.slice(0, 3).some((entry) => entry.data.byteLength > BACKUP_LIMITS.jsonBytes) ||
    archiveEntries.reduce((total, entry) => total + entry.data.byteLength, 0) >
      BACKUP_LIMITS.expandedBytes
  ) {
    throw new BackupError(
      BACKUP_FAILURE.InvalidPayload,
      "Backup exceeds the supported size limits.",
    );
  }
  const archiveData = await createZipArchive(archiveEntries);
  if (archiveData.byteLength > BACKUP_LIMITS.archiveBytes) {
    throw new BackupError(BACKUP_FAILURE.InvalidArchive, "Backup exceeds the archive size limit.");
  }

  return {
    data: archiveData,
    fileName: `leiblog-backup-${timestampForFileName()}.zip`,
  };
};

const backupContainsSensitiveConfig = (data: BackupData) =>
  Object.entries(SENSITIVE_COLUMNS).some(([table, columns]) => {
    const rows = data.tables[table] ?? [];
    return rows.some((row) => [...columns].some((column) => column in row));
  });

const tableCounts = (data: BackupData) =>
  Object.fromEntries(
    Object.entries(data.tables).map(([table, rows]) => [
      table,
      Array.isArray(rows) ? rows.length : 0,
    ]),
  );

export const previewBackupArchive = async ({ file }: BackupPreviewInput) => {
  const zip = await readBackupZip(file);
  const { data, manifest, mediaManifest } = await readBackupPayload(zip);

  return {
    ok: true,
    manifest,
    media: {
      included: manifest.media.included,
      total: mediaManifest.total,
      totalBytes: mediaManifest.totalBytes,
    },
    sensitiveConfigExported: backupContainsSensitiveConfig(data),
    tables: tableCounts(data),
  };
};

const preserveSensitiveConfig = async (sql: BackupSql) => {
  const authProviderSecrets = await sql<AuthProviderSecretRow[]>`
    SELECT provider, client_secret_encrypted
    FROM auth_provider_settings
  `;
  const siteSettingsRows = await sql<SiteSettingsSensitiveRow[]>`
    SELECT r2_access_key_id
    FROM site_settings
    WHERE id = 1
    LIMIT 1
  `;

  return {
    authProviderSecrets,
    r2AccessKeyId: siteSettingsRows[0]?.r2AccessKeyId ?? null,
  };
};

const restoreSensitiveConfig = async (
  sql: BackupSql,
  preserved: Awaited<ReturnType<typeof preserveSensitiveConfig>>,
) => {
  for (const row of preserved.authProviderSecrets) {
    await sql`
      UPDATE auth_provider_settings
      SET client_secret_encrypted = ${row.clientSecretEncrypted ?? null}
      WHERE provider = ${row.provider}
    `;
  }

  await sql`
    UPDATE site_settings
    SET r2_access_key_id = ${preserved.r2AccessKeyId}
    WHERE id = 1
  `;
};

const replaceInValue = (value: unknown, oldUrl: string, newUrl: string): unknown => {
  if (typeof value === "string") {
    return value.split(oldUrl).join(newUrl);
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceInValue(item, oldUrl, newUrl));
  }

  return value;
};

const replaceMediaReferences = (data: BackupData, oldUrl: string, newUrl: string) => {
  if (!oldUrl || oldUrl === newUrl) {
    return;
  }

  for (const [table, columns] of Object.entries(MEDIA_REFERENCE_COLUMNS)) {
    for (const row of data.tables[table] ?? []) {
      for (const column of columns) {
        if (column in row) {
          row[column] = replaceInValue(row[column], oldUrl, newUrl);
        }
      }
    }
  }
};

const prepareMediaRowsForLocalRestore = (data: BackupData, media: MediaManifest) => {
  const mediaRows = data.tables.media_assets ?? [];
  const entriesById = new Map(media.entries.map((entry) => [entry.id, entry]));

  for (const row of mediaRows) {
    const id = String(row.id ?? "");
    const entry = entriesById.get(id);
    if (entry === undefined) {
      continue;
    }

    const oldUrl = String(row.access_url ?? entry.accessUrl);
    const storageKey = entry.storageKey;
    const newUrl = accessUrlFromStorageKey(storageKey);

    row.access_url = newUrl;
    row.storage_provider = "local";
    row.storage_key = storageKey;
    row.storage_bucket = null;
    replaceMediaReferences(data, oldUrl, newUrl);
  }
};

const restoreMediaFiles = async (
  files: Awaited<ReturnType<typeof readBackupPayload>>["mediaFiles"],
  createdPaths: string[],
) => {
  let importedMedia = 0;

  for (const { entry, bytes } of files) {
    const filePath = await localPathForStorageKey(entry.storageKey);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes, { flag: "wx" });
    createdPaths.push(filePath);
    importedMedia += 1;
  }

  return importedMedia;
};

const tableRows = (data: BackupData, table: string) => {
  const rows = data.tables[table];
  return Array.isArray(rows) ? rows : [];
};

const insertableColumns = (table: string, row: BackupRow) => {
  const sensitiveColumns = SENSITIVE_COLUMNS[table] ?? new Set<string>();
  return Object.keys(row).filter((column) => !sensitiveColumns.has(column));
};

const escapePostgresArrayValue = (value: string) =>
  `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const toPostgresTextArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return value;
  }

  return `{${value.map((item) => escapePostgresArrayValue(String(item))).join(",")}}`;
};

const toSqlValue = (value: unknown): SqlValue => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return JSON.stringify(value);
};

const normalizeSqlValue = (table: string, column: string, value: unknown): SqlValue => {
  if (TEXT_ARRAY_COLUMNS[table]?.has(column)) {
    return toSqlValue(toPostgresTextArray(value));
  }

  if (JSONB_COLUMNS[table]?.has(column) && value !== null && value !== undefined) {
    return JSON.stringify(value);
  }

  return toSqlValue(value);
};

const insertRows = async (sql: BackupSql, table: string, rows: BackupRow[]) => {
  if (rows.length === 0) {
    return 0;
  }

  const commentParentIds: Array<{ id: SqlValue; parentId: SqlValue }> = [];
  let imported = 0;

  for (const row of rows) {
    const insertRow = table === "comments" ? { ...row, parent_id: null } : row;
    if (table === "comments" && row.parent_id !== null && row.parent_id !== undefined) {
      commentParentIds.push({ id: toSqlValue(row.id), parentId: toSqlValue(row.parent_id) });
    }

    const columns = insertableColumns(table, insertRow);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    const values = columns.map((column) => normalizeSqlValue(table, column, insertRow[column]));

    await sql.unsafe(
      `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")})
       VALUES (${placeholders})`,
      values,
    );
    imported += 1;
  }

  for (const parent of commentParentIds) {
    await sql`
      UPDATE comments
      SET parent_id = ${parent.parentId}
      WHERE id = ${parent.id}
        AND EXISTS (SELECT 1 FROM comments parent WHERE parent.id = ${parent.parentId})
    `;
  }

  return imported;
};

const restoreTables = async (sql: BackupSql, data: BackupData) => {
  await sql.unsafe(
    `TRUNCATE TABLE ${EXPORTED_TABLES.map(quoteIdent).join(", ")} RESTART IDENTITY CASCADE`,
  );

  let importedRows = 0;
  for (const table of EXPORTED_TABLES) {
    importedRows += await insertRows(sql, table, tableRows(data, table));
  }

  // Restoring an older backup must not resend notifications for already-public content.
  await sql`UPDATE articles SET notification_enqueued_at = now() WHERE status = 'published'`;
  await sql`UPDATE comments SET notification_enqueued_at = now() WHERE status = 'approved'`;
  // Delivery jobs are intentionally not backed up; require opt-in after a restore.
  await sql`UPDATE subscriptions SET reminder_enabled = false`;

  return importedRows;
};

export const importBackupArchive = async ({ file, mode = "replace" }: BackupImportInput) => {
  if (mode !== "replace") {
    throw new BackupError(BACKUP_FAILURE.InvalidMode, "This restore mode is not supported.");
  }

  const zip = await readBackupZip(file);
  const { data, mediaManifest, mediaFiles } = await readBackupPayload(zip);
  const restorePrefix = `restored/${randomUUID()}`;
  for (const entry of mediaManifest.entries) {
    entry.storageKey = `${restorePrefix}/${entry.id}.${entry.fileFormat}`;
  }
  prepareMediaRowsForLocalRestore(data, mediaManifest);
  const sql = getSql();

  let importedRows = 0;
  let importedMedia = 0;
  const createdPaths: string[] = [];
  try {
    await sql.begin(async (tx) => {
      const preserved = await preserveSensitiveConfig(tx);
      importedRows = await restoreTables(tx, data);
      await restoreSensitiveConfig(tx, preserved);
      importedMedia = await restoreMediaFiles(mediaFiles, createdPaths);
    });
  } catch (error) {
    for (const path of createdPaths) {
      await rm(path, { force: true });
    }
    throw error;
  }

  return {
    ok: true,
    importedMedia,
    importedRows,
    mode,
    tables: tableCounts(data),
  };
};
