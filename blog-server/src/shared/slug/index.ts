import { pinyin } from "pinyin-pro";

const SLUG_SEPARATOR = "-";

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
