import { getPublicApiBaseUrl, resolveApiAssetUrl } from "../../../shared/api/api-base-url";

export type NavigationItem = {
  iconUrl: string | null;
  id: string;
  name: string;
  note: string | null;
  url: string;
};

export type NavigationGroup = {
  id: string;
  items: NavigationItem[];
  name: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  if (typeof value !== "string") throw new Error(`导航接口字段 ${key} 不是字符串`);
  return value;
}

function readNullableString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`导航接口字段 ${key} 不是字符串`);
  return value;
}

function normalizeItem(value: unknown): NavigationItem {
  if (!isRecord(value)) throw new Error("导航网站格式无效");

  return {
    iconUrl: resolveApiAssetUrl(readNullableString(value, "iconUrl")) ?? null,
    id: readString(value, "id"),
    name: readString(value, "name"),
    note: readNullableString(value, "note"),
    url: readString(value, "url"),
  };
}

export function normalizeNavigationGroups(payload: unknown): NavigationGroup[] {
  if (!isRecord(payload) || !Array.isArray(payload.groups)) {
    throw new Error("导航页响应格式无效");
  }

  return payload.groups
    .map((value) => {
      if (!isRecord(value) || !Array.isArray(value.items)) {
        throw new Error("导航分组格式无效");
      }
      return {
        id: readString(value, "id"),
        items: value.items.map(normalizeItem),
        name: readString(value, "name"),
      };
    })
    .filter((group) => group.items.length > 0);
}

export async function fetchPublicNavigation() {
  const response = await fetch(`${getPublicApiBaseUrl()}/navigation`);
  if (!response.ok) throw new Error(`导航页请求失败：${response.status}`);
  return normalizeNavigationGroups(await response.json());
}
