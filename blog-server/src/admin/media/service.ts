import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { basename, extname, resolve, sep } from "node:path";

import {
  assertWritableAdmin,
  requireAdminOrDemo,
  type AuthUser,
} from "../../shared/auth";
import { appConfig, type AppConfig } from "../../shared/config";
import { db, withTransaction, type DbClient } from "../../shared/db";
import { notFound, validationError } from "../../shared/errors";

type MediaType = "image" | "video" | "document";
type SortOrder = "asc" | "desc";

export interface MediaListQuery {
  search?: string;
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
}

export interface MediaServiceOptions {
  client?: DbClient;
  config?: AppConfig;
}

interface MediaRow {
  id: string;
  file_name: string;
  file_format: string;
  file_type: MediaType;
  file_size_bytes: string | number | bigint;
  access_url: string;
  uploaded_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

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
    uploadedBy: row.uploaded_by,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function parsePositiveInt(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
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
      ? "lower(file_name)"
      : sortBy === "fileSize"
        ? "file_size_bytes"
        : sortBy === "fileType"
          ? "file_type"
          : "created_at";

  return `${column} ${order}, created_at DESC`;
}

function getConfig(options: MediaServiceOptions) {
  return options.config ?? appConfig;
}

function getClient(options: MediaServiceOptions) {
  return options.client ?? db;
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
    SELECT id, file_name, file_format, file_type, file_size_bytes,
           access_url, uploaded_by, created_at, updated_at
    FROM media_assets
    WHERE id = ${id}
  `;

  if (!row) throw notFound("媒体不存在");
  return row;
}

export async function getMediaById(
  currentUser: AuthUser,
  id: string,
  options: MediaServiceOptions = {}
) {
  requireAdminOrDemo(currentUser);
  return toMediaItem(await getMediaRow(id, getClient(options)));
}

export async function listMedia(
  currentUser: AuthUser,
  query: MediaListQuery,
  options: MediaServiceOptions = {}
) {
  requireAdminOrDemo(currentUser);
  const client = getClient(options);
  const { page, pageSize, offset } = toPage(query);
  const search = query.search?.trim()
    ? `%${query.search.trim().toLowerCase()}%`
    : null;
  const fileType = query.fileType ?? null;
  const fileFormat = query.fileFormat?.trim().toLowerCase() || null;
  const orderBy = orderClause(query.sortBy, query.sortOrder);

  const rows = await client.unsafe<MediaRow[]>(
    `
      SELECT id, file_name, file_format, file_type, file_size_bytes,
             access_url, uploaded_by, created_at, updated_at
      FROM media_assets
      WHERE ($1::text IS NULL OR lower(file_name) LIKE $1 OR lower(access_url) LIKE $1)
        AND ($2::media_type IS NULL OR file_type = $2)
        AND ($3::text IS NULL OR lower(file_format) = $3)
      ORDER BY ${orderBy}
      LIMIT $4 OFFSET $5
    `,
    [search, fileType, fileFormat, pageSize, offset]
  );

  const [count] = await client.unsafe<{ total: string }[]>(
    `
      SELECT count(*) AS total
      FROM media_assets
      WHERE ($1::text IS NULL OR lower(file_name) LIKE $1 OR lower(access_url) LIKE $1)
        AND ($2::media_type IS NULL OR file_type = $2)
        AND ($3::text IS NULL OR lower(file_format) = $3)
    `,
    [search, fileType, fileFormat]
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
  assertWritableAdmin(currentUser);
  const config = getConfig(options);
  const client = getClient(options);
  const fileInfo = await validateUploadFile(input.file, config);
  const id = randomUUID();
  const subdir = storageSubdir();
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
        id, file_name, file_format, file_type, file_size_bytes, access_url, uploaded_by
      )
      VALUES (
        ${id},
        ${displayName},
        ${fileInfo.format},
        ${fileInfo.fileType},
        ${input.file.size},
        ${accessUrl},
        ${currentUser.id}
      )
    `;
  } catch (error) {
    await rm(targetPath, { force: true });
    throw error;
  }

  return getMediaById(currentUser, id, options);
}

export async function renameMedia(
  currentUser: AuthUser,
  id: string,
  fileName: string,
  options: MediaServiceOptions = {}
) {
  assertWritableAdmin(currentUser);
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
  assertWritableAdmin(currentUser);
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
  requireAdminOrDemo(currentUser);
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
