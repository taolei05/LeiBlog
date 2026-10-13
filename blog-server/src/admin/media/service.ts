import { mkdir, readFile, rm } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";

import type { Sql, TransactionSql } from "postgres";

import { getSql } from "../../shared/db/postgres";
import { env } from "../../shared/env";
import { decryptSecret } from "../../shared/security/encryption";
import { buildR2ObjectUrl, deleteR2Object, getR2Object, putR2Object } from "./r2-storage";
import type { R2StorageSettings } from "./r2-storage";
import { isMediaFileContentValid } from "./file-policy";
import { resolveSafeMediaStoragePath } from "./storage-path";

export const MEDIA_FILE_TYPES = {
  Document: "document",
  Image: "image",
  Video: "video",
} as const;

const ARTICLE_MEDIA_FOLDER_SLUG = "article-covers";
const ARTICLE_MEDIA_FOLDER_NAME = "文章";
const ARTICLE_MEDIA_FOLDER_DESCRIPTION = "文章封面和正文插图可以集中存储到这里。";

export type MediaFileType = (typeof MEDIA_FILE_TYPES)[keyof typeof MEDIA_FILE_TYPES];

export type MediaAsset = {
  id: string;
  fileName: string;
  fileFormat: string;
  fileType: MediaFileType;
  fileSizeBytes: number;
  accessUrl: string;
  folderId?: string;
  folderName?: string;
  folderSlug?: string;
  storageProvider: "local" | "r2";
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type MediaLibrarySummary = {
  total: number;
  images: number;
  videos: number;
  documents: number;
  storageBytes: number;
};

export type MediaLibraryPageInfo = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type MediaLibraryList = {
  media: MediaAsset[];
  summary: MediaLibrarySummary;
  pageInfo: MediaLibraryPageInfo;
};

export type MediaFolder = {
  id: string;
  name: string;
  slug: string;
  description: string;
  fileCount: number;
  isProtected: boolean;
  systemKey?: string;
  createdAt: string;
  updatedAt: string;
};

export type MediaFolderList = {
  folders: MediaFolder[];
};

export const MEDIA_LIBRARY_FAILURE = {
  EmptyFile: "empty-file",
  FileTooLarge: "file-too-large",
  FolderNotFound: "folder-not-found",
  FolderSlugExists: "folder-slug-exists",
  NotFound: "not-found",
  ProtectedFolder: "protected-folder",
  R2ConfigurationIncomplete: "r2-configuration-incomplete",
  RemoteStorageUnsupported: "remote-storage-unsupported",
  UnsupportedFileType: "unsupported-file-type",
} as const;

export type MediaLibraryFailure =
  (typeof MEDIA_LIBRARY_FAILURE)[keyof typeof MEDIA_LIBRARY_FAILURE];

export class MediaLibraryError extends Error {
  readonly reason: MediaLibraryFailure;

  constructor(reason: MediaLibraryFailure, message: string) {
    super(message);
    this.reason = reason;
  }
}

type MediaAssetsSql = Sql | TransactionSql;

type MediaAssetRow = {
  id: string;
  fileName: string;
  fileFormat: string;
  fileType: MediaFileType;
  fileSizeBytes: string | number;
  accessUrl: string;
  folderId: string | null;
  folderName: string | null;
  folderSlug: string | null;
  storageProvider: "local" | "r2";
  storageBucket: string | null;
  storageKey: string | null;
  uploadedBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type MediaSummaryRow = {
  totalCount: string;
  imageCount: string;
  videoCount: string;
  documentCount: string;
  storageBytes: string;
};

type CountRow = {
  count: string;
};

type MediaFolderRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  fileCount: string | number;
  isProtected: boolean;
  systemKey: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type ListMediaAssetsParameters = {
  fileType?: MediaFileType | "all";
  folderSlug?: string;
  page?: number;
  pageSize?: number;
  query?: string;
  storageProvider?: MediaAsset["storageProvider"] | "all";
};

export type UploadMediaAssetInput = {
  acceptedFileTypes?: readonly MediaFileType[];
  file: File;
  fileName?: string;
  folderSlug?: string;
  uploadedBy?: string;
  targetProvider?: MediaAsset["storageProvider"];
};

type R2StorageSettingsRow = {
  r2AccessKeyId: string | null;
  r2AccountId: string | null;
  r2Bucket: string | null;
  r2Enabled: boolean;
  r2PublicBaseUrl: string | null;
  r2SecretAccessKeyEncrypted: string | null;
};

type DeleteMediaAssetParameters = {
  mediaId: string;
};

type CreateMediaFolderInput = {
  description?: string;
  name: string;
  slug?: string;
};

type UpdateMediaFolderInput = CreateMediaFolderInput & {
  folderId: string;
};

type DeleteMediaFolderParameters = {
  folderId: string;
};

type UpdateMediaAssetParameters = {
  fileName: string;
  mediaId: string;
};

type GetMediaAssetDownloadParameters = {
  mediaId: string;
};

export type MediaAssetDownload = {
  contentType: string;
  fileName: string;
} & (
  | {
      data: Buffer;
      filePath?: never;
    }
  | {
      data?: never;
      filePath: string;
    }
);

type MigrateMediaStorageInput = {
  ids: string[];
  targetProvider: MediaAsset["storageProvider"];
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 60;

const FORMAT_TO_TYPE = {
  doc: MEDIA_FILE_TYPES.Document,
  docx: MEDIA_FILE_TYPES.Document,
  gif: MEDIA_FILE_TYPES.Image,
  ico: MEDIA_FILE_TYPES.Image,
  jpg: MEDIA_FILE_TYPES.Image,
  jpeg: MEDIA_FILE_TYPES.Image,
  md: MEDIA_FILE_TYPES.Document,
  mov: MEDIA_FILE_TYPES.Video,
  mp4: MEDIA_FILE_TYPES.Video,
  pdf: MEDIA_FILE_TYPES.Document,
  png: MEDIA_FILE_TYPES.Image,
  txt: MEDIA_FILE_TYPES.Document,
  webm: MEDIA_FILE_TYPES.Video,
  webp: MEDIA_FILE_TYPES.Image,
} as const;

type SupportedFileFormat = keyof typeof FORMAT_TO_TYPE;

const MIME_TYPES: Record<SupportedFileFormat, string> = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  gif: "image/gif",
  ico: "image/x-icon",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  md: "text/markdown; charset=utf-8",
  mov: "video/quicktime",
  mp4: "video/mp4",
  pdf: "application/pdf",
  png: "image/png",
  txt: "text/plain; charset=utf-8",
  webm: "video/webm",
  webp: "image/webp",
};

const isSupportedFileFormat = (value: string): value is SupportedFileFormat =>
  Object.prototype.hasOwnProperty.call(FORMAT_TO_TYPE, value);

const toPageSize = (value?: number) => {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value)));
};

