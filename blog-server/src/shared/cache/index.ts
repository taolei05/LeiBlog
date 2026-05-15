import { createHash } from "node:crypto";

import { getRedis } from "../redis";

const DEFAULT_TTL_SECONDS = 60 * 5;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => [key, stableValue(entryValue)])
  );
}

export function createCacheHash(value: unknown) {
  return createHash("sha1")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex")
    .slice(0, 16);
}

export async function cacheGetJson<T>(key: string) {
  try {
    const client = await getRedis();
    const value = await client.get(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSetJson(
  key: string,
  value: unknown,
  ttlSeconds = DEFAULT_TTL_SECONDS
) {
  try {
    const client = await getRedis();
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch {
    // Redis is an optimization layer. Reads must still work when it is down.
  }
}

export async function cacheRememberJson<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSeconds = DEFAULT_TTL_SECONDS
) {
  const cached = await cacheGetJson<T>(key);
  if (cached) return cached;

  const value = await loader();
  await cacheSetJson(key, value, ttlSeconds);
  return value;
}

export async function cacheDelete(keys: Array<string | null | undefined>) {
  const cleanKeys = [...new Set(keys.filter(Boolean) as string[])];
  if (cleanKeys.length === 0) return 0;

  try {
    const client = await getRedis();
    let deleted = 0;

    for (const key of cleanKeys) {
      deleted += await client.del(key);
    }

    return deleted;
  } catch {
    return 0;
  }
}

export async function cacheDeleteByPattern(pattern: string) {
  try {
    const client = await getRedis();
    let deleted = 0;

    for await (const keys of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      deleted += await cacheDelete(keys.map((key) => String(key)));
    }

    return deleted;
  } catch {
    return 0;
  }
}
