import { t } from "elysia";

const BackupManifestSchema = t.Object({
  createdAt: t.String(),
  format: t.Literal("leiblog-backup"),
  media: t.Object({
    included: t.Boolean(),
    total: t.Number(),
    totalBytes: t.Number(),
  }),
  sensitiveFieldsExcluded: t.Array(t.String()),
  tables: t.Array(t.String()),
  version: t.Number(),
});

export const BackupImportModeSchema = t.Union([t.Literal("replace")]);

export const BackupFileBody = t.Object({
  file: t.File(),
});

export const BackupImportBody = t.Object({
  file: t.File(),
  mode: t.Optional(BackupImportModeSchema),
});

export const BackupPreviewResponse = t.Object({
  ok: t.Boolean(),
  manifest: BackupManifestSchema,
  media: t.Object({
    included: t.Boolean(),
    total: t.Number(),
    totalBytes: t.Number(),
  }),
  sensitiveConfigExported: t.Boolean(),
  tables: t.Record(t.String(), t.Number()),
});

export const BackupImportResponse = t.Object({
  ok: t.Boolean(),
  importedMedia: t.Number(),
  importedRows: t.Number(),
  mode: BackupImportModeSchema,
  tables: t.Record(t.String(), t.Number()),
});
