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

export type PublicSiteConfig = {
  commentsEnabled: boolean;
  copyright: string;
  resendDomain: string | null;
  seoDescription: string;
  seoKeywords: string[];
  seoTitle: string;
};

export type PublicSiteFilingRecord = {
  number: string;
  url: string | null;
};

export type PublicSiteFiling = {
  icpNumber: string | null;
  icpRecords: PublicSiteFilingRecord[];
  icpUrl: string | null;
  policeNumber: string | null;
  policeUrl: string | null;
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

function toPublicSiteConfig(value: unknown): PublicSiteConfig {
  if (!isRecord(value)) throw new Error("站点配置格式无效");

  const commentsEnabled = value.commentsEnabled;
  if (typeof commentsEnabled !== "boolean") throw new Error("接口字段 commentsEnabled 不是布尔值");

  return {
    commentsEnabled,
    copyright: readString(value, "copyright"),
    resendDomain: readNullableString(value, "resendDomain"),
    seoDescription: readString(value, "seoDescription"),
    seoKeywords: readStringArray(value, "seoKeywords"),
    seoTitle: readString(value, "seoTitle"),
  };
}

function toPublicSiteFilingRecord(value: unknown): PublicSiteFilingRecord {
  if (!isRecord(value)) throw new Error("ICP备案格式无效");

  return {
    number: readString(value, "number"),
    url: readNullableString(value, "url"),
  };
}

function toPublicSiteFiling(value: unknown): PublicSiteFiling {
  if (!isRecord(value)) throw new Error("备案信息格式无效");

  const records = value.icpRecords;
  if (!Array.isArray(records)) throw new Error("接口字段 icpRecords 不是数组");

  return {
    icpNumber: readNullableString(value, "icpNumber"),
    icpRecords: records.map(toPublicSiteFilingRecord),
    icpUrl: readNullableString(value, "icpUrl"),
    policeNumber: readNullableString(value, "policeNumber"),
    policeUrl: readNullableString(value, "policeUrl"),
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

export async function fetchPublicSiteConfig() {
  const response = await fetch(`${publicApiBaseUrl}/site/config`);
  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new Error("站点配置读取失败");
  }

  if (!isRecord(payload)) {
    throw new Error("站点配置响应格式无效");
  }

  return toPublicSiteConfig(payload.item);
}

export async function fetchPublicSiteFiling() {
  const response = await fetch(`${publicApiBaseUrl}/site/filing`);
  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new Error("备案信息读取失败");
  }

  if (!isRecord(payload)) {
    throw new Error("备案信息响应格式无效");
  }

  return toPublicSiteFiling(payload.item);
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
