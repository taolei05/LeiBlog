import { pinyin } from "pinyin-pro";
import type { Sql, TransactionSql } from "postgres";

import { env } from "../env";
import { decryptSecret } from "../security/encryption";

type SlugSql = Sql | TransactionSql;

type EncryptedSettingRow = {
  encryptedValue: string;
};

type DeepLTranslation = {
  text?: string;
};

type DeepLTranslateResponse = {
  translations?: DeepLTranslation[];
};

const SLUG_SEPARATOR = "-";

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isDeepLTranslateResponse = (value: unknown): value is DeepLTranslateResponse => {
  if (!isObjectRecord(value)) {
    return false;
  }

  const translations = value.translations;
  return (
    translations === undefined ||
    (Array.isArray(translations) &&
      translations.every(
        (translation) =>
          isObjectRecord(translation) &&
          (translation.text === undefined || typeof translation.text === "string"),
      ))
  );
};

const readDeepLApiKey = async ({ sql }: { sql: SlugSql }) => {
  const [row] = await sql<EncryptedSettingRow[]>`
    SELECT encrypted_value
    FROM encrypted_settings
    WHERE key = 'deepl_api_key'
    LIMIT 1
  `;

  if (row === undefined) {
    return undefined;
  }

  return decryptSecret({
    secret: env.configEncryptionSecret,
    value: row.encryptedValue,
  });
};

export const normalizeSlug = (value: string) =>
  value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, SLUG_SEPARATOR)
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, SLUG_SEPARATOR);

export const createPinyinSlug = (value: string) => {
  const converted = pinyin(value, {
    nonZh: "consecutive",
    toneType: "none",
    type: "array",
  }).join(SLUG_SEPARATOR);

  return normalizeSlug(converted || value);
};

export const translateTextForSlug = async ({ sql, value }: { sql: SlugSql; value: string }) => {
  const apiKey = await readDeepLApiKey({ sql });
  if (apiKey === undefined || apiKey.length === 0) {
    return null;
  }

  const endpoint = apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";

  try {
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        target_lang: "EN",
        text: [value],
      }),
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();
    if (!isDeepLTranslateResponse(payload)) {
      return null;
    }

    return payload.translations?.[0]?.text ?? null;
  } catch {
    return null;
  }
};

export const createDeepLPreferredSlug = async ({
  fallback,
  sql,
  value,
}: {
  fallback: string;
  sql: SlugSql;
  value: string;
}) => {
  const translated = await translateTextForSlug({ sql, value });
  const translatedSlug = translated === null ? "" : normalizeSlug(translated);

  return translatedSlug || createPinyinSlug(value) || fallback;
};
