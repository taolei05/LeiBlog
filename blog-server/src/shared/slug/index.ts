import { pinyin } from "pinyin-pro";

import type { StoredEncryptedSecret } from "../crypto";
import { decryptSecret } from "../crypto";
import type { DbClient } from "../db";

const SLUG_SEPARATOR = "-";

interface DeepLConfigRow {
  deepl_api_key_encrypted: StoredEncryptedSecret | null;
}

export function normalizeSlug(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, SLUG_SEPARATOR)
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, SLUG_SEPARATOR);
}

export function createPinyinSlug(value: string) {
  const converted = pinyin(value, {
    toneType: "none",
    type: "array",
    nonZh: "consecutive",
  }).join(SLUG_SEPARATOR);

  return normalizeSlug(converted || value);
}

export function withSlugSuffix(slug: string, index: number) {
  return index <= 1 ? slug : `${slug}-${index}`;
}

export async function createUniqueSlug(
  baseValue: string,
  exists: (slug: string) => boolean | Promise<boolean>
) {
  const baseSlug = createPinyinSlug(baseValue) || "post";

  for (let index = 1; index < 1000; index += 1) {
    const candidate = withSlugSuffix(baseSlug, index);
    if (!(await exists(candidate))) return candidate;
  }

  throw new Error("Unable to create unique slug");
}

async function getDeepLApiKey(client: DbClient) {
  const [config] = await client<DeepLConfigRow[]>`
    SELECT deepl_api_key_encrypted
    FROM site_config
    WHERE id = 1
  `;

  return decryptSecret(config?.deepl_api_key_encrypted);
}

export async function translateTextForSlug(value: string, client: DbClient) {
  const apiKey = await getDeepLApiKey(client);
  if (!apiKey) return null;

  const endpoint = apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: [value],
        target_lang: "EN",
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      translations?: Array<{ text?: string }>;
    };

    return data.translations?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

export async function createDeepLPreferredSlug(
  value: string,
  client: DbClient,
  fallback: string
) {
  const translated = await translateTextForSlug(value, client);
  const translatedSlug = translated ? normalizeSlug(translated) : "";

  return translatedSlug || createPinyinSlug(value) || fallback;
}
