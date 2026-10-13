import { createHash, createHmac } from "node:crypto";
import { isMediaStorageKeyValid } from "./storage-path";

export interface R2StorageSettings {
  accessKeyId: string;
  accountId: string;
  bucket: string;
  publicBaseUrl: string;
  secretAccessKey: string;
}

interface R2ObjectInput {
  body: Buffer;
  contentType: string;
  key: string;
  settings: R2StorageSettings;
}

interface SignedR2Request {
  headers: Headers;
  url: URL;
}

const R2_REGION = "auto";
const R2_SERVICE = "s3";
const EMPTY_HASH = createHash("sha256").update("").digest("hex");
const MAX_R2_DOWNLOAD_BYTES = 64 * 1024 * 1024;

const hashHex = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");

const hmac = (key: Buffer | string, value: string): Buffer =>
  createHmac("sha256", key).update(value).digest();

const hmacHex = (key: Buffer | string, value: string): string =>
  createHmac("sha256", key).update(value).digest("hex");

const createCredentialScope = (dateStamp: string): string =>
  `${dateStamp}/${R2_REGION}/${R2_SERVICE}/aws4_request`;

const normalizeObjectKey = (key: string): string => {
  if (!isMediaStorageKeyValid(key)) {
    throw new Error("Media storage key is invalid.");
  }
  return key;
};

const encodeObjectKey = (key: string): string =>
  normalizeObjectKey(key)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const createR2Url = (settings: R2StorageSettings, key: string): URL => {
  if (
    !/^[a-f0-9]{32}$/i.test(settings.accountId) ||
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(settings.bucket)
  ) {
    throw new Error("Cloudflare R2 account ID or bucket name is invalid.");
  }
  return new URL(
    `https://${settings.accountId}.r2.cloudflarestorage.com/${settings.bucket}/${encodeObjectKey(key)}`,
  );
};

const createDateParts = (date: Date): { amzDate: string; dateStamp: string } => {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");

  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
};

const getSigningKey = (secretAccessKey: string, dateStamp: string): Buffer => {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, R2_REGION);
  const serviceKey = hmac(regionKey, R2_SERVICE);

  return hmac(serviceKey, "aws4_request");
};

const signR2Request = ({
  bodyHash,
  contentType,
  method,
  settings,
  url,
}: {
  bodyHash: string;
  contentType?: string;
  method: "DELETE" | "GET" | "PUT";
  settings: R2StorageSettings;
  url: URL;
}): SignedR2Request => {
  const now = new Date();
  const { amzDate, dateStamp } = createDateParts(now);
  const host = url.host;
  const credentialScope = createCredentialScope(dateStamp);
  const headers = new Headers({
    host,
    "x-amz-content-sha256": bodyHash,
    "x-amz-date": amzDate,
  });

  if (contentType) {
    headers.set("content-type", contentType);
  }

  const sortedHeaderEntries = [...headers.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const canonicalHeaders = `${sortedHeaderEntries.map(([key, value]) => `${key}:${value.trim()}`).join("\n")}\n`;
  const signedHeaders = sortedHeaderEntries.map(([key]) => key).join(";");
  const canonicalRequest = [
    method,
    url.pathname,
    url.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    hashHex(canonicalRequest),
  ].join("\n");
  const signature = hmacHex(getSigningKey(settings.secretAccessKey, dateStamp), stringToSign);
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${settings.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ");

  headers.set("authorization", authorization);

  return { headers, url };
};

const assertR2Response = async (response: Response, action: string): Promise<void> => {
  if (response.ok || (action === "delete" && response.status === 404)) {
    return;
  }

  const message = await response.text().catch(() => "");

  throw new Error(
    `Cloudflare R2 ${action} failed with status ${response.status}${message ? `: ${message}` : ""}`,
  );
};

export const buildR2ObjectUrl = (settings: R2StorageSettings, key: string): string =>
  `${settings.publicBaseUrl.replace(/\/$/, "")}/${normalizeObjectKey(key)}`;

export const putR2Object = async ({
  body,
  contentType,
  key,
  settings,
}: R2ObjectInput): Promise<void> => {
  const url = createR2Url(settings, key);
  const signedRequest = signR2Request({
    bodyHash: hashHex(body),
    contentType,
    method: "PUT",
    settings,
    url,
  });
  const response = await fetch(signedRequest.url, {
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
    body: body as unknown as BodyInit,
    headers: signedRequest.headers,
    method: "PUT",
  });

  await assertR2Response(response, "upload");
};

export const getR2Object = async (settings: R2StorageSettings, key: string): Promise<Buffer> => {
  const url = createR2Url(settings, key);
  const signedRequest = signR2Request({
    bodyHash: EMPTY_HASH,
    method: "GET",
    settings,
    url,
  });
  const response = await fetch(signedRequest.url, {
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
    headers: signedRequest.headers,
    method: "GET",
  });

  await assertR2Response(response, "download");
  const contentLength = response.headers.get("content-length");
  if (
    contentLength !== null &&
    (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_R2_DOWNLOAD_BYTES)
  ) {
    await response.body?.cancel();
    throw new Error("Cloudflare R2 object exceeds the supported download size.");
  }
  const reader = response.body?.getReader();
  if (reader === undefined) {
    return Buffer.alloc(0);
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > MAX_R2_DOWNLOAD_BYTES) {
        await reader.cancel();
        throw new Error("Cloudflare R2 object exceeds the supported download size.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
};

export const deleteR2Object = async (settings: R2StorageSettings, key: string): Promise<void> => {
  const url = createR2Url(settings, key);
  const signedRequest = signR2Request({
    bodyHash: EMPTY_HASH,
    method: "DELETE",
    settings,
    url,
  });
  const response = await fetch(signedRequest.url, {
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
    headers: signedRequest.headers,
    method: "DELETE",
  });

  await assertR2Response(response, "delete");
};
