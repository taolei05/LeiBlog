import type { StoredEncryptedSecret } from "../crypto";
import { decryptSecret } from "../crypto";
import type { DbClient } from "../db";

interface LocationConfigRow {
  deepl_api_key_encrypted: StoredEncryptedSecret | null;
  ipgeolocation_api_key_encrypted: StoredEncryptedSecret | null;
}

function readJsonText(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" && field.trim() ? field.trim() : null;
}

export function describeLocation(value: unknown) {
  const location = readJsonText(value, "location");
  if (location) return location;

  const city = readJsonText(value, "city");
  const country = readJsonText(value, "country_name") ?? readJsonText(value, "country");
  const parts = [country, city].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function withLocationText(location: Record<string, unknown>, text: string) {
  return { ...location, location: text };
}

async function localizeLocation(
  location: Record<string, unknown>,
  apiKey: string | null
) {
  const sourceText = describeLocation(location);
  if (!sourceText) return location;
  if (!apiKey) return withLocationText(location, sourceText);

  const endpoint = apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";

  try {
    const response = await fetch(endpoint, {
      body: JSON.stringify({
        target_lang: "ZH-HANS",
        text: [sourceText],
      }),
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return withLocationText(location, sourceText);

    const payload = (await response.json()) as {
      translations?: Array<{ text?: string }>;
    };
    const translatedText = payload.translations?.[0]?.text?.trim();
    return withLocationText(location, translatedText || sourceText);
  } catch {
    return withLocationText(location, sourceText);
  }
}

export async function resolveLocalizedIpLocation(ip: string, client: DbClient) {
  const [config] = await client<LocationConfigRow[]>`
    SELECT deepl_api_key_encrypted, ipgeolocation_api_key_encrypted
    FROM site_config
    WHERE id = 1
  `;
  const ipGeolocationApiKey = decryptSecret(config?.ipgeolocation_api_key_encrypted);
  if (!ipGeolocationApiKey) return null;

  const apiUrl = new URL("https://api.ipgeolocation.io/ipgeo");
  apiUrl.searchParams.set("apiKey", ipGeolocationApiKey);
  apiUrl.searchParams.set("ip", ip);
  apiUrl.searchParams.set("lang", "cn");

  try {
    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;

    const location: unknown = await response.json();
    if (!location || typeof location !== "object" || Array.isArray(location)) return null;

    return localizeLocation(
      location as Record<string, unknown>,
      decryptSecret(config?.deepl_api_key_encrypted)
    );
  } catch {
    return null;
  }
}
