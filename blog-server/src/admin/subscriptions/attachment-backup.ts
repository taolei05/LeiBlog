import { createHash } from "node:crypto";
import type AdmZip from "adm-zip";
import { BACKUP_FAILURE, BackupError, readBackupEntry } from "../backup/archive";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const invalid = () =>
  new BackupError(BACKUP_FAILURE.InvalidPayload, "Private subscription attachment is invalid.");
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const entryName = (id: string) => `private/subscriptions/${id}`;

// Keep binary data out of data.json and its intentionally small JSON limit.
export const packSubscriptionAttachments = (rows: Record<string, unknown>[]) =>
  rows.map((row) => {
    if (
      typeof row.id !== "string" ||
      !uuid.test(row.id) ||
      typeof row.content !== "string" ||
      !/^\\x(?:[0-9a-f]{2})+$/i.test(row.content)
    )
      throw invalid();
    const data = Buffer.from(row.content.slice(2), "hex");
    if (data.length !== row.file_size || data.length > 5242880) throw invalid();
    delete row.content;
    row.backup_content_sha256 = hash(data);
    return { name: entryName(row.id), data };
  });

export const unpackSubscriptionAttachments = ({
  rows,
  zip,
}: {
  rows: Record<string, unknown>[];
  zip: AdmZip;
}) => {
  const names = new Set<string>();
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (
      typeof row.id !== "string" ||
      !uuid.test(row.id) ||
      typeof row.subscription_id !== "string" ||
      !uuid.test(row.subscription_id) ||
      typeof row.file_size !== "number" ||
      !Number.isInteger(row.file_size) ||
      row.file_size < 1 ||
      row.file_size > 5242880 ||
      typeof row.backup_content_sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(row.backup_content_sha256)
    )
      throw invalid();
    const name = entryName(row.id);
    const entry = zip.getEntry(name);
    const count = (counts.get(row.subscription_id) ?? 0) + 1;
    if (entry === null || names.has(name) || count > 10) throw invalid();
    const bytes = readBackupEntry(entry);
    if (bytes.length !== row.file_size || hash(bytes) !== row.backup_content_sha256)
      throw invalid();
    row.content = `\\x${bytes.toString("hex")}`;
    delete row.backup_content_sha256;
    names.add(name);
    counts.set(row.subscription_id, count);
  }
  return names;
};
