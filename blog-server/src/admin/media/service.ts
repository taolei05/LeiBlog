import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { basename, dirname, extname, resolve, sep } from "node:path";

import type { AuthUser } from "../../shared/auth";
import type { AppConfig } from "../../shared/config";
import type { DbClient } from "../../shared/db";
import { requireAdmin } from "../../shared/auth";
import { appConfig } from "../../shared/config";
import { decryptSecret, type StoredEncryptedSecret } from "../../shared/crypto";
import { db, withTransaction } from "../../shared/db";
import { notFound, validationError } from "../../shared/errors";
import { normalizeSvgBuffer } from "../../shared/media/svg";
import {
  createDeepLPreferredSlug,
  createPinyinSlug,
  normalizeSlug,
  withSlugSuffix,
} from "../../shared/slug";
import {
  buildR2ObjectUrl,
  deleteR2Object,
  getR2Object,
  putR2Object,
  type R2StorageSettings,
} from "./r2-storage";

type MediaType = "image" | "video" | "document";
type MediaStorageProvider = "local" | "r2";
type SortOrder = "asc" | "desc";
type MediaSystemFolderKey =
  | "article-covers"
  | "avatars"
  | "comments"
  | "site"
  | "website-icons";

export interface MediaListQuery {
  createdFrom?: string;
  createdTo?: string;
  search?: string;
  folderId?: string;
  folderSlug?: string;
  fileType?: MediaType;
  fileFormat?: string;
  storageProvider?: MediaStorageProvider;
  page?: number;
  pageSize?: number;
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

export interface MigrateMediaStorageInput {
  ids: string[];
  targetProvider: MediaStorageProvider;
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
  storage_bucket: string | null;
  storage_key: string | null;
  storage_provider: MediaStorageProvider;
  updated_at: Date | string;
  uploaded_by: string | null;
}

interface R2ConfigRow {
  r2_access_key_id: string | null;
  r2_account_id: string | null;
  r2_bucket: string | null;
  r2_enabled: boolean;
  r2_public_base_url: string | null;
  r2_secret_access_key_encrypted: StoredEncryptedSecret | null;
}

type MediaDownloadResult =
  | {
      contentType: string;
      data: Uint8Array;
      fileName: string;
      filePath?: never;
    }
  | {
      contentType: string;
      data?: never;
      fileName: string;
      filePath: string;
    };

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

interface MediaStorageSummaryRow {
  all_count: string | number | bigint;
  id: string;
  local_count: string | number | bigint;
  name: string;
  r2_count: string | number | bigint;
  slug: string;
  system_key: MediaSystemFolderKey | null;
}

interface MediaStorageTotalsRow {
  all_count: string | number | bigint;
  local_count: string | number | bigint;
  r2_count: string | number | bigint;
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
  {
    description: "导航页网站图标只能存储到这里。",
    name: "网址图标",
    slug: "website-icons",
    systemKey: "website-icons",
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
    storageBucket: row.storage_bucket,
    storageKey: row.storage_key,
    storageProvider: row.storage_provider,
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

function toCount(value: string | number | bigint | null | undefined) {
  return Number(value ?? 0);
}

function toMediaStorageFolderSummary(row: MediaStorageSummaryRow) {
  return {
    id: row.id,
    local: toCount(row.local_count),
    name: row.name,
    r2: toCount(row.r2_count),
    slug: row.slug,
    systemKey: row.system_key,
    total: toCount(row.all_count),
  };
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
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 24;
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

async function folderSlugFromName(client: DbClient, value: string, shouldTranslate: boolean) {
  return shouldTranslate
    ? createDeepLPreferredSlug(value, client, "folder")
    : normalizeSlug(value) || createPinyinSlug(value) || "folder";
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

async function createUniqueFolderSlug(
  client: DbClient,
  value: string,
  exceptId?: string,
  shouldTranslate = true
) {
  const baseSlug = await folderSlugFromName(client, value, shouldTranslate);

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

  let buffer = new Uint8Array(await file.arrayBuffer());
  if (!validateSignature(format, buffer)) {
    throw validationError("文件内容与扩展名不匹配");
  }

  if (format === "svg") {
    const normalizedBuffer = normalizeSvgBuffer(buffer);
    if (!normalizedBuffer) throw validationError("SVG 文件内容无效");
    buffer = normalizedBuffer;
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

function toAccessUrlFromStorageKey(config: AppConfig, storageKey: string) {
  return `${config.uploadsUrlPrefix.replace(/\/$/, "")}/${storageKey}`;
}

function toStorageKey(subdir: string, storageName: string) {
  return `${subdir}/${storageName}`;
}

function pathForStorageKey(config: AppConfig, storageKey: string) {
  const root = resolveUploadsDir(config);
  const filePath = resolve(root, storageKey);

  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    throw validationError("媒体存储路径无效");
  }

  return filePath;
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

function storageKeyForRow(config: AppConfig, row: MediaRow) {
  if (row.storage_key) return row.storage_key;

  const prefix = config.uploadsUrlPrefix.replace(/\/$/, "");
  if (!row.access_url.startsWith(`${prefix}/`)) {
    throw validationError("媒体访问地址无效");
  }

  return row.access_url.slice(prefix.length + 1);
}

function localPathForRow(config: AppConfig, row: MediaRow) {
  return row.storage_key ? pathForStorageKey(config, row.storage_key) : pathForAccessUrl(config, row.access_url);
}

async function readMediaBytes({
  client,
  config,
  row,
}: {
  client: DbClient;
  config: AppConfig;
  row: MediaRow;
}) {
  if (row.storage_provider === "r2") {
    const settings = await getR2StorageSettings(client, { requireEnabled: false });
    if (!settings) throw validationError("Cloudflare R2 存储配置不完整");
    return getR2Object(settings, storageKeyForRow(config, row));
  }

  return new Uint8Array(await readFile(localPathForRow(config, row)));
}

async function getR2StorageSettings(
  client: DbClient,
  { requireEnabled }: { requireEnabled: boolean }
): Promise<R2StorageSettings | null> {
  const [row] = await client<R2ConfigRow[]>`
    SELECT r2_enabled, r2_account_id, r2_bucket, r2_access_key_id,
           r2_secret_access_key_encrypted, r2_public_base_url
    FROM site_config
    WHERE id = 1
  `;

  if (!row) return null;
  if (requireEnabled && !row.r2_enabled) return null;

  const settings = {
    accessKeyId: cleanOptional(row.r2_access_key_id),
    accountId: cleanOptional(row.r2_account_id),
    bucket: cleanOptional(row.r2_bucket),
    publicBaseUrl: cleanOptional(row.r2_public_base_url),
    secretAccessKey: decryptSecret(row.r2_secret_access_key_encrypted),
  };
  const hasAnySetting = Object.values(settings).some(Boolean);

  if (!hasAnySetting) {
    if (requireEnabled && row.r2_enabled) {
      throw validationError("Cloudflare R2 存储配置不完整");
    }

    return null;
  }

  if (
    !settings.accessKeyId ||
    !settings.accountId ||
    !settings.bucket ||
    !settings.publicBaseUrl ||
    !settings.secretAccessKey
  ) {
    throw validationError("Cloudflare R2 存储配置不完整");
  }

  return {
    accessKeyId: settings.accessKeyId,
    accountId: settings.accountId,
    bucket: settings.bucket,
    publicBaseUrl: settings.publicBaseUrl,
    secretAccessKey: settings.secretAccessKey,
  };
}

async function getMediaRow(id: string, client: DbClient = db) {
  const [row] = await client<MediaRow[]>`
    SELECT ma.id, ma.file_name, ma.file_format, ma.file_type, ma.file_size_bytes,
           ma.access_url, ma.folder_id, mf.name AS folder_name, mf.slug AS folder_slug,
           mf.system_key AS folder_system_key, ma.storage_provider, ma.storage_key,
           ma.storage_bucket, ma.uploaded_by, ma.created_at, ma.updated_at
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

export async function listMediaStorageSummary(
  currentUser: AuthUser,
  options: MediaServiceOptions = {}
) {
  requireAdmin(currentUser);
  const client = getClient(options);
  await ensureDefaultMediaFolders(client);
  const [totals] = await client<MediaStorageTotalsRow[]>`
    SELECT count(ma.id) AS all_count,
           count(ma.id) FILTER (WHERE ma.storage_provider = 'local') AS local_count,
           count(ma.id) FILTER (WHERE ma.storage_provider = 'r2') AS r2_count
    FROM media_assets ma
  `;
  const folders = await client<MediaStorageSummaryRow[]>`
    SELECT mf.id, mf.name, mf.slug, mf.system_key,
           count(ma.id) AS all_count,
           count(ma.id) FILTER (WHERE ma.storage_provider = 'local') AS local_count,
           count(ma.id) FILTER (WHERE ma.storage_provider = 'r2') AS r2_count
    FROM media_folders mf
    LEFT JOIN media_assets ma ON ma.folder_id = mf.id
    GROUP BY mf.id
    ORDER BY mf.is_protected DESC, mf.created_at ASC, lower(mf.name) ASC
  `;

  return {
    ok: true,
    totals: {
      all: toCount(totals?.all_count),
      local: toCount(totals?.local_count),
      r2: toCount(totals?.r2_count),
    },
    folders: folders.map(toMediaStorageFolderSummary),
  };
}

export async function createMediaFolder(
  currentUser: AuthUser,
  input: MediaFolderInput,
  options: MediaServiceOptions = {}
) {
  requireAdmin(currentUser);
  const client = getClient(options);
  await ensureDefaultMediaFolders(client);

  const slug = input.slug?.trim()
    ? await createUniqueFolderSlug(client, input.slug, undefined, false)
    : await createUniqueFolderSlug(client, input.name);
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
      ? await createUniqueFolderSlug(client, input.slug, id, false)
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
  const storageProvider = query.storageProvider ?? null;
  const createdFrom = parseDateFilter(query.createdFrom);
  const createdTo = parseDateFilter(query.createdTo);
  const orderBy = orderClause(query.sortBy, query.sortOrder);

  const rows = await client.unsafe<MediaRow[]>(
    `
      SELECT ma.id, ma.file_name, ma.file_format, ma.file_type, ma.file_size_bytes,
             ma.access_url, ma.folder_id, mf.name AS folder_name, mf.slug AS folder_slug,
             mf.system_key AS folder_system_key, ma.storage_provider, ma.storage_key,
             ma.storage_bucket, ma.uploaded_by, ma.created_at, ma.updated_at
      FROM media_assets ma
      LEFT JOIN media_folders mf ON mf.id = ma.folder_id
      WHERE ($1::text IS NULL OR lower(ma.file_name) LIKE $1 OR lower(ma.access_url) LIKE $1 OR lower(coalesce(mf.name, '')) LIKE $1)
        AND ($2::media_type IS NULL OR ma.file_type = $2)
        AND ($3::text IS NULL OR lower(ma.file_format) = $3)
        AND ($4::timestamptz IS NULL OR ma.created_at >= $4)
        AND ($5::timestamptz IS NULL OR ma.created_at < $5)
        AND ($6::uuid IS NULL OR ma.folder_id = $6)
        AND ($7::text IS NULL OR lower(mf.slug) = $7)
        AND ($8::text IS NULL OR ma.storage_provider = $8)
      ORDER BY ${orderBy}
      LIMIT $9 OFFSET $10
    `,
    [
      search,
      fileType,
      fileFormat,
      createdFrom,
      createdTo,
      folderId,
      folderSlug,
      storageProvider,
      pageSize,
      offset,
    ]
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
        AND ($8::text IS NULL OR ma.storage_provider = $8)
    `,
    [search, fileType, fileFormat, createdFrom, createdTo, folderId, folderSlug, storageProvider]
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
  const storageKey = toStorageKey(subdir, storageName);
  const targetPath = pathForStorageKey(config, storageKey);
  const displayName = safeDisplayName(input.fileName || input.file.name);
  const r2Settings = await getR2StorageSettings(client, { requireEnabled: true });
  const storageProvider: MediaStorageProvider = r2Settings ? "r2" : "local";
  const accessUrl = r2Settings
    ? buildR2ObjectUrl(r2Settings, storageKey)
    : toAccessUrl(config, subdir, storageName);

  if (r2Settings) {
    await putR2Object({
      body: fileInfo.buffer,
      contentType: mediaContentType(fileInfo.format),
      key: storageKey,
      settings: r2Settings,
    });
  } else {
    await mkdir(dirname(targetPath), { recursive: true });
    await Bun.write(targetPath, fileInfo.buffer);
  }

  try {
    await client`
      INSERT INTO media_assets (
        id, file_name, file_format, file_type, file_size_bytes, access_url, folder_id,
        storage_provider, storage_key, storage_bucket, uploaded_by
      )
      VALUES (
        ${id},
        ${displayName},
        ${fileInfo.format},
        ${fileInfo.fileType},
        ${fileInfo.buffer.byteLength},
        ${accessUrl},
        ${folder?.id ?? null},
        ${storageProvider},
        ${storageKey},
        ${r2Settings?.bucket ?? null},
        ${input.uploadedBy}
      )
    `;
  } catch (error) {
    if (r2Settings) {
      await deleteR2Object(r2Settings, storageKey).catch(() => undefined);
    } else {
      await rm(targetPath, { force: true });
    }
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

  if (row.storage_provider === "r2") {
    const settings = await getR2StorageSettings(client, { requireEnabled: false });
    if (!settings) throw validationError("Cloudflare R2 存储配置不完整");
    await deleteR2Object(settings, storageKeyForRow(config, row));
    await withTransaction(async (tx) => {
      await tx`DELETE FROM media_assets WHERE id = ${id}`;
    }, client);
  } else {
    const filePath = localPathForRow(config, row);

    await withTransaction(async (tx) => {
      await tx`DELETE FROM media_assets WHERE id = ${id}`;
    }, client);
    await rm(filePath, { force: true });
  }

  return { ok: true };
}

async function updateMediaReferences(client: DbClient, oldUrl: string, newUrl: string) {
  if (oldUrl === newUrl) return 0;

  let updatedReferences = 0;
  const countUpdatedRows = (rows: unknown[]) => {
    updatedReferences += rows.length;
  };

  countUpdatedRows(
    await client<{ id: string }[]>`
      UPDATE articles
      SET cover_image_url = ${newUrl}
      WHERE cover_image_url = ${oldUrl}
      RETURNING id
    `
  );
  countUpdatedRows(
    await client<{ id: string }[]>`
      UPDATE articles
      SET content_mdx = replace(content_mdx, ${oldUrl}, ${newUrl})
      WHERE strpos(content_mdx, ${oldUrl}) > 0
      RETURNING id
    `
  );
  countUpdatedRows(
    await client<{ id: string }[]>`
      UPDATE article_revisions
      SET cover_image_url = ${newUrl}
      WHERE cover_image_url = ${oldUrl}
      RETURNING id
    `
  );
  countUpdatedRows(
    await client<{ id: string }[]>`
      UPDATE article_revisions
      SET content_mdx = replace(content_mdx, ${oldUrl}, ${newUrl})
      WHERE strpos(content_mdx, ${oldUrl}) > 0
      RETURNING id
    `
  );
  countUpdatedRows(
    await client<{ id: number }[]>`
      UPDATE site_info
      SET logo_dark_url = ${newUrl}
      WHERE logo_dark_url = ${oldUrl}
      RETURNING id
    `
  );
  countUpdatedRows(
    await client<{ id: number }[]>`
      UPDATE site_info
      SET logo_light_url = ${newUrl}
      WHERE logo_light_url = ${oldUrl}
      RETURNING id
    `
  );
  countUpdatedRows(
    await client<{ id: number }[]>`
      UPDATE site_info
      SET favicon_url = ${newUrl}
      WHERE favicon_url = ${oldUrl}
      RETURNING id
    `
  );
  countUpdatedRows(
    await client<{ id: number }[]>`
      UPDATE site_info
      SET home_cover_urls = array_replace(home_cover_urls, ${oldUrl}, ${newUrl})
      WHERE ${oldUrl} = ANY(home_cover_urls)
      RETURNING id
    `
  );
  countUpdatedRows(
    await client<{ id: string }[]>`
      UPDATE users
      SET avatar_url = ${newUrl}
      WHERE avatar_url = ${oldUrl}
      RETURNING id
    `
  );
  countUpdatedRows(
    await client<{ id: string }[]>`
      UPDATE article_contributors
      SET avatar_url = ${newUrl}
      WHERE avatar_url = ${oldUrl}
      RETURNING id
    `
  );
  countUpdatedRows(
    await client<{ id: string }[]>`
      UPDATE navigation_items
      SET icon_url = ${newUrl}
      WHERE icon_url = ${oldUrl}
      RETURNING id
    `
  );
  countUpdatedRows(
    await client<{ id: string }[]>`
      UPDATE comments
      SET content = replace(content, ${oldUrl}, ${newUrl})
      WHERE strpos(content, ${oldUrl}) > 0
      RETURNING id
    `
  );

  return updatedReferences;
}

export async function migrateMediaStorage(
  currentUser: AuthUser,
  input: MigrateMediaStorageInput,
  options: MediaServiceOptions = {}
) {
  requireAdmin(currentUser);
  const config = getConfig(options);
  const client = getClient(options);
  const ids = [...new Set(input.ids.map((id) => id.trim()).filter(Boolean))];

  if (ids.length === 0) throw validationError("请选择要迁移的媒体文件");

  const migratedItems = [];
  let updatedReferences = 0;

  for (const id of ids) {
    const row = await getMediaRow(id, client);
    if (row.storage_provider === input.targetProvider) {
      migratedItems.push(toMediaItem(row));
      continue;
    }

    const storageKey = storageKeyForRow(config, row);
    const body = await readMediaBytes({ client, config, row });

    if (input.targetProvider === "r2") {
      const settings = await getR2StorageSettings(client, { requireEnabled: true });
      if (!settings) throw validationError("请先启用 Cloudflare R2 存储配置");
      const accessUrl = buildR2ObjectUrl(settings, storageKey);
      await putR2Object({
        body,
        contentType: mediaContentType(row.file_format),
        key: storageKey,
        settings,
      });
      await withTransaction(async (tx) => {
        updatedReferences += await updateMediaReferences(tx, row.access_url, accessUrl);
        await tx`
          UPDATE media_assets
          SET access_url = ${accessUrl},
              storage_provider = 'r2',
              storage_key = ${storageKey},
              storage_bucket = ${settings.bucket}
          WHERE id = ${id}
        `;
      }, client);
    } else {
      const localPath = pathForStorageKey(config, storageKey);
      const accessUrl = toAccessUrlFromStorageKey(config, storageKey);

      await mkdir(dirname(localPath), { recursive: true });
      await Bun.write(localPath, body);
      await withTransaction(async (tx) => {
        updatedReferences += await updateMediaReferences(tx, row.access_url, accessUrl);
        await tx`
          UPDATE media_assets
          SET access_url = ${accessUrl},
              storage_provider = 'local',
              storage_key = ${storageKey},
              storage_bucket = null
          WHERE id = ${id}
        `;
      }, client);
    }

    migratedItems.push(toMediaItem(await getMediaRow(id, client)));
  }

  return { ok: true, items: migratedItems, updatedReferences };
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
): Promise<MediaDownloadResult> {
  requireAdmin(currentUser);
  const config = getConfig(options);
  const client = getClient(options);
  const row = await getMediaRow(id, client);
  const contentType = mediaContentType(row.file_format);

  if (row.storage_provider === "r2") {
    return {
      data: await readMediaBytes({ client, config, row }),
      fileName: row.file_name,
      contentType,
    };
  }

  return {
    filePath: localPathForRow(config, row),
    fileName: row.file_name,
    contentType,
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
