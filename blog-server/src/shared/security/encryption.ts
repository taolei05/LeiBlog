import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const ENCRYPTED_VALUE_VERSION = "v1";

type SecretParams = {
  value: string;
  secret: string;
};

const deriveKey = (secret: string) => createHash("sha256").update(secret).digest();

export const encryptSecret = ({ value, secret }: SecretParams) => {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTED_VALUE_VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
};

export const decryptSecret = ({ value, secret }: SecretParams) => {
  const parts = value.split(":");
  const [version, ivText, authTagText, encryptedText] = parts;
  if (
    parts.length !== 4 ||
    version !== ENCRYPTED_VALUE_VERSION ||
    ivText === undefined ||
    authTagText === undefined ||
    encryptedText === undefined
  ) {
    throw new Error("Encrypted secret has an unsupported format.");
  }

  const iv = Buffer.from(ivText, "base64");
  const authTag = Buffer.from(authTagText, "base64");
  const encrypted = Buffer.from(encryptedText, "base64");
  if (
    iv.length !== IV_LENGTH ||
    authTag.length !== 16 ||
    iv.toString("base64") !== ivText ||
    authTag.toString("base64") !== authTagText ||
    encrypted.toString("base64") !== encryptedText
  ) {
    throw new Error("Encrypted secret has an unsupported format.");
  }

  const decipher = createDecipheriv(ALGORITHM, deriveKey(secret), iv, { authTagLength: 16 });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
};
