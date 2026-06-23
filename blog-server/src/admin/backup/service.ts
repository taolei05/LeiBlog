import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { PassThrough } from "node:stream";

import AdmZip from "adm-zip";
import { Archiver, ZipArchive } from "archiver";

import type { AuthUser } from "../../shared/auth";
import type { AppConfig } from "../../shared/config";
import type { DbClient } from "../../shared/db";
import type { StoredEncryptedSecret } from "../../shared/crypto";
import { requireAdmin } from "../../shared/auth";
import { appConfig } from "../../shared/config";
import { decryptSecret } from "../../shared/crypto";
import { db, withTransaction } from "../../shared/db";
import { validationError } from "../../shared/errors";
import { getR2Object, type R2StorageSettings } from "../media/r2-storage";

type BackupImportMode = "replace";
type BackupRow = Record<string, unknown>;

interface BackupServiceOptions {
  client?: DbClient;
  config?: AppConfig;
}

interface BackupImportInput extends BackupServiceOptions {
  file: File;
  mode?: BackupImportMode;
}

interface BackupPreviewInput {
  file: File;
}

interface BackupManifest {
  createdAt: string;
  format: "leiblog-backup";
  media: {
    included: boolean;
    total: number;
    totalBytes: number;
  };
  sensitiveFieldsExcluded: string[];
  tables: string[];
  version: number;
}

interface BackupData {
  exportedAt: string;
  format: "leiblog-backup-data";
  tables: Record<string, BackupRow[]>;
  version: number;
}

interface MediaManifestEntry {
  accessUrl: string;
  entryName: string;
  fileFormat: string;
  fileName: string;
  fileSizeBytes: number;
  id: string;
  sha256: string;
  storageKey: string;
  storageProvider: "local" | "r2";
}

interface MediaManifest {
  entries: MediaManifestEntry[];
  total: number;
  totalBytes: number;
}

interface R2ConfigRow {
  r2_access_key_id: string | null;
  r2_account_id: string | null;
  r2_bucket: string | null;
  r2_public_base_url: string | null;
  r2_secret_access_key_encrypted: StoredEncryptedSecret | null;
}

const BACKUP_VERSION = 1;
const EXPORTED_TABLES = [
  "site_info",
  "site_config",
  "site_filing",
  "setup_state",
  "users",
  "auth_provider_settings",
  "user_oauth_accounts",
  "article_categories",
  "article_tags",
  "articles",
  "article_category_links",
  "article_tag_links",
  "article_contributors",
  "article_contributor_links",
  "comments",
  "media_folders",
  "media_assets",
  "navigation_groups",
  "navigation_items",
  "login_audit_logs",
  "article_revisions",
] as const;

const SENSITIVE_COLUMNS: Record<string, Set<string>> = {
  auth_provider_settings: new Set(["client_secret_encrypted"]),
  site_config: new Set([
    "deepl_api_key_encrypted",
    "ipgeolocation_api_key_encrypted",
    "r2_access_key_id",
    "r2_secret_access_key_encrypted",
    "resend_api_key_encrypted",
  ]),
};

const SENSITIVE_FIELD_NAMES = Object.entries(SENSITIVE_COLUMNS).flatMap(([table, columns]) =>
  [...columns].map((column) => `${table}.${column}`)
);

const TEXT_ARRAY_COLUMNS: Record<string, Set<string>> = {
  auth_provider_settings: new Set(["scopes"]),
  site_config: new Set(["seo_keywords"]),
  site_info: new Set(["home_cover_urls"]),
  users: new Set(["tags"]),
};

const MEDIA_REFERENCE_COLUMNS: Record<string, string[]> = {
  article_contributors: ["avatar_url"],
  article_revisions: ["content_mdx", "cover_image_url"],
  articles: ["content_mdx", "cover_image_url"],
  comments: ["content"],
  navigation_items: ["icon_url"],
  site_info: ["favicon_url", "home_cover_urls", "logo_dark_url", "logo_light_url"],
  users: ["avatar_url"],
};

function getClient(options: BackupServiceOptions) {
  return options.client ?? db;
}

function getConfig(options: BackupServiceOptions) {
  return options.config ?? appConfig;
}

