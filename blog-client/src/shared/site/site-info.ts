import type { ResolvedTheme } from "../theme/ThemeProviderLite";

import { getPublicApiBaseUrl, resolveApiAssetUrl } from "../api/api-base-url";

export type PublicSiteInfo = {
  description: string;
  establishedAt: string;
  faviconUrl?: string;
  homeCoverUrls: string[];
  homeSlogan: string;
  logoDarkUrl?: string;
  logoLightUrl?: string;
  siteName: string;
};

export type PublicSiteAuthor = {
  avatarUrl: string | null;
  blogUrl: string | null;
  description: string;
  name: string | null;
  socialLinks: Record<string, string>;
  tags: string[];
  username: string;
};

const publicApiBaseUrl = getPublicApiBaseUrl();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  if (typeof value !== "string") throw new Error(`接口字段 ${key} 不是字符串`);
  return value;
}

function readOptionalString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`接口字段 ${key} 不是字符串`);
  return value;
}

function readNullableString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`接口字段 ${key} 不是字符串`);
  return value;
}

function readStringArray(source: Record<string, unknown>, key: string) {
  const value = source[key];
  if (!Array.isArray(value)) throw new Error(`接口字段 ${key} 不是数组`);

  return value.map((item) => {
    if (typeof item !== "string") throw new Error(`接口字段 ${key} 的成员不是字符串`);
    return item;
  });
}

function readOptionalStringArray(source: Record<string, unknown>, key: string) {
  const value = source[key];
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`接口字段 ${key} 不是数组`);

  return value.map((item) => {
    if (typeof item !== "string") throw new Error(`接口字段 ${key} 的成员不是字符串`);
    return item;
  });
}

function readStringRecord(source: Record<string, unknown>, key: string) {
  const value = source[key];
  if (!isRecord(value)) throw new Error(`接口字段 ${key} 不是对象`);

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function resolveAssetUrlList(values: string[]) {
  return [
    ...new Set(
      values
        .map((value) => resolveApiAssetUrl(value))
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}

function toPublicSiteInfo(value: unknown): PublicSiteInfo {
  if (!isRecord(value)) throw new Error("站点信息格式无效");

  const homeCoverUrls = resolveAssetUrlList(readOptionalStringArray(value, "homeCoverUrls"));

  return {
    description: readString(value, "description"),
    establishedAt: readString(value, "establishedAt"),
    faviconUrl: resolveApiAssetUrl(readOptionalString(value, "faviconUrl")),
    homeCoverUrls,
    homeSlogan: readString(value, "homeSlogan"),
    logoDarkUrl: resolveApiAssetUrl(readOptionalString(value, "logoDarkUrl")),
    logoLightUrl: resolveApiAssetUrl(readOptionalString(value, "logoLightUrl")),
    siteName: readString(value, "siteName"),
  };
}

function toPublicSiteAuthor(value: unknown): PublicSiteAuthor {
  if (!isRecord(value)) throw new Error("作者信息格式无效");

  return {
    avatarUrl: resolveApiAssetUrl(readNullableString(value, "avatarUrl")) ?? null,
    blogUrl: readNullableString(value, "blogUrl"),
    description: readString(value, "description"),
    name: readNullableString(value, "name"),
    socialLinks: readStringRecord(value, "socialLinks"),
    tags: readStringArray(value, "tags"),
    username: readString(value, "username"),
  };
}

export async function fetchPublicSiteInfo() {
  const response = await fetch(`${publicApiBaseUrl}/site/info`);
  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new Error("站点信息读取失败");
  }

  if (!isRecord(payload)) {
    throw new Error("站点信息响应格式无效");
  }

  return toPublicSiteInfo(payload.item);
}

export async function fetchPublicSiteAuthor() {
  const response = await fetch(`${publicApiBaseUrl}/site/author`);
  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new Error("作者信息读取失败");
  }

  if (!isRecord(payload)) {
    throw new Error("作者信息响应格式无效");
  }

  return toPublicSiteAuthor(payload.item);
}

export function getPreferredSiteLogo(
  siteInfo: PublicSiteInfo | undefined,
  resolvedTheme: ResolvedTheme,
) {
  if (!siteInfo) return undefined;

  return resolvedTheme === "dark"
    ? (siteInfo.logoDarkUrl ?? siteInfo.logoLightUrl)
    : (siteInfo.logoLightUrl ?? siteInfo.logoDarkUrl);
}

export function applyFavicon(faviconUrl: string | undefined) {
  if (!faviconUrl || typeof document === "undefined") return;

  const existingLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  const link = existingLink ?? document.createElement("link");

  link.rel = "icon";
  link.href = faviconUrl;

  if (!existingLink) {
    document.head.append(link);
  }
}
