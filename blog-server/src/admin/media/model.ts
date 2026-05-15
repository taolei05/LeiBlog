import { t } from "elysia";

const MediaTypeSchema = t.Union([
  t.Literal("image"),
  t.Literal("video"),
  t.Literal("document"),
]);

export const MediaQuery = t.Object({
  search: t.Optional(t.String({ maxLength: 160 })),
  fileType: t.Optional(MediaTypeSchema),
  fileFormat: t.Optional(t.String({ maxLength: 20 })),
  page: t.Optional(t.String()),
  pageSize: t.Optional(t.String()),
  sortBy: t.Optional(
    t.Union([
      t.Literal("createdAt"),
      t.Literal("fileName"),
      t.Literal("fileSize"),
      t.Literal("fileType"),
    ])
  ),
  sortOrder: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
});

export const MediaParams = t.Object({
  id: t.String(),
});

export const UploadMediaBody = t.Object({
  file: t.File(),
  fileName: t.Optional(t.String({ maxLength: 255 })),
});

export const RenameMediaBody = t.Object({
  fileName: t.String({ minLength: 1, maxLength: 255 }),
});

export const MediaItemSchema = t.Object({
  id: t.String(),
  fileName: t.String(),
  fileFormat: t.String(),
  fileType: MediaTypeSchema,
  fileSizeBytes: t.Number(),
  accessUrl: t.String(),
  uploadedBy: t.Nullable(t.String()),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const MediaListResponse = t.Object({
  ok: t.Boolean(),
  items: t.Array(MediaItemSchema),
  page: t.Number(),
  pageSize: t.Number(),
  total: t.Number(),
});

export const MediaResponse = t.Object({
  ok: t.Boolean(),
  item: MediaItemSchema,
});

export const MediaLinkResponse = t.Object({
  ok: t.Boolean(),
  accessUrl: t.String(),
});

export const MediaPreviewResponse = t.Object({
  ok: t.Boolean(),
  implemented: t.Boolean(),
  message: t.String(),
  accessUrl: t.String(),
  fileType: MediaTypeSchema,
});

export const OkResponse = t.Object({
  ok: t.Boolean(),
});
