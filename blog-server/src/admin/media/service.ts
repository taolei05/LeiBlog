import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { basename, extname, resolve, sep } from "node:path";

import type { AuthUser } from "../../shared/auth";
import type { AppConfig } from "../../shared/config";
import type { DbClient } from "../../shared/db";
import { requireAdmin } from "../../shared/auth";
import { appConfig } from "../../shared/config";
import { db, withTransaction } from "../../shared/db";
import { notFound, validationError } from "../../shared/errors";
import { createPinyinSlug, normalizeSlug, withSlugSuffix } from "../../shared/slug";

type MediaType = "image" | "video" | "document";
type SortOrder = "asc" | "desc";
type MediaSystemFolderKey = "article-covers" | "avatars" | "comments" | "site";

export interface MediaListQuery {
  createdFrom?: string;
  createdTo?: string;
  search?: string;
  folderId?: string;
  folderSlug?: string;
  fileType?: MediaType;
  fileFormat?: string;
  page?: string;
  pageSize?: string;
  sortBy?: "createdAt" | "fileName" | "fileSize" | "fileType";
  sortOrder?: SortOrder;
}

export interface UploadMediaInput {
  file: File;
  fileName?: string;
  folderId?: string;
  folderSlug?: string;
}

export interface MediaFolderInput {
  description?: string | null;
  name: string;
  slug?: string;
}

export interface MediaServiceOptions {
  client?: DbClient;
  config?: AppConfig;
}

interface StoreMediaAssetInput extends UploadMediaInput {
  allowedFileTypes?: MediaType[];
  uploadedBy: string | null;
}

interface MediaRow {
  access_url: string;
  created_at: Date | string;
  file_format: string;
  file_name: string;
  file_size_bytes: string | number | bigint;
  file_type: MediaType;
  folder_id: string | null;
  folder_name: string | null;
  folder_slug: string | null;
  folder_system_key: string | null;
  id: string;
  updated_at: Date | string;
  uploaded_by: string | null;
}

interface MediaFolderRow {
  article_count: string | number | bigint;
  created_at: Date | string;
  description: string;
  id: string;
  is_protected: boolean;
  name: string;
  slug: string;
  system_key: MediaSystemFolderKey | null;
  updated_at: Date | string;
}

const DEFAULT_MEDIA_FOLDERS = [
  {
    description: "文章封面只能存储到这里。",
    name: "文章封面",
    slug: "article-covers",
    systemKey: "article-covers",
  },
  {
    description: "所有用户头像只能存储到这里。",
    name: "头像",
    slug: "avatars",
    systemKey: "avatars",
  },
  {
    description: "评论图片只能存储到这里。",
    name: "评论",
    slug: "comments",
    systemKey: "comments",
  },
  {
    description: "站点深浅色 Logo 和 favicon 只能存储到这里。",
    name: "站点",
    slug: "site",
    systemKey: "site",
  },
] satisfies Array<{
  description: string;
  name: string;
  slug: MediaSystemFolderKey;
  systemKey: MediaSystemFolderKey;
}>;

const FORMAT_TO_TYPE = {
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  mp4: "video",
  webm: "video",
  pdf: "document",
  docx: "document",
} satisfies Record<string, MediaType>;

const EXTENSION_ALIASES: Record<string, keyof typeof FORMAT_TO_TYPE> = {
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  gif: "gif",
  webp: "webp",
  svg: "svg",
  mp4: "mp4",
  webm: "webm",
  pdf: "pdf",
  docx: "docx",
};

