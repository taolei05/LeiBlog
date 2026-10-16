import { resolveApiBaseUrl } from "./api-base-url";
import { uploadFileRequest } from "./upload-request";
import type { UploadProgressHandler } from "./upload-request";

export const subscriptionCategories = [
  "domain",
  "server",
  "membership",
  "software",
  "other",
] as const;
export const subscriptionCurrencies = ["CNY", "HKD", "USD", "EUR", "GBP", "JPY"] as const;
export type SubscriptionCurrency = (typeof subscriptionCurrencies)[number];
export const subscriptionRenewalTypes = ["automatic", "manual", "perpetual"] as const;
export type SubscriptionInput = {
  name: string;
  serviceUrl: string;
  category: (typeof subscriptionCategories)[number];
  details: string;
  startDate: string;
  expiryDate: string | null;
  initialPrice: string;
  renewalPrice: string;
  initialCurrency: SubscriptionCurrency;
  renewalCurrency: SubscriptionCurrency;
  renewalType: (typeof subscriptionRenewalTypes)[number];
  notes: string;
  reminderEnabled: boolean;
  reminderDays: number;
  reminderTimes: string[];
};
export type SubscriptionAttachment = {
  id: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
};
export type Subscription = SubscriptionInput & {
  id: string;
  reminderTime: string;
  recipientEmail: string | null;
  status: "normal" | "expiring" | "expired";
  attachments: SubscriptionAttachment[];
  deliveryStatus: "pending" | "sent" | "skipped" | "failed" | null;
  createdAt: string;
  updatedAt: string;
};
export type ExchangeRates = {
  base: "USD";
  rates: Record<(typeof subscriptionCurrencies)[number], number>;
  updatedAt: string;
  nextUpdateAt: string;
};
export type SubscriptionList = {
  ok: true;
  items: Subscription[];
  total: number;
  page: number;
  pageSize: number;
  timeZone: string;
};

const base = resolveApiBaseUrl({
  configuredUrl: import.meta.env.VITE_API_BASE_URL,
  isProduction: import.meta.env.PROD,
  location: typeof window === "undefined" ? undefined : window.location,
});
const endpoint = `${base}/api/admin/subscriptions`;
const headersFor = (token: string): Record<string, string> =>
  token.trim() ? { Authorization: `Bearer ${token}` } : {};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const dateValid = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
export const getSubscriptionServiceUrl = (value: string) => {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      ? url
      : undefined;
  } catch {
    return undefined;
  }
};
export const isSubscriptionAttachment = (value: unknown): value is SubscriptionAttachment =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.fileName === "string" &&
  typeof value.fileSize === "number" &&
  Number.isInteger(value.fileSize) &&
  value.fileSize > 0 &&
  value.fileSize <= 5242880 &&
  dateValid(value.createdAt);
