import { createHash } from "node:crypto";
import { Value } from "@sinclair/typebox/value";
import { t } from "elysia";
import type { Static } from "elysia";
import { getRedisClient } from "../../shared/db/redis";
import { readEncryptedSetting } from "../settings/service";
import { subscriptionCurrencies, SubscriptionError } from "./domain";

const rate = t.Number({ exclusiveMinimum: 0, maximum: 1e9 });
export const exchangeRateSchema = t.Object({
  result: t.Literal("success"),
  base_code: t.Literal("USD"),
  time_last_update_unix: t.Integer({ minimum: 1 }),
  time_next_update_unix: t.Integer({ minimum: 1 }),
  conversion_rates: t.Object({
    CNY: rate,
    HKD: rate,
    USD: t.Literal(1),
    EUR: rate,
    GBP: rate,
    JPY: rate,
  }),
});
type ProviderRates = Static<typeof exchangeRateSchema>;
export const fetchExchangeRates = async ({
  apiKey,
  fetcher = fetch,
}: {
  apiKey: string;
  fetcher?: typeof fetch;
}) => {
  if (!/^[A-Za-z0-9_-]{8,200}$/.test(apiKey))
    throw new SubscriptionError("Invalid ExchangeRate API key. / ExchangeRate 密钥格式无效。");
  try {
    const response = await fetcher(
      `https://v6.exchangerate-api.com/v6/${encodeURIComponent(apiKey)}/latest/USD`,
      {
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      },
    );
    const body: unknown = await response.json();
    if (!response.ok || !Value.Check(exchangeRateSchema, body))
      throw new Error("Invalid provider response");
    if (
      body.time_next_update_unix <= Math.floor(Date.now() / 1000) ||
      body.time_next_update_unix <= body.time_last_update_unix ||
      body.time_last_update_unix * 1000 > Date.now() + 300000
    )
      throw new Error("Invalid provider timestamps");
    return body;
  } catch {
    // Do not return fetch errors: the provider URL contains a credential.
    throw new SubscriptionError(
      "ExchangeRate request failed. Check key, account and quota. / 汇率请求失败，请检查密钥、账户与额度。",
    );
  }
};

const pendingRates = new Map<string, Promise<ProviderRates>>();
export const getExchangeRates = async ({
  apiKey: inputKey,
  forceRefresh = false,
}: { apiKey?: string; forceRefresh?: boolean } = {}) => {
  const apiKey = inputKey?.trim() || (await readEncryptedSetting("exchange_rate_api_key"));
  if (apiKey === undefined)
    throw new SubscriptionError(
      "Configure ExchangeRate API Key in Site Settings. / 请先在站点设置配置 ExchangeRate API Key。",
    );
  const key = `subscriptions:rates:${createHash("sha256").update(apiKey).digest("hex")}`;
  const redis = await getRedisClient();
  let data: ProviderRates | undefined;
  // Explicit key tests bypass cached credentials, but normal reads reuse provider data.
  if (!forceRefresh && !inputKey?.trim()) {
    const cached = await redis.get(key);
    if (cached !== null) {
      try {
        const value: unknown = JSON.parse(cached);
        if (
          Value.Check(exchangeRateSchema, value) &&
          value.time_next_update_unix * 1000 > Date.now()
        )
          data = value;
      } catch {
        /* Expired or invalid cache is refreshed from the provider. */
      }
    }
  }
  if (data === undefined) {
    let request = pendingRates.get(key);
    if (request === undefined) {
      request = fetchExchangeRates({ apiKey });
      pendingRates.set(key, request);
    }
    try {
      data = await request;
      const ttl = Math.max(
        60,
        Math.min(86400, data.time_next_update_unix - Math.floor(Date.now() / 1000)),
      );
      await redis.set(key, JSON.stringify(data), { EX: ttl });
    } finally {
      pendingRates.delete(key);
    }
  }
  return {
    base: "USD" as const,
    rates: Object.fromEntries(
      subscriptionCurrencies.map((currency) => [currency, data.conversion_rates[currency]]),
    ),
    updatedAt: new Date(data.time_last_update_unix * 1000).toISOString(),
    nextUpdateAt: new Date(data.time_next_update_unix * 1000).toISOString(),
  };
};
