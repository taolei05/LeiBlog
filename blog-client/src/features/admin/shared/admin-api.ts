import { getAdminApiBaseUrl } from "../../../shared/api/api-base-url";

export const ADMIN_SESSION_STORAGE_KEY = "leiblog:admin-session";

export type AdminRole = "admin" | "demo" | "user";

export type AdminUser = {
  avatarUrl: string | null;
  email: string | null;
  id: string;
  name: string | null;
  role: AdminRole;
  username: string;
};

export type AdminSession = {
  token: string;
  user: AdminUser;
};

export type SetupStepKey =
  | "admin"
  | "complete"
  | "completed"
  | "filing"
  | "site-config"
  | "site-info";

export type SetupStatus = {
  completedAt: string | null;
  currentStep: SetupStepKey;
  isCompleted: boolean;
  ok: boolean;
};

type RequestOptions = {
  body?: FormData | Record<string, unknown>;
  method?: "DELETE" | "GET" | "PATCH" | "POST";
  requireAuth?: boolean;
};

const API_BASE_URL = getAdminApiBaseUrl();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  if (typeof value !== "string") throw new Error(`接口字段 ${key} 格式无效`);
  return value;
}

function readNullableString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`接口字段 ${key} 格式无效`);
  return value;
}

function readBoolean(source: Record<string, unknown>, key: string) {
  const value = source[key];
  if (typeof value !== "boolean") throw new Error(`接口字段 ${key} 格式无效`);
  return value;
}

function readAdminRole(value: unknown): AdminRole {
  if (value === "admin" || value === "demo" || value === "user") return value;
  throw new Error("用户角色格式无效");
}

function parseAdminUser(value: unknown): AdminUser {
  if (!isRecord(value)) throw new Error("用户信息格式无效");

  return {
    avatarUrl: readNullableString(value, "avatarUrl"),
    email: readNullableString(value, "email"),
    id: readString(value, "id"),
    name: readNullableString(value, "name"),
    role: readAdminRole(value.role),
    username: readString(value, "username"),
  };
}

export function readStoredAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    return {
      token: readString(parsed, "token"),
      user: parseAdminUser(parsed.user),
    };
  } catch {
    return null;
  }
}

export function writeAdminSession(session: AdminSession) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearAdminSession() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  window.localStorage.removeItem("leiblog:admin-authenticated");
  window.localStorage.removeItem("leiblog:admin-role");
}

function buildHeaders(body: RequestOptions["body"], requireAuth: boolean) {
  const headers = new Headers();
  const session = readStoredAdminSession();

  if (!(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (requireAuth && session?.token) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }

  return headers;
}

export function getAdminApiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

export async function adminFetch<T>(path: string, options: RequestOptions = {}) {
  const method = options.method ?? "GET";
  const body =
    options.body instanceof FormData
      ? options.body
      : options.body
        ? JSON.stringify(options.body)
        : undefined;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    body,
    headers: buildHeaders(options.body, options.requireAuth ?? true),
    method,
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      isRecord(payload) && typeof payload.message === "string" ? payload.message : "请求失败";
    throw new Error(message);
  }

  return payload as T;
}

export async function downloadAdminFile(path: string, fileName: string) {
  const response = await fetch(getAdminApiUrl(path), {
    headers: buildHeaders(undefined, true),
    method: "GET",
  });

  if (!response.ok) {
    throw new Error("文件下载失败");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function uploadAdminMediaFile({
  file,
  fileName,
  folderSlug,
}: {
  file: File;
  fileName?: string;
  folderSlug: string;
}) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("folderSlug", folderSlug);
  if (fileName?.trim()) {
    formData.set("fileName", fileName.trim());
  }

  return adminFetch<{
    item: {
      accessUrl: string;
      id: string;
    };
    ok: boolean;
  }>("/admin/media/", {
    body: formData,
    method: "POST",
  });
}

export async function getSetupStatus() {
  const payload = await adminFetch<unknown>("/admin/setup/status", {
    requireAuth: false,
  });
  if (!isRecord(payload)) throw new Error("初始化状态格式无效");

  return {
    completedAt: readNullableString(payload, "completedAt"),
    currentStep: readString(payload, "currentStep") as SetupStepKey,
    isCompleted: readBoolean(payload, "isCompleted"),
    ok: readBoolean(payload, "ok"),
  };
}

export async function loginAdmin(identifier: string, password: string) {
  const payload = await adminFetch<unknown>("/auth/login", {
    body: { identifier, password },
    method: "POST",
    requireAuth: false,
  });
  if (!isRecord(payload)) throw new Error("登录响应格式无效");

  return {
    token: readString(payload, "token"),
    user: parseAdminUser(payload.user),
  };
}

export async function createDemoSession() {
  const payload = await adminFetch<unknown>("/admin/setup/demo-session", {
    method: "POST",
    requireAuth: false,
  });
  if (!isRecord(payload)) throw new Error("演示会话格式无效");

  return {
    token: readString(payload, "token"),
    user: parseAdminUser(payload.user),
  };
}

export async function completeInitialSetup(input: {
  admin: Record<string, unknown>;
  filing: Record<string, unknown>;
  siteConfig: Record<string, unknown>;
  siteInfo: Record<string, unknown>;
}) {
  await adminFetch("/admin/setup/admin", {
    body: input.admin,
    method: "POST",
    requireAuth: false,
  });
  await adminFetch("/admin/setup/site-info", {
    body: input.siteInfo,
    method: "POST",
    requireAuth: false,
  });
  await adminFetch("/admin/setup/site-config", {
    body: input.siteConfig,
    method: "POST",
    requireAuth: false,
  });
  await adminFetch("/admin/setup/filing", {
    body: input.filing,
    method: "POST",
    requireAuth: false,
  });
  await adminFetch("/admin/setup/complete", {
    method: "POST",
    requireAuth: false,
  });
}
