import { createHash } from "node:crypto";

import type AdmZip from "adm-zip";
import type { Static } from "elysia";
import { getSchemaValidator, t } from "elysia";

import { isMediaFileContentValid } from "../media/file-policy";
import { isMediaStorageKeyValid } from "../media/storage-path";
import { unpackSubscriptionAttachments } from "../subscriptions/attachment-backup";
import {
  BACKUP_FAILURE,
  BACKUP_LIMITS,
  BackupError,
  readBackupEntry,
  readBackupJson,
} from "./archive";

export const EXPORTED_TABLES = [
  "site_settings",
  "site_settings_en",
  "filing_records",
  "users",
  "users_en",
  "user_social_links",
  "auth_provider_settings",
  "user_oauth_accounts",
  "media_folders",
  "media_assets",
  "article_categories",
  "article_categories_en",
  "article_tags",
  "article_tags_en",
  "article_contributors",
  "articles",
  "articles_en",
  "article_category_links",
  "article_tag_links",
  "article_contributor_links",
  "comments",
  "navigation_groups",
  "navigation_items",
  "login_audit_logs",
  "subscriptions",
  "subscription_attachments",
] as const;

export const SENSITIVE_COLUMNS: Record<string, ReadonlySet<string>> = {
  auth_provider_settings: new Set(["client_secret_encrypted"]),
  encrypted_settings: new Set(["encrypted_value"]),
  site_settings: new Set(["r2_access_key_id"]),
};

export const excludeSensitiveColumns = (table: string, row: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(row).filter(([column]) => !SENSITIVE_COLUMNS[table]?.has(column)),
  );

const countSchema = t.Integer({ minimum: 0, maximum: BACKUP_LIMITS.expandedBytes });
const mediaSummarySchema = t.Object({
  included: t.Boolean(),
  total: countSchema,
  totalBytes: countSchema,
});
const manifestSchema = t.Object({
  createdAt: t.String(),
  format: t.Literal("leiblog-backup"),
  media: mediaSummarySchema,
  sensitiveFieldsExcluded: t.Array(t.String()),
  tables: t.Array(t.String()),
  version: t.Literal(1),
});
const dataSchema = t.Object({
  exportedAt: t.String(),
  format: t.Literal("leiblog-backup-data"),
  version: t.Literal(1),
  tables: t.Record(t.String(), t.Array(t.Record(t.String(), t.Unknown()))),
});
const mediaEntrySchema = t.Object({
  accessUrl: t.String(),
  entryName: t.String({ minLength: 1, maxLength: 1024 }),
  fileFormat: t.String({ pattern: "^[a-z0-9]{1,10}$" }),
  fileName: t.String(),
  fileSizeBytes: t.Integer({ minimum: 1, maximum: BACKUP_LIMITS.entryBytes }),
  id: t.String({ pattern: "^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$" }),
  sha256: t.String({ pattern: "^[a-f0-9]{64}$" }),
  storageKey: t.String(),
  storageProvider: t.Union([t.Literal("local"), t.Literal("r2")]),
});
const mediaSchema = t.Object({
  entries: t.Array(mediaEntrySchema, { maxItems: BACKUP_LIMITS.entries }),
  total: countSchema,
  totalBytes: countSchema,
});

export type BackupData = Static<typeof dataSchema>;
export type BackupManifest = Static<typeof manifestSchema>;
export type MediaManifest = Static<typeof mediaSchema>;
export type MediaManifestEntry = Static<typeof mediaEntrySchema>;

const manifestValidator = getSchemaValidator(manifestSchema);
const dataValidator = getSchemaValidator(dataSchema);
const mediaValidator = getSchemaValidator(mediaSchema);

const invalidPayload = () =>
  new BackupError(BACKUP_FAILURE.InvalidPayload, "Backup payload is invalid or incomplete.");

