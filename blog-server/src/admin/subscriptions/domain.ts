import { t } from "elysia";
import type { Static } from "elysia";

export const subscriptionCategories = [
  "domain",
  "server",
  "membership",
  "software",
  "other",
] as const;
export const subscriptionCurrencies = ["CNY", "HKD", "USD", "EUR", "GBP", "JPY"] as const;
export const subscriptionRenewalTypes = ["automatic", "manual", "perpetual"] as const;
const dateSchema = t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" });
const priceSchema = t.String({ pattern: "^\\d{1,10}(\\.\\d{1,2})?$" });
export const subscriptionInputSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 160 }),
  serviceUrl: t.String({ maxLength: 2048 }),
  category: t.Union(subscriptionCategories.map((value) => t.Literal(value))),
  details: t.String({ maxLength: 10000 }),
  startDate: dateSchema,
  expiryDate: t.Nullable(dateSchema),
  initialPrice: priceSchema,
  renewalPrice: priceSchema,
  currency: t.Union(subscriptionCurrencies.map((value) => t.Literal(value))),
  renewalType: t.Union(subscriptionRenewalTypes.map((value) => t.Literal(value))),
  notes: t.String({ maxLength: 10000 }),
  reminderEnabled: t.Boolean(),
  reminderDays: t.Integer({ minimum: 0, maximum: 365 }),
  reminderTime: t.String({ pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" }),
});
export type SubscriptionInput = Static<typeof subscriptionInputSchema>;

export class SubscriptionError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

const isDateValid = (date: string) => {
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === date &&
    date >= "1900-01-01" &&
    date <= "9999-12-31"
  );
};

export const normalizeSubscription = (input: SubscriptionInput): SubscriptionInput => {
  const name = input.name.trim();
  const serviceUrl = input.serviceUrl.trim();
  if (!name) throw new SubscriptionError("Service name is required. / 请填写服务名称。");
  if (serviceUrl) {
    let url: URL;
    try {
      url = new URL(serviceUrl);
    } catch {
      throw new SubscriptionError("Invalid service URL. / 服务链接无效。");
    }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
      throw new SubscriptionError(
        "Use an HTTP(S) URL without credentials. / 请使用不含账号密码的 HTTP(S) 链接。",
      );
  }
  const expiryDate = input.renewalType === "perpetual" ? null : input.expiryDate;
  if (
    !isDateValid(input.startDate) ||
    (expiryDate !== null && !isDateValid(expiryDate)) ||
    (input.renewalType !== "perpetual" && expiryDate === null) ||
    (expiryDate !== null && expiryDate < input.startDate)
  )
    throw new SubscriptionError("Check start and expiry dates. / 请检查开始日期与到期日期。");
  return {
    ...input,
    name,
    serviceUrl,
    expiryDate,
    reminderEnabled: expiryDate !== null && input.reminderEnabled,
  };
};

export const getSubscriptionStatus = ({
  expiryDate,
  today,
  reminderDays,
}: {
  expiryDate: string | null;
  today: string;
  reminderDays: number;
}): "normal" | "expiring" | "expired" => {
  if (expiryDate === null) return "normal";
  if (expiryDate < today) return "expired";
  const days =
    (Date.parse(`${expiryDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
  return days <= reminderDays ? "expiring" : "normal";
};
