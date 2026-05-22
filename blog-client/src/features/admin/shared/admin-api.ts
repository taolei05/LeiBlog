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

export type SetupSubmitStepKey = "admin" | "complete" | "filing" | "site-config" | "site-info";

export class SetupSubmitStepError extends Error {
  readonly step: SetupSubmitStepKey;

  constructor(step: SetupSubmitStepKey, label: string, message: string) {
    super(`${label}提交失败：${message}`);
    this.name = "SetupSubmitStepError";
    this.step = step;
  }
}

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

function readNumber(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "number" ? value : null;
}

function parseDetails(details: unknown) {
  if (isRecord(details)) return details;
  if (typeof details !== "string") return null;

  try {
    const parsed: unknown = JSON.parse(details);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getFieldName(path: string | null) {
  const key = path?.replace(/^\//, "").split("/").at(-1) ?? "";
  const names: Record<string, string> = {
    avatarUrl: "头像链接",
    commentsEnabled: "是否开启评论系统",
    copyright: "版权信息",
    deeplApiKey: "DeepL API Key",
    description: "描述",
    email: "邮箱",
    establishedAt: "建站时间",
    faviconUrl: "favicon",
    file: "上传文件",
    folderSlug: "目标文件夹",
    icpNumber: "ICP备案号",
    icpUrl: "ICP备案网址",
    ipgeolocationApiKey: "IPGeolocation API Key",
    logoDarkUrl: "深色 Logo",
    logoLightUrl: "浅色 Logo",
    name: "显示名称",
    password: "密码",
    policeNumber: "公安备案号",
    policeUrl: "公安备案网址",
    resendApiKey: "Resend API Key",
    resendDomain: "Resend 域名",
    seoDescription: "SEO 描述",
    seoKeywords: "SEO 关键词",
    seoTitle: "SEO 标题",
    siteName: "站点名称",
    tags: "个人标签",
    username: "用户名",
  };

  return names[key] ?? (key || "请求字段");
}

function describeValidationIssue(issue: unknown) {
  if (!isRecord(issue)) return null;

  const path = typeof issue.path === "string" ? issue.path : null;
  const message = typeof issue.message === "string" ? issue.message : "";
  const summary = typeof issue.summary === "string" ? issue.summary : "";
  const schema = isRecord(issue.schema) ? issue.schema : {};
  const fieldName = getFieldName(path);
  const minLength = readNumber(schema, "minLength");
  const maxLength = readNumber(schema, "maxLength");
  const maxItems = readNumber(schema, "maxItems");
  const format = typeof schema.format === "string" ? schema.format : null;
  const type = typeof schema.type === "string" ? schema.type : null;
  const text = `${message} ${summary}`;

  if (format === "email") return `${fieldName}格式不正确`;
  if (minLength !== null && text.includes("greater or equal")) {
    return `${fieldName}至少需要 ${minLength} 个字符`;
  }
  if (maxLength !== null && text.includes("smaller or equal")) {
    return `${fieldName}不能超过 ${maxLength} 个字符`;
  }
  if (maxItems !== null && text.includes("Expected array length")) {
    return `${fieldName}最多填写 ${maxItems} 项`;
  }
  if (summary.includes("undefined")) return `${fieldName}不能为空`;
  if (type === "boolean") return `${fieldName}必须是开启或关闭状态`;
  if (type === "array") return `${fieldName}必须是列表格式`;
  if (type === "string") return `${fieldName}必须是文本格式`;

  return `${fieldName}${summary || message || "格式不正确"}`;
}

function readErrorMessage(payload: unknown) {
  if (!isRecord(payload)) return "请求失败";

  const message = typeof payload.message === "string" ? payload.message : "请求失败";
  if (!message.includes("请求参数无效")) return message;

  const details = parseDetails(payload.details);
  const errors = details && Array.isArray(details.errors) ? details.errors : [];
  const issueMessages = errors
    .map(describeValidationIssue)
    .filter((issueMessage): issueMessage is string => Boolean(issueMessage));

  if (issueMessages.length > 0) {
    return `请求参数无效：${issueMessages.join("；")}`;
  }

  return message;
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

  if (body !== undefined && !(body instanceof FormData)) {
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
    throw new Error(readErrorMessage(payload));
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

export async function uploadSetupAsset({
  file,
  fileName,
  folderSlug,
}: {
  file: File;
  fileName?: string;
  folderSlug: "avatars" | "site";
}) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("folderSlug", folderSlug);
  if (fileName?.trim()) {
    formData.set("fileName", fileName.trim());
  }

  const payload = await adminFetch<unknown>("/admin/setup/upload", {
    body: formData,
    method: "POST",
    requireAuth: false,
  });
  if (!isRecord(payload)) throw new Error("初始化上传响应格式无效");

  return {
    accessUrl: readString(payload, "accessUrl"),
    ok: readBoolean(payload, "ok"),
  };
}

export async function completeInitialSetup(input: {
  admin: Record<string, unknown>;
  filing: Record<string, unknown>;
  siteConfig: Record<string, unknown>;
  siteInfo: Record<string, unknown>;
}) {
  await submitSetupStep("admin", "管理员配置", "/admin/setup/admin", input.admin);
  await submitSetupStep("site-info", "站点信息", "/admin/setup/site-info", input.siteInfo);
  await submitSetupStep("site-config", "站点配置", "/admin/setup/site-config", input.siteConfig);
  await submitSetupStep("filing", "备案配置", "/admin/setup/filing", input.filing);
  await submitSetupStep("complete", "完成配置", "/admin/setup/complete");
}

export function isSetupSubmitStepError(error: unknown): error is SetupSubmitStepError {
  return error instanceof SetupSubmitStepError;
}

async function submitSetupStep(
  step: SetupSubmitStepKey,
  label: string,
  path: string,
  body?: Record<string, unknown>,
) {
  try {
    await adminFetch(path, {
      body,
      method: "POST",
      requireAuth: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "请求失败";
    throw new SetupSubmitStepError(step, label, message);
  }
}