const toPage = (value?: number) => {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_PAGE;
  }

  return Math.max(1, Math.floor(value));
};

const toCount = (value: string | number | undefined) => {
  if (value === undefined) {
    return 0;
  }

  return Number(value);
};

const toTimestamp = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const optionalText = (value: string | null) => {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

const isArticleMediaFolder = (slug?: string | null, systemKey?: string | null) => {
  return slug === ARTICLE_MEDIA_FOLDER_SLUG || systemKey === ARTICLE_MEDIA_FOLDER_SLUG;
};

const normalizeMediaFolderName = (name: string, slug?: string, systemKey?: string | null) => {
  return isArticleMediaFolder(slug, systemKey) ? ARTICLE_MEDIA_FOLDER_NAME : name;
};

const normalizeMediaFolderDescription = (
  description: string,
  slug?: string,
  systemKey?: string | null,
) => {
  return isArticleMediaFolder(slug, systemKey) ? ARTICLE_MEDIA_FOLDER_DESCRIPTION : description;
};

const normalizeMediaAssetFolderName = (folderName: string | null, folderSlug: string | null) => {
  if (folderName === null) {
    return undefined;
  }

  return isArticleMediaFolder(folderSlug) ? ARTICLE_MEDIA_FOLDER_NAME : optionalText(folderName);
};

const toMediaFolder = (row: MediaFolderRow): MediaFolder => ({
  createdAt: toTimestamp(row.createdAt),
  description: normalizeMediaFolderDescription(row.description, row.slug, row.systemKey),
  fileCount: toCount(row.fileCount),
  id: row.id,
  isProtected: row.isProtected,
  name: normalizeMediaFolderName(row.name, row.slug, row.systemKey),
  slug: row.slug,
  systemKey: optionalText(row.systemKey),
  updatedAt: toTimestamp(row.updatedAt),
});

const toMediaAsset = (row: MediaAssetRow): MediaAsset => ({
  accessUrl: row.accessUrl,
  createdAt: toTimestamp(row.createdAt),
  fileFormat: row.fileFormat,
  fileName: row.fileName,
  fileSizeBytes: toCount(row.fileSizeBytes),
  fileType: row.fileType,
  folderId: optionalText(row.folderId),
  folderName: normalizeMediaAssetFolderName(row.folderName, row.folderSlug),
  folderSlug: optionalText(row.folderSlug),
  id: row.id,
  storageProvider: row.storageProvider,
  updatedAt: toTimestamp(row.updatedAt),
  uploadedBy: optionalText(row.uploadedBy),
});

const toSummary = (row?: MediaSummaryRow): MediaLibrarySummary => ({
  documents: toCount(row?.documentCount),
  images: toCount(row?.imageCount),
  storageBytes: toCount(row?.storageBytes),
  total: toCount(row?.totalCount),
  videos: toCount(row?.videoCount),
});

const normalizeSearchQuery = (query?: string) => {
  const trimmedQuery = query?.trim().toLocaleLowerCase() ?? "";
  return trimmedQuery.length > 0 ? `%${trimmedQuery}%` : null;
};

const normalizeFileTypeFilter = (fileType?: MediaFileType | "all") => {
  if (fileType === undefined || fileType === "all") {
    return null;
  }

  return fileType;
};

const normalizeStorageProviderFilter = (
  storageProvider?: MediaAsset["storageProvider"] | "all",
) => {
  if (storageProvider === undefined || storageProvider === "all") {
    return null;
  }

  return storageProvider;
};

const normalizeFolderSlugFilter = (folderSlug?: string) => {
  const trimmedSlug = folderSlug?.trim().toLocaleLowerCase() ?? "";
  return trimmedSlug.length > 0 && trimmedSlug !== "all" ? trimmedSlug : null;
};

const normalizeFolderText = (value: string) => value.trim().replace(/\s+/g, " ");

const createFolderSlugBase = (value: string) => {
  const slug = value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : `folder-${Date.now()}`;
};

const createUniqueFolderSlug = async ({
  exceptId,
  sql,
  value,
}: {
  exceptId?: string;
  sql: MediaAssetsSql;
  value: string;
}) => {
  const baseSlug = createFolderSlugBase(value);

  for (let index = 0; index < 1000; index += 1) {
    const candidate = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
    const rows = await sql<{ id: string }[]>`
      SELECT id
      FROM media_folders
      WHERE lower(slug) = ${candidate}
        AND (${exceptId ?? null}::uuid IS NULL OR id <> ${exceptId ?? null})
      LIMIT 1
    `;

    if (rows[0] === undefined) {
      return candidate;
    }
  }

  throw new MediaLibraryError(
    MEDIA_LIBRARY_FAILURE.FolderSlugExists,
    "Media folder slug already exists.",
  );
};

const sanitizeDisplayName = (name: string) => {
  const cleanName = basename(name)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return cleanName.length > 0 ? cleanName : `media-${Date.now()}`;
};

const readFileFormat = (file: File) => {
  const extension = extname(file.name).replace(".", "").toLocaleLowerCase();
  if (isSupportedFileFormat(extension)) {
    return extension;
  }

  throw new MediaLibraryError(
    MEDIA_LIBRARY_FAILURE.UnsupportedFileType,
    "File type is not supported.",
  );
};

const resolveUploadsRoot = () => resolve(process.cwd(), env.uploadsDir);

const createStorageSubdir = (folderSlug?: string) => {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const normalizedFolderSlug = folderSlug?.trim().toLocaleLowerCase();

  return normalizedFolderSlug !== undefined && normalizedFolderSlug.length > 0
    ? `${normalizedFolderSlug}/${year}/${month}`
    : `${year}/${month}`;
};

const normalizeUploadsPrefix = () => `/${env.uploadsUrlPrefix.replace(/^\/+|\/+$/g, "")}`;

const createLocalAccessUrl = (storageKey: string) => `${normalizeUploadsPrefix()}/${storageKey}`;

const writeLocalMediaObject = async ({
  body,
  storageKey,
}: {
  body: Buffer;
  storageKey: string;
}) => {
  const targetPath = await resolveStoragePath({ storageKey });
  await mkdir(dirname(targetPath), { recursive: true });
  await Bun.write(targetPath, body);

  return targetPath;
};

const deleteLocalMediaObject = async (storageKey: string) => {
  await rm(await resolveStoragePath({ storageKey }), { force: true });
};

type ResolveStoragePathParameters = {
  storageKey: string;
};

const resolveStoragePath = async ({ storageKey }: ResolveStoragePathParameters) => {
  try {
    return await resolveSafeMediaStoragePath({ root: resolveUploadsRoot(), storageKey });
  } catch {
    throw new MediaLibraryError(
      MEDIA_LIBRARY_FAILURE.UnsupportedFileType,
      "Media storage path is invalid.",
    );
  }
};

type GetR2StorageSettingsParameters = {
  requireEnabled: boolean;
  sql: MediaAssetsSql;
};

export const getR2StorageSettings = async ({
  requireEnabled,
  sql,
}: GetR2StorageSettingsParameters): Promise<R2StorageSettings | undefined> => {
  const rows = await sql<R2StorageSettingsRow[]>`
    SELECT
      ss.r2_enabled,
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
  const row = rows[0];

  if (row === undefined || (requireEnabled && !row.r2Enabled)) {
    return undefined;
  }

  const secretAccessKey =
    row.r2SecretAccessKeyEncrypted === null
      ? undefined
      : decryptSecret({
          secret: env.configEncryptionSecret,
          value: row.r2SecretAccessKeyEncrypted,
        });
  const accessKeyId = optionalText(row.r2AccessKeyId);
  const accountId = optionalText(row.r2AccountId);
  const bucket = optionalText(row.r2Bucket);
  const publicBaseUrl = optionalText(row.r2PublicBaseUrl);

  if (
    accessKeyId === undefined ||
    accountId === undefined ||
    bucket === undefined ||
    publicBaseUrl === undefined ||
    secretAccessKey === undefined
  ) {
    throw new MediaLibraryError(
      MEDIA_LIBRARY_FAILURE.R2ConfigurationIncomplete,
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

type ResolveMediaFolderParameters = {
  folderSlug?: string;
  sql: MediaAssetsSql;
};

const resolveMediaFolder = async ({ folderSlug, sql }: ResolveMediaFolderParameters) => {
  const slug = folderSlug?.trim().toLocaleLowerCase() ?? "media";

  const systemNames: Readonly<Record<string, string>> = {
    "article-covers": "文章",
    avatars: "头像",
    comments: "评论",
    site: "站点",
    "website-icons": "导航图标",
    media: "媒体库",
  };
  const systemName = Object.prototype.hasOwnProperty.call(systemNames, slug) ? systemNames[slug] : undefined;
  if (systemName !== undefined) {
    await sql`
      INSERT INTO media_folders (name, slug, system_key, is_protected)
      VALUES (${systemName}, ${slug}, ${slug}, true)
      ON CONFLICT DO NOTHING
    `;
  }

  const rows = await sql<MediaFolderRow[]>`
    SELECT id, name, slug
    FROM media_folders
    WHERE lower(slug) = ${slug}
    LIMIT 1
  `;
  const folder = rows[0];

  if (folder === undefined) {
    throw new MediaLibraryError(
      MEDIA_LIBRARY_FAILURE.FolderNotFound,
      "Media folder was not found.",
    );
  }

  return folder;
};

type ValidateUploadFileParameters = {
  file: File;
};

const validateUploadFile = ({ file }: ValidateUploadFileParameters) => {
  if (file.size <= 0) {
    throw new MediaLibraryError(MEDIA_LIBRARY_FAILURE.EmptyFile, "File is empty.");
  }

  if (file.size > env.uploadMaxFileSizeBytes) {
    throw new MediaLibraryError(MEDIA_LIBRARY_FAILURE.FileTooLarge, "File is too large.");
  }

  const fileFormat = readFileFormat(file);

  return {
    fileFormat,
    fileType: FORMAT_TO_TYPE[fileFormat],
  };
};

export const listMediaAssets = async ({
  fileType,
  folderSlug,
  page,
  pageSize,
  query,
  storageProvider,
}: ListMediaAssetsParameters): Promise<MediaLibraryList> => {
  const sql = getSql();
  const normalizedPageSize = toPageSize(pageSize);
  const search = normalizeSearchQuery(query);
  const normalizedFileType = normalizeFileTypeFilter(fileType);
  const normalizedFolderSlug = normalizeFolderSlugFilter(folderSlug);
  const normalizedStorageProvider = normalizeStorageProviderFilter(storageProvider);
  const [summaryRow] = await sql<MediaSummaryRow[]>`
    SELECT
      count(*)::text AS total_count,
      count(*) FILTER (WHERE file_type = 'image')::text AS image_count,
      count(*) FILTER (WHERE file_type = 'video')::text AS video_count,
      count(*) FILTER (WHERE file_type = 'document')::text AS document_count,
      coalesce(sum(file_size_bytes), 0)::text AS storage_bytes
    FROM media_assets
  `;
  const [countRow] = await sql<CountRow[]>`
    SELECT count(*)::text AS count
    FROM media_assets ma
    LEFT JOIN media_folders mf
      ON mf.id = ma.folder_id
    WHERE (${search}::text IS NULL
        OR lower(ma.file_name) LIKE ${search}
        OR lower(ma.access_url) LIKE ${search}
        OR lower(coalesce(mf.name, '')) LIKE ${search})
      AND (${normalizedFileType}::text IS NULL OR ma.file_type = ${normalizedFileType})
      AND (${normalizedFolderSlug}::text IS NULL OR lower(mf.slug) = ${normalizedFolderSlug})
      AND (${normalizedStorageProvider}::text IS NULL
        OR ma.storage_provider = ${normalizedStorageProvider})
  `;
  const totalItems = toCount(countRow?.count);
  const totalPages = Math.max(1, Math.ceil(totalItems / normalizedPageSize));
  const normalizedPage = Math.min(toPage(page), totalPages);
  const offset = (normalizedPage - 1) * normalizedPageSize;
  const rows = await sql<MediaAssetRow[]>`
    SELECT
      ma.id,
      ma.file_name,
      ma.file_format,
      ma.file_type,
      ma.file_size_bytes,
      ma.access_url,
      ma.folder_id,
      mf.name AS folder_name,
      mf.slug AS folder_slug,
      ma.storage_provider,
      ma.storage_bucket,
      ma.storage_key,
      ma.uploaded_by,
      ma.created_at,
      ma.updated_at
    FROM media_assets ma
    LEFT JOIN media_folders mf
      ON mf.id = ma.folder_id
    WHERE (${search}::text IS NULL
        OR lower(ma.file_name) LIKE ${search}
        OR lower(ma.access_url) LIKE ${search}
        OR lower(coalesce(mf.name, '')) LIKE ${search})
      AND (${normalizedFileType}::text IS NULL OR ma.file_type = ${normalizedFileType})
      AND (${normalizedFolderSlug}::text IS NULL OR lower(mf.slug) = ${normalizedFolderSlug})
      AND (${normalizedStorageProvider}::text IS NULL
        OR ma.storage_provider = ${normalizedStorageProvider})
    ORDER BY ma.created_at DESC, ma.file_name ASC
    LIMIT ${normalizedPageSize}
    OFFSET ${offset}
  `;

  return {
    media: rows.map(toMediaAsset),
    pageInfo: {
      page: normalizedPage,
      pageSize: normalizedPageSize,
      totalItems,
      totalPages,
    },
    summary: toSummary(summaryRow),
  };
};

export const listMediaFolders = async (): Promise<MediaFolderList> => {
  const sql = getSql();
  const rows = await sql<MediaFolderRow[]>`
    SELECT
      mf.id,
      mf.name,
      mf.slug,
      mf.description,
      mf.is_protected,
      mf.system_key,
      mf.created_at,
      mf.updated_at,
      count(ma.id)::text AS file_count
    FROM media_folders mf
    LEFT JOIN media_assets ma
      ON ma.folder_id = mf.id
    GROUP BY mf.id
    ORDER BY mf.is_protected DESC, mf.created_at ASC, lower(mf.name) ASC
  `;

  return { folders: rows.map(toMediaFolder) };
};

export const createMediaFolder = async ({ description, name, slug }: CreateMediaFolderInput) => {
  const sql = getSql();
  const normalizedName = normalizeFolderText(name);

  const [row] = await sql<MediaFolderRow[]>`
    INSERT INTO media_folders (name, slug, description)
    VALUES (
      ${normalizedName},
      ${await createUniqueFolderSlug({ sql, value: slug?.trim() || normalizedName })},
      ${description?.trim() ?? ""}
    )
    RETURNING
      id,
      name,
      slug,
      description,
      is_protected,
      system_key,
      created_at,
      updated_at,
      0::text AS file_count
  `;

  if (row === undefined) {
    throw new MediaLibraryError(
      MEDIA_LIBRARY_FAILURE.FolderNotFound,
      "Media folder was not found.",
    );
  }

  return { item: toMediaFolder(row), ok: true as const };
};

export const updateMediaFolder = async ({
  description,
  folderId,
  name,
  slug,
}: UpdateMediaFolderInput) => {
  const sql = getSql();
  const [existingFolder] = await sql<MediaFolderRow[]>`
    SELECT
      mf.id,
      mf.name,
      mf.slug,
      mf.description,
      mf.is_protected,
      mf.system_key,
      mf.created_at,
      mf.updated_at,
      count(ma.id)::text AS file_count
    FROM media_folders mf
    LEFT JOIN media_assets ma
      ON ma.folder_id = mf.id
    WHERE mf.id = ${folderId}
    GROUP BY mf.id
    LIMIT 1
  `;

  if (existingFolder === undefined) {
    throw new MediaLibraryError(
      MEDIA_LIBRARY_FAILURE.FolderNotFound,
      "Media folder was not found.",
    );
  }

  const normalizedName = normalizeFolderText(name);
  const nextSlug = existingFolder.isProtected
    ? existingFolder.slug
    : await createUniqueFolderSlug({
        exceptId: folderId,
        sql,
        value: slug?.trim() || normalizedName,
      });

  await sql`
    UPDATE media_folders
    SET name = ${normalizedName},
        slug = ${nextSlug},
        description = ${description?.trim() ?? ""}
    WHERE id = ${folderId}
  `;

  const [row] = await sql<MediaFolderRow[]>`
    SELECT
      mf.id,
      mf.name,
      mf.slug,
      mf.description,
      mf.is_protected,
      mf.system_key,
      mf.created_at,
      mf.updated_at,
      count(ma.id)::text AS file_count
    FROM media_folders mf
    LEFT JOIN media_assets ma
      ON ma.folder_id = mf.id
    WHERE mf.id = ${folderId}
    GROUP BY mf.id
    LIMIT 1
  `;

  if (row === undefined) {
    throw new MediaLibraryError(
      MEDIA_LIBRARY_FAILURE.FolderNotFound,
      "Media folder was not found.",
    );
  }

  return { item: toMediaFolder(row), ok: true as const };
};

export const deleteMediaFolder = async ({ folderId }: DeleteMediaFolderParameters) => {
  const sql = getSql();
  const [folder] = await sql<MediaFolderRow[]>`
    SELECT
      mf.id,
      mf.name,
      mf.slug,
      mf.description,
      mf.is_protected,
      mf.system_key,
      mf.created_at,
      mf.updated_at,
      count(ma.id)::text AS file_count
    FROM media_folders mf
    LEFT JOIN media_assets ma
      ON ma.folder_id = mf.id
    WHERE mf.id = ${folderId}
    GROUP BY mf.id
    LIMIT 1
  `;

  if (folder === undefined) {
    throw new MediaLibraryError(
      MEDIA_LIBRARY_FAILURE.FolderNotFound,
      "Media folder was not found.",
    );
  }

  if (folder.isProtected) {
    throw new MediaLibraryError(
      MEDIA_LIBRARY_FAILURE.ProtectedFolder,
      "Protected media folder cannot be deleted.",
    );
  }

  await sql`DELETE FROM media_folders WHERE id = ${folderId}`;

  return { ok: true as const };
};

export const uploadMediaAsset = async ({
  acceptedFileTypes,
  file,
  fileName,
  folderSlug,
  targetProvider,
  uploadedBy,
}: UploadMediaAssetInput) => {
  const { fileFormat, fileType } = validateUploadFile({ file });
  if (acceptedFileTypes !== undefined && !acceptedFileTypes.includes(fileType)) {
    throw new MediaLibraryError(
      MEDIA_LIBRARY_FAILURE.UnsupportedFileType,
      "File type is not supported.",
    );
  }
  const fileBytes = Buffer.from(await file.arrayBuffer());
  if (!(await isMediaFileContentValid({ bytes: fileBytes, fileFormat }))) {
    throw new MediaLibraryError(
      MEDIA_LIBRARY_FAILURE.UnsupportedFileType,
      "File content does not match a supported media format.",
    );
  }
  const sql = getSql();
  const folder = await resolveMediaFolder({ folderSlug, sql });
  const id = crypto.randomUUID();
  const storageSubdir = createStorageSubdir(folder.slug);
  const storageKey = `${storageSubdir}/${id}.${fileFormat}`;
  const displayName = sanitizeDisplayName(fileName?.trim() || file.name);
  const enabledR2Settings =
    targetProvider === undefined
      ? await getR2StorageSettings({ requireEnabled: true, sql })
      : undefined;
  const storageProvider = targetProvider ?? (enabledR2Settings === undefined ? "local" : "r2");
  const r2Settings =
    storageProvider === "r2"
      ? (enabledR2Settings ?? (await getR2StorageSettings({ requireEnabled: false, sql })))
      : undefined;
  if (storageProvider === "r2" && r2Settings === undefined) {
    throw new MediaLibraryError(
      MEDIA_LIBRARY_FAILURE.R2ConfigurationIncomplete,
      "Cloudflare R2 storage configuration is incomplete.",
    );
  }
  const accessUrl =
    r2Settings === undefined
      ? createLocalAccessUrl(storageKey)
      : buildR2ObjectUrl(r2Settings, storageKey);
  const storageBucket = r2Settings?.bucket ?? null;

  if (r2Settings === undefined) {
    await writeLocalMediaObject({ body: fileBytes, storageKey });
  } else {
    await putR2Object({
      body: fileBytes,
      contentType: readMediaContentType(fileFormat),
      key: storageKey,
      settings: r2Settings,
    });
  }

  try {
    await sql`
      INSERT INTO media_assets (
        id,
        file_name,
        file_format,
        file_type,
        file_size_bytes,
        access_url,
        uploaded_by,
        folder_id,
        storage_provider,
        storage_bucket,
        storage_key
      )
      VALUES (
        ${id},
        ${displayName},
        ${fileFormat},
        ${fileType},
        ${fileBytes.byteLength},
        ${accessUrl},
        ${uploadedBy ?? null},
        ${folder.id},
        ${storageProvider},
        ${storageBucket},
        ${storageKey}
      )
    `;
  } catch (error) {
    if (r2Settings === undefined) {
      await deleteLocalMediaObject(storageKey);
    } else {
      await deleteR2Object(r2Settings, storageKey);
    }
    throw error;
  }

  return getMediaAssetById({ mediaId: id });
};

type GetMediaAssetByIdParameters = {
  mediaId: string;
};

export const getMediaAssetById = async ({ mediaId }: GetMediaAssetByIdParameters) => {
  const sql = getSql();
  const rows = await sql<MediaAssetRow[]>`
    SELECT
      ma.id,
      ma.file_name,
      ma.file_format,
      ma.file_type,
      ma.file_size_bytes,
      ma.access_url,
      ma.folder_id,
      mf.name AS folder_name,
      mf.slug AS folder_slug,
      ma.storage_provider,
      ma.storage_bucket,
      ma.storage_key,
      ma.uploaded_by,
      ma.created_at,
      ma.updated_at
    FROM media_assets ma
    LEFT JOIN media_folders mf
      ON mf.id = ma.folder_id
    WHERE ma.id = ${mediaId}
    LIMIT 1
  `;
  const row = rows[0];

  if (row === undefined) {
    throw new MediaLibraryError(MEDIA_LIBRARY_FAILURE.NotFound, "Media asset was not found.");
  }

  return toMediaAsset(row);
};

export const deleteMediaAsset = async ({ mediaId }: DeleteMediaAssetParameters) => {
  const sql = getSql();
  const rows = await sql<MediaAssetRow[]>`
    SELECT
      id,
      file_name,
      file_format,
      file_type,
      file_size_bytes,
      access_url,
      folder_id,
      null AS folder_name,
      null AS folder_slug,
      storage_provider,
      storage_bucket,
      storage_key,
      uploaded_by,
      created_at,
      updated_at
    FROM media_assets
    WHERE id = ${mediaId}
    LIMIT 1
  `;
  const row = rows[0];

  if (row === undefined) {
    throw new MediaLibraryError(MEDIA_LIBRARY_FAILURE.NotFound, "Media asset was not found.");
  }

  const r2Settings =
    row.storageProvider === "r2" && row.storageKey !== null
      ? await getR2StorageSettings({ requireEnabled: false, sql })
      : undefined;

  await sql.begin(async (transaction) => {
    await transaction`DELETE FROM media_assets WHERE id = ${mediaId}`;
  });

  if (row.storageProvider === "local" && row.storageKey !== null) {
    await deleteLocalMediaObject(row.storageKey);
  }
  if (r2Settings !== undefined && row.storageKey !== null) {
    await deleteR2Object(r2Settings, row.storageKey);
  }

  return { ok: true };
};

export const updateMediaAsset = async ({ fileName, mediaId }: UpdateMediaAssetParameters) => {
  const sql = getSql();
  await getMediaAssetById({ mediaId });

  await sql`
    UPDATE media_assets
    SET file_name = ${sanitizeDisplayName(fileName)}
    WHERE id = ${mediaId}
  `;

  const item = await getMediaAssetById({ mediaId });

  return { item, ok: true as const };
};

export const getMediaAssetDownload = async ({
  mediaId,
}: GetMediaAssetDownloadParameters): Promise<MediaAssetDownload> => {
  const sql = getSql();
  const rows = await sql<MediaAssetRow[]>`
    SELECT
      id,
      file_name,
      file_format,
      file_type,
      file_size_bytes,
      access_url,
      folder_id,
      null AS folder_name,
      null AS folder_slug,
      storage_provider,
      storage_bucket,
      storage_key,
      uploaded_by,
      created_at,
      updated_at
    FROM media_assets
    WHERE id = ${mediaId}
    LIMIT 1
  `;
  const row = rows[0];

  if (row === undefined) {
    throw new MediaLibraryError(MEDIA_LIBRARY_FAILURE.NotFound, "Media asset was not found.");
  }

  if (row.storageKey === null) {
    throw new MediaLibraryError(MEDIA_LIBRARY_FAILURE.NotFound, "Media file was not found.");
  }

  if (row.storageProvider === "r2") {
    const r2Settings = await getR2StorageSettings({ requireEnabled: false, sql });

    if (r2Settings === undefined) {
      throw new MediaLibraryError(
        MEDIA_LIBRARY_FAILURE.R2ConfigurationIncomplete,
        "Cloudflare R2 storage configuration is incomplete.",
      );
    }

    return {
      contentType: readMediaContentType(row.fileFormat),
      data: await getR2Object(r2Settings, row.storageKey),
      fileName: row.fileName,
    };
  }

  return {
    contentType: readMediaContentType(row.fileFormat),
    fileName: row.fileName,
    filePath: await resolveStoragePath({ storageKey: row.storageKey }),
  };
};

const getMediaAssetRow = async ({ mediaId, sql }: { mediaId: string; sql: MediaAssetsSql }) => {
  const rows = await sql<MediaAssetRow[]>`
    SELECT
      id,
      file_name,
      file_format,
      file_type,
      file_size_bytes,
      access_url,
      folder_id,
      null AS folder_name,
      null AS folder_slug,
      storage_provider,
      storage_bucket,
      storage_key,
      uploaded_by,
      created_at,
      updated_at
    FROM media_assets
    WHERE id = ${mediaId}
    LIMIT 1
  `;

  return rows[0];
};

const readMediaObjectBytes = async ({
  row,
  r2Settings,
}: {
  row: MediaAssetRow;
  r2Settings?: R2StorageSettings;
}) => {
  if (row.storageKey === null) {
    throw new MediaLibraryError(MEDIA_LIBRARY_FAILURE.NotFound, "Media file was not found.");
  }

  if (row.storageProvider === "r2") {
    if (r2Settings === undefined) {
      throw new MediaLibraryError(
        MEDIA_LIBRARY_FAILURE.R2ConfigurationIncomplete,
        "Cloudflare R2 storage configuration is incomplete.",
      );
    }

    return getR2Object(r2Settings, row.storageKey);
  }

  return readFile(await resolveStoragePath({ storageKey: row.storageKey }));
};

const updateMediaReferences = async ({
  newUrl,
  oldUrl,
  sql,
}: {
  newUrl: string;
  oldUrl: string;
  sql: MediaAssetsSql;
}) => {
  if (newUrl === oldUrl) {
    return 0;
  }

  const urlPattern = `%${oldUrl}%`;
  const [row] = await sql<{ updatedCount: string }[]>`
    WITH
      articles_cover AS (
        UPDATE articles
        SET cover_image_url = ${newUrl}
        WHERE cover_image_url = ${oldUrl}
        RETURNING 1
      ),
      articles_content AS (
        UPDATE articles
        SET content_mdx = replace(content_mdx, ${oldUrl}, ${newUrl})
        WHERE content_mdx LIKE ${urlPattern}
        RETURNING 1
      ),
      articles_en_content AS (
        UPDATE articles_en
        SET content_mdx = replace(content_mdx, ${oldUrl}, ${newUrl})
        WHERE content_mdx LIKE ${urlPattern}
        RETURNING 1
      ),
      settings_light_logo AS (
        UPDATE site_settings
        SET light_logo_url = ${newUrl}
        WHERE light_logo_url = ${oldUrl}
        RETURNING 1
      ),
      settings_dark_logo AS (
        UPDATE site_settings
        SET dark_logo_url = ${newUrl}
        WHERE dark_logo_url = ${oldUrl}
        RETURNING 1
      ),
      settings_favicon AS (
        UPDATE site_settings
        SET favicon_url = ${newUrl}
        WHERE favicon_url = ${oldUrl}
        RETURNING 1
      ),
      settings_covers AS (
        UPDATE site_settings
        SET cover_urls = array_replace(cover_urls, ${oldUrl}, ${newUrl})
        WHERE ${oldUrl} = ANY(cover_urls)
        RETURNING 1
      ),
      users_avatar AS (
        UPDATE users
        SET avatar_url = ${newUrl}
        WHERE avatar_url = ${oldUrl}
        RETURNING 1
      ),
      contributors_avatar AS (
        UPDATE article_contributors
        SET avatar_url = ${newUrl}
        WHERE avatar_url = ${oldUrl}
        RETURNING 1
      ),
      navigation_icons AS (
        UPDATE navigation_items
        SET icon_url = ${newUrl}
        WHERE icon_url = ${oldUrl}
        RETURNING 1
      ),
      comments_content AS (
        UPDATE comments
        SET content = replace(content, ${oldUrl}, ${newUrl})
        WHERE content LIKE ${urlPattern}
        RETURNING 1
      )
    SELECT (
      (SELECT count(*) FROM articles_cover) +
      (SELECT count(*) FROM articles_content) +
      (SELECT count(*) FROM articles_en_content) +
      (SELECT count(*) FROM settings_light_logo) +
      (SELECT count(*) FROM settings_dark_logo) +
      (SELECT count(*) FROM settings_favicon) +
      (SELECT count(*) FROM settings_covers) +
      (SELECT count(*) FROM users_avatar) +
      (SELECT count(*) FROM contributors_avatar) +
      (SELECT count(*) FROM navigation_icons) +
      (SELECT count(*) FROM comments_content)
    )::text AS updated_count
  `;

  return toCount(row?.updatedCount);
};

export const migrateMediaStorage = async ({ ids, targetProvider }: MigrateMediaStorageInput) => {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0))];
  if (uniqueIds.length === 0) {
    return {
      items: [],
      ok: true as const,
      updatedReferences: 0,
    };
  }

  const sql = getSql();
  const targetR2Settings =
    targetProvider === "r2"
      ? await getR2StorageSettings({ requireEnabled: false, sql })
      : undefined;
  if (targetProvider === "r2" && targetR2Settings === undefined) {
    throw new MediaLibraryError(
      MEDIA_LIBRARY_FAILURE.R2ConfigurationIncomplete,
      "Cloudflare R2 storage configuration is incomplete.",
    );
  }

  let updatedReferences = 0;
  const migratedIds: string[] = [];

  for (const mediaId of uniqueIds) {
    const row = await getMediaAssetRow({ mediaId, sql });
    if (row === undefined) {
      throw new MediaLibraryError(MEDIA_LIBRARY_FAILURE.NotFound, "Media asset was not found.");
    }
    if (row.storageKey === null || row.storageProvider === targetProvider) {
      migratedIds.push(mediaId);
      continue;
    }

    const sourceR2Settings =
      row.storageProvider === "r2"
        ? await getR2StorageSettings({ requireEnabled: false, sql })
        : undefined;
    const fileBytes = await readMediaObjectBytes({ row, r2Settings: sourceR2Settings });
    if (!(await isMediaFileContentValid({ bytes: fileBytes, fileFormat: row.fileFormat }))) {
      throw new MediaLibraryError(
        MEDIA_LIBRARY_FAILURE.UnsupportedFileType,
        "File content does not match a supported media format.",
      );
    }
    const nextAccessUrl =
      targetProvider === "r2" && targetR2Settings !== undefined
        ? buildR2ObjectUrl(targetR2Settings, row.storageKey)
        : createLocalAccessUrl(row.storageKey);

    if (targetProvider === "r2" && targetR2Settings !== undefined) {
      await putR2Object({
        body: fileBytes,
        contentType: readMediaContentType(row.fileFormat),
        key: row.storageKey,
        settings: targetR2Settings,
      });
    } else {
      await writeLocalMediaObject({ body: fileBytes, storageKey: row.storageKey });
    }

    await sql.begin(async (transaction) => {
      await transaction`
        UPDATE media_assets
        SET
          access_url = ${nextAccessUrl},
          storage_provider = ${targetProvider},
          storage_bucket = ${targetR2Settings?.bucket ?? null},
          storage_key = ${row.storageKey}
        WHERE id = ${mediaId}
      `;
      updatedReferences += await updateMediaReferences({
        newUrl: nextAccessUrl,
        oldUrl: row.accessUrl,
        sql: transaction,
      });
    });

    if (row.storageProvider === "local") {
      await deleteLocalMediaObject(row.storageKey);
    } else if (sourceR2Settings !== undefined) {
      await deleteR2Object(sourceR2Settings, row.storageKey);
    }

    migratedIds.push(mediaId);
  }

  const items = await Promise.all(migratedIds.map((mediaId) => getMediaAssetById({ mediaId })));

  return {
    items,
    ok: true as const,
    updatedReferences,
  };
};

export const readMediaContentType = (fileFormat: string) => {
  if (!isSupportedFileFormat(fileFormat)) {
    return "application/octet-stream";
  }

  return MIME_TYPES[fileFormat];
};
