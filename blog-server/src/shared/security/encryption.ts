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
  const [version, ivText, authTagText, encryptedText] = value.split(":");
  if (
    version !== ENCRYPTED_VALUE_VERSION ||
    ivText === undefined ||
    authTagText === undefined ||
    encryptedText === undefined
  ) {
    throw new Error("Encrypted secret has an unsupported format.");
  }

  const decipher = createDecipheriv(ALGORITHM, deriveKey(secret), Buffer.from(ivText, "base64"));
  decipher.setAuthTag(Buffer.from(authTagText, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64")),
    decipher.final(),
  ]).toString("utf8");
};
