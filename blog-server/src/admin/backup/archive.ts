import { crc32, inflateRawSync } from "node:zlib";

import AdmZip from "adm-zip";

export const BACKUP_LIMITS = {
  archiveBytes: 64 * 1024 * 1024,
  entries: 10_000,
  entryBytes: 64 * 1024 * 1024,
  expandedBytes: 256 * 1024 * 1024,
  jsonBytes: 16 * 1024 * 1024,
} as const;

export const BACKUP_FAILURE = {
  EmptyFile: "empty-file",
  InvalidArchive: "invalid-archive",
  InvalidMedia: "invalid-media",
  InvalidMediaPath: "invalid-media-path",
  InvalidMode: "invalid-mode",
  InvalidPayload: "invalid-payload",
  RemoteMediaUnsupported: "remote-media-unsupported",
  UnsupportedVersion: "unsupported-version",
} as const;

export type BackupFailure = (typeof BACKUP_FAILURE)[keyof typeof BACKUP_FAILURE];

export class BackupError extends Error {
  readonly reason: BackupFailure;

  constructor(reason: BackupFailure, message: string) {
    super(message);
    this.reason = reason;
  }
}

const invalidArchive = () =>
  new BackupError(
    BACKUP_FAILURE.InvalidArchive,
    "Backup archive is invalid or exceeds the supported limits.",
  );

const isEntryNameValid = (name: string) =>
  name.length > 0 &&
  name.length <= 1024 &&
  !/[\\\u0000-\u001f\u007f]/.test(name) &&
  !/^[a-zA-Z]:/.test(name) &&
  name
    .replace(/\/$/, "")
    .split("/")
    .every((part) => part.length > 0 && part !== "." && part !== "..");

export const validateBackupZip = (zip: AdmZip) => {
  if (zip.getEntryCount() > BACKUP_LIMITS.entries) {
    throw invalidArchive();
  }
  const names = new Set<string>();
  let totalBytes = 0;
  for (const entry of zip.getEntries()) {
    const { header } = entry;
    const sizeLimit = entry.entryName.endsWith(".json")
      ? BACKUP_LIMITS.jsonBytes
      : BACKUP_LIMITS.entryBytes;
    if (
      !isEntryNameValid(entry.entryName) ||
      names.has(entry.entryName) ||
      ((header.attr >>> 16) & 0xf000) === 0xa000 ||
      (header.flags & 1) !== 0 ||
      ![0, 8].includes(header.method) ||
      !Number.isSafeInteger(header.size) ||
      header.size < 0 ||
      header.size > sizeLimit ||
      !Number.isSafeInteger(header.compressedSize) ||
      header.compressedSize < 0 ||
      header.compressedSize > BACKUP_LIMITS.archiveBytes ||
      (entry.isDirectory && header.size !== 0)
    ) {
      throw invalidArchive();
    }
    names.add(entry.entryName);
    totalBytes += header.size;
    if (totalBytes > BACKUP_LIMITS.expandedBytes) {
      throw invalidArchive();
    }
  }
};

export const readBackupZip = async (file: File) => {
  if (file.size <= 0) {
    throw new BackupError(BACKUP_FAILURE.EmptyFile, "Backup file is empty.");
  }
  if (file.size > BACKUP_LIMITS.archiveBytes || !file.name.toLowerCase().endsWith(".zip")) {
    throw invalidArchive();
  }
  try {
    const zip = new AdmZip(Buffer.from(await file.arrayBuffer()));
    validateBackupZip(zip);
    return zip;
  } catch {
    throw invalidArchive();
  }
};

export const readBackupEntry = (entry: AdmZip.IZipEntry) => {
  try {
    const compressed = entry.getCompressedData();
    const limit = entry.entryName.endsWith(".json")
      ? BACKUP_LIMITS.jsonBytes
      : BACKUP_LIMITS.entryBytes;
    if (
      entry.isDirectory ||
      entry.header.size > limit ||
      compressed.length !== entry.header.compressedSize
    ) {
      throw invalidArchive();
    }
    // Bound the actual inflater output even when the ZIP header lies about its size.
    const bytes =
      entry.header.method === 0
        ? compressed
        : inflateRawSync(compressed, {
            maxOutputLength: Math.max(1, entry.header.size),
          });
    if (bytes.length !== entry.header.size || crc32(bytes) !== entry.header.crc) {
      throw invalidArchive();
    }
    return bytes;
  } catch {
    throw invalidArchive();
  }
};

export const readBackupJson = (zip: AdmZip, name: string): unknown => {
  const entry = zip.getEntry(name);
  if (entry === null) {
    throw new BackupError(BACKUP_FAILURE.InvalidPayload, `Backup file is missing ${name}.`);
  }
  const bytes = readBackupEntry(entry);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new BackupError(BACKUP_FAILURE.InvalidPayload, `Backup file ${name} is invalid.`);
  }
};