export const isSubscription = (value: unknown): value is Subscription => {
  if (!isRecord(value)) return false;
  return (
    [
      "id",
      "name",
      "serviceUrl",
      "details",
      "notes",
      "initialPrice",
      "renewalPrice",
      "reminderTime",
    ].every((key) => typeof value[key] === "string") &&
    subscriptionCategories.some((item) => item === value.category) &&
    subscriptionCurrencies.some((item) => item === value.initialCurrency) &&
    subscriptionCurrencies.some((item) => item === value.renewalCurrency) &&
    subscriptionRenewalTypes.some((item) => item === value.renewalType) &&
    ["normal", "expiring", "expired"].includes(String(value.status)) &&
    [null, "pending", "sent", "skipped", "failed"].includes(
      value.deliveryStatus as string | null,
    ) &&
    (value.recipientEmail === null || typeof value.recipientEmail === "string") &&
    dateValid(value.startDate) &&
    (value.expiryDate === null || dateValid(value.expiryDate)) &&
    typeof value.reminderEnabled === "boolean" &&
    typeof value.reminderDays === "number" &&
    Number.isInteger(value.reminderDays) &&
    value.reminderDays >= 0 &&
    value.reminderDays <= 365 &&
    typeof value.reminderTime === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(value.reminderTime) &&
    Array.isArray(value.reminderTimes) &&
    value.reminderTimes.length >= 1 &&
    value.reminderTimes.length <= 12 &&
    new Set(value.reminderTimes).size === value.reminderTimes.length &&
    value.reminderTimes.every(
      (time: unknown) => typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time),
    ) &&
    Array.isArray(value.attachments) &&
    value.attachments.every(isSubscriptionAttachment) &&
    dateValid(value.createdAt) &&
    dateValid(value.updatedAt)
  );
};
export const isExchangeRates = (value: unknown): value is ExchangeRates => {
  if (!isRecord(value) || !isRecord(value.rates)) return false;
  const rates = value.rates;
  return (
    value.base === "USD" &&
    dateValid(value.updatedAt) &&
    dateValid(value.nextUpdateAt) &&
    subscriptionCurrencies.every(
      (currency) =>
        typeof rates[currency] === "number" &&
        Number.isFinite(rates[currency]) &&
        rates[currency] > 0,
    )
  );
};
const read = async (response: Response): Promise<unknown> => {
  const body: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      isRecord(body) && typeof body.message === "string"
        ? body.message
        : "Request failed. / 请求失败。",
    );
  return body;
};
const request = async (path: string, token: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  if (token.trim()) headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");
  return read(
    await fetch(`${endpoint}${path}`, {
      ...init,
      credentials: "include",
      headers,
    }),
  );
};
export const getSubscriptions = async ({
  token,
  search,
  category,
  status,
  page,
  pageSize = 12,
  signal,
}: {
  token: string;
  search: string;
  category: string;
  status: string;
  page: number;
  pageSize?: number;
  signal?: AbortSignal;
}): Promise<SubscriptionList> => {
  const body = await request(
    `/?${new URLSearchParams({ search, category, status, page: String(page), pageSize: String(pageSize) })}`,
    token,
    { signal },
  );
  if (
    !isRecord(body) ||
    body.ok !== true ||
    !Array.isArray(body.items) ||
    !body.items.every(isSubscription) ||
    !Number.isInteger(body.total) ||
    typeof body.page !== "number" ||
    typeof body.pageSize !== "number" ||
    typeof body.timeZone !== "string"
  )
    throw new Error("Invalid subscription response.");
  return {
    ok: true,
    items: body.items,
    total: body.total as number,
    page: body.page,
    pageSize: body.pageSize,
    timeZone: body.timeZone,
  };
};
export const saveSubscription = async ({
  id,
  token,
  input,
}: {
  id?: string;
  token: string;
  input: SubscriptionInput;
}) => {
  const result = await request(id ? `/${id}` : "/", token, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify({
      name: input.name,
      serviceUrl: input.serviceUrl,
      category: input.category,
      details: input.details,
      startDate: input.startDate,
      expiryDate: input.expiryDate,
      initialPrice: input.initialPrice,
      renewalPrice: input.renewalPrice,
      initialCurrency: input.initialCurrency,
      renewalCurrency: input.renewalCurrency,
      renewalType: input.renewalType,
      notes: input.notes,
      reminderEnabled: input.reminderEnabled,
      reminderDays: input.reminderDays,
      reminderTimes: input.reminderTimes,
    } satisfies SubscriptionInput),
  });
  if (!isRecord(result) || result.ok !== true || typeof result.id !== "string")
    throw new Error("Invalid subscription response.");
  return result.id;
};
export const deleteSubscription = async ({ id, token }: { id: string; token: string }) =>
  request(`/${id}`, token, { method: "DELETE" });
export const getSubscriptionRates = async (token: string): Promise<ExchangeRates> => {
  const body = await request("/exchange-rates", token);
  if (!isRecord(body) || body.ok !== true || !isExchangeRates(body.item))
    throw new Error("Invalid exchange rate response.");
  return body.item;
};
export const uploadSubscriptionAttachment = async ({
  id,
  token,
  file,
  onProgress,
}: {
  id: string;
  token: string;
  file: File;
  onProgress?: UploadProgressHandler;
}) => {
  const body = new FormData();
  body.set("file", file);
  return uploadFileRequest({
    url: `${endpoint}/${id}/attachments`,
    body,
    file,
    headers: headersFor(token),
    onProgress,
    readResponse: async (response) => {
      const body = await read(response);
      if (!isRecord(body) || body.ok !== true || !isSubscriptionAttachment(body.item))
        throw new Error("Invalid attachment response.");
      return body.item;
    },
  });
};
export const removeSubscriptionAttachment = async ({
  id,
  attachmentId,
  token,
}: {
  id: string;
  attachmentId: string;
  token: string;
}) => request(`/${id}/attachments/${attachmentId}`, token, { method: "DELETE" });
export const downloadSubscriptionAttachment = async ({
  id,
  attachmentId,
  token,
}: {
  id: string;
  attachmentId: string;
  token: string;
}) => {
  const response = await fetch(`${endpoint}/${id}/attachments/${attachmentId}`, {
    credentials: "include",
    headers: headersFor(token),
  });
  if (!response.ok) {
    await read(response);
    throw new Error("Download failed.");
  }
  return response.blob();
};

export const convertSubscriptionPrice = (
  price: string,
  from: SubscriptionCurrency,
  to: SubscriptionCurrency,
  rates: ExchangeRates,
) => {
  // Original money is stored as decimal text. Converted figures are display-only estimates.
  return (Number(price) / rates.rates[from]) * rates.rates[to];
};