function quoteIdent(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function jsonReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

function toJsonBytes(value: unknown) {
  return Buffer.from(`${JSON.stringify(value, jsonReplacer, 2)}\n`);
}

function timestampForFileName(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/[:]/g, "-");
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function toCount(value: string | number | bigint | null | undefined) {
  return Number(value ?? 0);
}

function resolveUploadsDir(config: AppConfig) {
  return resolve(process.cwd(), config.uploadsDir);
}

function localPathForStorageKey(config: AppConfig, storageKey: string) {
  const root = resolveUploadsDir(config);
  const filePath = resolve(root, storageKey);

  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    throw validationError("备份中的媒体路径无效");
  }

  return filePath;
}

function storageKeyFromAccessUrl(config: AppConfig, accessUrl: string) {
  const prefix = config.uploadsUrlPrefix.replace(/\/$/, "");
  if (!accessUrl.startsWith(`${prefix}/`)) return null;

  return accessUrl.slice(prefix.length + 1);
}

function normalizeStorageKey(config: AppConfig, row: BackupRow) {
  const storedKey = typeof row.storage_key === "string" ? row.storage_key.trim() : "";
  const accessUrl = typeof row.access_url === "string" ? row.access_url : "";
  const accessKey = storageKeyFromAccessUrl(config, accessUrl);
  const fallback = `backup/${String(row.id ?? randomUUID())}.${String(
    row.file_format ?? "bin"
  )}`;
  const candidate = storedKey || accessKey || fallback;

  localPathForStorageKey(config, candidate);
  return candidate;
}

function accessUrlFromStorageKey(config: AppConfig, storageKey: string) {
  return `${config.uploadsUrlPrefix.replace(/\/$/, "")}/${storageKey}`;
}

