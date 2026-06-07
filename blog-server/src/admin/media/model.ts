import { t } from "elysia";

const MediaTypeSchema = t.Union([
  t.Literal("image"),
  t.Literal("video"),
  t.Literal("document"),
]);

export const MediaQuery = t.Object({
  search: t.Optional(t.String({ maxLength: 160 })),
  folderId: t.Optional(t.String()),
  folderSlug: t.Optional(t.String({ maxLength: 100 })),
  fileType: t.Optional(MediaTypeSchema),
  fileFormat: t.Optional(t.String({ maxLength: 20 })),
  createdFrom: t.Optional(t.String()),
  createdTo: t.Optional(t.String()),
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 10_000 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
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

export const MediaFolderParams = t.Object({
  id: t.String(),
});

export const UploadMediaBody = t.Object({
  file: t.File(),
  fileName: t.Optional(t.String({ maxLength: 255 })),
  folderId: t.Optional(t.String()),
  folderSlug: t.Optional(t.String({ maxLength: 100 })),
});

export const RenameMediaBody = t.Object({
  fileName: t.String({ minLength: 1, maxLength: 255 }),
});

export const MediaFolderBody = t.Object({
  description: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
  name: t.String({ minLength: 1, maxLength: 80 }),
  slug: t.Optional(t.String({ maxLength: 100 })),
});

export const MediaFolderItemSchema = t.Object({
  createdAt: t.String(),
  description: t.String(),
  fileCount: t.Number(),
  id: t.String(),
  isProtected: t.Boolean(),
  name: t.String(),
  slug: t.String(),
  systemKey: t.Nullable(t.String()),
  updatedAt: t.String(),
});

export const MediaItemSchema = t.Object({
  id: t.String(),
  fileName: t.String(),
  fileFormat: t.String(),
  fileType: MediaTypeSchema,
  fileSizeBytes: t.Number(),
  accessUrl: t.String(),
  folderId: t.Nullable(t.String()),
  folderName: t.Nullable(t.String()),
  folderSlug: t.Nullable(t.String()),
  folderSystemKey: t.Nullable(t.String()),
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

export const MediaFolderListResponse = t.Object({
  ok: t.Boolean(),
  items: t.Array(MediaFolderItemSchema),
});

export const MediaFolderResponse = t.Object({
  ok: t.Boolean(),
  item: MediaFolderItemSchema,
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
