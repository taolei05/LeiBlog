import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { appConfig } from "../config";

const ALGORITHM = "aes-256-gcm";

export interface EncryptedSecret {
  algorithm: typeof ALGORITHM;
  iv: string;
  tag: string;
  data: string;
}

export type StoredEncryptedSecret = EncryptedSecret | string;

function encryptionKey(secret = appConfig.appSecretKey) {
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(
  value: string | null | undefined,
  secret = appConfig.appSecretKey
) {
  if (!value) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  return {
    algorithm: ALGORITHM,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
  } satisfies EncryptedSecret;
}

export function decryptSecret(
  payload: StoredEncryptedSecret | null | undefined,
  secret = appConfig.appSecretKey
) {
  if (!payload) return null;
  const normalized =
    typeof payload === "string" ? (JSON.parse(payload) as EncryptedSecret) : payload;

  const decipher = createDecipheriv(
    normalized.algorithm,
    encryptionKey(secret),
    Buffer.from(normalized.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(normalized.tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(normalized.data, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
