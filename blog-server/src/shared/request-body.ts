import { ParseError } from "elysia";

import { env } from "./env";

export const MAX_BACKUP_REQUEST_BYTES = 65 * 1024 * 1024;

export class RequestBodyTooLarge extends Error {}

export const getRequestBodyLimit = (request: Request) => {
  if (new URL(request.url).pathname.startsWith("/api/admin/backup/")) {
    return MAX_BACKUP_REQUEST_BYTES;
  }
  return request.headers.get("content-type")?.startsWith("multipart/form-data")
    ? env.uploadMaxFileSizeBytes + 1024 * 1024
    : 2 * 1024 * 1024;
};

const readBoundedBody = async (request: Request) => {
  const reader = request.body?.getReader();
  if (reader === undefined) {
    return new Uint8Array();
  }
  const maxBytes = getRequestBodyLimit(request);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new RequestBodyTooLarge("Request body is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
};

export const parseBoundedRequestBody = async (request: Request) => {
  const contentType = request.headers.get("content-type") ?? "";
  const bytes = await readBoundedBody(request);
  const response = new Response(bytes, { headers: { "content-type": contentType } });
  try {
    if (contentType.startsWith("application/json")) {
      const body: unknown = await response.json();
      return body;
    }
    if (
      contentType.startsWith("multipart/form-data") ||
      contentType.startsWith("application/x-www-form-urlencoded")
    ) {
      const form = await response.formData();
      const body: Record<string, FormDataEntryValue | FormDataEntryValue[]> = Object.create(null);
      for (const key of new Set(form.keys())) {
        const values = form.getAll(key);
        body[key] = values.length === 1 ? values[0] : values;
      }
      return body;
    }
    return response.text();
  } catch {
    throw new ParseError(new Error("Invalid request body."));
  }
};
