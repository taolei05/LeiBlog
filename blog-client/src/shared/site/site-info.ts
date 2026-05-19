import type { ResolvedTheme } from "../theme/ThemeProviderLite";

import { getPublicApiBaseUrl, resolveApiAssetUrl } from "../api/api-base-url";

export type PublicSiteInfo = {
  description: string;
  establishedAt: string;
  faviconUrl?: string;
  logoDarkUrl?: string;
  logoLightUrl?: string;
  siteName: string;
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

function toPublicSiteInfo(value: unknown): PublicSiteInfo {
  if (!isRecord(value)) throw new Error("站点信息格式无效");

  return {
    description: readString(value, "description"),
    establishedAt: readString(value, "establishedAt"),
    faviconUrl: resolveApiAssetUrl(readOptionalString(value, "faviconUrl")),
    logoDarkUrl: resolveApiAssetUrl(readOptionalString(value, "logoDarkUrl")),
    logoLightUrl: resolveApiAssetUrl(readOptionalString(value, "logoLightUrl")),
    siteName: readString(value, "siteName"),
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
