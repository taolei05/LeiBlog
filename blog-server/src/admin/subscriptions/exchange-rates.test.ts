import { describe, expect, test } from "bun:test";
import { fetchExchangeRates } from "./exchange-rates";

const fixture = () => ({
  result: "success",
  base_code: "USD",
  time_last_update_unix: Math.floor(Date.now() / 1000) - 60,
  time_next_update_unix: Math.floor(Date.now() / 1000) + 3600,
  conversion_rates: { USD: 1, CNY: 7, HKD: 7.8, EUR: 0.9, GBP: 0.8, JPY: 150 },
});
const provider = (value: unknown): typeof fetch =>
  Object.assign(async () => Response.json(value), { preconnect: () => {} });
describe("ExchangeRate provider boundary", () => {
  test("accepts all requested currencies and provider timestamps", async () => {
    const result = await fetchExchangeRates({
      apiKey: "synthetic-api-key",
      fetcher: provider(fixture()),
    });
    expect(result.conversion_rates.JPY).toBe(150);
  });
  test("rejects wrong bases, incomplete rates, nonpositive rates and expired timestamps", async () => {
    for (const value of [
      { ...fixture(), base_code: "EUR" },
      { ...fixture(), conversion_rates: { USD: 1 } },
      { ...fixture(), conversion_rates: { ...fixture().conversion_rates, CNY: 0 } },
      { ...fixture(), time_next_update_unix: 1 },
      { result: "error", "error-type": "invalid-key" },
    ]) {
      await expect(
        fetchExchangeRates({ apiKey: "synthetic-api-key", fetcher: provider(value) }),
      ).rejects.toThrow("ExchangeRate request failed");
    }
  });
  test("never propagates errors containing provider credential URLs", async () => {
    const fetcher: typeof fetch = Object.assign(
      async () => {
        throw new Error("https://v6.exchangerate-api.com/v6/secret-api-key/latest/USD");
      },
      { preconnect: () => {} },
    );
    let message = "";
    try {
      await fetchExchangeRates({ apiKey: "secret-api-key", fetcher });
    } catch (error) {
      message = String(error);
    }
    expect(message).not.toContain("secret-api-key");
    expect(message).toContain("ExchangeRate request failed");
  });
});
