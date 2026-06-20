import { createHash, createHmac } from "node:crypto";

import { validationError } from "../../shared/errors";

export interface R2StorageSettings {
  accessKeyId: string;
  accountId: string;
  bucket: string;
  publicBaseUrl: string;
  secretAccessKey: string;
}

const R2_REGION = "auto";
const R2_SERVICE = "s3";

function sha256Hex(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Uint8Array, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key: Uint8Array, value: string) {
  return createHmac("sha256", key).update(value).digest("hex");
}

function amzDateParts(now = new Date()) {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return {
    amzDate,
    dateStamp: amzDate.slice(0, 8),
  };
}

function encodeObjectKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

function signingKey(secretAccessKey: string, dateStamp: string) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, R2_REGION);
  const serviceKey = hmac(regionKey, R2_SERVICE);
  return hmac(serviceKey, "aws4_request");
}

function objectEndpoint(settings: R2StorageSettings, key: string) {
  const host = `${settings.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${settings.bucket}/${encodeObjectKey(key)}`;
  return {
    canonicalUri,
    host,
    url: `https://${host}${canonicalUri}`,
  };
}

function authorizationHeader({
  method,
  payloadHash,
  settings,
  url,
}: {
  method: "DELETE" | "GET" | "PUT";
  payloadHash: string;
  settings: R2StorageSettings;
  url: ReturnType<typeof objectEndpoint>;
}) {
  const { amzDate, dateStamp } = amzDateParts();
  const credentialScope = `${dateStamp}/${R2_REGION}/${R2_SERVICE}/aws4_request`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders =
    `host:${url.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const canonicalRequest = [
    method,
    url.canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = hmacHex(signingKey(settings.secretAccessKey, dateStamp), stringToSign);

  return {
    amzDate,
    value:
      `AWS4-HMAC-SHA256 Credential=${settings.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

async function r2Request({
  body,
  contentType,
  key,
  method,
  settings,
}: {
  body?: Uint8Array;
  contentType?: string;
  key: string;
  method: "DELETE" | "GET" | "PUT";
  settings: R2StorageSettings;
}) {
  const endpoint = objectEndpoint(settings, key);
  const payloadHash = sha256Hex(body ?? "");
  const authorization = authorizationHeader({
    method,
    payloadHash,
    settings,
    url: endpoint,
  });
  const headers = new Headers({
    Authorization: authorization.value,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": authorization.amzDate,
  });

  if (contentType) headers.set("content-type", contentType);

  const response = await fetch(endpoint.url, {
    body: body as BodyInit | undefined,
    headers,
    method,
  });

  if (!response.ok) {
    throw validationError(`Cloudflare R2 请求失败：${response.status}`);
  }

  return response;
}

export function buildR2ObjectUrl(settings: R2StorageSettings, key: string) {
  return `${settings.publicBaseUrl.replace(/\/$/, "")}/${key}`;
}

export async function putR2Object({
  body,
  contentType,
  key,
  settings,
}: {
  body: Uint8Array;
  contentType: string;
  key: string;
  settings: R2StorageSettings;
}) {
  await r2Request({
    body,
    contentType,
    key,
    method: "PUT",
    settings,
  });
}

export async function getR2Object(settings: R2StorageSettings, key: string) {
  const response = await r2Request({
    key,
    method: "GET",
    settings,
  });
  return new Uint8Array(await response.arrayBuffer());
}

export async function deleteR2Object(settings: R2StorageSettings, key: string) {
  await r2Request({
    key,
    method: "DELETE",
    settings,
  });
}