function createMediaEntryName(row: BackupRow, storageKey: string) {
  const id = String(row.id ?? randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "");
  const storageKeyParts = storageKey.split("/");
  const fileName = String(
    row.file_name ?? storageKeyParts[storageKeyParts.length - 1] ?? "media"
  ).replace(
    /[\\/:*?"<>|]+/g,
    "-"
  );

  return `media/${id}/${fileName}`;
}

async function collectArchive(archive: Archiver) {
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
}

function createZipArchive(entries: Array<{ data: Uint8Array | Buffer; name: string }>) {
  const archive = new ZipArchive({
    zlib: { level: 9 },
  });

  for (const entry of entries) {
    archive.append(Buffer.from(entry.data), { name: entry.name });
  }

  return collectArchive(archive);
}

async function readTableRows(client: DbClient, table: string) {
  const rows = await client.unsafe<BackupRow[]>(`SELECT * FROM ${quoteIdent(table)}`);
  const sensitiveColumns = SENSITIVE_COLUMNS[table] ?? new Set<string>();

  if (sensitiveColumns.size === 0) return rows;

  return rows.map((row) =>
    Object.fromEntries(Object.entries(row).filter(([column]) => !sensitiveColumns.has(column)))
  );
}

async function exportData(client: DbClient): Promise<BackupData> {
  const tables: Record<string, BackupRow[]> = {};

  for (const table of EXPORTED_TABLES) {
    tables[table] = await readTableRows(client, table);
  }

  return {
    exportedAt: new Date().toISOString(),
    format: "leiblog-backup-data",
    tables,
    version: BACKUP_VERSION,
  };
}

async function getR2StorageSettings(client: DbClient): Promise<R2StorageSettings | null> {
  const [row] = await client<R2ConfigRow[]>`
    SELECT r2_account_id, r2_bucket, r2_access_key_id,
           r2_secret_access_key_encrypted, r2_public_base_url
    FROM site_config
    WHERE id = 1
  `;

  if (!row) return null;

  const settings = {
    accessKeyId: row.r2_access_key_id?.trim(),
    accountId: row.r2_account_id?.trim(),
    bucket: row.r2_bucket?.trim(),
    publicBaseUrl: row.r2_public_base_url?.trim(),
    secretAccessKey: decryptSecret(row.r2_secret_access_key_encrypted),
  };

  if (!Object.values(settings).some(Boolean)) return null;
  if (
    !settings.accessKeyId ||
    !settings.accountId ||
    !settings.bucket ||
    !settings.publicBaseUrl ||
    !settings.secretAccessKey
  ) {
    throw validationError("Cloudflare R2 存储配置不完整，无法导出 R2 媒体文件");
  }

  return settings as R2StorageSettings;
}

async function readMediaBytes(client: DbClient, config: AppConfig, row: BackupRow) {
  const storageKey = normalizeStorageKey(config, row);

  if (row.storage_provider === "r2") {
    const settings = await getR2StorageSettings(client);
    if (!settings) throw validationError("Cloudflare R2 存储配置不完整，无法导出 R2 媒体文件");
    return {
      bytes: await getR2Object(settings, storageKey),
      storageKey,
    };
  }

  return {
    bytes: new Uint8Array(await readFile(localPathForStorageKey(config, storageKey))),
    storageKey,
  };
}

async function exportMediaEntries(client: DbClient, config: AppConfig, rows: BackupRow[]) {
  const entries: Array<{ data: Uint8Array; name: string }> = [];
  const manifestEntries: MediaManifestEntry[] = [];
  let totalBytes = 0;

  for (const row of rows) {
    const { bytes, storageKey } = await readMediaBytes(client, config, row);
    const entryName = createMediaEntryName(row, storageKey);
    const fileSizeBytes = bytes.byteLength;

    totalBytes += fileSizeBytes;
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
      storageProvider: row.storage_provider === "r2" ? "r2" : "local",
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
}

function createManifest(data: BackupData, media: MediaManifest): BackupManifest {
  return {
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
  };
}

export async function createBackupArchive(
  currentUser: AuthUser,
  options: BackupServiceOptions = {}
) {
  requireAdmin(currentUser);
  const client = getClient(options);
  const config = getConfig(options);
  const data = await exportData(client);
  const media = await exportMediaEntries(client, config, data.tables.media_assets ?? []);
  const manifest = createManifest(data, media.manifest);
  const archiveEntries = [
    { data: toJsonBytes(manifest), name: "manifest.json" },
    { data: toJsonBytes(data), name: "data.json" },
    { data: toJsonBytes(media.manifest), name: "media-manifest.json" },
    ...media.entries,
  ];

  return {
    data: await createZipArchive(archiveEntries),
    fileName: `leiblog-backup-${timestampForFileName()}.zip`,
  };
}

function readZipJson<T>(zip: AdmZip, name: string): T {
  const entry = zip.getEntry(name);
  if (!entry) throw validationError(`备份文件缺少 ${name}`);

  try {
    return JSON.parse(entry.getData().toString("utf8")) as T;
  } catch {
    throw validationError(`备份文件 ${name} 格式无效`);
  }
}

async function readBackupZip(file: File) {
  if (file.size <= 0) throw validationError("备份文件不能为空");
  if (!file.name.toLowerCase().endsWith(".zip")) {
    throw validationError("备份文件必须是 zip 格式");
  }

  try {
    return new AdmZip(Buffer.from(await file.arrayBuffer()));
  } catch {
    throw validationError("备份文件无法读取");
  }
}

function validateManifest(manifest: BackupManifest) {
  if (manifest.format !== "leiblog-backup" || manifest.version !== BACKUP_VERSION) {
    throw validationError("备份文件版本不受支持");
  }
}

function readBackupPayload(zip: AdmZip) {
  const manifest = readZipJson<BackupManifest>(zip, "manifest.json");
  validateManifest(manifest);

  const data = readZipJson<BackupData>(zip, "data.json");
  const mediaManifest = readZipJson<MediaManifest>(zip, "media-manifest.json");
  if (data.format !== "leiblog-backup-data" || data.version !== BACKUP_VERSION) {
    throw validationError("备份数据版本不受支持");
  }

  return { data, manifest, mediaManifest };
}

function backupContainsSensitiveConfig(data: BackupData) {
  return Object.entries(SENSITIVE_COLUMNS).some(([table, columns]) => {
    const rows = data.tables[table] ?? [];
    return rows.some((row) => [...columns].some((column) => column in row));
  });
}

function tableCounts(data: BackupData) {
  return Object.fromEntries(
    Object.entries(data.tables).map(([table, rows]) => [table, Array.isArray(rows) ? rows.length : 0])
  );
}

export async function previewBackupArchive(
  currentUser: AuthUser,
  input: BackupPreviewInput
) {
  requireAdmin(currentUser);
  const zip = await readBackupZip(input.file);
  const { data, manifest, mediaManifest } = readBackupPayload(zip);

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
}

async function preserveSensitiveConfig(client: DbClient) {
  const [siteConfig] = await client<BackupRow[]>`
    SELECT resend_api_key_encrypted, deepl_api_key_encrypted,
           ipgeolocation_api_key_encrypted, r2_access_key_id,
           r2_secret_access_key_encrypted
    FROM site_config
    WHERE id = 1
  `;
  const authProviderSecrets = await client<BackupRow[]>`
    SELECT provider, client_secret_encrypted
    FROM auth_provider_settings
  `;

  return {
    authProviderSecrets,
    siteConfig,
  };
}

async function restoreSensitiveConfig(
  client: DbClient,
  preserved: Awaited<ReturnType<typeof preserveSensitiveConfig>>
) {
  if (preserved.siteConfig) {
    await client`
      INSERT INTO site_config (
        id,
        resend_api_key_encrypted,
        deepl_api_key_encrypted,
        ipgeolocation_api_key_encrypted,
        r2_access_key_id,
        r2_secret_access_key_encrypted
      )
      VALUES (
        1,
        ${preserved.siteConfig.resend_api_key_encrypted ?? null},
        ${preserved.siteConfig.deepl_api_key_encrypted ?? null},
        ${preserved.siteConfig.ipgeolocation_api_key_encrypted ?? null},
        ${preserved.siteConfig.r2_access_key_id ?? null},
        ${preserved.siteConfig.r2_secret_access_key_encrypted ?? null}
      )
      ON CONFLICT (id) DO UPDATE
      SET resend_api_key_encrypted = EXCLUDED.resend_api_key_encrypted,
          deepl_api_key_encrypted = EXCLUDED.deepl_api_key_encrypted,
          ipgeolocation_api_key_encrypted = EXCLUDED.ipgeolocation_api_key_encrypted,
          r2_access_key_id = EXCLUDED.r2_access_key_id,
          r2_secret_access_key_encrypted = EXCLUDED.r2_secret_access_key_encrypted
    `;
  }

  for (const row of preserved.authProviderSecrets) {
    await client`
      UPDATE auth_provider_settings
      SET client_secret_encrypted = ${row.client_secret_encrypted ?? null}
      WHERE provider = ${row.provider}
    `;
  }
}

function replaceInValue(value: unknown, oldUrl: string, newUrl: string): unknown {
  if (typeof value === "string") return value.split(oldUrl).join(newUrl);
  if (Array.isArray(value)) return value.map((item) => replaceInValue(item, oldUrl, newUrl));
  return value;
}

function replaceMediaReferences(data: BackupData, oldUrl: string, newUrl: string) {
  if (!oldUrl || oldUrl === newUrl) return;

  for (const [table, columns] of Object.entries(MEDIA_REFERENCE_COLUMNS)) {
    for (const row of data.tables[table] ?? []) {
      for (const column of columns) {
        if (column in row) row[column] = replaceInValue(row[column], oldUrl, newUrl);
      }
    }
  }
}

function prepareMediaRowsForLocalRestore(config: AppConfig, data: BackupData, media: MediaManifest) {
  const mediaRows = data.tables.media_assets ?? [];
  const entriesById = new Map(media.entries.map((entry) => [entry.id, entry]));

  for (const row of mediaRows) {
    const id = String(row.id ?? "");
    const entry = entriesById.get(id);
    if (!entry) continue;

    const oldUrl = String(row.access_url ?? entry.accessUrl);
    const storageKey = normalizeStorageKey(config, {
      ...row,
      storage_key: entry.storageKey,
    });
    const newUrl = accessUrlFromStorageKey(config, storageKey);

    row.access_url = newUrl;
    row.storage_provider = "local";
    row.storage_key = storageKey;
    row.storage_bucket = null;
    replaceMediaReferences(data, oldUrl, newUrl);
  }
}

async function restoreMediaFiles(config: AppConfig, zip: AdmZip, media: MediaManifest) {
  let importedMedia = 0;

  for (const entry of media.entries) {
    const zipEntry = zip.getEntry(entry.entryName);
    if (!zipEntry) throw validationError(`备份文件缺少媒体：${entry.fileName}`);

    const bytes = zipEntry.getData();
    if (sha256(bytes) !== entry.sha256) {
      throw validationError(`媒体文件校验失败：${entry.fileName}`);
    }

    const filePath = localPathForStorageKey(config, entry.storageKey);
    await mkdir(dirname(filePath), { recursive: true });
    await Bun.write(filePath, bytes);
    importedMedia += 1;
  }

  return importedMedia;
}

function tableRows(data: BackupData, table: string) {
  const rows = data.tables[table];
  return Array.isArray(rows) ? rows : [];
}

function insertableColumns(table: string, row: BackupRow) {
  const sensitiveColumns = SENSITIVE_COLUMNS[table] ?? new Set<string>();
  return Object.keys(row).filter((column) => !sensitiveColumns.has(column));
}

function escapePostgresArrayValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function toPostgresTextArray(value: unknown) {
  if (!Array.isArray(value)) return value;
  return `{${value.map((item) => escapePostgresArrayValue(String(item))).join(",")}}`;
}

function normalizeSqlValue(table: string, column: string, value: unknown) {
  if (TEXT_ARRAY_COLUMNS[table]?.has(column)) {
    return toPostgresTextArray(value);
  }

  return value;
}

async function insertRows(client: DbClient, table: string, rows: BackupRow[]) {
  if (rows.length === 0) return 0;
  const commentParentIds: Array<{ id: unknown; parentId: unknown }> = [];
  let imported = 0;

  for (const row of rows) {
    const insertRow = table === "comments" ? { ...row, parent_id: null } : row;
    if (table === "comments" && row.parent_id) {
      commentParentIds.push({ id: row.id, parentId: row.parent_id });
    }

    const columns = insertableColumns(table, insertRow);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    const values = columns.map((column) => normalizeSqlValue(table, column, insertRow[column]));

    await client.unsafe(
      `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")}) VALUES (${placeholders})`,
      values
    );
    imported += 1;
  }

  for (const parent of commentParentIds) {
    await client`
      UPDATE comments
      SET parent_id = ${parent.parentId}
      WHERE id = ${parent.id}
        AND EXISTS (SELECT 1 FROM comments parent WHERE parent.id = ${parent.parentId})
    `;
  }

  return imported;
}

async function restoreTables(client: DbClient, data: BackupData) {
  await client.unsafe(
    `TRUNCATE TABLE ${EXPORTED_TABLES.map(quoteIdent).join(", ")} RESTART IDENTITY CASCADE`
  );

  let importedRows = 0;
  for (const table of EXPORTED_TABLES) {
    importedRows += await insertRows(client, table, tableRows(data, table));
  }

  return importedRows;
}

export async function importBackupArchive(
  currentUser: AuthUser,
  input: BackupImportInput
) {
  requireAdmin(currentUser);
  const mode = input.mode ?? "replace";
  if (mode !== "replace") throw validationError("暂不支持这个恢复模式");

  const client = getClient(input);
  const config = getConfig(input);
  const zip = await readBackupZip(input.file);
  const { data, mediaManifest } = readBackupPayload(zip);
  prepareMediaRowsForLocalRestore(config, data, mediaManifest);

  let importedRows = 0;
  let importedMedia = 0;
  await withTransaction(async (tx) => {
    const preserved = await preserveSensitiveConfig(tx);
    importedRows = await restoreTables(tx, data);
    await restoreSensitiveConfig(tx, preserved);
    importedMedia = await restoreMediaFiles(config, zip, mediaManifest);
  }, client);

  return {
    ok: true,
    importedMedia,
    importedRows,
    mode,
    tables: tableCounts(data),
  };
}