function toIso(value: Date | string) {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function toMediaItem(row: MediaRow) {
  return {
    id: row.id,
    fileName: row.file_name,
    fileFormat: row.file_format,
    fileType: row.file_type,
    fileSizeBytes: Number(row.file_size_bytes),
    accessUrl: row.access_url,
    folderId: row.folder_id,
    folderName: row.folder_name,
    folderSlug: row.folder_slug,
    folderSystemKey: row.folder_system_key,
    uploadedBy: row.uploaded_by,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function toMediaFolder(row: MediaFolderRow) {
  return {
    createdAt: toIso(row.created_at),
    description: row.description,
    fileCount: Number(row.article_count),
    id: row.id,
    isProtected: row.is_protected,
    name: row.name,
    slug: row.slug,
    systemKey: row.system_key,
    updatedAt: toIso(row.updated_at),
  };
}

function parsePositiveInt(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function parseDateFilter(value: string | undefined) {
  if (!value?.trim()) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw validationError("媒体时间筛选格式无效");
  }

  return date;
}

function toPage(input: MediaListQuery) {
  const page = parsePositiveInt(input.page, 1, 10_000);
  const pageSize = parsePositiveInt(input.pageSize, 24, 100);
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

function orderClause(sortBy: MediaListQuery["sortBy"], sortOrder: MediaListQuery["sortOrder"]) {
  const order = sortOrder === "asc" ? "ASC" : "DESC";
  const column =
    sortBy === "fileName"
      ? "lower(ma.file_name)"
      : sortBy === "fileSize"
        ? "ma.file_size_bytes"
        : sortBy === "fileType"
          ? "ma.file_type"
          : "ma.created_at";

  return `${column} ${order}, ma.created_at DESC`;
}

function getConfig(options: MediaServiceOptions) {
  return options.config ?? appConfig;
}

function getClient(options: MediaServiceOptions) {
  return options.client ?? db;
}

function cleanOptional(value: string | null | undefined) {
  if (value === null) return null;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function folderSlugFromName(value: string) {
  return normalizeSlug(value) || createPinyinSlug(value) || "folder";
}

async function ensureDefaultMediaFolders(client: DbClient) {
  for (const folder of DEFAULT_MEDIA_FOLDERS) {
    await client`
      INSERT INTO media_folders (name, slug, description, system_key, is_protected)
      VALUES (
        ${folder.name},
        ${folder.slug},
        ${folder.description},
        ${folder.systemKey},
        true
      )
      ON CONFLICT DO NOTHING
    `;
    await client`
      UPDATE media_folders
      SET name = ${folder.name},
          description = ${folder.description},
          system_key = ${folder.systemKey},
          is_protected = true
      WHERE slug = ${folder.slug}
    `;
  }
}

async function folderSlugExists(client: DbClient, slug: string, exceptId?: string) {
  const [row] = await client.unsafe<{ id: string }[]>(
    `
      SELECT id
      FROM media_folders
      WHERE lower(slug) = lower($1)
        AND ($2::uuid IS NULL OR id <> $2)
      LIMIT 1
    `,
    [slug, exceptId ?? null]
  );

  return Boolean(row);
}

async function createUniqueFolderSlug(client: DbClient, value: string, exceptId?: string) {
  const baseSlug = folderSlugFromName(value);

  for (let index = 1; index < 1000; index += 1) {
    const candidate = withSlugSuffix(baseSlug, index);
    if (!(await folderSlugExists(client, candidate, exceptId))) return candidate;
  }

  throw validationError("文件夹 slug 已存在");
}

function resolveUploadsDir(config: AppConfig) {
  return resolve(process.cwd(), config.uploadsDir);
}

function safeDisplayName(name: string) {
  const cleanName = basename(name)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return cleanName || `media-${Date.now()}`;
}

function fileExtension(fileName: string) {
  const ext = extname(fileName).replace(".", "").toLowerCase();
  return EXTENSION_ALIASES[ext] ?? null;
}

function hasBytes(bytes: Uint8Array, expected: number[]) {
  return expected.every((value, index) => bytes[index] === value);
}

function textHead(bytes: Uint8Array) {
  return new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.slice(0, 512))
    .trim()
    .toLowerCase();
}

function validateSignature(format: keyof typeof FORMAT_TO_TYPE, bytes: Uint8Array) {
  switch (format) {
    case "jpeg":
      return hasBytes(bytes, [0xff, 0xd8, 0xff]);
    case "png":
      return hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "gif":
      return textHead(bytes).startsWith("gif87a") || textHead(bytes).startsWith("gif89a");
    case "webp":
      return (
        textHead(bytes.slice(0, 16)).startsWith("riff") &&
        textHead(bytes.slice(8, 16)).startsWith("webp")
      );
    case "svg":
      return textHead(bytes).includes("<svg");
    case "mp4":
      return textHead(bytes.slice(4, 12)).includes("ftyp");
    case "webm":
      return hasBytes(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
    case "pdf":
      return textHead(bytes).startsWith("%pdf");
    case "docx":
      return hasBytes(bytes, [0x50, 0x4b, 0x03, 0x04]);
  }
}

async function validateUploadFile(file: File, config: AppConfig) {
  if (file.size <= 0) throw validationError("文件不能为空");
  if (file.size > config.uploadMaxFileSizeBytes) {
    throw validationError("文件大小超过限制");
  }

  const format = fileExtension(file.name);
  if (!format) throw validationError("不支持的文件类型");

  const buffer = new Uint8Array(await file.arrayBuffer());
  if (!validateSignature(format, buffer)) {
    throw validationError("文件内容与扩展名不匹配");
  }

  return {
    buffer,
    format,
    fileType: FORMAT_TO_TYPE[format],
  };
}

function mediaStorageName(id: string, format: keyof typeof FORMAT_TO_TYPE) {
  return `${id}.${format}`;
}

function storageSubdir(now = new Date()) {
  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}/${month}`;
}

function toAccessUrl(config: AppConfig, subdir: string, storageName: string) {
  return `${config.uploadsUrlPrefix.replace(/\/$/, "")}/${subdir}/${storageName}`;
}

function pathForAccessUrl(config: AppConfig, accessUrl: string) {
  const prefix = config.uploadsUrlPrefix.replace(/\/$/, "");
  if (!accessUrl.startsWith(`${prefix}/`)) {
    throw validationError("媒体访问地址无效");
  }

  const relativePath = accessUrl.slice(prefix.length + 1);
  const root = resolveUploadsDir(config);
  const filePath = resolve(root, relativePath);

  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    throw validationError("媒体访问地址无效");
  }

  return filePath;
}

async function getMediaRow(id: string, client: DbClient = db) {
  const [row] = await client<MediaRow[]>`
    SELECT ma.id, ma.file_name, ma.file_format, ma.file_type, ma.file_size_bytes,
           ma.access_url, ma.folder_id, mf.name AS folder_name, mf.slug AS folder_slug,
           mf.system_key AS folder_system_key, ma.uploaded_by, ma.created_at, ma.updated_at
    FROM media_assets ma
    LEFT JOIN media_folders mf ON mf.id = ma.folder_id
    WHERE ma.id = ${id}
  `;

  if (!row) throw notFound("媒体不存在");
  return row;
}

async function getFolderRow(id: string, client: DbClient = db) {
  const [row] = await client<MediaFolderRow[]>`
    SELECT mf.id, mf.name, mf.slug, mf.description, mf.system_key, mf.is_protected,
           mf.created_at, mf.updated_at, count(ma.id) AS article_count
    FROM media_folders mf
    LEFT JOIN media_assets ma ON ma.folder_id = mf.id
    WHERE mf.id = ${id}
    GROUP BY mf.id
  `;

  if (!row) throw notFound("媒体文件夹不存在");
  return row;
}

async function resolveFolder({
  client,
  folderId,
  folderSlug,
}: {
  client: DbClient;
  folderId?: string;
  folderSlug?: string;
}) {
  const slug = folderSlug?.trim().toLowerCase() || null;
  const id = folderId?.trim() || null;

  if (!id && !slug) return null;

  const [row] = await client<MediaFolderRow[]>`
    SELECT mf.id, mf.name, mf.slug, mf.description, mf.system_key, mf.is_protected,
           mf.created_at, mf.updated_at, count(ma.id) AS article_count
    FROM media_folders mf
    LEFT JOIN media_assets ma ON ma.folder_id = mf.id
    WHERE (${id}::uuid IS NULL OR mf.id = ${id})
      AND (${slug}::text IS NULL OR lower(mf.slug) = ${slug})
    GROUP BY mf.id
    LIMIT 1
  `;

  if (!row) throw validationError("媒体文件夹不存在");
  return row;
}

export async function listMediaFolders(
  currentUser: AuthUser,
  options: MediaServiceOptions = {}
) {
  requireAdmin(currentUser);
  const client = getClient(options);
  await ensureDefaultMediaFolders(client);

  const rows = await client<MediaFolderRow[]>`
    SELECT mf.id, mf.name, mf.slug, mf.description, mf.system_key, mf.is_protected,
           mf.created_at, mf.updated_at, count(ma.id) AS article_count
    FROM media_folders mf
    LEFT JOIN media_assets ma ON ma.folder_id = mf.id
    GROUP BY mf.id
    ORDER BY mf.is_protected DESC, mf.created_at ASC, lower(mf.name) ASC
  `;

  return { ok: true, items: rows.map(toMediaFolder) };
}

export async function createMediaFolder(
  currentUser: AuthUser,
  input: MediaFolderInput,
  options: MediaServiceOptions = {}
) {
  requireAdmin(currentUser);
  const client = getClient(options);
  await ensureDefaultMediaFolders(client);

  const slug = await createUniqueFolderSlug(client, input.slug ?? input.name);
  const [row] = await client<MediaFolderRow[]>`
    INSERT INTO media_folders (name, slug, description)
    VALUES (${input.name.trim()}, ${slug}, ${cleanOptional(input.description) ?? ""})
    RETURNING id, name, slug, description, system_key, is_protected,
              created_at, updated_at, 0 AS article_count
  `;

  return { ok: true, item: toMediaFolder(row) };
}

export async function updateMediaFolder(
  currentUser: AuthUser,
  id: string,
  input: MediaFolderInput,
  options: MediaServiceOptions = {}
) {
  requireAdmin(currentUser);
  const client = getClient(options);
  const existing = await getFolderRow(id, client);
  const slug =
    !existing.is_protected && input.slug?.trim()
      ? await createUniqueFolderSlug(client, input.slug, id)
      : existing.slug;

  await client`
    UPDATE media_folders
    SET name = ${input.name.trim()},
        slug = ${slug},
        description = ${cleanOptional(input.description) ?? ""}
    WHERE id = ${id}
  `;

  return { ok: true, item: toMediaFolder(await getFolderRow(id, client)) };
}

export async function deleteMediaFolder(
  currentUser: AuthUser,
  id: string,
  options: MediaServiceOptions = {}
) {
  requireAdmin(currentUser);
  const client = getClient(options);
  const folder = await getFolderRow(id, client);

  if (folder.is_protected) {
    throw validationError("系统媒体文件夹禁止删除");
  }

  await client`DELETE FROM media_folders WHERE id = ${id}`;
  return { ok: true };
}

export async function getMediaById(
  currentUser: AuthUser,
  id: string,
  options: MediaServiceOptions = {}
) {
  requireAdmin(currentUser);
  return toMediaItem(await getMediaRow(id, getClient(options)));
}

export async function listMedia(
  currentUser: AuthUser,
  query: MediaListQuery,
  options: MediaServiceOptions = {}
) {
  requireAdmin(currentUser);
  const client = getClient(options);
  await ensureDefaultMediaFolders(client);
  const { page, pageSize, offset } = toPage(query);
  const search = query.search?.trim()
    ? `%${query.search.trim().toLowerCase()}%`
    : null;
  const folderId = query.folderId ?? null;
  const folderSlug = query.folderSlug?.trim().toLowerCase() || null;
  const fileType = query.fileType ?? null;
  const fileFormat = query.fileFormat?.trim().toLowerCase() || null;
  const createdFrom = parseDateFilter(query.createdFrom);
  const createdTo = parseDateFilter(query.createdTo);
  const orderBy = orderClause(query.sortBy, query.sortOrder);

  const rows = await client.unsafe<MediaRow[]>(
    `
      SELECT ma.id, ma.file_name, ma.file_format, ma.file_type, ma.file_size_bytes,
             ma.access_url, ma.folder_id, mf.name AS folder_name, mf.slug AS folder_slug,
             mf.system_key AS folder_system_key, ma.uploaded_by, ma.created_at, ma.updated_at
      FROM media_assets ma
      LEFT JOIN media_folders mf ON mf.id = ma.folder_id
      WHERE ($1::text IS NULL OR lower(ma.file_name) LIKE $1 OR lower(ma.access_url) LIKE $1 OR lower(coalesce(mf.name, '')) LIKE $1)
        AND ($2::media_type IS NULL OR ma.file_type = $2)
        AND ($3::text IS NULL OR lower(ma.file_format) = $3)
        AND ($4::timestamptz IS NULL OR ma.created_at >= $4)
        AND ($5::timestamptz IS NULL OR ma.created_at < $5)
        AND ($6::uuid IS NULL OR ma.folder_id = $6)
        AND ($7::text IS NULL OR lower(mf.slug) = $7)
      ORDER BY ${orderBy}
      LIMIT $8 OFFSET $9
    `,
    [search, fileType, fileFormat, createdFrom, createdTo, folderId, folderSlug, pageSize, offset]
  );

  const [count] = await client.unsafe<{ total: string }[]>(
    `
      SELECT count(*) AS total
      FROM media_assets ma
      LEFT JOIN media_folders mf ON mf.id = ma.folder_id
      WHERE ($1::text IS NULL OR lower(ma.file_name) LIKE $1 OR lower(ma.access_url) LIKE $1 OR lower(coalesce(mf.name, '')) LIKE $1)
        AND ($2::media_type IS NULL OR ma.file_type = $2)
        AND ($3::text IS NULL OR lower(ma.file_format) = $3)
        AND ($4::timestamptz IS NULL OR ma.created_at >= $4)
        AND ($5::timestamptz IS NULL OR ma.created_at < $5)
        AND ($6::uuid IS NULL OR ma.folder_id = $6)
        AND ($7::text IS NULL OR lower(mf.slug) = $7)
    `,
    [search, fileType, fileFormat, createdFrom, createdTo, folderId, folderSlug]
  );

  return {
    ok: true,
    items: rows.map(toMediaItem),
    page,
    pageSize,
    total: Number(count?.total ?? 0),
  };
}

export async function uploadMedia(
  currentUser: AuthUser,
  input: UploadMediaInput,
  options: MediaServiceOptions = {}
) {
  requireAdmin(currentUser);
  return storeMediaAsset(
    {
      ...input,
      uploadedBy: currentUser.id,
    },
    options
  );
}

export async function uploadSetupMedia(
  input: UploadMediaInput,
  options: MediaServiceOptions = {}
) {
  return storeMediaAsset(
    {
      ...input,
      allowedFileTypes: ["image"],
      uploadedBy: null,
    },
    options
  );
}

export async function uploadUserAvatar(
  userId: string,
  input: Pick<UploadMediaInput, "file" | "fileName">,
  options: MediaServiceOptions = {}
) {
  return storeMediaAsset(
    {
      ...input,
      allowedFileTypes: ["image"],
      folderSlug: "avatars",
      uploadedBy: userId,
    },
    options
  );
}

export async function uploadCommentImage(
  userId: string,
  input: Pick<UploadMediaInput, "file" | "fileName">,
  options: MediaServiceOptions = {}
) {
  return storeMediaAsset(
    {
      ...input,
      allowedFileTypes: ["image"],
      folderSlug: "comments",
      uploadedBy: userId,
    },
    options
  );
}

async function storeMediaAsset(
  input: StoreMediaAssetInput,
  options: MediaServiceOptions = {}
) {
  const config = getConfig(options);
  const client = getClient(options);
  await ensureDefaultMediaFolders(client);
  const fileInfo = await validateUploadFile(input.file, config);

  if (input.allowedFileTypes && !input.allowedFileTypes.includes(fileInfo.fileType)) {
    throw validationError("初始化上传只支持图片文件");
  }

  const folder = await resolveFolder({
    client,
    folderId: input.folderId,
    folderSlug: input.folderSlug,
  });
  const id = randomUUID();
  const subdir = folder ? `${folder.slug}/${storageSubdir()}` : storageSubdir();
  const storageName = mediaStorageName(id, fileInfo.format);
  const uploadsDir = resolveUploadsDir(config);
  const targetDir = resolve(uploadsDir, subdir);
  const targetPath = resolve(targetDir, storageName);
  const displayName = safeDisplayName(input.fileName || input.file.name);
  const accessUrl = toAccessUrl(config, subdir, storageName);

  await mkdir(targetDir, { recursive: true });
  await Bun.write(targetPath, fileInfo.buffer);

  try {
    await client`
      INSERT INTO media_assets (
        id, file_name, file_format, file_type, file_size_bytes, access_url, folder_id, uploaded_by
      )
      VALUES (
        ${id},
        ${displayName},
        ${fileInfo.format},
        ${fileInfo.fileType},
        ${input.file.size},
        ${accessUrl},
        ${folder?.id ?? null},
        ${input.uploadedBy}
      )
    `;
  } catch (error) {
    await rm(targetPath, { force: true });
    throw error;
  }

  const stored = await getMediaRow(id, client);
  return toMediaItem(stored);
}

export async function renameMedia(
  currentUser: AuthUser,
  id: string,
  fileName: string,
  options: MediaServiceOptions = {}
) {
  requireAdmin(currentUser);
  const client = getClient(options);
  await getMediaRow(id, client);

  await client`
    UPDATE media_assets
    SET file_name = ${safeDisplayName(fileName)}
    WHERE id = ${id}
  `;

  return getMediaById(currentUser, id, options);
}

export async function deleteMedia(
  currentUser: AuthUser,
  id: string,
  options: MediaServiceOptions = {}
) {
  requireAdmin(currentUser);
  const config = getConfig(options);
  const client = getClient(options);
  const row = await getMediaRow(id, client);
  const filePath = pathForAccessUrl(config, row.access_url);

  await withTransaction(async (tx) => {
    await tx`DELETE FROM media_assets WHERE id = ${id}`;
  }, client);
  await rm(filePath, { force: true });

  return { ok: true };
}

export async function getMediaLink(
  currentUser: AuthUser,
  id: string,
  options: MediaServiceOptions = {}
) {
  const item = await getMediaById(currentUser, id, options);
  return {
    ok: true,
    accessUrl: item.accessUrl,
  };
}

export async function getMediaPreview(
  currentUser: AuthUser,
  id: string,
  options: MediaServiceOptions = {}
) {
  const item = await getMediaById(currentUser, id, options);
  return {
    ok: true,
    implemented: false,
    message: "预览接口已保留，前端暂时使用访问链接占位。",
    accessUrl: item.accessUrl,
    fileType: item.fileType,
  };
}

export async function getMediaDownload(
  currentUser: AuthUser,
  id: string,
  options: MediaServiceOptions = {}
) {
  requireAdmin(currentUser);
  const config = getConfig(options);
  const row = await getMediaRow(id, getClient(options));

  return {
    filePath: pathForAccessUrl(config, row.access_url),
    fileName: row.file_name,
    contentType: mediaContentType(row.file_format),
  };
}

function mediaContentType(format: string) {
  switch (format) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
}