const hasCompleteTableSet = (names: string[]) => {
  const legacy = EXPORTED_TABLES.filter(
    (table) => table !== "subscriptions" && table !== "subscription_attachments",
  );
  return (
    new Set(names).size === names.length &&
    ((names.length === EXPORTED_TABLES.length &&
      EXPORTED_TABLES.every((table) => names.includes(table))) ||
      (names.length === legacy.length && legacy.every((table) => names.includes(table))))
  );
};

export const readBackupPayload = async (zip: AdmZip) => {
  const manifestResult = manifestValidator.safeParse(readBackupJson(zip, "manifest.json"));
  const dataResult = dataValidator.safeParse(readBackupJson(zip, "data.json"));
  const mediaResult = mediaValidator.safeParse(readBackupJson(zip, "media-manifest.json"));
  if (!manifestResult.success || !dataResult.success || !mediaResult.success) {
    throw invalidPayload();
  }
  const manifest = manifestResult.data;
  const data = dataResult.data;
  const mediaManifest = mediaResult.data;
  if (
    !hasCompleteTableSet(Object.keys(data.tables)) ||
    !hasCompleteTableSet(manifest.tables) ||
    manifest.tables.length !== Object.keys(data.tables).length ||
    !manifest.media.included ||
    manifest.media.total !== mediaManifest.entries.length ||
    mediaManifest.total !== mediaManifest.entries.length ||
    manifest.media.totalBytes !== mediaManifest.totalBytes
  ) {
    throw invalidPayload();
  }

  const mediaRows = data.tables.media_assets;
  const rowsById = new Map(mediaRows.map((row) => [row.id, row]));
  if (rowsById.size !== mediaRows.length || mediaRows.length !== mediaManifest.entries.length) {
    throw invalidPayload();
  }
  const ids = new Set<string>();
  const entryNames = new Set<string>();
  const storageKeys = new Set<string>();
  const mediaFiles: Array<{ entry: MediaManifestEntry; bytes: Buffer }> = [];
  let totalBytes = 0;
  for (const entry of mediaManifest.entries) {
    if (!isMediaStorageKeyValid(entry.storageKey)) {
      throw new BackupError(BACKUP_FAILURE.InvalidMediaPath, "Backup media path is invalid.");
    }
    const row = rowsById.get(entry.id);
    const zipEntry = zip.getEntry(entry.entryName);
    if (
      row === undefined ||
      zipEntry === null ||
      !entry.entryName.startsWith("media/") ||
      ids.has(entry.id) ||
      entryNames.has(entry.entryName) ||
      storageKeys.has(entry.storageKey) ||
      row.file_format !== entry.fileFormat ||
      row.file_name !== entry.fileName ||
      Number(row.file_size_bytes) !== entry.fileSizeBytes ||
      row.access_url !== entry.accessUrl ||
      (typeof row.storage_key === "string" && row.storage_key !== entry.storageKey)
    ) {
      throw invalidPayload();
    }
    const bytes = readBackupEntry(zipEntry);
    if (
      bytes.length !== entry.fileSizeBytes ||
      createHash("sha256").update(bytes).digest("hex") !== entry.sha256 ||
      !(await isMediaFileContentValid({ bytes, fileFormat: entry.fileFormat }))
    ) {
      throw new BackupError(
        BACKUP_FAILURE.InvalidMedia,
        "Backup media content or checksum is invalid.",
      );
    }
    ids.add(entry.id);
    entryNames.add(entry.entryName);
    storageKeys.add(entry.storageKey);
    totalBytes += bytes.length;
    mediaFiles.push({ entry, bytes });
  }
  const privateNames = unpackSubscriptionAttachments({
    rows: data.tables.subscription_attachments ?? [],
    zip,
  });
  if (
    totalBytes !== mediaManifest.totalBytes ||
    zip
      .getEntries()
      .some(
        (entry) =>
          !entry.isDirectory &&
          !["manifest.json", "data.json", "media-manifest.json"].includes(entry.entryName) &&
          !entryNames.has(entry.entryName) &&
          !privateNames.has(entry.entryName),
      )
  ) {
    throw invalidPayload();
  }
  return { data, manifest, mediaManifest, mediaFiles };
};
